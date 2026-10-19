import type { GroupRepository } from '../db.js';
import type { Group } from '../domain/groups.js';

interface DemoData {
  version: 1;
  device: string;
  groups: Group[];
  joins: { device: string; at: number }[];
  meta: Record<string, string>;
}
export type DemoStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const STORAGE_KEY = 'maimai-xianpin:browser-demo:v1';

// This adapter is only bundled into the standalone demo. The live server keeps
// SQLite; no browser data is sent to it or to the McDonald's account API.
export class BrowserRepository implements GroupRepository {
  readonly mode = 'demo' as const;
  readonly device: string;
  private data: DemoData;
  constructor(private readonly storage?: DemoStorage) {
    let saved: DemoData | undefined;
    try {
      const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
      if (value?.version === 1 && /^[0-9a-f-]{36}$/.test(value.device) && Array.isArray(value.groups) && Array.isArray(value.joins) && value.meta && typeof value.meta === 'object') saved = value;
    } catch { /* A blocked storage area or old demo data starts a fresh demo. */ }
    this.data = saved ?? { version: 1, device: crypto.randomUUID(), groups: [], joins: [], meta: {} };
    this.device = this.data.device;
  }
  flush() {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
    catch { /* Private/restricted browsers still get a working in-memory demo. */ }
  }
  transaction<T>(action: () => T): T {
    const before = structuredClone(this.data);
    try { return action(); }
    catch (error) { this.data = before; throw error; }
  }
  sweep(now: number) {
    for (const g of this.data.groups) if (g.endedAt === null && g.deadline <= now) {
      g.endedAt = g.deadline;
      if (g.state === 'open' || g.state === 'full') g.state = 'expired';
    }
    this.data.groups = this.data.groups.filter(g => g.endedAt === null || g.endedAt > now - 24 * 60 * 60_000);
    this.data.joins = this.data.joins.filter(j => j.at > now - 10 * 60_000);
  }
  get(id: string): Group | undefined { const g = this.data.groups.find(g => g.id === id); return g ? structuredClone(g) : undefined; }
  all(): Group[] { return structuredClone(this.data.groups).sort((a, b) => a.deadline - b.deadline || a.id.localeCompare(b.id)); }
  insert(group: Group) {
    if (this.data.groups.some(g => g.id === group.id)) throw new Error('DUPLICATE_DEMO_GROUP');
    this.data.groups.push(structuredClone(group));
  }
  save(group: Group) {
    const i = this.data.groups.findIndex(g => g.id === group.id);
    if (i >= 0) this.data.groups[i] = structuredClone(group);
  }
  joinCount(device: string, now: number): number { return this.data.joins.filter(j => j.device === device && j.at > now - 10 * 60_000).length; }
  recordJoin(device: string, now: number) { this.data.joins.push({ device, at: now }); }
  getMeta(key: string): string | undefined { return this.data.meta[key]; }
  setMeta(key: string, value: string) { this.data.meta[key] = value; }
}
