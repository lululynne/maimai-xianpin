import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Catalog, STORE_CODES } from '../src/catalog.js';
import { Repository } from '../src/db.js';
import { Groups, pickHostDefault } from '../src/domain/groups.js';
import { DemoMcpClient } from '../src/mcp/demo.js';
import { sampleMeals } from '../src/sample-meals.js';
import { seedDemoBoard } from '../src/demo-board.js';
import { createApp } from '../src/app.js';

const snapshot = JSON.parse(readFileSync('fixtures/mcp-calls.json', 'utf8'));
function setup(hour = '12') {
  let at = Date.parse(`2026-10-19T${hour}:00:00+08:00`);
  const now = () => at;
  const repo = new Repository(':memory:', 'demo');
  const catalog = new Catalog(new DemoMcpClient(snapshot, now), now, 3000, sampleMeals, now);
  return { now, repo, catalog, groups: new Groups(repo, now), advance: (ms: number) => { at += ms; } };
}

test('demo plaza offers different meals, valid portions and success cards across all stores and periods', async () => {
  for (const hour of ['08', '12', '19']) {
    const { now, repo, catalog, groups } = setup(hour);
    try {
      await seedDemoBoard(catalog, groups, now);
      for (const store of STORE_CODES) {
        const open = groups.list(store).filter(g => g.state === 'open');
        assert.equal(open.length, 5);
        assert.equal(new Set(open.map(g => g.meal.code)).size, 5);
        if (hour !== '08' && store !== '1421248') assert.ok(open.every(g => !g.meal.sample));
        for (const g of open) {
          const host = g.members.find(m => m.id === g.hostId)!;
          assert.ok(g.meal.parts.length - host.partIds.length >= g.people - 1);
          const visitor = groups.view(g, 'visitor');
          assert.equal(visitor.members[0]!.tail4, undefined);
        }
        assert.deepEqual(new Set(groups.done(store).map(g => g.state)), new Set(['full', 'ordered']));
      }
    } finally { repo.close(); }
  }
});

test('expired demo slots rotate once under concurrent refresh without extending old deadlines or replacing joined cards', async () => {
  const { now, repo, catalog, groups, advance } = setup();
  try {
    await seedDemoBoard(catalog, groups, now);
    const initial = groups.list('1420082').filter(g => g.state === 'open');
    const first = initial[0]!;
    const joining = initial.find(g => g.people === 2 && g.deadline - now() > 20 * 60_000)!;
    const used = new Set(joining.members.flatMap(m => m.partIds));
    groups.join(joining.id, 'actual-demo-visitor', { nickname: '正在体验', tail4: '7531', partIds: joining.meal.parts.filter(p => !used.has(p.id)).map(p => p.id) });
    const joinedBefore = structuredClone(groups.get(joining.id));
    advance(10 * 60_000);
    await Promise.all([seedDemoBoard(catalog, groups, now), seedDemoBoard(catalog, groups, now), seedDemoBoard(catalog, groups, now)]);
    const fresh = groups.list('1420082').filter(g => g.state === 'open');
    assert.equal(fresh.length, 5);
    assert.equal(new Set(fresh.map(g => g.meal.code)).size, 5);
    assert.equal(groups.get(first.id).state, 'expired');
    assert.equal(groups.get(first.id).deadline, first.deadline);
    assert.deepEqual(groups.get(joining.id), joinedBefore);
    for (const old of initial.filter(g => g.id !== first.id && g.id !== joining.id)) assert.ok(fresh.some(g => g.id === old.id && g.deadline === old.deadline));
    advance(2 * 60 * 60_000);
    await seedDemoBoard(catalog, groups, now);
    assert.equal(groups.list('1420082').filter(g => g.state === 'open').length, 5);
    assert.deepEqual(new Set(groups.done('1420082').filter(g => g.deadline > now()).map(g => g.state)), new Set(['full', 'ordered']));
  } finally { repo.close(); }
});

test('mine polling replenishes an ended demo with a new ID while live mode never seeds', async () => {
  const { now, repo, catalog, groups, advance } = setup();
  try {
    const app = createApp({ catalog, groups, mode: 'demo', now, speed: 1, capturedAt: '' });
    const cookie = (await app.request('/api/config')).headers.get('set-cookie')!.split(';')[0]!;
    const readMine = async (target = app) => (await target.request('/api/mine?store=1420082', { headers: { Cookie: cookie } })).json();
    const first = (await readMine()).groups[0];
    assert.equal(first.state, 'open');
    advance(70 * 60_000);
    const next = await readMine();
    const old = next.groups.find((g: any) => g.id === first.id);
    const fresh = next.groups.find((g: any) => g.state === 'open');
    assert.equal(old.state, 'expired');
    assert.equal(old.deadline, first.deadline);
    assert.notEqual(fresh.id, first.id);
    assert.ok(fresh.deadline > now());
    advance(70 * 60_000);
    const live = createApp({ catalog, groups, mode: 'live', now, speed: 1, capturedAt: '' });
    const countBefore = repo.all().length;
    assert.ok((await readMine(live)).groups.every((g: any) => g.state !== 'open'));
    assert.equal(repo.all().length, countBefore);
  } finally { repo.close(); }
});

test('upgrading same-meal examples preserves personal and joined cards, then keeps IDs and deadlines on restart', async () => {
  const { now, repo, catalog, groups } = setup();
  try {
    const meal = await catalog.meal('1420082', '9900016136').catch(async () => {
      const menu = await catalog.shareableMenu('1420082');
      return catalog.meal('1420082', menu.find(m => /亲子/.test(m.name))!.code);
    });
    const input = { nickname: '原来的卡片', tail4: '1357', partIds: pickHostDefault(meal), people: 2, minutes: 30 };
    const old = groups.create('demo-host-1420082-0', '1420082', meal, input);
    const own = groups.create('personal-device', '1420082', meal, input);
    const joined = groups.create('demo-host-1420082-1', '1420082', meal, input);
    groups.join(joined.id, 'personal-joiner', { nickname: '已经加入', tail4: '2468', partIds: meal.parts.filter(p => !input.partIds.includes(p.id)).map(p => p.id) });
    const ownBefore = structuredClone(groups.get(own.id)), joinedBefore = structuredClone(groups.get(joined.id));
    await seedDemoBoard(catalog, groups, now);
    assert.equal(groups.get(old.id).state, 'expired');
    assert.deepEqual(groups.get(own.id), ownBefore);
    assert.deepEqual(groups.get(joined.id), joinedBefore);
    const before = groups.list('1420082').map(g => ({ id: g.id, deadline: g.deadline }));
    await seedDemoBoard(catalog, groups, now);
    assert.deepEqual(groups.list('1420082').map(g => ({ id: g.id, deadline: g.deadline })), before);
  } finally { repo.close(); }
});

test('different demo visitors get underrepresented real meals in their own cards', async () => {
  const { now, repo, catalog, groups } = setup();
  try {
    await seedDemoBoard(catalog, groups, now);
    const app = createApp({ catalog, groups, mode: 'demo', now, speed: 1, capturedAt: '' });
    const codes: string[] = [];
    for (let i = 0; i < 2; i++) {
      const cookie = (await app.request('/api/config')).headers.get('set-cookie')!.split(';')[0]!;
      const response = await app.request('/api/demo/mine/seed', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ storeCode: '1420082' }) });
      assert.equal(response.status, 200);
      const mine = await (await app.request('/api/mine', { headers: { Cookie: cookie } })).json();
      assert.equal(mine.groups.length, 1);
      assert.ok(!mine.groups[0].meal.sample);
      codes.push(mine.groups[0].meal.code);
    }
    assert.notEqual(codes[0], codes[1]);
  } finally { repo.close(); }
});
