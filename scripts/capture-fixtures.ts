import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { assertPublicCall } from '../src/mcp/policy.js';
import { STORE_CODES } from '../src/catalog.js';
import type { Capture } from '../src/mcp/demo.js';

const pick = (value: any, keys: string[]) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));

export function sanitizeCapture(entry: Capture): Capture {
  assertPublicCall(entry.name, entry.arguments);
  const raw = entry.result.structuredContent;
  if (!raw) throw new Error('MCD_CAPTURE_STRUCTURE_REQUIRED');
  let data = raw.data;
  if (entry.name === 'query-meals' && raw.success) {
    const meals: Record<string, unknown> = {};
    for (const [code, row] of Object.entries(data.meals) as [string, any][]) {
      if (row.canWithOrder) continue;
      meals[code] = { name: row.name, image: row.image, currentPrice: row.currentPrice, originalPrice: row.originalPrice, canWithOrder: false };
    }
    data = { categories: data.categories.map((c: any) => ({ name: c.name, meals: c.meals.filter((m: any) => m.code in meals).map((m: any) => pick(m, ['code', 'tags'])) })), meals };
  } else if (entry.name === 'query-nearby-stores' && raw.success) {
    data = data.filter((r: any) => STORE_CODES.includes(r.storeCode)).map((r: any) => ({ storeCode: r.storeCode, storeName: r.storeName, address: r.address, businessStatus: r.businessStatus, businessStartTime: r.businessStartTime, businessEndTime: r.businessEndTime, reservation: r.reservation, reservationTimeOptions: r.reservationTimeOptions }));
  } else if (entry.name === 'calculate-price' && raw.success) {
    data = { productPrice: data.productPrice, price: data.price, productList: data.productList?.map((p: any) => pick(p, ['productCode', 'productName', 'quantity', 'originalSubtotal', 'subtotal'])) };
  } else if (entry.name === 'query-meal-detail' && raw.success) {
    data = { code: data.code, name: data.name, rounds: data.rounds?.map((r: any) => ({ ...pick(r, ['id', 'name', 'quantity', 'maxQuantity', 'minQuantity']), choices: r.choices.map((c: any) => pick(c, ['code', 'name', 'quantity', 'maxQuantity', 'isDefault', 'diffPrice', 'supportModify'])) })), supportModify: data.supportModify };
  }
  return { capturedAt: entry.capturedAt, name: entry.name, arguments: entry.arguments, result: { structuredContent: { success: raw.success, code: raw.code, message: raw.message, data }, isError: entry.result.isError === true } };
}

export function mergeCaptures(entries: Capture[]): Capture[] {
  const calls = new Map<string, Capture>();
  for (const entry of entries) {
    const safe = sanitizeCapture(entry);
    calls.set(JSON.stringify([safe.capturedAt, safe.name, safe.arguments]), safe);
  }
  return [...calls.values()].sort((a, b) => Date.parse(a.capturedAt ?? '') - Date.parse(b.capturedAt ?? ''));
}

export async function captureFixtures() {
  const source = '.local/probes';
  const previous = JSON.parse(await readFile('fixtures/mcp-calls.json', 'utf8'));
  const entries: Capture[] = [...previous.calls];
  for (const file of (await readdir(source)).filter(n => /^\d+-.*\.json$/.test(n)).sort()) entries.push(JSON.parse(await readFile(`${source}/${file}`, 'utf8')));
  const calls = mergeCaptures(entries);
  const body = JSON.stringify({ source: 'McDonald’s official MCP live calls; store/menu/price data only; no account coupons, frequent orders, card offers, distances or trace IDs', calls }, null, 2) + '\n';
  const token = process.env.MCD_MCP_TOKEN?.trim();
  if (token && body.includes(token)) throw new Error('MCD_CREDENTIAL_DETECTED');
  let schemas: string;
  try { schemas = await readFile(`${source}/tools-list.json`, 'utf8'); }
  catch { schemas = await readFile('fixtures/mcp-tools.json', 'utf8'); }
  if (token && schemas.includes(token)) throw new Error('MCD_CREDENTIAL_DETECTED');
  await mkdir('fixtures', { recursive: true });
  for (const [file, value] of Object.entries({ 'mcp-calls.json': body, 'mcp-tools.json': schemas, 'manifest.json': JSON.stringify({ files: { 'mcp-calls.json': createHash('sha256').update(body).digest('hex'), 'mcp-tools.json': createHash('sha256').update(schemas).digest('hex') }, callCount: calls.length, stores: STORE_CODES }, null, 2) + '\n' })) {
    const temporary = `fixtures/${file}.tmp`;
    await writeFile(temporary, value);
    await rename(temporary, `fixtures/${file}`);
  }
  console.log(`Saved ${calls.length} reviewed public read captures; existing periods preserved.`);
  return calls;
}

if (process.argv[1]?.endsWith('/capture-fixtures.ts')) {
  await captureFixtures();
}
