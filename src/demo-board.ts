import type { Catalog, MenuItem } from './catalog.js';
import { STORE_CODES } from './catalog.js';
import { type Group, type Groups, pickHostDefault } from './domain/groups.js';
import { randomInt } from 'node:crypto';

const NAMES = ['午休水母', '加班猫猫', '等饭小鹿', '路过狐狸', '奶茶续命', '小番茄', '早八人', '阿乌', '芝士', '可乐冰', '薯条控', '麦旋风', '小林', '小圆', '豆豆', '阿禾', '糖糖', '柚子', '小葵', '小满', '阿北'];
export function demoNickname(groups: Groups, store: string, now = Date.now): string {
  const taken = new Set(groups.repo.all().filter(g => g.storeCode === store && g.deadline > now() && ['open', 'full', 'ordered'].includes(g.state)).flatMap(g => g.members.map(m => m.nickname)));
  const free = NAMES.filter(n => !taken.has(n));
  if (free.length) return free[randomInt(free.length)]!;
  let name: string;
  do { name = `拼友${randomInt(100, 1000)}`; } while (taken.has(name));
  return name;
}

// Prefer a spread of real meals; labelled samples only fill a short demo menu.
export async function demoMealChoices(catalog: Catalog, store: string): Promise<MenuItem[]> {
  const menu = await catalog.shareableMenu(store);
  const result: MenuItem[] = [];
  const styles = [/麦辣鸡腿/, /翅|鸡薯|麦乐鸡/, /麦香鱼|鳕鱼/, /亲子|开心乐园/, /四宫格|小食盘|分享/];
  for (const pool of [menu.filter(m => !m.sample), menu.filter(m => m.sample)]) {
    for (const style of styles) {
      const meal = pool.find(m => style.test(m.name) && !result.some(r => r.code === m.code));
      if (meal) result.push(meal);
    }
    for (const meal of pool) if (!result.some(r => r.code === meal.code)) result.push(meal);
  }
  return result;
}

function untouchedSeed(group: Group, store: string): boolean {
  const host = group.members.find(m => m.id === group.hostId)?.device;
  if (!host || !host.startsWith(`demo-host-${store}-`) && !host.startsWith(`demo-done-${store}-`)) return false;
  return group.members.every(m => m.device === host || m.device === `${host}-mate`);
}

const refreshes = new WeakMap<Groups, Promise<void>>();
export function seedDemoBoard(catalog: Catalog, groups: Groups, now = Date.now): Promise<void> {
  const pending = refreshes.get(groups);
  if (pending) return pending;
  const refresh = refreshDemoBoard(catalog, groups, now).finally(() => refreshes.delete(groups));
  refreshes.set(groups, refresh);
  return refresh;
}

async function refreshDemoBoard(catalog: Catalog, groups: Groups, now: () => number): Promise<void> {
  if (groups.repo.mode !== 'demo') throw new Error('DEMO_DATABASE_REQUIRED');
  for (const store of STORE_CODES) {
    const version = `rotating-meals-v2:${catalog.activePeriod()}`;
    const key = `demo-board:${store}`;
    const previous = groups.repo.db.prepare('SELECT value FROM app_meta WHERE key=?').get(key)?.value;
    groups.list(store); // Run normal expiry before finding vacant demo slots.
    const choices = await demoMealChoices(catalog, store);
    if (!choices.length) continue;
    // Upgrade old examples and rotate expired untouched success cards. A card
    // someone joined is always left to the normal state machine and 24h cleanup.
    for (const g of groups.repo.all().filter(g => g.storeCode === store && untouchedSeed(g, store) && ['open', 'full', 'ordered'].includes(g.state))) {
      if (previous === version && g.deadline > now()) continue;
      g.state = 'expired'; g.endedAt = Math.min(now(), g.deadline); groups.repo.save(g);
    }
    const slotActive = (device: string, state: string) => groups.repo.all().some(g => g.storeCode === store && g.state === state && g.deadline > now() && untouchedSeed(g, store) && g.members.some(m => m.id === g.hostId && m.device === device));
    const nextMeal = async () => {
      const used = new Set(groups.repo.all().filter(g => g.storeCode === store && g.deadline > now() && ['open', 'full', 'ordered'].includes(g.state)).map(g => g.meal.code));
      const unused = choices.filter(m => !used.has(m.code));
      const real = unused.filter(m => !m.sample);
      const pool = real.length ? real : unused.length ? unused : choices;
      // Keep the food styles varied while rotating the available candidates.
      const spread = pool.slice(0, Math.max(5, Math.min(pool.length, 10)));
      const item = spread[randomInt(spread.length)]!;
      return catalog.meal(store, item.code);
    };
    const seeds = [
      { tail4: '2716', take: 2, people: 2, minutes: 10, ago: 4 },
      { tail4: '5832', take: 1, people: 3, minutes: 30, ago: 7 },
      { tail4: '3307', take: 1, people: 2, minutes: 35, ago: 16 },
      { tail4: '9461', take: 3, people: 2, minutes: 45, ago: 12 },
      { tail4: '6150', take: 2, people: 3, minutes: 55, ago: 2 },
    ];
    for (const [index, x] of seeds.entries()) {
      const host = `demo-host-${store}-${index}`;
      if (slotActive(host, 'open')) continue;
      const meal = await nextMeal();
      const people = Math.min(x.people, meal.parts.length);
      const take = Math.min(x.take, meal.parts.length - people + 1);
      groups.create(host, store, meal, { ...x, nickname: demoNickname(groups, store, now), people, partIds: pickHostDefault(meal, take) }, now() - x.ago * 60_000);
    }
    for (const [index, x] of [{ tail4: '4417', ago: 9, order: false }, { tail4: '7203', ago: 21, order: true }].entries()) {
      const host = `demo-done-${store}-${index}`, mate = `${host}-mate`;
      if (slotActive(host, x.order ? 'ordered' : 'full')) continue;
      const meal = await nextMeal();
      const partIds = pickHostDefault(meal, Math.min(2, meal.parts.length - 1));
      let g = groups.create(host, store, meal, { ...x, nickname: demoNickname(groups, store, now), partIds, people: 2, minutes: 45 }, now() - x.ago * 60_000);
      g = groups.join(g.id, mate, { nickname: demoNickname(groups, store, now), tail4: ['0826', '3591'][index], partIds: meal.parts.filter(p => !partIds.includes(p.id)).map(p => p.id) });
      groups.action(g.id, mate, 'confirm');
      if (x.order) groups.action(g.id, host, 'ordered');
    }
    groups.repo.db.prepare('INSERT OR REPLACE INTO app_meta(key,value) VALUES(?,?)').run(key, version);
  }
}
