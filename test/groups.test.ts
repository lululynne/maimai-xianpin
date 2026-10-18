import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../src/db.js';
import { Groups, identity } from '../src/domain/groups.js';
import type { Meal } from '../src/catalog.js';

const repos: Repository[] = [];
afterEach(() => { for (const repo of repos.splice(0)) repo.close(); });
const meal: Meal = { code: '9900016136', name: '测试双人餐', image: '', menuPriceCents: 3990, priceCents: 3990, tags: [], verifiedAt: 0, parts: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `餐品${i}`, code: String(i), unitPriceCents: i === 4 ? null : 1000, supportModify: false })) };
function setup(path = ':memory:') {
  let time = 1000000000;
  const repo = new Repository(path, 'demo'); repos.push(repo);
  const groups = new Groups(repo, () => time);
  const create = (device = 'host', tail4 = '1000', minutes?: number, people = 2) => groups.create(device, '1420082', meal, { nickname: '小林', tail4, partIds: ['p0', 'p1'], minutes, people });
  return { repo, groups, create, advance: (ms: number) => time += ms, time: () => time };
}
const joinInput = { nickname: '小圆', tail4: '2000', partIds: ['p2', 'p3', 'p4'] };

test('deadline defaults to 30 minutes, accepts bounds, and cannot be extended by input', () => {
  const s = setup();
  assert.equal(s.create().deadline - s.time(), 30 * 60_000);
  for (const minutes of [10, 60]) assert.equal(s.create('host', '1000', minutes).deadline - s.time(), minutes * 60_000);
  for (const minutes of [0, 9, 61, 10.5]) assert.throws(() => s.create('host', '1000', minutes));
  const g = s.groups.create('host', '1420082', meal, { nickname: 'a', tail4: '1234', partIds: ['p0'], deadline: Infinity });
  assert.equal(g.deadline - s.time(), 30 * 60_000);
});

test('device and tail collisions cannot take a place; used portions are exclusive', () => {
  const s = setup(); const g = s.create();
  assert.throws(() => s.groups.join(g.id, 'host', joinInput), /不能拼自己的单/);
  assert.throws(() => s.groups.join(g.id, 'other', { ...joinInput, tail4: '1000' }), /同一尾号/);
  assert.throws(() => s.groups.join(g.id, 'other', { ...joinInput, partIds: ['p0'] }), /选走/);
  s.groups.join(g.id, 'other', joinInput);
  assert.throws(() => s.groups.join(g.id, 'racing', { ...joinInput, tail4: '3000' }), /拼满/);
  assert.equal(s.groups.get(g.id).members.length, 2);
});

test('three joins per ten minutes, including kicked attempts; expiry reopens the rate window', () => {
  const s = setup(); const gs = Array.from({ length: 5 }, (_, i) => s.create('host' + i));
  for (const g of gs.slice(0, 3)) s.groups.join(g.id, 'visitor', joinInput);
  assert.throws(() => s.groups.join(gs[3]!.id, 'visitor', joinInput), /十分钟内最多/);
  s.groups.action(gs[0]!.id, 'host0', 'kick', s.groups.get(gs[0]!.id).members[1]!.id);
  assert.throws(() => s.groups.join(gs[4]!.id, 'visitor', joinInput), /十分钟内最多/);
  s.advance(10 * 60_000);
  assert.doesNotThrow(() => s.groups.join(gs[3]!.id, 'visitor', joinInput));
});

test('unconfirmed members can be removed; confirmed members cannot', () => {
  const s = setup(); const g = s.create();
  const full = s.groups.join(g.id, 'visitor', joinInput);
  const member = full.members[1]!;
  assert.throws(() => s.groups.action(g.id, 'visitor', 'kick', g.hostId), /发起人/);
  assert.equal(s.groups.action(g.id, 'host', 'kick', member.id).state, 'open');
  s.groups.join(g.id, 'replacement', joinInput);
  s.groups.action(g.id, 'replacement', 'confirm');
  assert.throws(() => s.groups.action(g.id, 'host', 'kick', s.groups.get(g.id).members[1]!.id), /尚未确认/);
});

test('full -> confirmed -> ordered -> pickup, including pickup after recruitment deadline', () => {
  const s = setup(); const g = s.create();
  s.groups.join(g.id, 'visitor', joinInput);
  assert.throws(() => s.groups.action(g.id, 'host', 'ordered'), /所有人确认/);
  s.groups.action(g.id, 'visitor', 'confirm');
  assert.throws(() => s.groups.action(g.id, 'visitor', 'ordered'), /发起人/);
  s.groups.action(g.id, 'host', 'ordered');
  s.advance(31 * 60_000);
  assert.equal(s.groups.get(g.id).state, 'ordered');
  assert.equal(s.groups.list('1420082').length, 0);
  const picked = s.groups.action(g.id, 'host', 'picked-up');
  assert.equal(picked.state, 'picked-up');
  assert.equal(picked.endedAt, g.deadline);
  assert.equal(s.groups.view(picked, 'visitor').waitedMs, 30 * 60_000);
});

test('deadline expires open and un-ordered full groups; deletes all payload after 24 hours', () => {
  const s = setup(); const open = s.create(); const full = s.create('h2');
  s.groups.join(full.id, 'visitor', joinInput);
  s.advance(30 * 60_000);
  for (const g of [open, full]) {
    assert.equal(s.groups.get(g.id).state, 'expired');
    assert.throws(() => s.groups.join(g.id, 'late', joinInput), /结束或拼满/);
  }
  assert.equal(s.groups.list('1420082').length, 0);
  s.advance(24 * 60 * 60_000);
  assert.throws(() => s.groups.get(open.id), /已删除/);
  assert.equal(s.repo.db.prepare('SELECT COUNT(*) AS n FROM groups').get()?.n, 0);
  assert.equal(s.repo.db.prepare('SELECT COUNT(*) AS n FROM join_events').get()?.n, 0);
});

test('views never expose device identifiers; outsiders do not see tail numbers', () => {
  const s = setup(); const g = s.create('private-device-id');
  const view = s.groups.view(g, 'outsider');
  assert.ok(!JSON.stringify(view).includes('private-device-id'));
  assert.equal(view.members[0]!.tail4, undefined);
  assert.equal(s.groups.view(g, 'private-device-id').members[0]!.tail4, '1000');
  assert.throws(() => identity({ nickname: '手机号13812345678', tail4: '5678' }), /完整手机号/);
  assert.throws(() => identity({ nickname: 'a', tail4: '13812345678' }), /后四位/);
});

test('similar list is limited to three, ordered by earliest deadline, and excludes full groups', () => {
  const s = setup();
  for (const minutes of [50, 10, 30, 20, 60]) s.create('h' + minutes, '1000', minutes);
  const similar = s.groups.similar('1420082', meal.code);
  assert.deepEqual(similar.map(g => (g.deadline - s.time()) / 60_000), [10, 20, 30]);
  s.groups.join(similar[0]!.id, 'visitor', joinInput);
  assert.deepEqual(s.groups.similar('1420082', meal.code).map(g => (g.deadline - s.time()) / 60_000), [20, 30, 50]);
});

test('price shares conserve total both while recruiting and when full', () => {
  const s = setup(); const g = s.create();
  const full = s.groups.join(g.id, 'visitor', joinInput);
  const view = s.groups.view(full, 'host');
  assert.equal(view.method, 'equal-items');
  assert.equal(view.members.reduce((sum, m) => sum + m.cents, 0), 3990);
  assert.deepEqual(view.members.map(m => m.cents), [1596, 2394]);
});

test('SQLite survives a separate connection and refuses mixing demo with live', () => {
  const dir = mkdtempSync(join(tmpdir(), 'maimai-sqlite-'));
  try {
    const s = setup(join(dir, 'app.sqlite')); const g = s.create();
    const other = new Repository(join(dir, 'app.sqlite'), 'demo');
    try { assert.equal(other.get(g.id)?.members[0]?.nickname, '小林'); } finally { other.close(); }
    assert.throws(() => new Repository(join(dir, 'app.sqlite'), 'live'), /MODE_MISMATCH/);
  } finally { for (const r of repos.splice(0)) r.close(); rmSync(dir, { recursive: true, force: true }); }
});
