import { readFile, writeFile } from 'node:fs/promises';
import { Catalog, STORE_CODES } from '../src/catalog.js';
import { DemoMcpClient } from '../src/mcp/demo.js';
import { Repository } from '../src/db.js';
import { Groups, kindOf, pickHostDefault } from '../src/domain/groups.js';
import { sampleMeals } from '../src/sample-meals.js';

const snapshot = JSON.parse(await readFile('fixtures/mcp-calls.json', 'utf8'));
const now = Date.now;
const repo = new Repository(':memory:', 'demo');
const groups = new Groups(repo, now);
const result: any = { checkedAt: new Date().toISOString(), sourceCallCount: snapshot.calls.length, periods: {}, errors: [] };
try {
  for (const [period, hour] of [['breakfast', '08'], ['lunch', '12'], ['dinner', '19']]) {
    const menuTime = () => Date.parse(`2026-10-19T${hour}:00:00+08:00`);
    const catalog = new Catalog(new DemoMcpClient(snapshot, menuTime), now, 3000, sampleMeals, menuTime);
    const rows = [];
    for (const store of STORE_CODES) {
      const menu = await catalog.shareableMenu(store);
      const meals = [];
      for (const item of menu.filter(m => !m.sample)) {
        try {
          const meal = await catalog.meal(store, item.code);
          const partIds = pickHostDefault(meal, Math.min(2, meal.parts.length - 1));
          const g = groups.create(`check-${period}-${store}-${item.code}`, store, meal, { nickname: '菜单验证', tail4: '2468', partIds, people: 2, minutes: 30 });
          if (g.meal.priceCents !== meal.priceCents) throw new Error('PRICE_CHANGED');
          meals.push({ code: meal.code, name: meal.name, priceCents: meal.priceCents, verifiedAt: new Date(meal.verifiedAt).toISOString(), reservationDate: meal.reservationDate, forRequestedPeriod: item.availablePeriods?.includes(period as any) ?? false, singlePricesComplete: meal.parts.every(p => p.unitPriceCents !== null), parts: meal.parts.map(p => ({ name: p.name, kind: kindOf(p.name), unitPriceCents: p.unitPriceCents })) });
        } catch (error: any) { result.errors.push({ store, period, code: item.code, error: error.message }); }
      }
      rows.push({ store, forRequestedPeriod: meals.filter(m => m.forRequestedPeriod).length, fallback: meals.filter(m => !m.forRequestedPeriod).length, samples: menu.filter(m => m.sample).length, singlePricesComplete: meals.filter(m => m.singlePricesComplete).length, meals });
    }
    result.periods[period!] = rows;
  }
} finally { repo.close(); }
await writeFile('docs/reviews/20261019-menu-capture-summary.json', JSON.stringify(result, null, 2) + '\n');
for (const [period, rows] of Object.entries(result.periods) as [string, any[]][]) console.log(period, rows.map(r => `${r.store}: ${r.forRequestedPeriod} real / ${r.fallback} historical fallback / ${r.samples} samples`).join('; '));
console.log('Replay/create errors:', result.errors.length);
if (result.errors.length) { console.log(JSON.stringify(result.errors)); process.exitCode = 1; }
