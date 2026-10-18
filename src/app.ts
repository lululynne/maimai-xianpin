import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { randomUUID } from 'node:crypto';
import type { Catalog } from './catalog.js';
import { windowAt, pickHostDefault, DomainError, type Groups } from './domain/groups.js';

export function createApp(options: { catalog: Catalog; groups: Groups; mode: 'live' | 'demo'; now: () => number; speed: number; capturedAt: string; menuPreview?: string }) {
  const { catalog, groups, mode, now } = options;
  const app = new Hono<{ Variables: { device: string } }>();
  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cache-Control', 'no-cache');
    c.header('Content-Security-Policy', "default-src 'self'; img-src 'self' https://menu-img.mcd.cn https://img.mcd.cn data:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
    await next();
  });
  app.use('/api/*', bodyLimit({ maxSize: 16 * 1024 }));
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    const origin = c.req.header('Origin');
    if ((origin && origin !== new URL(c.req.url).origin) || c.req.header('Sec-Fetch-Site') === 'cross-site') return c.json({ error: '不接受跨站请求' }, 403);
    if (c.req.method === 'POST' && !c.req.header('Content-Type')?.startsWith('application/json')) return c.json({ error: '请使用 JSON 请求' }, 415);
    let device = getCookie(c, 'maimai_device');
    if (!device || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(device)) device = randomUUID();
    setCookie(c, 'maimai_device', device, { httpOnly: true, sameSite: 'Strict', secure: new URL(c.req.url).protocol === 'https:', path: '/', maxAge: 24 * 60 * 60 });
    c.set('device', device);
    await next();
  });
  app.onError((error, c) => {
    if (error instanceof DomainError) return c.json({ error: error.code }, error.status as 400);
    if (error instanceof SyntaxError) return c.json({ error: '请求格式不正确' }, 400);
    const known = /^(INVALID_STORE|INVALID_MEAL|MEAL_NOT_AVAILABLE|MEAL_NOT_SHAREABLE|MEAL_TOO_LARGE|MEAL_PRICE_UNAVAILABLE|MCD_[A-Z_]+|DEMO_CAPTURE_NOT_AVAILABLE)$/;
    return c.json({ error: known.test(error.message) ? error.message : '服务暂时不可用，请稍后重试' }, 502);
  });
  app.get('/api/config', c => c.json({ mode, serverNow: now(), clockSpeed: options.speed, capturedAt: options.capturedAt, menuPreview: options.menuPreview ?? 'auto', couponsEnabled: false, window: windowAt(now()), windowSimulated: mode === 'demo' }));
  // 午市 11:30–14:30、晚市 18:30–21:30 才开放发起和加入；演示模式按开放时段模拟。
  const requireWindow = () => { if (mode !== 'demo' && !windowAt(now()).open) throw new DomainError(`拼单只在午市 11:30–14:30、晚市 18:30–21:30 开放，下一场 ${windowAt(now()).next}`, 409); };
  app.get('/api/stores', async c => c.json({ stores: await catalog.stores() }));
  app.get('/api/stores/:store/meals', async c => {
    const meals = await catalog.shareableMenu(c.req.param('store'));
    const period = catalog.activePeriod();
    const fallback = mode === 'demo' && !meals.some(m => !m.sample && m.availablePeriods?.includes(period));
    return c.json({ meals, period, fallback });
  });
  app.get('/api/stores/:store/meals/:meal', async c => c.json({ meal: await catalog.meal(c.req.param('store'), c.req.param('meal')) }));
  app.get('/api/groups', c => c.json({ groups: groups.list(c.req.query('store') ?? '').map(g => groups.view(g, c.get('device'))), serverNow: now() }));
  app.get('/api/mine', c => c.json({ groups: groups.mine(c.get('device')).map(g => groups.view(g, c.get('device'))) }));
  app.get('/api/groups/done', c => c.json({ groups: groups.done(c.req.query('store') ?? '').map(g => groups.view(g, c.get('device'))), serverNow: now() }));
  app.get('/api/groups/similar', c => c.json({ groups: groups.similar(c.req.query('store') ?? '', c.req.query('meal') ?? '').map(g => groups.view(g, c.get('device'))) }));
  app.post('/api/groups', async c => {
    const body = await c.req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DomainError('请求格式不正确');
    if (body.confirmedSimilar !== true) throw new DomainError('请先确认相似拼单', 409);
    requireWindow();
    const w = windowAt(now());
    if (mode !== 'demo' && w.end && Number.isInteger(body.minutes) && now() + body.minutes * 60_000 > w.end) body.minutes = Math.max(10, Math.floor((w.end - now()) / 60_000));
    const meal = await catalog.meal(String(body.storeCode), String(body.mealCode));
    const g = groups.create(c.get('device'), String(body.storeCode), meal, body);
    return c.json({ group: groups.view(g, c.get('device')) }, 201);
  });
  app.get('/api/groups/:id', c => c.json({ group: groups.view(groups.get(c.req.param('id')), c.get('device')) }));
  if (mode === 'demo') app.post('/api/demo/groups/:id/fill', c => {
    let g = groups.get(c.req.param('id'));
    if (!groups.view(g, c.get('device')).isHost) throw new DomainError('只有发起人可以操作', 403);
    if (g.state !== 'open') throw new DomainError('这单已拼满或结束', 409);
    while (g.members.length < g.people) {
      const used = new Set(g.members.flatMap(m => m.partIds));
      const remaining = g.meal.parts.filter(p => !used.has(p.id));
      const last = g.members.length === g.people - 1;
      const partIds = (last ? remaining : remaining.slice(0, 1)).map(p => p.id);
      let tail = 1;
      while (g.members.some(m => m.tail4 === String(tail).padStart(4, '0'))) tail++;
      const simulatedDevice = randomUUID();
      g = groups.join(g.id, simulatedDevice, { nickname: `演示拼友${g.members.length}`, tail4: String(tail).padStart(4, '0'), partIds });
      g = groups.action(g.id, simulatedDevice, 'confirm');
    }
    return c.json({ group: groups.view(g, c.get('device')) });
  });
  // 演示发起人名字：最多五个字，同一家店正在拼的单里不重名（梅宝 10-19）
  const DEMO_NAMES = ['午休水母', '加班猫猫', '等饭小鹿', '路过狐狸', '奶茶续命', '小番茄', '早八人', '阿乌', '芝士', '可乐冰', '薯条控', '麦旋风'];
  const demoHostName = (store: string) => {
    const taken = new Set(groups.list(store).flatMap(g => g.members.filter(m => m.id === g.hostId).map(m => m.nickname)));
    const free = DEMO_NAMES.filter(n => !taken.has(n));
    return free.length ? free[Math.floor(Math.random() * free.length)] : `拼友${Math.floor(100 + Math.random() * 900)}`;
  };
  // 演示：给每台设备在「我的拼单」里放一单自己发起、已等了 18 分钟的单；以及把自己那单快进到等满 31 分钟。
  if (mode === 'demo') app.post('/api/demo/mine/seed', async c => {
    const device = c.get('device');
    if (groups.mine(device).some(g => g.hostId === g.members.find(m => m.device === device)?.id)) return c.json({ seeded: false });
    const body = await c.req.json().catch(() => ({}));
    const store = typeof body?.storeCode === 'string' ? body.storeCode : '1420082';
    const menu = await catalog.shareableMenu(store);
    const meal = await catalog.meal(store, menu.find(m => /双人|分享|桶/.test(m.name))?.code ?? menu[0]?.code ?? '9900016136');
    groups.create(device, store, meal, { nickname: demoHostName(store), tail4: String(1000 + Math.floor(Math.random() * 9000)), partIds: pickHostDefault(meal), people: 2, minutes: 60 }, now() - 18 * 60_000);
    return c.json({ seeded: true });
  });
  if (mode === 'demo') app.post('/api/demo/groups/:id/age', c => {
    const g = groups.get(c.req.param('id'));
    if (!groups.view(g, c.get('device')).isHost) throw new DomainError('只有发起人可以操作', 403);
    if (g.state !== 'open') throw new DomainError('这单已拼满或结束', 409);
    g.createdAt = Math.min(g.createdAt, now() - 31 * 60_000);
    if (g.deadline <= now() + 60_000) throw new DomainError('这单快到点了，换一单演示', 409);
    groups.repo.save(g);
    return c.json({ group: groups.view(g, c.get('device')) });
  });
  if (mode === 'demo') app.get('/api/demo/groups/:id/counter', c => {
    const g = groups.get(c.req.param('id'));
    if (!groups.view(g, c.get('device')).viewerId) throw new DomainError('只有本单成员可以打开演示的门店视角', 403);
    return c.json({ counter: groups.counter(g) });
  });
  if (mode === 'demo') app.post('/api/demo/groups/:id/collect-others', c => {
    let g = groups.get(c.req.param('id'));
    const me = groups.view(g, c.get('device')).viewerId ?? (() => { throw new DomainError('只有本单成员可以操作', 403); })();
    if (g.state !== 'ordered') throw new DomainError('还没下单，或这单已经取完', 409);
    for (const m of g.members) if (m.id !== me && !m.collectedAt && m.device !== c.get('device')) g = groups.action(g.id, m.device, 'collect');
    return c.json({ group: groups.view(g, c.get('device')) });
  });
  app.post('/api/groups/:id/join', async c => {
    requireWindow();
    const g = groups.join(c.req.param('id'), c.get('device'), await c.req.json());
    return c.json({ group: groups.view(g, c.get('device')) });
  });
  for (const action of ['confirm', 'kick', 'ordered', 'picked-up', 'collect', 'keep-waiting', 'solo', 'take-all'] as const) app.post(`/api/groups/:id/${action}`, async c => {
    const body = await c.req.json();
    const g = groups.action(c.req.param('id'), c.get('device'), action, body?.memberId);
    return c.json({ group: groups.view(g, c.get('device')) });
  });
  app.notFound(c => c.json({ error: '没有这个页面' }, 404));
  return app;
}
