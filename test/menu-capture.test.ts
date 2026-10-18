import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureWindow, candidatePriority } from '../scripts/capture-daypart.js';
import { mergeCaptures } from '../scripts/capture-fixtures.js';
import type { Capture } from '../src/mcp/demo.js';

test('scheduled captures reject early, late, and other-date runs without contacting MCP', () => {
  for (const [period, start, end] of [['lunch', '11:30', '14:30'], ['dinner', '18:30', '21:30']]) {
    const a = Date.parse(`2026-10-19T${start}:00+08:00`), b = Date.parse(`2026-10-19T${end}:00+08:00`);
    assert.equal(captureWindow(a - 1, '2026-10-19', period!).open, false);
    assert.equal(captureWindow(a, '2026-10-19', period!).open, true);
    assert.equal(captureWindow(b - 1, '2026-10-19', period!).open, true);
    assert.equal(captureWindow(b, '2026-10-19', period!).open, false);
    assert.equal(captureWindow(a + 24 * 3600_000, '2026-10-19', period!).open, false);
  }
  assert.throws(() => captureWindow(Date.now(), '2026-10-19', 'breakfast'), /INVALID_CAPTURE_WINDOW/);
});

test('fixture regeneration preserves breakfast and two regular captures without duplicate growth', () => {
  const make = (capturedAt: string): Capture => ({ capturedAt, name: 'calculate-price', arguments: { storeCode: '1420082', beType: 1, orderType: 1, items: [{ productCode: '123', quantity: 1 }] }, result: { structuredContent: { success: true, data: { productPrice: 0, price: 0, productList: [], traceId: 'private-trace', cardOffers: ['private'] } } } });
  const breakfast = make('2026-10-18T00:12:00Z'), lunch = make('2026-10-19T04:00:00Z'), dinner = make('2026-10-19T11:00:00Z');
  const merged = mergeCaptures([breakfast, lunch, dinner, breakfast, lunch]);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map(c => c.capturedAt), [breakfast, lunch, dinner].map(c => c.capturedAt));
  assert.equal(JSON.stringify(merged).includes('private'), false);
});

test('family buckets and sharing meals are attempted before ordinary threshold candidates', () => {
  assert.ok(candidatePriority('拼团全家桶套餐') < candidatePriority('麦乐鸡分享盒'));
  assert.ok(candidatePriority('麦乐鸡分享盒') < candidatePriority('麦辣鸡腿堡双人餐'));
  assert.ok(candidatePriority('带麦旋风的组合') < candidatePriority('普通套餐'));
});
