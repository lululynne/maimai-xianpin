import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Catalog } from './catalog.js';
import { Repository } from './db.js';
import { Groups } from './domain/groups.js';
import { McdMcpClient } from './mcp/client.js';
import { DemoMcpClient } from './mcp/demo.js';
import { sampleMeals } from './sample-meals.js';
import { menuPeriod, serviceTime } from './dayparts.js';
import { seedDemoBoard } from './demo-board.js';

const mode = process.env.MCD_MODE ?? 'demo';
if (mode !== 'demo' && mode !== 'live') throw new Error('INVALID_MCD_MODE');
const snapshot = JSON.parse(readFileSync(new URL('../fixtures/mcp-calls.json', import.meta.url), 'utf8'));
const speed = mode === 'demo' ? Number(process.env.DEMO_SPEED ?? 1) : 1;
if (!Number.isFinite(speed) || speed < 1 || speed > 60) throw new Error('INVALID_DEMO_SPEED');
const base = Date.now();
const now = () => base + (Date.now() - base) * speed;
const menuPreview = mode === 'demo' ? process.env.DEMO_MENU_PERIOD ?? 'auto' : 'auto';
if (!['auto', 'breakfast', 'lunch', 'dinner'].includes(menuPreview)) throw new Error('INVALID_MENU_PREVIEW');
const menuTime = () => {
  if (menuPreview === 'auto') return now();
  const date = new Date(now() + 8 * 3600_000).toISOString().slice(0, 10);
  return Date.parse(`${date}T${menuPreview === 'breakfast' ? '08:00' : menuPreview === 'lunch' ? '12:00' : '19:00'}:00+08:00`);
};
const reader = mode === 'demo' ? new DemoMcpClient(snapshot, menuTime) : new McdMcpClient(process.env.MCD_MCP_TOKEN ?? '');
const catalog = new Catalog(reader, now, Number(process.env.MIN_SHARE_PRICE_CENTS ?? 3000), mode === 'demo' ? sampleMeals : undefined, menuTime);
const repo = new Repository(process.env.DATABASE_PATH || `data/${mode}.sqlite`, mode);
const groups = new Groups(repo, now);
repo.sweep(now());

if (mode === 'demo') await seedDemoBoard(catalog, groups, now);

const periodCaptures = snapshot.calls.filter((c: any) => c.name === 'query-meals' && c.result?.structuredContent?.success && menuPeriod(serviceTime(c.arguments.reservationDate, c.capturedAt)) === menuPeriod(menuTime()));
const capturedAt = periodCaptures.at(-1)?.capturedAt ?? snapshot.calls.at(-1)?.capturedAt ?? '';
const app = createApp({ catalog, groups, mode, now, speed, capturedAt, menuPreview });
const root = fileURLToPath(new URL('../public/', import.meta.url));
app.get('/*', serveStatic({ root }));
const port = Number(process.env.PORT ?? 8787);
// HOST=0.0.0.0 只给演示模式用，方便同一局域网的手机打开模拟；实时模式始终只听本机。
const hostname = mode === 'demo' && process.env.HOST ? process.env.HOST : '127.0.0.1';
const server = serve({ fetch: app.fetch, port, hostname }, () => console.log(`麦麦现拼 · ${mode}\nLocal: http://127.0.0.1:${port}${hostname !== '127.0.0.1' ? `\nLAN: http://<本机局域网 IP>:${port}  手机模拟框: /phone.html` : ''}`));
const sweep = setInterval(() => {
  repo.sweep(now());
  if (mode === 'demo') void seedDemoBoard(catalog, groups, now).catch(() => console.error('DEMO_REFRESH_FAILED'));
}, 30_000);
const shutdown = () => { clearInterval(sweep); server.close(() => { repo.close(); if (reader instanceof McdMcpClient) void reader.close(); process.exit(0); }); };
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
