'use strict';
const $ = selector => document.querySelector(selector);
const state = { stores: [], meals: [], board: [], mine: [], tab: 'board', selectedMeal: null, draft: null, detail: null, config: null, clockAt: 0, clockRealAt: 0 };
// Reserved for the art batch. Adding files later does not change business logic.
const ART = { waiting: '/assets/jelly-waiting.png', full: '/assets/jelly-full.png', urgent: '/assets/jelly-urgent.png', expired: '/assets/jelly-expired.png', empty: '/assets/empty-plaza.png', ticket: '/assets/ticket.png' };
let artManifest = {};
function applyArt() {
  document.querySelectorAll('[data-art-slot]').forEach(el => {
    const key = el.dataset.artSlot === 'empty-plaza' ? 'empty' : el.dataset.artSlot;
    if (!artManifest[key] || !ART[key] || el.querySelector('.art-asset')) return;
    const image = new Image(); image.alt = ''; image.className = 'art-asset';
    image.addEventListener('load', () => { el.prepend(image); el.classList.add('has-art'); }); image.src = ART[key];
  });
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = cents => '¥' + (cents / 100).toFixed(2);
const chinaDate = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const chinaTime = value => new Date(value).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const now = () => state.clockAt + (Date.now() - state.clockRealAt) * (state.config?.clockSpeed ?? 1);
const labels = { open: '正在等人', full: '已经拼满', ordered: '已在官方渠道下单', 'picked-up': '已取到', expired: '到点结束' };
const messages = { MCD_MCP_CONNECT_FAILED: '菜单连接暂时不可用，请稍后重试', MCD_MCP_READ_FAILED: '菜单查询暂时不可用，请稍后重试', MCD_BUSINESS_ERROR: '当前餐品暂不可用，请重新选一个套餐', DEMO_CAPTURE_NOT_AVAILABLE: '演示没有采集这个选项，请选双人餐', MEAL_NOT_AVAILABLE: '当前时段没有这个餐品', MEAL_NOT_SHAREABLE: '这个餐品暂时无法拆分，请换一个套餐', MEAL_PRICE_UNAVAILABLE: '暂时核不到价格，请稍后重试' };
let toastTimer;
function toast(text) { $('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 7000); }
async function api(path, body) {
  const res = await fetch('/api' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(messages[data.error] ?? data.error ?? '暂时没有连上，请重试');
  return data;
}
function guard(fn) { return async event => { const button = event?.submitter ?? event?.currentTarget; if (button?.tagName === 'BUTTON') button.disabled = true; try { await fn(event); } catch (e) { toast(e.message); } finally { if (button?.tagName === 'BUTTON') button.disabled = false; } }; }
function syncClock(value) { if (value) { state.clockAt = value; state.clockRealAt = Date.now(); } }
function partsText(parts) {
  const counts = new Map();
  for (const part of parts) counts.set(part.name, (counts.get(part.name) ?? 0) + 1);
  return [...counts].map(([name, count]) => `${name} × ${count}`).join('、');
}
function similarPartsText(parts) {
  const counts = new Map();
  for (const part of parts) counts.set(part.name, (counts.get(part.name) ?? 0) + 1);
  return [...counts].map(([name, count]) => `${name}（数量：${count}）`).join('、');
}
const ICON = '/assets/theme/';
function mealIcon(name = '') {
  // 按剩下的主要餐品配纳纳的食物图标；没有对应的就用拼单图标。
  const rules = [[/桶|分享|家庭/, 'pindan-icon'], [/麦辣|鸡腿堡/, 'spicy-chicken-burger-icon'], [/堡/, 'burger-icon'], [/翅|鸡块|麦乐鸡/, 'wing-icon'], [/薯/, 'fries-game-icon'], [/圣代|甜筒|冰淇淋|麦旋风/, 'cone-icon'], [/可乐|咖|饮|豆浆|茶|雪碧|芬达/, 'cola-icon']];
  return ICON + (rules.find(([re]) => re.test(name))?.[1] ?? 'pindan-icon') + '.png';
}
function friesLoader(text = '正在查看这家店的拼单…') { return `<div class="fries-ld" role="status"><div class="box"><img class="grey" src="${ICON}fries-game-icon.png" alt=""><img class="color" src="${ICON}fries-game-icon.png" alt=""><span class="sp">✦</span><span class="sp">✦</span><span class="sp">✦</span></div><div class="bar"><i></i></div><p>${escape(text)}</p></div>`; }
function renderStoreChips() {
  const current = $('#store').value;
  $('#store-chips').innerHTML = state.stores.map(s => `<button type="button" class="tag ${s.code === current ? '' : 'off'}" data-store="${escape(s.code)}">${escape(s.name.replace(/^麦当劳/, ''))}</button>`).join('');
  document.querySelectorAll('[data-store]').forEach(b => b.addEventListener('click', () => { if ($('#store').value === b.dataset.store) return; $('#store').value = b.dataset.store; $('#store').dispatchEvent(new Event('change')); }));
}
// 理想版模拟（只在演示模式出现）：一单多码、出餐推送、等拼补偿券。都需要官方小程序/柜台/券系统配合，这里只在本页模拟，不调用任何下单或发券接口。
const sim = () => state.config?.mode === 'demo';
function pushBanner(title, body) {
  const el = document.createElement('div'); el.className = 'push';
  el.innerHTML = `<img src="${ICON}fries-game-icon.png" alt=""><div><b>${escape(title)}</b><span>${escape(body)}</span></div><small>现在</small>`;
  el.popover = 'manual'; document.body.append(el); try { el.showPopover(); } catch {} requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => { try { el.hidePopover(); } catch {} el.remove(); }, 400); }, 6000);
}
function simBlock(g, own) {
  if (!sim()) return '';
  const counter = ['ordered', 'picked-up'].includes(g.state) ? (state.counter?.id === g.id ? `<div class="counter"><div class="counter-head">门店视角 · 一单 ${state.counter.members.length} 个取餐码<em>理想版模拟</em></div>${state.counter.members.map(m => `<div class="code-row ${own && m.nickname === own.nickname ? 'me' : ''}"><b>${escape(m.pickupCode)}</b><span>@${escape(m.nickname)} · ${escape(m.parts.join('、'))}</span><small>尾号 ${escape(m.tail4)} · ${m.collected ? '已取走' : '待取'}</small></div>`).join('')}<p>只有门店能看到这张表。每个码只对应自己那几样，凭一个码拿不走整份。</p></div>` : '<button class="sm-link" data-counter>演示：切到门店视角（只有门店看得到所有尾号和取餐码）</button>') : '';
  const yuan = g.idealCouponYuan || (state.couponPreview === g.id ? 2 : 0);
  const coupon = yuan ? `<div class="coupon"><div class="c-amt">¥${yuan}</div><div class="c-txt"><b>等拼补偿券</b><span>${g.state === 'expired' ? '没拼成也不白等，可直接单点时用' : '拼单等了 ' + Math.max(15, Math.floor(g.waitedMs / 60000)) + ' 分钟'}</span><small>15 分钟 2 元 · 超过 30 分钟 5 元 · 每人每天一张 · 自己取消不给 · 理想版模拟，不是真券</small></div></div>` : `<p class="muted">已等待 ${Math.floor(g.waitedMs / 60000)} 分钟。等满 15 分钟，理想版会发 2 元补偿券；超过 30 分钟 5 元（只算取餐时间前的等待）。</p><button class="sm-link" data-coupon-preview>演示：看看等满 15 分钟的补偿券</button>`;
  return counter + coupon;
}
function timerText(deadline) { const seconds = Math.max(0, Math.ceil((deadline - now()) / 1000)); return seconds ? `⏱ 还剩 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '已截止'; }
function leftText(deadline) { const seconds = Math.max(0, Math.ceil((deadline - now()) / 1000)); return seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} 后截止` : '已截止'; }
function render() {
  $('#board-count').textContent = state.board.length;
  $('#mine-count').textContent = state.mine.length;
  $('#board-note').textContent = state.tab === 'board' ? '按截止时间排序，先帮快到点的那一单。' : '保留这张卡片，到店核对。取到提醒最多延迟 30 秒。';
  const groups = state[state.tab];
  $('#board').innerHTML = groups.length ? groups.map(g => {
    const remaining = g.meal.parts.filter(p => g.remainingPartIds.includes(p.id));
    const restCents = g.meal.priceCents - g.members.reduce((sum, m) => sum + m.cents, 0);
    const own = g.members.find(m => m.id === g.viewerId);
    const host = g.members.find(m => m.id === g.hostId);
    const missing = g.people - g.members.length;
    const each = g.state === 'open' && missing > 0 ? Math.round(restCents / missing) : null;
    const action = own ? '我的卡片' : g.state === 'open' ? '拼！' : '看看';
    return `<article class="card ${g.deadline - now() < 10 * 60000 && g.state === 'open' ? 'urgent' : ''} ${own ? 'mine' : ''}"><img class="food" src="${mealIcon(remaining[0]?.name ?? g.meal.name)}" alt=""><div class="t"><b>@${escape(host.nickname)} ${g.state === 'open' ? `还可加入 ${missing} 人` : escape(labels[g.state])}${g.isHost ? '<em>我发起的</em>' : own ? '<em>我参与的</em>' : ''}</b><span class="meal-name">${escape(g.meal.name)}</span><span class="allow">最多允许 ${g.people - 1} 人一起拼单</span><span>${escape(remaining.length ? '剩下 ' + partsText(remaining) : partsText(g.meal.parts))}${own ? ` · 我出 ${money(own.cents)}` : each !== null ? ` · 每人约 ${money(each)}` : ''}</span><div class="timer" data-deadline="${g.deadline}" data-style="timer">${escape(timerText(g.deadline))}</div></div><button class="${own ? 'btn-y' : g.state === 'open' ? 'primary' : ''}" data-detail="${g.id}">${action}</button></article>`;
  }).join('') : `<div class="empty"><img src="${ICON}fries-game-icon.png" alt=""><b>${state.tab === 'mine' ? '你还没有参与拼单' : '这家店还没人在拼'}</b><span>${state.tab === 'mine' ? '去看看店里的人正在拼什么。' : '当前无人跟您有相似拼单，来当第一个吧'}</span>${state.tab === 'mine' ? '' : '<button class="primary" data-empty-new>发起拼单</button>'}</div>`;
  document.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', guard(() => openDetail(b.dataset.detail))));
  $('[data-empty-new]')?.addEventListener('click', guard(compose));
  applyArt();
}
async function refreshBoard() {
  const store = $('#store').value;
  if (!state.board.length) $('#board').innerHTML = friesLoader();
  const data = await api('/groups?store=' + encodeURIComponent(store));
  if (store !== $('#store').value) return;
  state.board = data.groups; syncClock(data.serverNow); render();
}
async function refreshMine() {
  const data = await api('/mine');
  const previous = new Map(state.mine.map(g => [g.id, g.state]));
  for (const g of data.groups) {
    const was = previous.get(g.id); if (!previous.has(g.id) || was === g.state) continue;
    const me = g.members.find(m => m.id === g.viewerId);
    if (g.state === 'picked-up') { toast('发起人已经取到餐了，带上小卡片，到店对一下你的那份。'); if (sim()) pushBanner('麦麦拼单 · 全部取完', `${g.meal.name}：每个人都取走了自己那份。`); }
    else if (sim() && g.state === 'full') pushBanner('麦麦拼单 · 拼满了', `${g.meal.name} 人齐了，等发起人下单。`);
    else if (sim() && g.state === 'ordered') pushBanner('麦麦拼单 · 已下单', `${g.meal.name} 已出餐${me?.pickupCode ? '，你的取餐码 ' + me.pickupCode + '，到柜台报码取你那份' : ''}。`);
    else if (sim() && g.state === 'expired') pushBanner('麦麦拼单 · 到点下架', g.idealCouponYuan ? `没拼成，送你 ${g.idealCouponYuan} 元补偿券（模拟），可以直接单点。` : '没拼成，可以直接单点。');
  }
  state.mine = data.groups; render();
  if ($('#detail').open && state.detail?.viewerId) { const fresh = data.groups.find(g => g.id === state.detail.id); if (fresh) renderDetail(fresh); }
}
function checks(parts, selected = [], name = 'partIds') {
  return `<div class="checks">${parts.map(p => `<label><input type="checkbox" name="${name}" value="${escape(p.id)}" ${selected.includes(p.id) ? 'checked' : ''}><span>${escape(p.name)}${p.supportModify ? '【可特调】' : ''}<small> · 单点 ${p.unitPriceCents === null ? '价格暂缺' : money(p.unitPriceCents)}</small></span></label>`).join('')}</div>`;
}
async function selectMeal() {
  $('#meal-info').innerHTML = friesLoader('正在核对套餐和单件价格…');
  const button = $('#compose-form button[type="submit"]'); button.disabled = true;
  state.selectedMeal = null;
  try {
    const code = $('#meal-select').value;
    const data = await api(`/stores/${$('#store').value}/meals/${code}`);
    if (code !== $('#meal-select').value) return;
    state.selectedMeal = data.meal;
    const meal = data.meal;
    $('#meal-info').innerHTML = `<p>套餐核价 <strong>${money(meal.priceCents)}</strong> · 共 ${meal.parts.length} 件</p><p class="muted">选你自己要的，剩下的留给拼单的人。当前拼的是下面这份默认搭配。</p>${checks(meal.parts, meal.parts.slice(0, 2).map(p => p.id))}${meal.parts.some(p => p.unitPriceCents === null) ? '<p class="hint">部分单件没有可核对的单点价，这单将整体按餐品件数均分，零头归发起人。</p>' : '<p class="muted">按各自单点价占比分摊套餐价，算到分，零头归发起人。</p>'}`;
    $('#compose-form [name="people"]').innerHTML = Array.from({ length: Math.min(3, meal.parts.length) - 1 }, (_, i) => `<option value="${i + 2}">最多允许 ${i + 1} 人一起拼单${i ? '（等得起，更容易拼成）' : '（赶时间）'}</option>`).join('');
  } finally { button.disabled = !state.selectedMeal; }
}
async function compose() {
  $('#compose').showModal(); $('#meal-info').innerHTML = friesLoader('正在查看这家店的套餐…');
  const data = await api(`/stores/${$('#store').value}/meals`); state.meals = data.meals;
  $('#meal-select').innerHTML = data.meals.map(m => `<option value="${escape(m.code)}">${escape(m.name)}${m.menuPriceCents === null ? '' : ' · ' + money(m.menuPriceCents)}</option>`).join('');
  if (!data.meals.length) { $('#meal-info').textContent = '这个时段还没有适合拆分的套餐，稍后再看看。'; return; }
  if (data.meals.some(m => m.code === '9900016136')) $('#meal-select').value = '9900016136';
  await selectMeal();
}
async function reviewDraft(event) {
  event.preventDefault(); if (!state.selectedMeal) return;
  const form = new FormData(event.currentTarget);
  const partIds = form.getAll('partIds');
  const people = Number(form.get('people'));
  if (!partIds.length || partIds.length > state.selectedMeal.parts.length - people + 1) throw new Error('选好自己那份，并为其他每个人至少留一件餐品。');
  state.draft = { storeCode: $('#store').value, mealCode: state.selectedMeal.code, nickname: form.get('nickname'), tail4: form.get('tail4'), people, minutes: Number(form.get('minutes')), partIds, confirmedSimilar: true };
  const { groups } = await api(`/groups/similar?store=${state.draft.storeCode}&meal=${state.draft.mealCode}`);
  $('#similar-content').innerHTML = groups.length ? '<p>还有跟你相似的拼单噢</p>' + groups.map(g => `<div class="similar-row">@${escape(g.members.find(m => m.id === g.hostId).nickname)} 正在拼单，缺${g.people - g.members.length === 1 ? "一" : g.people - g.members.length}人拼${escape(similarPartsText(g.meal.parts.filter(p => g.remainingPartIds.includes(p.id))))}<br><span class="timer" data-deadline="${g.deadline}" data-style="timer">${escape(timerText(g.deadline))}</span><button class="primary sm" data-similar="${g.id}">点击直接完成拼单</button></div>`).join('') : '<p>当前无人跟您有相似拼单</p>';
  document.querySelectorAll('[data-similar]').forEach(b => b.addEventListener('click', guard(async () => { $('#similar').close(); await openDetail(b.dataset.similar); })));
  $('#compose').close(); $('#similar').showModal();
}
async function createGroup() {
  if (!state.draft) return;
  const { group } = await api('/groups', state.draft); $('#similar').close();
  state.draft = null; await Promise.all([refreshBoard(), refreshMine()]); renderDetail(group); $('#detail').showModal();
}
async function openDetail(id) { const { group } = await api('/groups/' + id); renderDetail(group); if (!$('#detail').open) $('#detail').showModal(); }
function renderDetail(g) {
  state.detail = g; syncClock(g.serverNow);
  const remaining = g.meal.parts.filter(p => g.remainingPartIds.includes(p.id));
  const own = g.members.find(m => m.id === g.viewerId);
  const fallback = g.method === 'equal-items';
  $('#detail-content').innerHTML = `<h3>${escape(g.meal.name)}</h3><p>${escape(labels[g.state])} · <span class="clock" data-deadline="${g.deadline}">${escape(leftText(g.deadline))}</span></p><p class="muted">规定时间不延长 · 套餐核价 ${money(g.meal.priceCents)} · 到店自取<br>核价时间 ${chinaDate(g.meal.verifiedAt)}，实际以官方下单为准。</p>${fallback ? '<p class="hint">单件价格有缺失：整单按餐品件数均分，零头归发起人。</p>' : '<p class="hint">按每人单点价占比分摊套餐价，零头归发起人。</p>'}${own ? (() => { const m = own; const coded = ['ordered', 'picked-up'].includes(g.state) && m.pickupCode; return `<div class="ticket own"><div class="who">我这份 · @${escape(m.nickname)}${m.id === g.hostId ? '（发起人）' : ''}</div><div class="lbl">${coded ? '我的取餐码' : '我的尾号'}</div><div class="num">${escape(coded ? m.pickupCode : m.tail4)}</div><p>${escape(partsText(g.meal.parts.filter(p => m.partIds.includes(p.id))))}</p><div class="chips"><span class="tag">我出 ${money(m.cents)}</span><span class="tag off">${m.collected ? '已取走' : m.confirmed ? '已确认' : '待确认'}</span></div><small class="ticket-note">${coded ? '到柜台报这个码，只能取走你自己这份。' : '下单后门店会给你一个只属于你的取餐码。'}</small></div>`; })() : ''}${g.members.filter(m => m.id !== g.viewerId).map(m => `<div class="mate"><b>@${escape(m.nickname)}${m.id === g.hostId ? '（发起人）' : ''}</b><span>${escape(partsText(g.meal.parts.filter(p => m.partIds.includes(p.id))))}</span><span class="tag">${own ? 'TA 出' : '已认领'} ${money(m.cents)}</span><small>${m.collected ? '已取走' : m.confirmed ? '已确认' : '待本人确认'}${g.isHost && !m.confirmed && ['open','full'].includes(g.state) ? `　<button class="sm-link" data-kick="${m.id}">移出</button>` : ''}</small></div>`).join('')}${own && g.members.length > 1 ? '<p class="muted">同单拼友的尾号和取餐码只有本人和门店能看到，你只看得到昵称。</p>' : ''}${sim() ? simBlock(g, own) : `<p class="muted">已等待 ${Math.floor(g.waitedMs / 60000)} 分钟。按理想版${g.idealCouponYuan ? '可对应 ' + g.idealCouponYuan + ' 元券档位' : '尚未达到补偿券档位'}。此处仅展示，不发券。</p>`}${g.state === 'expired' ? `<div class="hint">到点了，这单已经下架。可以改成自己单点：<br>${g.meal.parts.filter(p => !own || own.partIds.includes(p.id)).map(p => `${escape(p.name)}：${p.unitPriceCents === null ? '价格暂缺' : money(p.unitPriceCents)}`).join('<br>')}<br>自己的可用券，请到官方 App 查看。</div>` : ''}<div class="actions">${g.isHost && g.state === 'open' && state.config.mode === 'demo' ? '<button data-demo-fill>演示：模拟拼友加入并确认</button>' : ''}${own ? '<button id="copy-card">复制我的小卡片</button>' : ''}${own && !own.confirmed && ['open','full'].includes(g.state) ? '<button class="primary" data-action="confirm">确认我这份和金额</button>' : ''}${g.isHost && g.state === 'full' ? `<button class="primary" data-action="ordered">${state.config.mode === 'demo' ? '演示：模拟官方渠道已下单' : '我已在官方渠道下单'}</button>` : ''}${own && g.state === 'ordered' && !own.collected ? '<button class="primary" data-action="collect">我已凭取餐码取走我这份</button>' : ''}${own && g.state === 'ordered' && sim() && g.members.some(m => m.id !== own.id && !m.collected) ? '<button data-demo-collect>演示：模拟拼友取走 TA 那份</button>' : ''}</div>${g.state === 'picked-up' ? '<p class="hint">这单每个人都取走了自己那份，拼单完成。</p>' : own?.collected ? `<p class="hint">你这份已经取走，拼单对你来说已完成。还有 ${g.members.filter(m => !m.collected).length} 人会凭自己的取餐码去柜台取。</p>` : ''}${!own && g.state === 'open' ? `<hr><form id="join-form"><h3>我来拼剩下这份</h3>${checks(remaining, g.people - g.members.length === 1 ? remaining.map(p => p.id) : [])}<div class="form-row"><label>昵称<input name="nickname" maxlength="20" required></label><label>手机尾号后四位<input name="tail4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label></div><button class="primary wide" type="submit">加入这单，再核对金额</button></form>` : ''}`;
  $('#join-form')?.addEventListener('submit', guard(async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await api(`/groups/${g.id}/join`, { nickname: data.get('nickname'), tail4: data.get('tail4'), partIds: data.getAll('partIds') });
    await Promise.all([refreshBoard(), refreshMine()]); await openDetail(g.id);
  }));
  document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', guard(async () => {
    if (state.config.mode !== 'demo' && b.dataset.action === 'ordered' && !confirm('确认已经在麦当劳官方 App / 小程序完成真实下单？本网页不会代下单。')) return;
    await api(`/groups/${g.id}/${b.dataset.action}`, {}); await Promise.all([refreshBoard(), refreshMine()]); await openDetail(g.id);
  })));
  document.querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', guard(async () => { await api(`/groups/${g.id}/kick`, { memberId: b.dataset.kick }); await Promise.all([refreshBoard(), refreshMine()]); await openDetail(g.id); })));
  $('#copy-card')?.addEventListener('click', guard(async () => { const text = `麦麦现拼 · ${g.meal.name}\n${own.nickname} · 尾号 ${own.tail4}\n${partsText(g.meal.parts.filter(p => own.partIds.includes(p.id)))}\n分摊 ${money(own.cents)}${fallback ? '（按件均分）' : ''}\n门店 ${state.stores.find(s => s.code === g.storeCode)?.name ?? g.storeCode}\n${labels[g.state]} · ${chinaTime(g.deadline)} 截止`; try { await navigator.clipboard.writeText(text); toast('小卡片已复制'); } catch { toast('复制暂不可用，可以长按卡片文字保存。'); } }));
  document.querySelector('[data-counter]')?.addEventListener('click', guard(async () => { state.counter = (await api(`/demo/groups/${g.id}/counter`)).counter; renderDetail(g); }));
  document.querySelector('[data-demo-collect]')?.addEventListener('click', guard(async () => { await api(`/demo/groups/${g.id}/collect-others`, {}); state.counter = null; await Promise.all([refreshBoard(), refreshMine()]); await openDetail(g.id); }));
  document.querySelector('[data-coupon-preview]')?.addEventListener('click', () => { state.couponPreview = g.id; renderDetail(g); pushBanner('麦麦拼单 · 送你一张券', '拼单等了 15 分钟，2 元补偿券已放进卡包（模拟）。'); });
  document.querySelector('[data-demo-fill]')?.addEventListener('click', guard(async () => { await api(`/demo/groups/${g.id}/fill`, {}); await Promise.all([refreshBoard(), refreshMine()]); await openDetail(g.id); }));
  applyArt();
}
document.querySelectorAll('dialog .close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', guard(async () => { state.tab = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('active', t === b)); if (state.tab === 'mine') await refreshMine(); else await refreshBoard(); })));
$('#store').addEventListener('change', guard(async () => { state.board = []; renderStoreChips(); const s = state.stores.find(s => s.code === $('#store').value); $('#store-address').textContent = s.address + (s.open ? '' : ' · 当前暂停营业'); await refreshBoard(); }));
$('#refresh').addEventListener('click', guard(() => Promise.all([refreshBoard(), refreshMine()])));
$('#new-group').addEventListener('click', guard(compose));
$('#meal-select').addEventListener('change', guard(selectMeal));
$('#compose-form').addEventListener('submit', guard(reviewDraft));
$('#confirm-create').addEventListener('click', guard(createGroup));
$('#similar-back').addEventListener('click', () => { $('#similar').close(); $('#compose').showModal(); });
setInterval(() => {
  if (state.board.some(g => g.deadline <= now())) { state.board = state.board.filter(g => g.deadline > now()); render(); }
  document.querySelectorAll('[data-deadline]').forEach(el => el.textContent = (el.dataset.style === 'timer' ? timerText : leftText)(Number(el.dataset.deadline)));
  const g = state.detail;
  if ($('#detail').open && g && ['open', 'full'].includes(g.state) && g.deadline <= now() && !g.expiryRefreshSent) {
    g.expiryRefreshSent = true;
    openDetail(g.id).catch(e => toast(e.message));
  }
}, 1000);
setInterval(() => { if (!document.hidden && state.config) refreshMine().catch(e => toast(e.message)); }, 30000);
setInterval(() => { if (!document.hidden && state.config) refreshBoard().catch(e => toast(e.message)); }, 60000);
(async () => {
  try {
    artManifest = await fetch('/assets/manifest.json').then(r => r.json()).catch(() => ({})); applyArt();
    state.config = await api('/config'); syncClock(state.config.serverNow);
    $('#mode-badge').textContent = state.config.mode === 'demo' ? '演示模式 · 真实菜单快照' : '实时菜单';
    if (state.config.mode === 'demo') { $('#demo-note').hidden = false; $('#demo-note').textContent = `演示模式：菜单采集于 ${chinaDate(state.config.capturedAt)}，拼单、昵称和尾号为虚构。仅展示已采集套餐，不会真实下单${state.config.clockSpeed > 1 ? '；计时加速 ' + state.config.clockSpeed + ' 倍' : ''}。`; }
    state.stores = (await api('/stores')).stores;
    $('#store').innerHTML = state.stores.map(s => `<option value="${s.code}">${escape(s.name)}</option>`).join('');
    $('#store').disabled = false; $('#new-group').disabled = false; renderStoreChips();
    $('#store-address').textContent = state.stores[0]?.address ?? '暂时没有可用门店';
    await Promise.all([refreshBoard(), refreshMine()]);
  } catch (e) { $('#board').textContent = '暂时没有连上。请刷新页面重试。'; toast(e.message); }
})();
