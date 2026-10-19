import { randomInt, randomUUID } from 'node:crypto';
import type { Meal } from '../catalog.js';
import type { GroupRepository } from '../db.js';
import { allocateShares } from './shares.js';

export type State = 'open' | 'full' | 'ordered' | 'picked-up' | 'expired';
export interface Member { id: string; device: string; nickname: string; tail4: string; partIds: string[]; confirmed: boolean; pickupCode?: string; collectedAt?: number }
export interface Perk { waitBonusCents?: number; solo?: boolean; takeAll?: boolean }
export interface Group { perk?: Perk; id: string; storeCode: string; meal: Meal; createdAt: number; deadline: number; endedAt: number | null; people: number; state: State; hostId: string; members: Member[]; pickedUpAt?: number }
export class DomainError extends Error { constructor(readonly code: string, readonly status = 400) { super(code); } }
function fail(code: string, status = 400): never { throw new DomainError(code, status); }

export function identity(input: any): { nickname: string; tail4: string } {
  if (!input || typeof input.nickname !== 'string' || typeof input.tail4 !== 'string') fail('请填写昵称和尾号后四位');
  const nickname = input.nickname.trim();
  if (!nickname || [...nickname].length > 20 || /[\x00-\x1f\x7f]/.test(nickname)) fail('昵称限 1–20 个字');
  if (/1[3-9]\d{9}/.test(nickname)) fail('昵称中不要填写完整手机号');
  if (!/^\d{4}$/.test(input.tail4)) fail('只填写手机尾号后四位');
  return { nickname, tail4: input.tail4 };
}

function choose(ids: unknown, available: string[]): string[] {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length || ids.some(id => !available.includes(id))) fail('餐品已被选走，请刷新后重选', 409);
  return ids;
}

export const MAX_PEOPLE = 3;
// 梅宝 10-19 定：4 件及以上的中大套餐，发起人至少拿「1 饮料 + 1 主食」，不能只挑主食——
// 发起人享受最大的等待优惠，也要承担饮料的溢价（高风险高收益）。
export const DRINK = /可乐|雪碧|芬达|咖|美式|拿铁|奶铁|卡布|浓缩|茶|饮|豆浆|牛奶|奶昔|果汁|橙|柠|水|怡泉/;
export const MAIN = /堡|麦满分|麦香鱼|麦香鸡|巨无霸|营养卷|卷|鸡腿|鸡翅|鸡块|麦乐鸡|鸡排|脆汁鸡|V翅|粥|饭|面|扒|肠/;
export const kindOf = (name: string): 'drink' | 'main' | 'other' => DRINK.test(name) ? 'drink' : MAIN.test(name) ? 'main' : 'other';
// 6 件及以上的大套餐升级为至少「2 饮料 + 2 主食」（梅宝 10-19 00:4x：不让发起人只点最少的东西蹭整套优惠、还不点饮料，拼友不被迫买单）。
// 主食两份以上时至少给拼友留一份主食，所以主食要求最多到「主食总数 − 1」。
export function hostNeeds(meal: Meal): { drink: number; main: number } {
  const drinks = meal.parts.filter(p => kindOf(p.name) === 'drink').length, mains = meal.parts.filter(p => kindOf(p.name) === 'main').length;
  if (meal.parts.length < 4 || !drinks || !mains) return { drink: 0, main: 0 };
  const need = meal.parts.length >= 6 ? 2 : 1;
  return { drink: Math.min(need, drinks), main: mains >= 2 ? Math.max(1, Math.min(need, mains - 1)) : 1 };
}
export function hostPickRule(meal: Meal) { return hostNeeds(meal).main > 0; }
export function pickHostDefault(meal: Meal, count = 2): string[] {
  const n = hostNeeds(meal);
  const first = [...meal.parts.filter(p => kindOf(p.name) === 'main').slice(0, n.main), ...meal.parts.filter(p => kindOf(p.name) === 'drink').slice(0, n.drink)].map(p => p.id);
  // 补齐到 count 件时先补小食和饮料，主食最多补到「主食总数 − 1」，不违反留主食规则。
  const mains = meal.parts.filter(p => kindOf(p.name) === 'main').length;
  const order = [...meal.parts.filter(p => kindOf(p.name) !== 'main'), ...meal.parts.filter(p => kindOf(p.name) === 'main')];
  const picked = [...first];
  for (const p of order) {
    if (picked.length >= count) break;
    if (picked.includes(p.id)) continue;
    if (kindOf(p.name) === 'main' && n.main && mains >= 2 && picked.filter(id => kindOf(meal.parts.find(q => q.id === id)!.name) === 'main').length >= mains - 1) continue;
    picked.push(p.id);
  }
  return picked;
}
// 梅宝定的等待补偿（理想版，只给发起人）：等满 15 分钟送 2 元券（10-19 并档：原 30 分钟 5 元档并入 30 分钟弹窗）；
// 等满 30 分钟弹窗：单点 8.5 折，或继续等待按自己那几样每样立减 1.5 元；继续等待后也可「不等了，整套餐下单」。
export const WAIT_PROMPT_MS = 30 * 60_000;
export const PER_ITEM_BONUS_CENTS = 150;
export const SOLO_RATE = 0.85;
// 只在午高峰、晚高峰开放拼单（北京时间）。
export const WINDOWS = [[11 * 60 + 30, 14 * 60 + 30], [18 * 60 + 30, 21 * 60 + 30]] as const;
export function windowAt(at: number): { open: boolean; end?: number; next: string } {
  const bj = new Date(at + 8 * 3600_000); const minute = bj.getUTCHours() * 60 + bj.getUTCMinutes();
  const dayStart = at - (minute * 60_000 + bj.getUTCSeconds() * 1000 + bj.getUTCMilliseconds());
  for (const [a, b] of WINDOWS) if (minute >= a && minute < b) return { open: true, end: dayStart + b * 60_000, next: '' };
  const upcoming = WINDOWS.find(([a]) => minute < a);
  return { open: false, next: upcoming ? `${Math.floor(upcoming[0] / 60)}:${String(upcoming[0] % 60).padStart(2, '0')}` : '明天 11:30' };
}

export class Groups {
  constructor(readonly repo: GroupRepository, private readonly now = Date.now) {}
  private current(id: string): Group {
    this.repo.sweep(this.now());
    return this.repo.get(id) ?? fail('拼单不存在或已删除', 404);
  }
  list(store: string): Group[] {
    this.repo.sweep(this.now());
    return this.repo.all().filter(g => g.storeCode === store && ['open', 'full'].includes(g.state) && g.deadline > this.now());
  }
  // 已拼成功：人齐了（等下单）、已下单、已取完，按发起时间新的在前（梅宝 10-19 要的第三个分页）
  done(store: string): Group[] {
    this.repo.sweep(this.now());
    return this.repo.all().filter(g => g.storeCode === store && ['full', 'ordered', 'picked-up'].includes(g.state)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  }
  similar(store: string, meal: string): Group[] { return this.list(store).filter(g => g.meal.code === meal && g.state === 'open').slice(0, 3); }
  mine(device: string): Group[] { this.repo.sweep(this.now()); return this.repo.all().filter(g => g.members.some(m => m.device === device)); }
  get(id: string): Group { return this.current(id); }

  create(device: string, storeCode: string, meal: Meal, input: any, createdAt = this.now()): Group {
    const who = identity(input);
    const minutes = input.minutes ?? 30;
    const people = input.people ?? 2;
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 60) fail('规定时间须为 10–60 分钟');
    if (!Number.isInteger(people) || people < 2 || people > Math.min(MAX_PEOPLE, meal.parts.length)) fail('一份套餐最多三人拼：发起人最多再允许 2 人加入');
    const partIds = choose(input.partIds, meal.parts.map(p => p.id));
    if (partIds.length > meal.parts.length - people + 1) fail('请为其他每个人至少留一件餐品');
    const needs = hostNeeds(meal);
    if (needs.main) {
      const kinds = partIds.map(id => kindOf(meal.parts.find(p => p.id === id)!.name));
      const took = { drink: kinds.filter(k => k === 'drink').length, main: kinds.filter(k => k === 'main').length };
      if (took.drink < needs.drink || took.main < needs.main) fail(`${meal.parts.length} 件的套餐，发起人至少要拿 ${needs.drink} 份饮料 + ${needs.main} 份主食`);
      // 对称的另一半（阿景补）：主食两份以上时不能全拿走，至少给拼友留一份。
      const mains = meal.parts.filter(p => kindOf(p.name) === 'main').length;
      if (mains >= 2 && took.main >= mains) fail('主食不能全拿走，至少给拼友留一份主食');
    }
    return this.repo.transaction(() => {
      this.repo.sweep(this.now());
      const member: Member = { id: randomUUID(), device, ...who, partIds, confirmed: true };
      const group: Group = { id: randomUUID(), storeCode, meal: structuredClone(meal), createdAt, deadline: createdAt + minutes * 60_000, endedAt: null, people, state: 'open', hostId: member.id, members: [member] };
      this.repo.insert(group);
      return group;
    });
  }

  join(id: string, device: string, input: any): Group {
    const who = identity(input);
    return this.repo.transaction(() => {
      const g = this.current(id);
      if (g.state !== 'open') fail('这单已经结束或拼满', 409);
      if (g.members.some(m => m.device === device)) fail('不能拼自己的单或重复加入', 409);
      if (g.members.some(m => m.tail4 === who.tail4)) fail('同一尾号不能重复加入', 409);
      if (this.repo.joinCount(device, this.now()) >= 3) fail('十分钟内最多加入三单，请稍后再试', 429);
      const used = new Set(g.members.flatMap(m => m.partIds));
      const remaining = g.meal.parts.filter(p => !used.has(p.id)).map(p => p.id);
      const partIds = choose(input.partIds, remaining);
      const seatsLeft = g.people - g.members.length - 1;
      if (seatsLeft < 0 || (seatsLeft === 0 && partIds.length !== remaining.length) || partIds.length > remaining.length - seatsLeft) fail('最后一位需选完剩余餐品，其他情况请为每人至少留一件');
      g.members.push({ id: randomUUID(), device, ...who, partIds, confirmed: false });
      if (g.members.length === g.people && g.members.flatMap(m => m.partIds).length === g.meal.parts.length) g.state = 'full';
      this.repo.recordJoin(device, this.now());
      this.repo.save(g);
      return g;
    });
  }

  action(id: string, device: string, action: 'confirm' | 'kick' | 'ordered' | 'picked-up' | 'collect' | 'keep-waiting' | 'solo' | 'take-all', memberId?: string): Group {
    return this.repo.transaction(() => {
      const g = this.current(id);
      const member = g.members.find(m => m.device === device) ?? fail('只有本单成员可以操作', 403);
      if (action === 'confirm') {
        if (!['open', 'full'].includes(g.state)) fail('这单已结束，不能再确认', 409);
        member.confirmed = true;
      } else if (action === 'collect') {
        // 每人凭自己的取餐码取走自己那份就算完成；全员取完整单结束。
        if (g.state !== 'ordered') fail('还没下单，或这单已经取完', 409);
        if (member.collectedAt) fail('你这份已经取过了', 409);
        member.collectedAt = this.now();
        if (g.members.every(m => m.collectedAt)) { g.state = 'picked-up'; g.pickedUpAt = this.now(); g.endedAt = Math.min(this.now(), g.deadline); }
      } else {
        if (member.id !== g.hostId) fail('只有发起人可以操作', 403);
        if (action === 'keep-waiting' || action === 'solo' || action === 'take-all') {
          if (g.state !== 'open') fail('这单已经拼满或结束', 409);
          if (this.now() - g.createdAt < WAIT_PROMPT_MS) fail('等满 30 分钟后才能选择', 409);
          g.perk ??= {};
          if (action === 'keep-waiting') {
            if (g.perk.waitBonusCents) fail('已经领过继续等待的立减', 409);
            g.perk.waitBonusCents = PER_ITEM_BONUS_CENTS * member.partIds.length;
          } else if (action === 'solo') {
            if (g.members.length > 1) fail('已经有人加入，不能改单点；可以选「不等了，整套餐下单」', 409);
            g.perk.solo = true; g.state = 'expired'; g.endedAt = this.now();
          } else {
            const used = new Set(g.members.flatMap(m => m.partIds));
            member.partIds.push(...g.meal.parts.filter(p => !used.has(p.id)).map(p => p.id));
            g.perk.takeAll = true; g.people = g.members.length;
            g.state = 'full';
          }
          this.repo.save(g);
          return g;
        }
        if (action === 'kick') {
          if (!['open', 'full'].includes(g.state)) fail('这单不能再移出成员', 409);
          const target = g.members.find(m => m.id === memberId);
          if (!target || target.confirmed || target.id === g.hostId) fail('只能移出尚未确认的拼单人', 409);
          g.members = g.members.filter(m => m.id !== memberId);
          g.state = 'open';
        } else if (action === 'ordered') {
          if (g.state !== 'full' || g.members.some(m => !m.confirmed)) fail('拼满且所有人确认后，才能标记已下单', 409);
          g.state = 'ordered';
          // 理想版：门店为同一张单的每个人各出一个取餐码。码只给本人和门店看。
          const used = new Set<string>();
          for (const m of g.members) { let code; do code = String(randomInt(1000, 10000)); while (used.has(code)); used.add(code); m.pickupCode = code; }
        } else {
          if (g.state !== 'ordered') fail('发起人还没下单', 409);
          g.state = 'picked-up';
          g.pickedUpAt = this.now();
          for (const m of g.members) m.collectedAt ??= this.now();
          g.endedAt = Math.min(this.now(), g.deadline);
        }
      }
      this.repo.save(g);
      return g;
    });
  }

  // 门店视角：只有门店能看到同一张单下每个人的尾号和取餐码。v1 只在演示模式开放这个视角。
  counter(g: Group) {
    return { id: g.id, meal: g.meal.name, state: g.state, members: g.members.map(m => ({ nickname: m.nickname, tail4: m.tail4, pickupCode: m.pickupCode, parts: m.partIds.map(id => g.meal.parts.find(p => p.id === id)!.name), collected: Boolean(m.collectedAt) })) };
  }

  view(g: Group, device: string) {
    const used = new Set(g.members.flatMap(m => m.partIds));
    const unclaimed = g.meal.parts.filter(p => !used.has(p.id));
    const allocations = g.members.map(m => ({ id: m.id, items: m.partIds.map(id => ({ unitPriceCents: g.meal.parts.find(p => p.id === id)!.unitPriceCents, quantity: 1 })) }));
    if (unclaimed.length) allocations.push({ id: 'unclaimed', items: unclaimed.map(p => ({ unitPriceCents: p.unitPriceCents, quantity: 1 })) });
    const allocation = allocateShares(g.meal.priceCents, allocations, g.hostId);
    const viewer = g.members.find(m => m.device === device);
    const waitedMs = Math.max(0, Math.min(this.now(), g.deadline, g.pickedUpAt ?? Infinity, g.perk?.takeAll || g.perk?.solo ? (g.endedAt ?? Infinity) : Infinity) - g.createdAt);
    const isHost = viewer?.id === g.hostId;
    const host = g.members.find(m => m.id === g.hostId)!;
    const hostShare = allocation.shares.find(s => s.id === g.hostId)!.cents;
    const unit = host.partIds.map(id => g.meal.parts.find(p => p.id === id)!.unitPriceCents);
    const soloBase = unit.every(c => c !== null) ? unit.reduce((a, c) => a! + c!, 0)! : null;
    // 发起人实付（理想版模拟）：一人整套 = 套餐价 − 继续等待立减；有人同单 = 自己那份 × 8.5 折；单点 = 单点价 × 8.5 折；其余 = 分摊 − 立减。
    const perk = g.perk ?? {};
    const hostPay = perk.solo ? (soloBase === null ? null : Math.round(soloBase * SOLO_RATE))
      : perk.takeAll ? (g.members.length === 1 ? Math.max(0, g.meal.priceCents - (perk.waitBonusCents ?? 0)) : Math.round(hostShare * SOLO_RATE))
      : Math.max(0, hostShare - (perk.waitBonusCents ?? 0));
    return {
      id: g.id, storeCode: g.storeCode, meal: g.meal, createdAt: g.createdAt, deadline: g.deadline, people: g.people, state: g.state, hostId: g.hostId,
      // 尾号和取餐码只给本人；同单的其他人只看到昵称、餐品和金额，防止凭别人的尾号或码把那份领走。
      members: g.members.map(({ device: _device, tail4, pickupCode, collectedAt, ...m }) => ({ ...m, tail4: viewer?.id === m.id ? tail4 : undefined, pickupCode: viewer?.id === m.id ? pickupCode : undefined, collected: Boolean(collectedAt), cents: allocation.shares.find(s => s.id === m.id)!.cents })),
      viewerId: viewer?.id, isHost: viewer?.id === g.hostId, remainingPartIds: unclaimed.map(p => p.id), method: allocation.method,
      waitedMs, idealCouponYuan: isHost && waitedMs >= 15 * 60_000 ? 2 : 0,
      perk: isHost ? { ...perk, hostPayCents: hostPay, soloBaseCents: soloBase, prompt: g.state === 'open' && waitedMs >= WAIT_PROMPT_MS && !perk.waitBonusCents, canSolo: g.members.length === 1 } : undefined,
      pickedUpAt: g.pickedUpAt, serverNow: this.now(),
    };
  }
}
