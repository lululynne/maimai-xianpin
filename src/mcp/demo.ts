import type { McpReader } from './client.js';
import { assertPublicCall, type PublicReadTool } from './policy.js';

function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + stable(v)).join(',') + '}';
  return JSON.stringify(value);
}

export class DemoMcpClient implements McpReader {
  private captures: Map<string, unknown>;
  private menus = new Map<string, Set<string>>();
  constructor(snapshot: { calls: { name: string; arguments: Record<string, unknown>; result: unknown; capturedAt?: string }[] }) {
    this.captures = new Map(snapshot.calls.map(c => [c.name + stable(c.arguments), { ...(c.result as object), _sourceTimestamp: c.capturedAt ? Date.parse(c.capturedAt) : undefined }]));
    for (const c of snapshot.calls) {
      if (c.name !== 'query-meal-detail' || !(c.result as any)?.structuredContent?.success) continue;
      const store = String(c.arguments.storeCode);
      if (!this.menus.has(store)) this.menus.set(store, new Set());
      this.menus.get(store)!.add(String(c.arguments.code));
    }
  }
  async call(name: PublicReadTool, args: Record<string, unknown>): Promise<unknown> {
    assertPublicCall(name, args);
    const result = this.captures.get(name + stable(args));
    if (!result) throw new Error('DEMO_CAPTURE_NOT_AVAILABLE');
    const copy = structuredClone(result) as any;
    if (name === 'query-meals') {
      const allowed = this.menus.get(String(args.storeCode)) ?? new Set();
      const data = copy.structuredContent.data;
      data.meals = Object.fromEntries(Object.entries(data.meals).filter(([code]) => allowed.has(code)));
      data.categories = data.categories.map((c: any) => ({ ...c, meals: c.meals.filter((m: any) => allowed.has(m.code)) }));
    }
    return copy;
  }
}
