import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Catalog, STORE_CODES } from './catalog.js';
import { Repository } from './db.js';
import { Groups, pickHostDefault } from './domain/groups.js';
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
    // 演示五单：有人赶时间只允许 1 人加入，有人等得起允许 2 人加入；快照里有全家桶/分享盒时优先用它。
    const menu = await catalog.shareableMenu(store);
    const big = menu.find(m => /桶|分享|家庭/.test(m.name));
    const meal = await catalog.meal(store, big?.code ?? '9900016136');
    const seeds = [
      { nickname: '小林', tail4: '2716', take: 2, people: 2, minutes: 10, ago: 4 },
      { nickname: '小圆', tail4: '5832', take: 1, people: 3, minutes: 30, ago: 7 },
      { nickname: '豆豆', tail4: '3307', take: 1, people: 2, minutes: 35, ago: 16 },
      { nickname: '阿禾', tail4: '9461', take: 3, people: 2, minutes: 45, ago: 12 },
      { nickname: '糖糖', tail4: '6150', take: 2, people: 3, minutes: 55, ago: 2 },
    ].map(x => ({ ...x, take: Math.max(x.take, 2) })).filter(x => x.people <= meal.parts.length && x.take <= meal.parts.length - x.people + 1);
    for (const [index, x] of seeds.entries()) {
      groups.create(`demo-host-${store}-${index}`, store, meal, { nickname: x.nickname, tail4: x.tail4, partIds: pickHostDefault(meal, x.take), people: x.people, minutes: x.minutes }, now() - x.ago * 60_000);
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
