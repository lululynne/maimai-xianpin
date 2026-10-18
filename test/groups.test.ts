import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../src/db.js';
import { Groups, identity, windowAt, hostPickRule, pickHostDefault, hostNeeds } from '../src/domain/groups.js';
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

test('at most three people share one meal (host plus two)', () => {
  const s = setup();
  assert.equal(s.create('host', '1000', 30, 3).people, 3);
  assert.throws(() => s.create('host', '1000', 30, 4), /最多三人/);
});

test('tail4 and pickup codes are visible only to their owner; counter sees all', () => {
  const s = setup();
  const g = s.create();
  s.groups.join(g.id, 'guest', joinInput);
  s.groups.action(g.id, 'guest', 'confirm');
  const ordered = s.groups.action(g.id, 'host', 'ordered');
  const codes = ordered.members.map(m => m.pickupCode);
  assert.ok(codes.every(c => /^\d{4}$/.test(c!)) && new Set(codes).size === 2);
  const hostView = s.groups.view(ordered, 'host');
  const guestInHost = hostView.members.find(m => m.id !== hostView.hostId)!;
  assert.equal(guestInHost.tail4, undefined);
  assert.equal(guestInHost.pickupCode, undefined);
  assert.equal(hostView.members.find(m => m.id === hostView.hostId)!.pickupCode, codes[0]);
  assert.deepEqual(s.groups.counter(ordered).members.map(m => m.pickupCode), codes);
  assert.equal(s.groups.counter(ordered).members[1]!.tail4, '2000');
});

test('each member collects their own share; the group ends when everyone has', () => {
  const s = setup();
  const g = s.create();
  s.groups.join(g.id, 'guest', joinInput);
  s.groups.action(g.id, 'guest', 'confirm');
  assert.throws(() => s.groups.action(g.id, 'guest', 'collect'), /还没下单/);
  s.groups.action(g.id, 'host', 'ordered');
  const half = s.groups.action(g.id, 'guest', 'collect');
  assert.equal(half.state, 'ordered');
  assert.equal(s.groups.view(half, 'host').members.find(m => m.id !== half.hostId)!.collected, true);
  assert.throws(() => s.groups.action(g.id, 'guest', 'collect'), /已经取过/);
  assert.equal(s.groups.action(g.id, 'host', 'collect').state, 'picked-up');
});

test('waiting coupons and 30-minute choices belong to the host only', () => {
  const s = setup();
  const g = s.create('host', '1000', 60, 3);
  s.advance(16 * 60_000);
  assert.equal(s.groups.view(s.groups.get(g.id), 'host').idealCouponYuan, 2);
  s.advance(0);
  s.groups.join(g.id, 'guest', { nickname: '小圆', tail4: '2000', partIds: ['p2'] });
  assert.equal(s.groups.view(s.groups.get(g.id), 'guest').idealCouponYuan, 0);
  assert.equal(s.groups.view(s.groups.get(g.id), 'guest').perk, undefined);
  assert.throws(() => s.groups.action(g.id, 'host', 'keep-waiting'), /30 分钟/);
  s.advance(15 * 60_000);
  const view = s.groups.view(s.groups.get(g.id), 'host');
  assert.equal(view.perk!.prompt, true);
  assert.equal(view.idealCouponYuan, 2, '30 分钟不再升 5 元，改走弹窗');
  assert.throws(() => s.groups.action(g.id, 'guest', 'keep-waiting'), /发起人/);
  assert.throws(() => s.groups.action(g.id, 'host', 'solo'), /已经有人加入/);
  const kept = s.groups.action(g.id, 'host', 'keep-waiting');
  assert.equal(kept.perk!.waitBonusCents, 300);
  assert.equal(s.groups.view(kept, 'host').perk!.prompt, false);
  const all = s.groups.action(g.id, 'host', 'take-all');
  assert.equal(all.state, 'full');
  assert.deepEqual(all.members[0]!.partIds, ['p0', 'p1', 'p3', 'p4']);
  const hostView = s.groups.view(all, 'host');
  const share = hostView.members.find(m => m.id === hostView.hostId)!.cents;
  assert.equal(hostView.perk!.hostPayCents, Math.round(share * 0.85));
});

test('solo after 30 minutes gives 85% of the host single-item price; alone take-all subtracts the bonus', () => {
  const s = setup();
  const g = s.create('host', '1000', 60);
  s.advance(31 * 60_000);
  const solo = s.groups.action(g.id, 'host', 'solo');
  assert.equal(solo.state, 'expired');
  assert.equal(s.groups.view(solo, 'host').perk!.hostPayCents, Math.round(2000 * 0.85));
  const h = s.create('host2', '1001', 60);
  s.advance(31 * 60_000);
  s.groups.action(h.id, 'host2', 'keep-waiting');
  const alone = s.groups.action(h.id, 'host2', 'take-all');
  assert.equal(s.groups.view(alone, 'host2').perk!.hostPayCents, 3990 - 300);
});

test('peak windows are 11:30-14:30 and 18:30-21:30 Beijing time', () => {
  const at = (h: number, m: number) => Date.UTC(2026, 9, 19, h - 8, m);
  assert.equal(windowAt(at(11, 29)).open, false);
  assert.equal(windowAt(at(11, 30)).open, true);
  assert.equal(windowAt(at(14, 29)).end, at(14, 30));
  assert.equal(windowAt(at(14, 30)).open, false);
  assert.equal(windowAt(at(15, 0)).next, '18:30');
  assert.equal(windowAt(at(21, 30)).open, false);
  assert.equal(windowAt(at(0, 30)).next, '11:30');
});

test('host of a 4+ item meal must take at least one drink and one main', () => {
  const s = setup();
  const named: Meal = { ...meal, parts: [['猪柳堡', 1800], ['板烧鸡腿麦满分', 1450], ['脆薯饼', 850], ['鲜萃冰咖', 900], ['鲜萃冰咖', 900]].map(([name, c], i) => ({ id: `n${i}`, name: name as string, code: String(i), unitPriceCents: c as number, supportModify: false })) };
  assert.equal(hostPickRule(named), true);
  const make = (partIds: string[]) => s.groups.create('h', '1420082', named, { nickname: '小林', tail4: '1000', partIds, people: 2 });
  assert.throws(() => make(['n0', 'n1']), /1 份饮料 \+ 1 份主食/);
  assert.throws(() => make(['n3']), /1 份饮料 \+ 1 份主食/);
  assert.throws(() => make(['n0', 'n1', 'n3']), /至少给拼友留一份主食/);
  assert.ok(make(['n0', 'n3']));
  assert.deepEqual(pickHostDefault(named), ['n0', 'n3']);
  const small: Meal = { ...named, parts: named.parts.slice(0, 3) };
  assert.equal(hostPickRule(small), false);
});

test('6+ item meals require 2 drinks + 2 mains, still leaving a main for joiners', () => {
  const s = setup();
  const mk = (names: string[]): Meal => ({ ...meal, parts: names.map((name, i) => ({ id: `b${i}`, name, code: String(i), unitPriceCents: 1000, supportModify: false })) });
  const bucket = mk(['麦辣鸡腿堡', '板烧鸡腿堡', '麦乐鸡', '薯条', '可乐', '可乐', '雪碧', '派']);
  assert.deepEqual(hostNeeds(bucket), { drink: 2, main: 2 });
  const make = (m: Meal, partIds: string[]) => s.groups.create('h', '1420082', m, { nickname: '小林', tail4: '1000', partIds, people: 3 });
  assert.throws(() => make(bucket, ['b0', 'b4']), /至少要拿 2 份饮料 \+ 2 份主食/);
  assert.throws(() => make(bucket, ['b0', 'b1', 'b2', 'b4', 'b5']), /至少给拼友留一份主食/);
  assert.ok(make(bucket, ['b0', 'b1', 'b4', 'b5']));
  assert.deepEqual(pickHostDefault(bucket), ['b0', 'b1', 'b4', 'b5']);
  const twoMains = mk(['麦辣鸡腿堡', '板烧鸡腿堡', '薯条', '可乐', '可乐', '派']);
  assert.deepEqual(hostNeeds(twoMains), { drink: 2, main: 1 }, '只有两份主食时只要求 1 份，另一份留给拼友');
  assert.deepEqual(hostNeeds(mk(['堡', '可乐', '薯条', '派'])), { drink: 1, main: 1 });
});

test('pickHostDefault never takes every main when filling up', () => {
  const m: Meal = { ...meal, parts: ['猪柳堡', '板烧鸡腿麦满分', '脆薯饼', '鲜萃冰咖', '鲜萃冰咖'].map((name, i) => ({ id: `d${i}`, name, code: String(i), unitPriceCents: 1000, supportModify: false })) };
  for (const count of [2, 3, 4]) {
    const ids = pickHostDefault(m, count);
    assert.ok(ids.includes('d0') && ids.includes('d3'));
    assert.ok(!(ids.includes('d0') && ids.includes('d1')), `count ${count}`);
  }
});
