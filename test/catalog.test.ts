import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Catalog, defaultRounds, readProductPrice, STORE_CODES, yuanToCents } from '../src/catalog.js';
import { DemoMcpClient } from '../src/mcp/demo.js';

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
  const demo = new DemoMcpClient(snapshot);
  let reads = 0;
  const reader = { call: async (...args: Parameters<typeof demo.call>) => { reads++; return demo.call(...args); } };
  const catalog = new Catalog(reader);
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
