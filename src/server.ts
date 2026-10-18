import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Catalog, STORE_CODES } from './catalog.js';
import { Repository } from './db.js';
import { Groups } from './domain/groups.js';
import { McdMcpClient } from './mcp/client.js';
import { DemoMcpClient } from './mcp/demo.js';

const mode = process.env.MCD_MODE ?? 'demo';
if (mode !== 'demo' && mode !== 'live') throw new Error('INVALID_MCD_MODE');
const snapshot = JSON.parse(readFileSync(new URL('../fixtures/mcp-calls.json', import.meta.url), 'utf8'));
const speed = mode === 'demo' ? Number(process.env.DEMO_SPEED ?? 1) : 1;
if (!Number.isFinite(speed) || speed < 1 || speed > 60) throw new Error('INVALID_DEMO_SPEED');
const base = Date.now();
const now = () => base + (Date.now() - base) * speed;
const reader = mode === 'demo' ? new DemoMcpClient(snapshot) : new McdMcpClient(process.env.MCD_MCP_TOKEN ?? '');
const catalog = new Catalog(reader, now, Number(process.env.MIN_SHARE_PRICE_CENTS ?? 3000));
const repo = new Repository(process.env.DATABASE_PATH || `data/${mode}.sqlite`, mode);
const groups = new Groups(repo, now);
repo.sweep(now());

if (mode === 'demo') {
  for (const store of STORE_CODES) {
    if (groups.list(store).length) continue;
    const meal = await catalog.meal(store, '9900016136');
    for (const [index, nickname] of ['小林', '小圆', '阿禾'].entries()) {
      groups.create(`demo-host-${store}-${index}`, store, meal, { nickname, tail4: ['2716', '5832', '9461'][index], partIds: meal.parts.slice(0, 2).map(p => p.id), people: 2, minutes: [10, 25, 40][index] }, now() - [4, 7, 12][index]! * 60_000);
    }
  }
}

const app = createApp({ catalog, groups, mode, now, speed, capturedAt: snapshot.calls[0]?.capturedAt ?? '' });
const root = fileURLToPath(new URL('../public/', import.meta.url));
app.get('/*', serveStatic({ root }));
const port = Number(process.env.PORT ?? 8787);
// HOST=0.0.0.0 只给演示模式用，方便同一局域网的手机打开模拟；实时模式始终只听本机。
const hostname = mode === 'demo' && process.env.HOST ? process.env.HOST : '127.0.0.1';
const server = serve({ fetch: app.fetch, port, hostname }, () => console.log(`麦麦现拼 · ${mode}\nLocal: http://127.0.0.1:${port}${hostname !== '127.0.0.1' ? `\nLAN: http://<本机局域网 IP>:${port}  手机模拟框: /phone.html` : ''}`));
const sweep = setInterval(() => repo.sweep(now()), 60_000);
const shutdown = () => { clearInterval(sweep); server.close(() => { repo.close(); if (reader instanceof McdMcpClient) void reader.close(); process.exit(0); }); };
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
