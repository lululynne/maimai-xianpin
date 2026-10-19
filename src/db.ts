import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Group } from './domain/groups.js';

export interface GroupRepository {
  readonly mode: 'live' | 'demo';
  transaction<T>(action: () => T): T;
  sweep(now: number): void;
  get(id: string): Group | undefined;
  all(): Group[];
  insert(group: Group): void;
  save(group: Group): void;
  joinCount(device: string, now: number): number;
  recordJoin(device: string, now: number): void;
  getMeta(key: string): string | undefined;
  setMeta(key: string, value: string): void;
}

export class Repository implements GroupRepository {
  readonly db: DatabaseSync;
  constructor(path: string, readonly mode: 'live' | 'demo') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.db.exec(readFileSync(new URL('../migrations/0001.sql', import.meta.url), 'utf8'));
    const modeRow = this.db.prepare('SELECT value FROM app_meta WHERE key = ?').get('mode');
    if (modeRow && modeRow.value !== mode) { this.db.close(); throw new Error('DATABASE_MODE_MISMATCH'); }
    this.db.prepare('INSERT OR IGNORE INTO app_meta(key,value) VALUES(?,?)').run('mode', mode);
  }
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  sweep(now: number) {
    this.db.prepare("UPDATE groups SET ended_at = deadline, state = CASE WHEN state IN ('open','full') THEN 'expired' ELSE state END WHERE ended_at IS NULL AND deadline <= ?").run(now);
    this.db.prepare('DELETE FROM groups WHERE ended_at IS NOT NULL AND ended_at <= ?').run(now - 24 * 60 * 60_000);
    this.db.prepare('DELETE FROM join_events WHERE at <= ?').run(now - 10 * 60_000);
  }
  private decode(row: any): Group {
    return { ...JSON.parse(row.payload), state: row.state, endedAt: row.ended_at };
  }
  get(id: string): Group | undefined {
    const row = this.db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    return row ? this.decode(row) : undefined;
  }
  all(): Group[] { return this.db.prepare('SELECT * FROM groups ORDER BY deadline, id').all().map(row => this.decode(row)); }
  insert(group: Group) {
    this.db.prepare('INSERT INTO groups(id,store_code,meal_code,state,created_at,deadline,ended_at,payload) VALUES(?,?,?,?,?,?,?,?)').run(group.id, group.storeCode, group.meal.code, group.state, group.createdAt, group.deadline, group.endedAt, JSON.stringify(group));
  }
  save(group: Group) {
    this.db.prepare('UPDATE groups SET state=?, ended_at=?, payload=? WHERE id=?').run(group.state, group.endedAt, JSON.stringify(group), group.id);
  }
  joinCount(device: string, now: number): number {
    return Number(this.db.prepare('SELECT COUNT(*) AS n FROM join_events WHERE device_id = ? AND at > ?').get(device, now - 10 * 60_000)?.n ?? 0);
  }
  recordJoin(device: string, now: number) { this.db.prepare('INSERT INTO join_events(device_id,at) VALUES(?,?)').run(device, now); }
  getMeta(key: string): string | undefined { return this.db.prepare('SELECT value FROM app_meta WHERE key=?').get(key)?.value as string | undefined; }
  setMeta(key: string, value: string) { this.db.prepare('INSERT OR REPLACE INTO app_meta(key,value) VALUES(?,?)').run(key, value); }
  close() { this.db.close(); }
}
