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
      if (/coupon|token|authorization|phone|mobile|contact|userId|memberId|addressId|cardId/i.test(key)) {
        throw new Error('MCP_ACCOUNT_ARGUMENT_FORBIDDEN');
      }
      assertPublicArguments(child);
    }
  }
}
