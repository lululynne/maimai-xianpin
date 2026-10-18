import assert from 'node:assert/strict';
import { test } from 'node:test';
import { McdMcpClient } from '../src/mcp/client.js';
import { assertPublicArguments, assertPublicReadTool, PUBLIC_READ_TOOLS } from '../src/mcp/policy.js';

test('only public menu/store reads pass the fixed allowlist', () => {
  for (const name of PUBLIC_READ_TOOLS) assert.doesNotThrow(() => assertPublicReadTool(name));
  for (const name of ['query-store-coupons', 'available-coupons', 'query-my-coupons', 'create-order', 'cancel-order', 'auto-bind-coupons', 'query-my-account', 'delivery-query-addresses', 'unknown-tool']) {
    assert.throws(() => assertPublicReadTool(name), /MCP_TOOL_NOT_PUBLIC/);
  }
});

test('nested coupon and account arguments cannot enter a public price lookup', () => {
  assert.doesNotThrow(() => assertPublicArguments({ storeCode: '1420082', beType: 1, orderType: 1, items: [{ productCode: 'example', quantity: 1 }] }));
  for (const key of ['couponId', 'couponCode', 'memberId', 'phone', 'token', 'authorization', 'addressId', 'cardId']) {
    assert.throws(() => assertPublicArguments({ items: [{ [key]: 'private' }] }), /MCP_ACCOUNT_ARGUMENT_FORBIDDEN/);
  }
});

test('client rejects a forbidden call before any connection, including JS callers', async () => {
  const client = new McdMcpClient('test-token-never-send');
  await assert.rejects(() => client.call('create-order' as never, {}), /MCP_TOOL_NOT_PUBLIC/);
  await assert.rejects(() => client.call('calculate-price', { items: [{ couponId: 'private' }] }), /MCP_ACCOUNT_ARGUMENT_FORBIDDEN/);
});

test('missing token fails closed', () => {
  assert.throws(() => new McdMcpClient('  '), /MCD_MCP_TOKEN_MISSING/);
});
