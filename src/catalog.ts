import type { McpReader } from './mcp/client.js';
import { menuDaypart, type MenuDaypart } from './dayparts.js';

export interface Store { code: string; name: string; address: string; open: boolean; reservationTimeOptions: unknown[] }
export interface MenuItem { code: string; name: string; image: string; menuPriceCents: number | null; tags: string[]; availableDayparts?: MenuDaypart[]; sample?: boolean }
export interface Part { id: string; code: string; name: string; unitPriceCents: number | null; supportModify: boolean }
export interface Meal extends MenuItem { priceCents: number; parts: Part[]; verifiedAt: number }
export const STORE_CODES = ['1420082', '1420800', '1420277', '1421248'];
export const CACHE_MS = 10 * 60_000;

export function unwrap(result: any): any {
  if (result?.isError) throw new Error('MCD_BUSINESS_ERROR');
  let body = result?.structuredContent;
  if (!body) {
    const text = result?.content?.find((c: any) => c.type === 'text')?.text;
    try { body = JSON.parse(text); } catch { throw new Error('MCD_INVALID_RESPONSE'); }
  }
  if (body?.success !== true || body?.data == null) throw new Error('MCD_BUSINESS_ERROR');
  return body.data;
}

export function yuanToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) && result <= 10_000_000 ? result : null;
}

export function defaultRounds(detail: any): { round: string; comboItemList: { code: string; quantity: number }[] }[] {
  return (detail.rounds ?? []).map((round: any) => {
    let selected = round.choices.filter((c: any) => c.quantity > 0);
    if (!selected.length) {
      const first = round.choices.find((c: any) => c.isDefault === 1);
      if (!first) throw new Error('MCD_NO_DEFAULT_COMPOSITION');
      selected = [{ ...first, quantity: round.quantity }];
    }
    if (selected.reduce((n: number, c: any) => n + c.quantity, 0) !== round.quantity) throw new Error('MCD_INVALID_COMPOSITION');
    return { round: String(round.id), comboItemList: selected.map((c: any) => ({ code: c.code, quantity: c.quantity })) };
  });
}

export function readProductPrice(data: any, code: string): number | null {
  // Some unmatched products return success=true, zero totals and an empty productList.
  const line = data?.productList?.find((p: any) => p.productCode === code && p.quantity === 1);
  if (!line || !Number.isSafeInteger(line.subtotal) || line.subtotal < 0) return null;
  return line.subtotal;
}

export class Catalog {
  private cache = new Map<string, { until: number; value: Promise<any> }>();
  constructor(private readonly reader: McpReader, private readonly now = Date.now, readonly minPriceCents = 3000, private readonly samples?: (now: number) => Meal[]) {
    if (!Number.isSafeInteger(minPriceCents) || minPriceCents < 0 || minPriceCents > 10_000_000) throw new Error('INVALID_PRICE_THRESHOLD');
  }

  private cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);
    if (entry && entry.until > this.now()) return entry.value;
    if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
    const value = loader().catch(error => { this.cache.delete(key); throw error; });
    this.cache.set(key, { until: this.now() + CACHE_MS, value });
    return value;
  }

  stores(): Promise<Store[]> {
    return this.cached('stores', async () => {
      const rows = unwrap(await this.reader.call('query-nearby-stores', { beType: 1, searchType: 2, city: '中山市', keyword: '中山三乡' }));
      if (!Array.isArray(rows)) throw new Error('MCD_INVALID_RESPONSE');
      return rows.filter((r: any) => STORE_CODES.includes(r.storeCode)).map((r: any) => ({ code: r.storeCode, name: r.storeName, address: r.address, open: r.businessStatus === true, reservationTimeOptions: r.reservationTimeOptions ?? [] }));
    });
  }

  menu(store: string): Promise<MenuItem[]> {
    this.validateStore(store);
    return this.cached(`menu:${store}:${menuDaypart(this.now())}`, async () => {
      const result = await this.reader.call('query-meals', { storeCode: store, beType: 1, orderType: 1 });
      const data = unwrap(result);
      const availability = (result as any)?._availableDayparts as Record<string, MenuDaypart[]> | undefined;
      const tags = new Map<string, string[]>();
      for (const c of data.categories ?? []) for (const item of c.meals ?? []) tags.set(item.code, item.tags ?? []);
      return Object.entries(data.meals ?? {}).filter(([, v]: [string, any]) => !v.canWithOrder).map(([code, v]: [string, any]) => ({ code, name: String(v.name), image: /^https:\/\/(menu-img|img)\.mcd\.cn\//.test(v.image) ? v.image : '', menuPriceCents: yuanToCents(v.currentPrice), tags: tags.get(code) ?? [], ...(availability?.[code] ? { availableDayparts: availability[code] } : {}) }));
    });
  }

  async shareableMenu(store: string): Promise<MenuItem[]> {
    const real = await this.realShareableMenu(store);
    // 演示：真实可拼套餐不足 10 个时补上标「示例」的套餐（见 sample-meals.ts）。
    if (!this.samples || real.length >= 10) return real;
    return [...real, ...this.samples(this.now()).filter(s => !real.some(r => r.name === s.name)).map(({ parts, priceCents, verifiedAt, ...item }) => item)];
  }

  private async realShareableMenu(store: string): Promise<MenuItem[]> {
    const all = (await this.menu(store)).filter(m => /双人|多人|组合|件套|分享|桶|盒|套餐/.test(m.name + m.tags.join(' ')) || (m.menuPriceCents ?? 0) >= this.minPriceCents);
    const current = all.filter(m => m.availableDayparts?.includes(menuDaypart(this.now())));
    // Live menus have no snapshot metadata. Missing demo periods fall back to
    // all recorded, fully replayable meals without inventing availability.
    return current.length ? current : all;
  }

  private price(store: string, item: Record<string, unknown>): Promise<{ cents: number | null; verifiedAt: number }> {
    const code = String(item.productCode);
    return this.cached(`price:${store}:${menuDaypart(this.now())}:${JSON.stringify(item)}`, async () => {
      const result = await this.reader.call('calculate-price', { storeCode: store, beType: 1, orderType: 1, items: [item] });
      return { cents: readProductPrice(unwrap(result), code), verifiedAt: (result as any)._sourceTimestamp ?? this.now() };
    });
  }

  meal(store: string, code: string): Promise<Meal> {
    this.validateStore(store);
    const sample = this.samples?.(this.now()).find(m => m.code === code);
    if (sample) return Promise.resolve(sample);
    if (!/^\d{1,20}$/.test(code)) throw new Error('INVALID_MEAL');
    return this.cached(`meal:${store}:${code}:${menuDaypart(this.now())}`, async () => {
      const menu = (await this.menu(store)).find(m => m.code === code);
      if (!menu) throw new Error('MEAL_NOT_AVAILABLE');
      const detail = unwrap(await this.reader.call('query-meal-detail', { storeCode: store, beType: 1, orderType: 1, code }));
      const rounds = defaultRounds(detail);
      const quote = await this.price(store, { productCode: code, quantity: 1, roundList: rounds });
      const priceCents = quote.cents;
      if (priceCents === null) throw new Error('MEAL_PRICE_UNAVAILABLE');
      const parts: Part[] = [];
      for (const r of rounds) for (const c of r.comboItemList) {
        if (c.quantity > 20 || parts.length + c.quantity > 40) throw new Error('MEAL_TOO_LARGE');
        const choice = detail.rounds.find((v: any) => String(v.id) === r.round).choices.find((v: any) => v.code === c.code);
        let unitPriceCents: number | null = null;
        try { unitPriceCents = (await this.price(store, { productCode: c.code, quantity: 1 })).cents; } catch { /* explicit unknown-price fallback */ }
        for (let i = 0; i < c.quantity; i++) parts.push({ id: `${r.round}-${c.code}-${i}`, code: c.code, name: choice.name, unitPriceCents, supportModify: choice.supportModify === true });
      }
      if (parts.length < 2) throw new Error('MEAL_NOT_SHAREABLE');
      return { ...menu, priceCents, parts, verifiedAt: quote.verifiedAt };
    });
  }

  private validateStore(store: string) {
    if (!STORE_CODES.includes(store)) throw new Error('INVALID_STORE');
  }
}
