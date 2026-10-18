import { mkdir, writeFile, readFile, open, unlink } from 'node:fs/promises';
import { McdMcpClient } from '../src/mcp/client.js';
import { defaultRounds, readProductPrice, STORE_CODES, unwrap, yuanToCents, Catalog } from '../src/catalog.js';
import { DemoMcpClient, type Capture } from '../src/mcp/demo.js';
import { captureFixtures } from './capture-fixtures.js';
import type { PublicReadTool } from '../src/mcp/policy.js';
import { kindOf } from '../src/domain/groups.js';

export function captureWindow(at: number, date: string, period: string): { start: number; end: number; open: boolean } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['lunch', 'dinner'].includes(period)) throw new Error('INVALID_CAPTURE_WINDOW');
  const start = Date.parse(`${date}T${period === 'lunch' ? '11:30' : '18:30'}:00+08:00`);
  const end = start + 3 * 60 * 60_000;
  if (!Number.isFinite(start)) throw new Error('INVALID_CAPTURE_WINDOW');
  return { start, end, open: at >= start && at < end };
}

export function candidatePriority(name: string): number {
  if (/桶|家庭/.test(name)) return 0;
  if (/分享|麦乐鸡|鸡翅/.test(name)) return 1;
  if (/麦辣|双人|三人/.test(name)) return 2;
  if (/圣代|麦旋风|开心乐园/.test(name)) return 3;
  return 4;
}

export async function captureDaypart(date: string, period: string, reserved = false, stores = STORE_CODES) {
  if (reserved) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['breakfast', 'lunch', 'dinner'].includes(period)) throw new Error('INVALID_CAPTURE_WINDOW');
  } else captureWindow(Date.now(), date, period);
  if (!stores.length || stores.some(s => !STORE_CODES.includes(s))) throw new Error('INVALID_STORE');
  const reservationDate = reserved ? `${date} ${period === 'breakfast' ? '08:00' : period === 'lunch' ? '12:00' : '19:00'}` : undefined;
  if (!reserved && !captureWindow(Date.now(), date, period).open) throw new Error('MCD_OUTSIDE_CAPTURE_WINDOW');
  const token = process.env.MCD_MCP_TOKEN?.trim();
  if (!token) throw new Error('MCD_MCP_TOKEN_MISSING');
  await mkdir('.local/probes', { recursive: true, mode: 0o700 });
  await mkdir('.local/menu-captures', { recursive: true, mode: 0o700 });
  const prefix = `${date}-${period}${reserved ? '-reserved' : ''}`, reportPath = `.local/menu-captures/${prefix}.json`;
  try {
    const previous = JSON.parse(await readFile(reportPath, 'utf8'));
    if (previous.finishedAt && previous.status === 'captured') { console.log('MCD_CAPTURE_ALREADY_FINISHED'); return previous; }
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const lockPath = '.local/menu-captures/capture.lock';
  const lock = await open(lockPath, 'wx', 0o600);
  const client = new McdMcpClient(token);
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/\D/g, '');
  let sequence = 0;
  const report: any = { date, period, mode: reserved ? 'reserved-query' : 'live-recheck', reservationDate, startedAt, status: 'running', stores: [], errors: [], callCount: 0 };
  const saveReport = async () => writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  const seenPrices = new Map<string, Capture>();
  async function call(name: PublicReadTool, args: Record<string, unknown>): Promise<Capture> {
    if (!reserved && !captureWindow(Date.now(), date, period).open) throw new Error('MCD_OUTSIDE_CAPTURE_WINDOW');
    const key = name + JSON.stringify(args);
    if (name === 'calculate-price' && seenPrices.has(key)) return seenPrices.get(key)!;
    let result: any;
    try { result = await client.call(name, args); }
    catch { result = { structuredContent: { success: false, code: 'MCD_READ_FAILED', message: 'Read failed', data: null }, isError: true }; }
    if (!reserved && !captureWindow(Date.now(), date, period).open) throw new Error('MCD_OUTSIDE_CAPTURE_WINDOW');
    const entry: Capture = { name, arguments: args, capturedAt: new Date().toISOString(), result };
    // Raw public-tool responses stay private; credentials never enter logs or fixtures.
    const safe = JSON.stringify(entry, null, 2).replaceAll(token!, '[REDACTED]') + '\n';
    await writeFile(`.local/probes/${runId}-${String(++sequence).padStart(4, '0')}-${name}.json`, safe, { mode: 0o600 });
    report.callCount++;
    if (name === 'calculate-price') seenPrices.set(key, entry);
    return entry;
  }
  try {
    await saveReport();
    const tools = await client.listTools();
    await writeFile('.local/probes/tools-list.json', JSON.stringify({ capturedAt: new Date().toISOString(), tools }, null, 2).replaceAll(token, '[REDACTED]') + '\n', { mode: 0o600 });
    for (const store of stores) {
      const summary: any = { storeCode: store, candidates: 0, captured: [], rejected: [] };
      report.stores.push(summary);
      const args = { storeCode: store, beType: 1, orderType: 1, ...(reservationDate ? { reservationDate } : {}) };
      let data: any;
      try { data = unwrap((await call('query-meals', args)).result); }
      catch { summary.error = 'MCD_MENU_READ_FAILED'; await saveReport(); continue; }
      const candidates = (Object.entries(data.meals ?? {}) as [string, any][])
        .filter(([, m]) => !m.canWithOrder && (/双人|多人|组合|件套|分享|桶|盒|套餐/.test(m.name) || (yuanToCents(m.currentPrice) ?? 0) >= Number(process.env.MIN_SHARE_PRICE_CENTS ?? 3000)))
        .sort((a, b) => candidatePriority(a[1].name) - candidatePriority(b[1].name));
      summary.candidates = candidates.length;
      for (const [code, row] of candidates) {
        try {
          const detail = unwrap((await call('query-meal-detail', { ...args, code })).result);
          const rounds = defaultRounds(detail);
          const choices = rounds.flatMap(r => r.comboItemList);
          const count = choices.reduce((n, c) => n + c.quantity, 0);
          if (count < 2 || count > 40 || choices.some(c => c.quantity > 20)) throw new Error('MCD_UNSUPPORTED_COMPOSITION');
          const quote = unwrap((await call('calculate-price', { ...args, items: [{ productCode: code, quantity: 1, roundList: rounds }] })).result);
          const priceCents = readProductPrice(quote, code);
          if (priceCents === null) throw new Error('MCD_PRICE_UNKNOWN');
          const parts = [];
          for (const item of choices) {
            const choice = detail.rounds.flatMap((r: any) => r.choices).find((c: any) => c.code === item.code);
            let unitPriceCents = null;
            try { unitPriceCents = readProductPrice(unwrap((await call('calculate-price', { ...args, items: [{ productCode: item.code, quantity: 1 }] })).result), item.code); }
            catch (error: any) { if (error.message === 'MCD_OUTSIDE_CAPTURE_WINDOW') throw error; }
            const name = String(choice?.name ?? '');
            parts.push({ code: item.code, name, kind: kindOf(name), quantity: item.quantity, unitPriceCents });
          }
          summary.captured.push({ code, name: row.name, priceCents, parts });
        } catch (error: any) {
          const reason = /^[A-Z_]+$/.test(error.message ?? '') ? error.message : 'MCD_MEAL_CAPTURE_FAILED';
          summary.rejected.push({ code, name: row.name, reason });
          if (reason === 'MCD_OUTSIDE_CAPTURE_WINDOW') throw error;
        }
        await saveReport();
      }
      console.log(`${store}: ${summary.captured.length} complete meal captures`);
    }
    report.status = report.stores.every((s: any) => s.captured.length >= 10) ? 'captured' : 'partial';
  } catch (error: any) {
    report.status = 'partial';
    report.errors.push(/^[A-Z_]+$/.test(error.message ?? '') ? error.message : 'MCD_CAPTURE_FAILED');
  } finally {
    report.finishedAt = new Date().toISOString();
    await client.close().catch(() => {});
    try {
      const calls = await captureFixtures();
      const now = Date.now;
      const menuTime = () => reservationDate ? Date.parse(reservationDate.replace(' ', 'T') + ':00+08:00') : Date.parse(startedAt);
      const catalog = new Catalog(new DemoMcpClient({ calls }, menuTime), now, 3000, undefined, menuTime);
      for (const store of report.stores) {
        const menu = await catalog.shareableMenu(store.storeCode);
        // Count this round's successful meals, never breakfast fallback.
        store.offered = menu.filter(m => store.captured.some((c: any) => c.code === m.code)).map(m => ({ code: m.code, name: m.name }));
        if (store.offered.length < 10) report.status = 'partial';
      }
    } catch { report.errors.push('MCD_FIXTURE_MERGE_FAILED'); report.status = 'partial'; }
    if (!reserved) {
      try {
        const earlier = JSON.parse(await readFile(`.local/menu-captures/${date}-${period}-reserved.json`, 'utf8'));
        report.unitPriceChanges = report.stores.flatMap((store: any) => store.captured.flatMap((meal: any) => {
          const previous = earlier.stores.find((s: any) => s.storeCode === store.storeCode)?.captured.find((m: any) => m.code === meal.code);
          if (!previous) return [];
          return meal.parts.flatMap((part: any) => { const old = previous.parts.find((p: any) => p.code === part.code); return old && old.unitPriceCents !== part.unitPriceCents ? [{ storeCode: store.storeCode, mealCode: meal.code, code: part.code, name: part.name, reservedCents: old.unitPriceCents, currentCents: part.unitPriceCents }] : []; });
        }));
        report.priceChanges = report.stores.flatMap((store: any) => store.captured.flatMap((meal: any) => {
          const previous = earlier.stores.find((s: any) => s.storeCode === store.storeCode)?.captured.find((m: any) => m.code === meal.code);
          return previous && previous.priceCents !== meal.priceCents ? [{ storeCode: store.storeCode, code: meal.code, name: meal.name, reservedCents: previous.priceCents, currentCents: meal.priceCents }] : [];
        }));
      } catch { report.priceChanges = null; }
    }
    await saveReport();
    await lock.close();
    await unlink(lockPath);
  }
  console.log(`Capture ${period}: ${report.status}; report ${reportPath}`);
  return report;
}

if (process.argv[1]?.endsWith('/capture-daypart.ts')) {
  try { await captureDaypart(process.argv[2] ?? '', process.argv[3] ?? '', process.argv.includes('--reserve'), process.argv.find(a => a.startsWith('--store='))?.slice(8).split(',') ?? STORE_CODES); }
  catch (error: any) { console.error(/^[A-Z_]+$/.test(error.message ?? '') ? error.message : 'MCD_CAPTURE_FAILED'); process.exitCode = 1; }
}
