// Only public store/menu reads. Never expose a caller-selected MCP tool.
export const PUBLIC_READ_TOOLS = [
  'query-nearby-stores',
  'query-meals',
  'query-meal-detail',
  'calculate-price',
  'now-time-info',
] as const;

export type PublicReadTool = typeof PUBLIC_READ_TOOLS[number];

export function assertPublicReadTool(name: string): asserts name is PublicReadTool {
  if (!(PUBLIC_READ_TOOLS as readonly string[]).includes(name)) {
    throw new Error('MCP_TOOL_NOT_PUBLIC');
  }
}

export function assertPublicArguments(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertPublicArguments);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      // Prevent accidentally using the owner's coupons, account, or addresses.
      if (/coupon|token|authorization|phone|mobile|contact|userId|memberId|addressId|cardId|membership|withOrder/i.test(key)) {
        throw new Error('MCP_ACCOUNT_ARGUMENT_FORBIDDEN');
      }
      assertPublicArguments(child);
    }
  }
}

export function assertPublicCall(name: string, args: Record<string, unknown>): asserts name is PublicReadTool {
  assertPublicReadTool(name);
  assertPublicArguments(args);
  if (name === 'now-time-info') {
    if (Object.keys(args).length) throw new Error('MCP_INVALID_PUBLIC_ARGUMENTS');
    return;
  }
  // query-nearby-stores defaults to account favorites; always force public location search.
  if (name === 'query-nearby-stores') {
    if (args.searchType !== 2 || args.beType !== 1 || typeof args.city !== 'string' || typeof args.keyword !== 'string') throw new Error('MCP_LOCATION_SEARCH_REQUIRED');
    return;
  }
  if (args.orderType !== 1 || args.beType !== 1 || typeof args.storeCode !== 'string' || !/^\d{7}$/.test(args.storeCode)) throw new Error('MCP_PICKUP_ONLY');
  if ('beCode' in args) throw new Error('MCP_PICKUP_ONLY');
}
