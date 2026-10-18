import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { assertPublicCall } from '../src/mcp/policy.js';
import { STORE_CODES } from '../src/catalog.js';

const source = '.local/probes';
const calls = [];
for (const file of (await readdir(source)).filter(n => /^\d+-.*\.json$/.test(n)).sort()) {
  const entry = JSON.parse(await readFile(`${source}/${file}`, 'utf8'));
  assertPublicCall(entry.name, entry.arguments);
  const raw = entry.result.structuredContent;
  if (!raw) throw new Error('Structured output required for reviewed captures');
  let data = raw.data;
  if (entry.name === 'query-meals' && raw.success) {
    const meals: Record<string, unknown> = {};
    for (const [code, row] of Object.entries(data.meals) as [string, any][]) {
      if (row.canWithOrder) continue;
      meals[code] = { name: row.name, image: row.image, currentPrice: row.currentPrice, originalPrice: row.originalPrice, canWithOrder: false };
    }
    data = { categories: data.categories.map((c: any) => ({ name: c.name, meals: c.meals.filter((m: any) => m.code in meals) })), meals };
  } else if (entry.name === 'query-nearby-stores' && raw.success) {
    data = data.filter((r: any) => STORE_CODES.includes(r.storeCode)).map((r: any) => ({ storeCode: r.storeCode, storeName: r.storeName, address: r.address, businessStatus: r.businessStatus, businessStartTime: r.businessStartTime, businessEndTime: r.businessEndTime, reservation: r.reservation, reservationTimeOptions: r.reservationTimeOptions }));
  } else if (entry.name === 'calculate-price' && raw.success) {
    data = { productPrice: data.productPrice, price: data.price, productList: data.productList };
  } else if (entry.name === 'query-meal-detail' && raw.success) {
    data = { code: data.code, name: data.name, rounds: data.rounds, supportModify: data.supportModify };
  }
  calls.push({ capturedAt: entry.capturedAt, name: entry.name, arguments: entry.arguments, result: { structuredContent: { success: raw.success, code: raw.code, message: raw.message, data }, isError: entry.result.isError === true } });
}
await mkdir('fixtures', { recursive: true });
const body = JSON.stringify({ source: 'McDonald’s official MCP live calls; store/menu/price data only; no account coupons, frequent orders, card offers, distances or trace IDs', calls }, null, 2) + '\n';
const token = process.env.MCD_MCP_TOKEN?.trim();
if (token && body.includes(token)) throw new Error('Credential detected');
await writeFile('fixtures/mcp-calls.json', body);
const schemas = await readFile(`${source}/tools-list.json`, 'utf8');
await writeFile('fixtures/mcp-tools.json', schemas);
await writeFile('fixtures/manifest.json', JSON.stringify({ files: { 'mcp-calls.json': createHash('sha256').update(body).digest('hex'), 'mcp-tools.json': createHash('sha256').update(schemas).digest('hex') }, callCount: calls.length, stores: STORE_CODES }, null, 2) + '\n');
console.log(`Saved ${calls.length} reviewed public read captures. Account-oriented fields excluded.`);
