import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BrowserRepository, type DemoStorage } from '../src/browser/repository.js';
import { createBrowserDemo } from '../src/browser/runtime.js';
import { Repository } from '../src/db.js';
import { pickHostDefault, type Group } from '../src/domain/groups.js';

const snapshot = JSON.parse(readFileSync('fixtures/mcp-calls.json', 'utf8'));
function storage(): DemoStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function api(demo: ReturnType<typeof createBrowserDemo>) {
  return async (path: string, body?: unknown) => {
    const response = await demo.fetch('/api' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    assert.ok(response.ok, `${path}: ${JSON.stringify(data)}`);
    return data;
  };
}

test('browser demo reuses real menus and completes joining, creating, simulated payment and collection with reload persistence', async () => {
  const saved = storage();
  const demo = createBrowserDemo(snapshot, saved);
  const call = api(demo);
  assert.equal((await call('/config')).mode, 'demo');
  assert.equal((await call('/stores')).stores.length, 4);
  for (const [store, count] of [['1420082', 29], ['1420800', 24], ['1420277', 30]] as const) assert.equal((await call(`/stores/${store}/meals`)).meals.filter((m: any) => !m.sample).length, count);
  assert.equal((await call('/stores/1421248/meals')).fallback, true);
  const board = (await call('/groups?store=1420082')).groups.filter((g: any) => g.state === 'open');
  assert.equal(board.length, 5);
  assert.equal(new Set(board.map((g: any) => g.meal.code)).size, 5);
  const joining = board.find((g: any) => g.people === 2);
  const claimed = new Set(joining.members.flatMap((m: any) => m.partIds));
  const partIds = joining.meal.parts.filter((p: any) => !claimed.has(p.id)).map((p: any) => p.id);
  assert.equal((await call(`/groups/${joining.id}/join`, { nickname: '浏览器拼友', tail4: '8642', partIds })).group.state, 'full');
  const confirmed = (await call(`/groups/${joining.id}/confirm`, {})).group;
  assert.ok(confirmed.members.find((m: any) => m.id === confirmed.viewerId).confirmed);
  assert.ok(confirmed.members.filter((m: any) => m.id !== confirmed.viewerId).every((m: any) => m.tail4 === undefined));
  const meal = (await call(`/stores/1420082/meals/${board[0].meal.code}`)).meal;
  const created = (await call('/groups', { storeCode: '1420082', mealCode: meal.code, nickname: '浏览器发起', tail4: '9753', minutes: 30, people: 2, partIds: pickHostDefault(meal), confirmedSimilar: true })).group;
  assert.equal((await call(`/demo/groups/${created.id}/fill`, {})).group.state, 'full');
  const ordered = (await call(`/groups/${created.id}/ordered`, {})).group;
  assert.match(ordered.members.find((m: any) => m.id === ordered.viewerId).pickupCode, /^\d{4}$/);
  assert.equal((await call(`/groups/${created.id}/collect`, {})).group.state, 'ordered');
  assert.equal((await call(`/demo/groups/${created.id}/collect-others`, {})).group.state, 'picked-up');
  const reloaded = api(createBrowserDemo(snapshot, saved));
  const retained = (await reloaded(`/groups/${created.id}`)).group;
  assert.equal(retained.state, 'picked-up');
  assert.equal(retained.isHost, true);
  assert.equal(retained.deadline, created.deadline);
  const other = api(createBrowserDemo(snapshot, storage()));
  const theirs = (await other('/groups?store=1420082')).groups;
  assert.ok(theirs.every((g: any) => g.id !== created.id && g.id !== joining.id));
  assert.equal((await demo.fetch('/api/tools/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"create-order"}' })).status, 404);
});

test('browser demo replenishes expired plaza and personal cards without extending old deadlines', async () => {
  let at = Date.parse('2026-10-19T03:00:00+08:00');
  const call = api(createBrowserDemo(snapshot, storage(), () => at));
  const before = (await call('/groups?store=1420082')).groups;
  const mine = (await call('/mine?store=1420082')).groups[0];
  at += 70 * 60_000;
  const after = (await call('/groups?store=1420082')).groups;
  assert.equal(after.filter((g: any) => g.state === 'open' && !g.isHost).length, 5);
  assert.ok(after.every((g: any) => !before.some((old: any) => old.id === g.id)));
  const cards = (await call('/mine?store=1420082')).groups;
  assert.ok(cards.some((g: any) => g.state === 'open' && g.id !== mine.id));
  assert.equal(cards.find((g: any) => g.id === mine.id).deadline, mine.deadline);
  assert.equal(cards.find((g: any) => g.id === mine.id).state, 'expired');
});

test('browser repository matches SQLite copy, rollback, join limit and expiry/24h retention semantics', () => {
  const sqlite = new Repository(':memory:', 'demo');
  const browser = new BrowserRepository();
  const now = Date.now();
  try {
    for (const [i, state] of (['open', 'full', 'ordered', 'picked-up'] as const).entries()) {
      const group: Group = { id: `g${i}`, storeCode: '1420082', meal: { code: 'meal', name: '测试套餐', image: '', tags: [], menuPriceCents: 1000, priceCents: 1000, parts: [], verifiedAt: now }, state, createdAt: now - 10_000, deadline: now + i * 1000, endedAt: null, people: 2, hostId: 'member', members: [] };
      for (const repo of [sqlite, browser]) repo.insert(group);
    }
    for (const repo of [sqlite, browser]) {
      const detached = repo.get('g0')!; detached.state = 'expired';
      assert.equal(repo.get('g0')!.state, 'open');
      repo.recordJoin('device', now - 10 * 60_000); repo.recordJoin('device', now - 1);
      repo.setMeta('demo-board', 'version');
      assert.throws(() => repo.transaction(() => { repo.save({ ...repo.get('g0')!, state: 'expired' }); repo.setMeta('demo-board', 'changed'); repo.recordJoin('device', now); throw new Error('rollback'); }), /rollback/);
      assert.equal(repo.joinCount('device', now), 1);
      assert.equal(repo.getMeta('demo-board'), 'version');
      repo.sweep(now + 4000);
    }
    assert.deepEqual(browser.all(), sqlite.all());
    for (const repo of [sqlite, browser]) repo.sweep(now + 24 * 60 * 60_000 + 4000);
    assert.deepEqual(browser.all(), sqlite.all());
    assert.equal(browser.all().length, 0);
  } finally { sqlite.close(); }
});

test('browser demo still works when session storage is blocked or cannot save', async () => {
  const blocked: DemoStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  const call = api(createBrowserDemo(snapshot, blocked));
  const mine = (await call('/mine?store=1420082')).groups[0];
  assert.ok(mine.isHost);
  assert.equal((await call(`/groups/${mine.id}`)).group.id, mine.id);
});
