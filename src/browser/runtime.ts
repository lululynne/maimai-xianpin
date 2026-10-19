import { createApp } from '../app.js';
import { Catalog } from '../catalog.js';
import { Groups } from '../domain/groups.js';
import { DemoMcpClient, type Capture } from '../mcp/demo.js';
import { menuPeriod, serviceTime } from '../dayparts.js';
import { sampleMeals } from '../sample-meals.js';
import { BrowserRepository, type DemoStorage } from './repository.js';

export function createBrowserDemo(snapshot: { calls: Capture[] }, storage?: DemoStorage, now = Date.now) {
  // Always show the captured lunch menu, so late-night visitors can try the full
  // variety. Recruiting deadlines continue to use the actual clock.
  const menuTime = () => {
    const date = new Date(now() + 8 * 3600_000).toISOString().slice(0, 10);
    return Date.parse(`${date}T12:00:00+08:00`);
  };
  const repo = new BrowserRepository(storage);
  const reader = new DemoMcpClient(snapshot, menuTime);
  const catalog = new Catalog(reader, now, 3000, sampleMeals, menuTime);
  const groups = new Groups(repo, now);
  const captures = snapshot.calls.filter(c => c.name === 'query-meals' && c.result?.structuredContent?.success && menuPeriod(serviceTime(c.arguments.reservationDate, c.capturedAt)) === 'lunch');
  const app = createApp({ catalog, groups, mode: 'demo', now, speed: 1, capturedAt: captures.at(-1)?.capturedAt ?? '', menuPreview: 'lunch', demoDevice: repo.device });
  let pending: Promise<unknown> = Promise.resolve();
  const request: typeof fetch = (input, init) => {
    // Keep browser actions and refreshes ordered. Every request uses this tab's
    // own anonymous identity and never becomes a network API request.
    const task = pending.then(async () => {
      const origin = 'https://browser-demo.invalid';
      const url = new URL(input instanceof Request ? input.url : String(input), origin);
      if (!url.pathname.startsWith('/api/')) throw new Error('INVALID_DEMO_REQUEST');
      const base = input instanceof Request ? input : new Request(url, init);
      const headers = new Headers(base.headers);
      headers.delete('Origin');
      const response = await app.fetch(new Request(new URL(url.pathname + url.search, origin), { method: base.method, headers, body: base.method === 'GET' || base.method === 'HEAD' ? undefined : await base.text() }));
      repo.flush();
      return response;
    });
    pending = task.catch(() => {});
    return task;
  };
  return { fetch: request };
}
