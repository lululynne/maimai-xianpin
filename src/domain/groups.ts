import { randomUUID } from 'node:crypto';
import type { Meal } from '../catalog.js';
import type { Repository } from '../db.js';
import { allocateShares } from './shares.js';

export type State = 'open' | 'full' | 'ordered' | 'picked-up' | 'expired';
export interface Member { id: string; device: string; nickname: string; tail4: string; partIds: string[]; confirmed: boolean }
export interface Group { id: string; storeCode: string; meal: Meal; createdAt: number; deadline: number; endedAt: number | null; people: number; state: State; hostId: string; members: Member[]; pickedUpAt?: number }
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

export class Groups {
  constructor(readonly repo: Repository, private readonly now = Date.now) {}
  private current(id: string): Group {
    this.repo.sweep(this.now());
    return this.repo.get(id) ?? fail('拼单不存在或已删除', 404);
  }
  list(store: string): Group[] {
    this.repo.sweep(this.now());
    return this.repo.all().filter(g => g.storeCode === store && ['open', 'full'].includes(g.state) && g.deadline > this.now());
  }
  similar(store: string, meal: string): Group[] { return this.list(store).filter(g => g.meal.code === meal && g.state === 'open').slice(0, 3); }
  mine(device: string): Group[] { this.repo.sweep(this.now()); return this.repo.all().filter(g => g.members.some(m => m.device === device)); }
  get(id: string): Group { return this.current(id); }

  create(device: string, storeCode: string, meal: Meal, input: any, createdAt = this.now()): Group {
    const who = identity(input);
    const minutes = input.minutes ?? 30;
    const people = input.people ?? 2;
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 60) fail('规定时间须为 10–60 分钟');
    if (!Number.isInteger(people) || people < 2 || people > meal.parts.length) fail('人数须在 2 人到餐品件数之间');
    const partIds = choose(input.partIds, meal.parts.map(p => p.id));
    if (partIds.length > meal.parts.length - people + 1) fail('请为其他每个人至少留一件餐品');
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

  action(id: string, device: string, action: 'confirm' | 'kick' | 'ordered' | 'picked-up', memberId?: string): Group {
    return this.repo.transaction(() => {
      const g = this.current(id);
      const member = g.members.find(m => m.device === device) ?? fail('只有本单成员可以操作', 403);
      if (action === 'confirm') {
        if (!['open', 'full'].includes(g.state)) fail('这单已结束，不能再确认', 409);
        member.confirmed = true;
      } else {
        if (member.id !== g.hostId) fail('只有发起人可以操作', 403);
        if (action === 'kick') {
          if (!['open', 'full'].includes(g.state)) fail('这单不能再移出成员', 409);
          const target = g.members.find(m => m.id === memberId);
          if (!target || target.confirmed || target.id === g.hostId) fail('只能移出尚未确认的拼单人', 409);
          g.members = g.members.filter(m => m.id !== memberId);
          g.state = 'open';
        } else if (action === 'ordered') {
          if (g.state !== 'full' || g.members.some(m => !m.confirmed)) fail('拼满且所有人确认后，才能标记已下单', 409);
          g.state = 'ordered';
        } else {
          if (g.state !== 'ordered') fail('请先在官方渠道下单并标记已下单', 409);
          g.state = 'picked-up';
          g.pickedUpAt = this.now();
          g.endedAt = Math.min(this.now(), g.deadline);
        }
      }
      this.repo.save(g);
      return g;
    });
  }

  view(g: Group, device: string) {
    const used = new Set(g.members.flatMap(m => m.partIds));
    const unclaimed = g.meal.parts.filter(p => !used.has(p.id));
    const allocations = g.members.map(m => ({ id: m.id, items: m.partIds.map(id => ({ unitPriceCents: g.meal.parts.find(p => p.id === id)!.unitPriceCents, quantity: 1 })) }));
    if (unclaimed.length) allocations.push({ id: 'unclaimed', items: unclaimed.map(p => ({ unitPriceCents: p.unitPriceCents, quantity: 1 })) });
    const allocation = allocateShares(g.meal.priceCents, allocations, g.hostId);
    const viewer = g.members.find(m => m.device === device);
    const waitedMs = Math.max(0, Math.min(this.now(), g.deadline, g.pickedUpAt ?? Infinity) - g.createdAt);
    return {
      id: g.id, storeCode: g.storeCode, meal: g.meal, createdAt: g.createdAt, deadline: g.deadline, people: g.people, state: g.state, hostId: g.hostId,
      members: g.members.map(({ device: _device, tail4, ...m }) => ({ ...m, tail4: viewer ? tail4 : undefined, cents: allocation.shares.find(s => s.id === m.id)!.cents })),
      viewerId: viewer?.id, isHost: viewer?.id === g.hostId, remainingPartIds: unclaimed.map(p => p.id), method: allocation.method,
      waitedMs, idealCouponYuan: waitedMs > 30 * 60_000 ? 5 : waitedMs >= 15 * 60_000 ? 2 : 0,
      pickedUpAt: g.pickedUpAt, serverNow: this.now(),
    };
  }
}
