import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Catalog, STORE_CODES } from '../src/catalog.js';
import { DemoMcpClient } from '../src/mcp/demo.js';
import { sampleMeals } from '../src/sample-meals.js';

const context: any = {};
runInNewContext(readFileSync('public/i18n.js', 'utf8'), context);
const { translateText, chooseLanguage } = context.MaiMaiI18n;
const han = /[\u3400-\u9fff]/;

test('English covers all offered real and sample meal/item names in every captured store and period', async () => {
  const snapshot = JSON.parse(readFileSync('fixtures/mcp-calls.json', 'utf8'));
  const names = new Set<string>();
  for (const hour of ['08', '12', '19']) {
    const at = () => Date.parse(`2026-10-19T${hour}:00:00+08:00`);
    const catalog = new Catalog(new DemoMcpClient(snapshot, at), at, 3000, sampleMeals, at);
    for (const store of STORE_CODES) for (const item of await catalog.shareableMenu(store)) {
      names.add(item.name);
      const meal = await catalog.meal(store, item.code);
      meal.parts.forEach(p => names.add(p.name));
    }
  }
  assert.ok(names.size > 100);
  for (const name of names) {
    const translated = translateText(name);
    assert.ok(!han.test(translated), `${name}: ${translated}`);
    assert.notEqual(translated, name);
  }
});

test('language selection honors explicit links and saved preference before browser language', () => {
  assert.equal(chooseLanguage('en', 'zh', 'zh-CN'), 'en');
  assert.equal(chooseLanguage('zh', 'en', 'en-US'), 'zh');
  assert.equal(chooseLanguage(null, 'zh', 'en-US'), 'zh');
  assert.equal(chooseLanguage('unsupported', null, 'zh-HK'), 'zh');
  assert.equal(chooseLanguage(null, null, 'en-GB'), 'en');
});

test('dynamic translations preserve amounts, timers, user nicknames and the meaning of Chinese discounts', () => {
  assert.equal(translateText('还剩 12:34'), '12:34 left');
  assert.equal(translateText('单点下单（8.5 折）'), 'Order solo (15% off)');
  assert.equal(translateText('我出 ¥22.32'), 'My share ¥22.32');
  assert.equal(translateText('@麦香鱼（发起人）'), '@麦香鱼 (Host)');
  assert.equal(translateText('最多允许 2 人一起拼单'), 'Up to 2 more');
  assert.match(translateText('核价时间 2026/10/19 03:25:44，实际以门店价格为准。'), /2026\/10\/19 03:25:44 \(Beijing time\)/);
  const card = translateText('麦麦现拼 · 麦香鱼套餐\n@梅宝 · 尾号 1234\n中薯条 × 1\n分摊 ¥22.32\n门店 麦当劳中山三乡餐厅\n正在等人 · 12:34 截止');
  assert.match(card, /@梅宝/);
  assert.match(card, /Filet-O-Fish Meal/);
  assert.match(card, /¥22\.32/);
  assert.match(card, /Waiting for someone/);
  assert.ok(!han.test(card.replace('@梅宝', '')));
});
