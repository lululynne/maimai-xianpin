import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Catalog, defaultRounds, readProductPrice, STORE_CODES, yuanToCents } from '../src/catalog.js';
import { DemoMcpClient } from '../src/mcp/demo.js';
import { menuDaypart } from '../src/dayparts.js';
import type { Capture } from '../src/mcp/demo.js';

test('menu yuan strings convert to exact cents', () => {
  assert.equal(yuanToCents('39.9'), 3990);
  assert.equal(yuanToCents('8.05'), 805);
  for (const invalid of ['NaN', '-1', '1.001', '1e4', 3990]) assert.equal(yuanToCents(invalid), null);
});

test('unmatched zero price is not a free item', () => {
  assert.equal(readProductPrice({ productPrice: 0, productList: [] }, '521327'), null);
  assert.equal(readProductPrice({ productList: [{ productCode: 'a', quantity: 1, subtotal: 0 }] }, 'a'), 0);
});

test('actual selected quantities take priority over inconsistent default flags', () => {
  const r = defaultRounds({ rounds: [{ id: 1, quantity: 2, choices: [{ code: 'hot', isDefault: 1, quantity: 0 }, { code: 'ice', isDefault: 0, quantity: 2 }] }] });
  assert.deepEqual(r, [{ round: '1', comboItemList: [{ code: 'ice', quantity: 2 }] }]);
});

test('four real store captures replay full combo and unknown individual price faithfully', async () => {
  const snapshot = JSON.parse(await readFile('fixtures/mcp-calls.json', 'utf8'));
  const now = () => Date.parse('2026-10-18T00:30:00Z');
  const demo = new DemoMcpClient(snapshot, now);
  let reads = 0;
  const reader = { call: async (...args: Parameters<typeof demo.call>) => { reads++; return demo.call(...args); } };
  const catalog = new Catalog(reader, now);
  assert.equal((await catalog.stores()).length, 4);
  for (const store of STORE_CODES) {
    const meal = await catalog.meal(store, '9900016136');
    assert.equal(meal.priceCents, 3990);
    assert.equal(meal.parts.length, 5);
    assert.equal(meal.parts.filter(p => p.unitPriceCents === null).length, 2);
    const before = reads;
    assert.deepEqual(await catalog.meal(store, '9900016136'), meal);
    assert.equal(reads, before);
  }
});

function captureMeal(code: string, name: string, capturedAt: string, cents = 3990, store = STORE_CODES[0]!): Capture[] {
  const args = { storeCode: store, beType: 1, orderType: 1 };
  const rounds = [{ id: 1, quantity: 2, choices: [{ code: code + '1', name: '汉堡', quantity: 2 }] }];
  const make = (tool: string, arguments_: Record<string, unknown>, data: unknown): Capture => ({ name: tool, arguments: arguments_, capturedAt, result: { structuredContent: { success: true, data } } });
  return [
    make('query-meals', args, { meals: { [code]: { name, currentPrice: String(cents / 100) } }, categories: [] }),
    make('query-meal-detail', { ...args, code }, { rounds }),
    make('calculate-price', { ...args, items: [{ productCode: code, quantity: 1, roundList: defaultRounds({ rounds }) }] }, { productList: [{ productCode: code, quantity: 1, subtotal: cents }] }),
    make('calculate-price', { ...args, items: [{ productCode: code + '1', quantity: 1 }] }, { productList: [{ productCode: code + '1', quantity: 1, subtotal: 1800 }] }),
  ];
}

test('breakfast ends at 10:30 Beijing, regardless of machine timezone', () => {
  assert.equal(menuDaypart(Date.parse('2026-10-19T02:29:59Z')), 'breakfast');
  assert.equal(menuDaypart(Date.parse('2026-10-19T02:30:00Z')), 'regular');
  assert.equal(menuDaypart(Date.parse('2026-10-18T16:00:00Z')), 'breakfast');
});

test('demo merges periods and filters each store independently, falling back only when needed', async () => {
  const calls = [
    ...captureMeal('101', '早餐组合', '2026-10-18T00:12:00Z'),
    ...captureMeal('102', '拼团全家桶套餐', '2026-10-19T04:00:00Z'),
    ...captureMeal('103', '麦乐鸡分享盒', '2026-10-19T11:00:00Z'),
    ...captureMeal('201', '另一店早餐组合', '2026-10-18T00:12:00Z', 3990, STORE_CODES[1]),
  ];
  let at = Date.parse('2026-10-19T00:00:00Z');
  const catalog = new Catalog(new DemoMcpClient({ calls }, () => at), () => at);
  assert.deepEqual((await catalog.shareableMenu(STORE_CODES[0]!)).map(m => m.code), ['101']);
  at = Date.parse('2026-10-19T04:00:00Z');
  assert.deepEqual((await catalog.shareableMenu(STORE_CODES[0]!)).map(m => m.code), ['102']);
  assert.deepEqual((await catalog.shareableMenu(STORE_CODES[1]!)).map(m => m.code), ['201']);
  assert.equal((await catalog.meal(STORE_CODES[0]!, '102')).parts.length, 2);
  at = Date.parse('2026-10-19T11:00:00Z');
  assert.deepEqual((await catalog.shareableMenu(STORE_CODES[0]!)).map(m => m.code), ['103']);
});

test('same code keeps its period price and invalidates cached detail at the breakfast boundary', async () => {
  let at = Date.parse('2026-10-19T02:29:00Z');
  const calls = [...captureMeal('101', '双人餐', '2026-10-18T00:12:00Z', 3900), ...captureMeal('101', '双人餐', '2026-10-19T04:00:00Z', 4900)];
  const catalog = new Catalog(new DemoMcpClient({ calls }, () => at), () => at);
  assert.equal((await catalog.meal(STORE_CODES[0]!, '101')).priceCents, 3900);
  at += 60_000;
  assert.equal((await catalog.meal(STORE_CODES[0]!, '101')).priceCents, 4900);
});

test('incomplete detail and empty zero quote never become offered meals', async () => {
  const complete = captureMeal('101', '早餐组合', '2026-10-18T00:12:00Z');
  const unfinished = captureMeal('102', '全家桶套餐', '2026-10-19T04:00:00Z').slice(0, 2);
  const empty = captureMeal('103', '分享盒', '2026-10-19T04:00:00Z');
  empty[2]!.result.structuredContent.data = { productList: [], price: 0 };
  const at = () => Date.parse('2026-10-19T04:00:00Z');
  const catalog = new Catalog(new DemoMcpClient({ calls: [...complete, ...unfinished, ...empty] }, at), at);
  assert.deepEqual((await catalog.shareableMenu(STORE_CODES[0]!)).map(m => m.code), ['101']);
});

test('a later partial re-capture cannot hide a previously complete meal or turn unknown price free', async () => {
  const calls = captureMeal('101', '双人餐', '2026-10-19T04:00:00Z');
  const partial = captureMeal('101', '双人餐', '2026-10-19T11:00:00Z');
  partial[1]!.result.structuredContent.data.rounds[0].quantity = 3;
  partial[1]!.result.structuredContent.data.rounds[0].choices[0].quantity = 3;
  partial[2]!.result.structuredContent.data = { productList: [], price: 0 };
  const at = () => Date.parse('2026-10-19T04:30:00Z');
  const catalog = new Catalog(new DemoMcpClient({ calls: [...calls, ...partial] }, at), at);
  assert.equal((await catalog.meal(STORE_CODES[0]!, '101')).priceCents, 3990);
});

test('reserved lunch and dinner captured at night retain actual capture time and separate quotes', async () => {
  const lunch = captureMeal('301', '午晚双人餐', '2026-10-18T19:30:00Z', 4900);
  const dinner = captureMeal('301', '午晚双人餐', '2026-10-18T19:31:00Z', 5900);
  for (const c of lunch) c.arguments.reservationDate = '2026-10-19 12:00';
  for (const c of dinner) c.arguments.reservationDate = '2026-10-19 19:00';
  const now = () => Date.parse('2026-10-18T19:35:00Z');
  let selected = Date.parse('2026-10-19T04:00:00Z');
  const menuTime = () => selected;
  const catalog = new Catalog(new DemoMcpClient({ calls: [...lunch, ...dinner] }, menuTime), now, 3000, undefined, menuTime);
  const first = await catalog.meal(STORE_CODES[0]!, '301');
  assert.equal(first.priceCents, 4900);
  assert.equal(first.verifiedAt, Date.parse('2026-10-18T19:30:00Z'));
  assert.equal(first.reservationDate, '2026-10-19 12:00');
  selected = Date.parse('2026-10-19T11:00:00Z');
  assert.equal((await catalog.meal(STORE_CODES[0]!, '301')).priceCents, 5900);
});

test('missing lunch single-item prices cannot borrow breakfast prices', async () => {
  const breakfast = captureMeal('301', '双人餐', '2026-10-18T00:12:00Z', 3900);
  const lunch = captureMeal('301', '双人餐', '2026-10-18T19:30:00Z', 4900).slice(0, 3);
  for (const c of lunch) c.arguments.reservationDate = '2026-10-19 12:00';
  const at = () => Date.parse('2026-10-19T04:00:00Z');
  const catalog = new Catalog(new DemoMcpClient({ calls: [...breakfast, ...lunch] }, at), at);
  assert.ok((await catalog.meal(STORE_CODES[0]!, '301')).parts.every(p => p.unitPriceCents === null));
});

test('unsupported reserved period falls back to recorded breakfast instead of replaying a failed menu', async () => {
  const calls = captureMeal('401', '早餐组合', '2026-10-18T00:12:00Z');
  calls.push({ name: 'query-meals', arguments: { storeCode: STORE_CODES[0]!, beType: 1, orderType: 1, reservationDate: '2026-10-19 12:00' }, capturedAt: '2026-10-18T19:30:00Z', result: { structuredContent: { success: false, code: 600054, data: null } } });
  const at = () => Date.parse('2026-10-19T04:00:00Z');
  const catalog = new Catalog(new DemoMcpClient({ calls }, at), at);
  assert.deepEqual((await catalog.shareableMenu(STORE_CODES[0]!)).map(m => m.code), ['401']);
  assert.equal((await catalog.meal(STORE_CODES[0]!, '401')).priceCents, 3990);
});

test('success with null data cannot replace a valid snapshot', async () => {
  const calls = captureMeal('501', '双人餐', '2026-10-19T04:00:00Z');
  calls.push({ ...calls[0]!, capturedAt: '2026-10-19T04:01:00Z', result: { structuredContent: { success: true, data: null } } });
  const at = () => Date.parse('2026-10-19T04:02:00Z');
  const catalog = new Catalog(new DemoMcpClient({ calls }, at), at);
  assert.equal((await catalog.shareableMenu(STORE_CODES[0]!)).length, 1);
});
