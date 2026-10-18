import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateShares } from '../src/domain/shares.js';

function sumCents(shares: { id: string; cents: number }[]): number {
  return shares.reduce((acc, s) => acc + s.cents, 0);
}

test('exact division among equal weights', () => {
  const r = allocateShares(
    1000,
    [
      { id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] },
      { id: 'b', items: [{ unitPriceCents: 100, quantity: 1 }] },
    ],
    'a'
  );
  assert.equal(r.method, 'weighted');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 500 },
    { id: 'b', cents: 500 },
  ]);
});

test('remainder goes to initiator (initiator last)', () => {
  const members = [
    { id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] },
    { id: 'b', items: [{ unitPriceCents: 100, quantity: 1 }] },
    { id: 'c', items: [{ unitPriceCents: 100, quantity: 1 }] },
  ];
  const r = allocateShares(100, members, 'c');
  assert.equal(r.method, 'weighted');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 33 },
    { id: 'b', cents: 33 },
    { id: 'c', cents: 34 },
  ]);
  assert.equal(sumCents(r.shares), 100);
});

test('remainder goes to initiator (initiator first)', () => {
  const members = [
    { id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] },
    { id: 'b', items: [{ unitPriceCents: 100, quantity: 1 }] },
    { id: 'c', items: [{ unitPriceCents: 100, quantity: 1 }] },
  ];
  const r = allocateShares(100, members, 'a');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 34 },
    { id: 'b', cents: 33 },
    { id: 'c', cents: 33 },
  ]);
});

test('unequal unit-price weights', () => {
  const r = allocateShares(
    800,
    [
      { id: 'a', items: [{ unitPriceCents: 300, quantity: 1 }] },
      { id: 'b', items: [{ unitPriceCents: 100, quantity: 1 }] },
    ],
    'a'
  );
  assert.equal(r.method, 'weighted');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 600 },
    { id: 'b', cents: 200 },
  ]);
});

test('unequal weights include quantity', () => {
  const r = allocateShares(
    300,
    [
      { id: 'a', items: [{ unitPriceCents: 50, quantity: 2 }] },
      { id: 'b', items: [{ unitPriceCents: 25, quantity: 2 }] },
    ],
    'a'
  );
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 200 },
    { id: 'b', cents: 100 },
  ]);
});

test('one unknown unit price falls back to equal-items', () => {
  const r = allocateShares(
    100,
    [
      { id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] },
      { id: 'b', items: [{ unitPriceCents: null, quantity: 1 }] },
    ],
    'a'
  );
  assert.equal(r.method, 'equal-items');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 50 },
    { id: 'b', cents: 50 },
  ]);
});

test('equal-items fallback splits by quantity counts', () => {
  const r = allocateShares(
    300,
    [
      { id: 'a', items: [{ unitPriceCents: null, quantity: 2 }] },
      { id: 'b', items: [{ unitPriceCents: 999, quantity: 1 }] },
    ],
    'a'
  );
  assert.equal(r.method, 'equal-items');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 200 },
    { id: 'b', cents: 100 },
  ]);
});

test('all-zero known prices fall back to equal-items', () => {
  const r = allocateShares(
    100,
    [
      { id: 'a', items: [{ unitPriceCents: 0, quantity: 1 }] },
      { id: 'b', items: [{ unitPriceCents: 0, quantity: 1 }] },
    ],
    'a'
  );
  assert.equal(r.method, 'equal-items');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 50 },
    { id: 'b', cents: 50 },
  ]);
});

test('sole initiator takes the entire total', () => {
  const r = allocateShares(
    500,
    [{ id: 'a', items: [{ unitPriceCents: 100, quantity: 3 }] }],
    'a'
  );
  assert.equal(r.method, 'weighted');
  assert.deepEqual(r.shares, [{ id: 'a', cents: 500 }]);
});

test('total price zero yields all zero shares', () => {
  const r = allocateShares(
    0,
    [
      { id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] },
      { id: 'b', items: [{ unitPriceCents: 200, quantity: 1 }] },
    ],
    'a'
  );
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 0 },
    { id: 'b', cents: 0 },
  ]);
  assert.equal(sumCents(r.shares), 0);
});

test('member with empty items gets zero', () => {
  const r = allocateShares(
    100,
    [
      { id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] },
      { id: 'b', items: [] },
    ],
    'a'
  );
  assert.equal(r.method, 'weighted');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 100 },
    { id: 'b', cents: 0 },
  ]);
});

test('empty-items initiator still receives the remainder', () => {
  const r = allocateShares(
    100,
    [
      { id: 'a', items: [{ unitPriceCents: null, quantity: 2 }] },
      { id: 'b', items: [{ unitPriceCents: null, quantity: 1 }] },
      { id: 'c', items: [] },
    ],
    'c'
  );
  assert.equal(r.method, 'equal-items');
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 66 },
    { id: 'b', cents: 33 },
    { id: 'c', cents: 1 },
  ]);
  assert.equal(sumCents(r.shares), 100);
});

test('throws on duplicate member id', () => {
  assert.throws(
    () =>
      allocateShares(
        100,
        [
          { id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] },
          { id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] },
        ],
        'a'
      ),
    /duplicate/i
  );
});

test('throws when initiator is not a member', () => {
  assert.throws(
    () =>
      allocateShares(
        100,
        [{ id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] }],
        'zzz'
      ),
    /initiator/i
  );
});

test('throws on illegal total amount', () => {
  const members = [{ id: 'a', items: [{ unitPriceCents: 100, quantity: 1 }] }];
  for (const bad of [-1, 1.5, NaN, Infinity, -Infinity, 10000001]) {
    assert.throws(() => allocateShares(bad as number, members, 'a'), Error);
  }
});

test('throws on illegal quantity', () => {
  for (const q of [0, -1, 101, 1.5, NaN, Infinity]) {
    assert.throws(
      () =>
        allocateShares(
          100,
          [{ id: 'a', items: [{ unitPriceCents: 100, quantity: q as number }] }],
          'a'
        ),
      Error
    );
  }
});

test('throws on illegal unit price', () => {
  for (const p of [-1, -0.5, 1.5, NaN, Infinity]) {
    assert.throws(
      () =>
        allocateShares(
          100,
          [{ id: 'a', items: [{ unitPriceCents: p as number, quantity: 1 }] }],
          'a'
        ),
      Error
    );
  }
});

test('throws when total item count is zero', () => {
  assert.throws(
    () =>
      allocateShares(
        100,
        [
          { id: 'a', items: [] },
          { id: 'b', items: [] },
        ],
        'a'
      ),
    /item count/i
  );
});

test('accepts boundary total 0 and max 10000000', () => {
  const r0 = allocateShares(
    0,
    [{ id: 'a', items: [{ unitPriceCents: 0, quantity: 100 }] }],
    'a'
  );
  assert.deepEqual(r0.shares, [{ id: 'a', cents: 0 }]);

  const rMax = allocateShares(
    10000000,
    [
      { id: 'a', items: [{ unitPriceCents: 10000000, quantity: 100 }] },
      { id: 'b', items: [{ unitPriceCents: 0, quantity: 1 }] },
    ],
    'a'
  );
  assert.equal(rMax.method, 'weighted');
  assert.equal(sumCents(rMax.shares), 10000000);
});

test('rejects totals outside 0..10000000', () => {
  const members = [{ id: 'a', items: [{ unitPriceCents: 1, quantity: 1 }] }];
  assert.throws(() => allocateShares(-1, members, 'a'), Error);
  assert.throws(() => allocateShares(10000001, members, 'a'), Error);
});

test('rejects quantity outside 1..100 boundary', () => {
  assert.throws(
    () =>
      allocateShares(
        100,
        [{ id: 'a', items: [{ unitPriceCents: 1, quantity: 0 }] }],
        'a'
      ),
    Error
  );
  assert.throws(
    () =>
      allocateShares(
        100,
        [{ id: 'a', items: [{ unitPriceCents: 1, quantity: 101 }] }],
        'a'
      ),
    Error
  );
});

test('accepts quantity boundary 1 and 100', () => {
  const r = allocateShares(
    1000,
    [
      { id: 'a', items: [{ unitPriceCents: 10, quantity: 1 }] },
      { id: 'b', items: [{ unitPriceCents: 10, quantity: 100 }] },
    ],
    'a'
  );
  assert.equal(sumCents(r.shares), 1000);
});

test('BigInt multiplication keeps large intermediate products exact', () => {
  const big = 9007199254740991;
  const r = allocateShares(
    10000000,
    [
      { id: 'a', items: [{ unitPriceCents: big, quantity: 100 }] },
      { id: 'b', items: [{ unitPriceCents: 1, quantity: 1 }] },
    ],
    'b'
  );
  assert.equal(r.method, 'weighted');
  assert.equal(r.shares[0]!.cents, 9999999);
  assert.equal(r.shares[1]!.cents, 1);
  assert.equal(sumCents(r.shares), 10000000);
});

test('ratio with non-dividing weights floors correctly', () => {
  const r = allocateShares(
    10000000,
    [
      { id: 'a', items: [{ unitPriceCents: 3, quantity: 7 }] },
      { id: 'b', items: [{ unitPriceCents: 1, quantity: 3 }] },
    ],
    'b'
  );
  assert.deepEqual(r.shares, [
    { id: 'a', cents: 8750000 },
    { id: 'b', cents: 1250000 },
  ]);
});
