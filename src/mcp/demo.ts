import type { McpReader } from './client.js';
import { assertPublicCall, type PublicReadTool } from './policy.js';
import { defaultRounds, readProductPrice } from '../catalog.js';
import { capturedDaypart, menuDaypart, type MenuDaypart } from '../dayparts.js';

export interface Capture { name: string; arguments: Record<string, unknown>; result: any; capturedAt?: string }

function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + stable(v)).join(',') + '}';
  return JSON.stringify(value);
}
const successful = (c: Capture) => !c.result?.isError && c.result?.structuredContent?.success === true;

export class DemoMcpClient implements McpReader {
  private captures = new Map<string, Capture[]>();
  private menus = new Map<string, Capture[]>();
  private availability = new Map<string, Map<string, Set<MenuDaypart>>>();
  private completeDetails = new Set<Capture>();

  constructor(snapshot: { calls: Capture[] }, private readonly now = Date.now) {
    const calls = [...snapshot.calls].sort((a, b) => Date.parse(a.capturedAt ?? '') - Date.parse(b.capturedAt ?? ''));
    for (const c of calls) {
      const key = c.name + stable(c.arguments);
      this.captures.set(key, [...(this.captures.get(key) ?? []), c]);
      if (c.name === 'query-meals' && successful(c)) {
        const store = String(c.arguments.storeCode);
        this.menus.set(store, [...(this.menus.get(store) ?? []), c]);
      }
    }
    // A detail without its exact combo quote cannot be offered in the demo.
    for (const c of calls) {
      if (c.name !== 'query-meal-detail' || !successful(c)) continue;
      const period = capturedDaypart(c.capturedAt);
      if (!period) continue;
      try {
        const rounds = defaultRounds(c.result.structuredContent.data);
        const count = rounds.flatMap(r => r.comboItemList).reduce((n, item) => n + item.quantity, 0);
        if (count < 2 || count > 40 || rounds.some(r => r.comboItemList.some(i => i.quantity > 20))) continue;
        const store = String(c.arguments.storeCode), code = String(c.arguments.code);
        const quotes = this.captures.get('calculate-price' + stable({ storeCode: store, beType: 1, orderType: 1, items: [{ productCode: code, quantity: 1, roundList: rounds }] })) ?? [];
        if (!quotes.some(q => successful(q) && capturedDaypart(q.capturedAt) === period && readProductPrice(q.result.structuredContent.data, code) !== null)) continue;
        if (!this.availability.has(store)) this.availability.set(store, new Map());
        const meals = this.availability.get(store)!;
        if (!meals.has(code)) meals.set(code, new Set());
        meals.get(code)!.add(period);
        this.completeDetails.add(c);
      } catch { /* Incomplete or unsupported captures remain evidence, not menu tiles. */ }
    }
  }

  private recorded(name: string, args: Record<string, unknown>): Capture {
    let all = this.captures.get(name + stable(args)) ?? [];
    if (name === 'query-meal-detail') all = all.filter(c => this.completeDetails.has(c));
    const period = menuDaypart(this.now());
    const matching = all.filter(c => capturedDaypart(c.capturedAt) === period);
    const candidates = matching.length ? matching : all;
    const valid = candidates.filter(successful);
    const item = (args.items as any[])?.[0];
    const priced = name === 'calculate-price' ? valid.filter(c => readProductPrice(c.result.structuredContent.data, String(item?.productCode)) !== null) : valid;
    const capture = priced.at(-1) ?? valid.at(-1) ?? candidates.at(-1);
    if (!capture) throw new Error('DEMO_CAPTURE_NOT_AVAILABLE');
    return capture;
  }

  async call(name: PublicReadTool, args: Record<string, unknown>): Promise<unknown> {
    assertPublicCall(name, args);
    const period = menuDaypart(this.now());
    const capture = this.recorded(name, args);
    if (name !== 'query-meals') return { ...structuredClone(capture.result), _sourceTimestamp: Date.parse(capture.capturedAt ?? '') };
    const store = String(args.storeCode), availability = this.availability.get(store);
    const rows = new Map<string, { row: any; period: MenuDaypart }>();
    const categories: any[] = [];
    for (const menu of this.menus.get(store) ?? []) {
      const when = capturedDaypart(menu.capturedAt);
      if (!when) continue;
      const data = menu.result.structuredContent.data;
      for (const [code, row] of Object.entries(data.meals ?? {})) {
        if (!availability?.get(code)?.has(when)) continue;
        const old = rows.get(code);
        if (!old || when === period || old.period !== period) rows.set(code, { row, period: when });
      }
      categories.push(...(data.categories ?? []));
    }
    const copy = structuredClone(capture.result);
    copy.structuredContent.data = {
      meals: Object.fromEntries([...rows].map(([code, value]) => [code, value.row])),
      categories: categories.map(c => ({ ...c, meals: c.meals.filter((m: any) => rows.has(m.code)) })),
    };
    return { ...copy, _sourceTimestamp: Date.parse(capture.capturedAt ?? ''), _availableDayparts: Object.fromEntries([...rows.keys()].map(code => [code, [...availability!.get(code)!]])) };
  }
}
