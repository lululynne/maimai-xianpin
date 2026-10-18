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
    return `<article class="card ${g.deadline - now() < 10 * 60000 && g.state === 'open' ? 'urgent' : ''}"><div class="card-top"><span>${escape(labels[g.state])} · ${g.state === 'open' ? `缺 ${g.people - g.members.length} 人` : `${g.members.length} 人`}</span><span class="clock" data-deadline="${g.deadline}">${escape(leftText(g.deadline))}</span></div><div class="card-body">${g.meal.image ? `<img src="${escape(g.meal.image)}" alt="${escape(g.meal.name)}" loading="lazy">` : ''}<p class="owner">@${escape(host.nickname)} 发起${g.isHost ? ' · 我发起的' : own ? ' · 我参与的' : ''}</p><h3>${escape(g.meal.name)}</h3><p class="parts-line">${escape(remaining.length ? '剩下：' + partsText(remaining) : partsText(g.meal.parts))}</p><div class="card-bottom"><div class="money">${money(own ? own.cents : restCents)}<small>${own ? '我这份的分摊金额' : '剩余餐品合计'} · 套餐 ${money(g.meal.priceCents)}</small></div><button class="${g.state === 'open' && !own ? 'primary' : ''}" data-detail="${g.id}">${own ? '查看我的卡片' : g.state === 'open' ? '我来拼这单' : '看看这单'}</button></div></div></article>`;
  }).join('') : `<div class="empty" data-art-slot="empty-plaza">${state.tab === 'mine' ? '你还没有参与拼单。去看看店里的人正在拼什么。' : '这家店还没有人在拼。发起一单，留一份给刚好也在的人。'}</div>`;
  document.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', guard(() => openDetail(b.dataset.detail))));
  applyArt();
}
async function refreshBoard() {
  const store = $('#store').value;
  const data = await api('/groups?store=' + encodeURIComponent(store));
  if (store !== $('#store').value) return;
  state.board = data.groups; syncClock(data.serverNow); render();
}
async function refreshMine() {
  const data = await api('/mine');
  const previous = new Map(state.mine.map(g => [g.id, g.state]));
  for (const g of data.groups) if (g.state === 'picked-up' && previous.has(g.id) && previous.get(g.id) !== 'picked-up') toast('发起人已经取到餐了，带上小卡片，到店对一下你的那份。');
  state.mine = data.groups; render();
  if ($('#detail').open && state.detail?.viewerId) { const fresh = data.groups.find(g => g.id === state.detail.id); if (fresh) renderDetail(fresh); }
}
function checks(parts, selected = [], name = 'partIds') {
  return `<div class="checks">${parts.map(p => `<label><input type="checkbox" name="${name}" value="${escape(p.id)}" ${selected.includes(p.id) ? 'checked' : ''}><span>${escape(p.name)}${p.supportModify ? '【可特调】' : ''}<small> · 单点 ${p.unitPriceCents === null ? '价格暂缺' : money(p.unitPriceCents)}</small></span></label>`).join('')}</div>`;
}
async function selectMeal() {
  $('#meal-info').textContent = '正在核对套餐和单件价格…';
  const button = $('#compose-form button[type="submit"]'); button.disabled = true;
  state.selectedMeal = null;
  try {
    const code = $('#meal-select').value;
    const data = await api(`/stores/${$('#store').value}/meals/${code}`);
    if (code !== $('#meal-select').value) return;
    state.selectedMeal = data.meal;
    const meal = data.meal;
    $('#meal-info').innerHTML = `<p>套餐核价 <strong>${money(meal.priceCents)}</strong> · 共 ${meal.parts.length} 件</p><p class="muted">选你自己要的，剩下的留给拼单的人。当前拼的是下面这份默认搭配。</p>${checks(meal.parts, meal.parts.slice(0, 2).map(p => p.id))}${meal.parts.some(p => p.unitPriceCents === null) ? '<p class="hint">部分单件没有可核对的单点价，这单将整体按餐品件数均分，零头归发起人。</p>' : '<p class="muted">按各自单点价占比分摊套餐价，算到分，零头归发起人。</p>'}`;
    $('#compose-form [name="people"]').innerHTML = Array.from({ length: Math.min(8, meal.parts.length) - 1 }, (_, i) => `<option value="${i + 2}">${i + 2} 人</option>`).join('');
  } finally { button.disabled = !state.selectedMeal; }
}
async function compose() {
  $('#compose').showModal(); $('#meal-info').textContent = '正在查看这家店的套餐…';
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
  $('#similar-content').innerHTML = groups.length ? '<p>还有跟你相似的拼单噢</p>' + groups.map(g => `<div class="similar-row">@${escape(g.members.find(m => m.id === g.hostId).nickname)} 正在拼单，缺${g.people - g.members.length === 1 ? "一" : g.people - g.members.length}人拼${escape(similarPartsText(g.meal.parts.filter(p => g.remainingPartIds.includes(p.id))))}<br><span class="clock" data-deadline="${g.deadline}">${escape(leftText(g.deadline))}</span><button data-similar="${g.id}">点击直接完成拼单</button></div>`).join('') : '<p>当前无人跟您有相似拼单</p>';
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
  $('#detail-content').innerHTML = `<h3>${escape(g.meal.name)}</h3><p>${escape(labels[g.state])} · <span class="clock" data-deadline="${g.deadline}">${escape(leftText(g.deadline))}</span></p><p class="muted">规定时间不延长 · 套餐核价 ${money(g.meal.priceCents)} · 到店自取<br>核价时间 ${chinaDate(g.meal.verifiedAt)}，实际以官方下单为准。</p>${fallback ? '<p class="hint">单件价格有缺失：整单按餐品件数均分，零头归发起人。</p>' : '<p class="hint">按每人单点价占比分摊套餐价，零头归发起人。</p>'}${g.members.map(m => `<div class="ticket" data-art-slot="ticket"><h3>${m.id === g.viewerId ? '我这份 · ' : ''}${escape(m.nickname)}${m.id === g.hostId ? '（发起人）' : ''}</h3><p>${escape(partsText(g.meal.parts.filter(p => m.partIds.includes(p.id))))}</p><p>尾号 ${escape(m.tail4 ?? '入拼后可核对')} · ${m.confirmed ? '已确认' : '待本人确认'}</p><div class="amount">${money(m.cents)}</div>${g.isHost && !m.confirmed && ['open','full'].includes(g.state) ? `<button data-kick="${m.id}">移出未确认成员</button>` : ''}</div>`).join('')}<p class="muted">已等待 ${Math.floor(g.waitedMs / 60000)} 分钟。按理想版${g.idealCouponYuan ? '可对应 ' + g.idealCouponYuan + ' 元券档位' : '尚未达到补偿券档位'}。此处仅展示，不发券。</p>${g.state === 'expired' ? `<div class="hint">到点了，这单已经下架。可以改成自己单点：<br>${g.meal.parts.filter(p => !own || own.partIds.includes(p.id)).map(p => `${escape(p.name)}：${p.unitPriceCents === null ? '价格暂缺' : money(p.unitPriceCents)}`).join('<br>')}<br>自己的可用券，请到官方 App 查看。</div>` : ''}<div class="actions">${g.isHost && g.state === 'open' && state.config.mode === 'demo' ? '<button data-demo-fill>演示：模拟拼友加入并确认</button>' : ''}${own ? '<button id="copy-card">复制我的小卡片</button>' : ''}${own && !own.confirmed && ['open','full'].includes(g.state) ? '<button class="primary" data-action="confirm">确认我这份和金额</button>' : ''}${g.isHost && g.state === 'full' ? `<button class="primary" data-action="ordered">${state.config.mode === 'demo' ? '演示：模拟官方渠道已下单' : '我已在官方渠道下单'}</button>` : ''}${g.isHost && g.state === 'ordered' ? '<button class="primary" data-action="picked-up">已取到，提醒大家</button>' : ''}</div>${g.state === 'picked-up' ? '<p class="hint">餐已经取到了。带着卡片，和发起人核对你那份。</p>' : ''}${!own && g.state === 'open' ? `<hr><form id="join-form"><h3>我来拼剩下这份</h3>${checks(remaining, g.people - g.members.length === 1 ? remaining.map(p => p.id) : [])}<div class="form-row"><label>昵称<input name="nickname" maxlength="20" required></label><label>手机尾号后四位<input name="tail4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label></div><button class="primary wide" type="submit">加入这单，再核对金额</button></form>` : ''}`;
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
  document.querySelector('[data-demo-fill]')?.addEventListener('click', guard(async () => { await api(`/demo/groups/${g.id}/fill`, {}); await Promise.all([refreshBoard(), refreshMine()]); await openDetail(g.id); }));
  applyArt();
}
document.querySelectorAll('dialog .close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', guard(async () => { state.tab = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('active', t === b)); if (state.tab === 'mine') await refreshMine(); else await refreshBoard(); })));
$('#store').addEventListener('change', guard(async () => { const s = state.stores.find(s => s.code === $('#store').value); $('#store-address').textContent = s.address + (s.open ? '' : ' · 当前暂停营业'); await refreshBoard(); }));
$('#refresh').addEventListener('click', guard(() => Promise.all([refreshBoard(), refreshMine()])));
$('#new-group').addEventListener('click', guard(compose));
$('#meal-select').addEventListener('change', guard(selectMeal));
$('#compose-form').addEventListener('submit', guard(reviewDraft));
$('#confirm-create').addEventListener('click', guard(createGroup));
setInterval(() => {
  if (state.board.some(g => g.deadline <= now())) { state.board = state.board.filter(g => g.deadline > now()); render(); }
  document.querySelectorAll('[data-deadline]').forEach(el => el.textContent = leftText(Number(el.dataset.deadline)));
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
    $('#store').disabled = false; $('#new-group').disabled = false;
    $('#store-address').textContent = state.stores[0]?.address ?? '暂时没有可用门店';
    await Promise.all([refreshBoard(), refreshMine()]);
  } catch (e) { $('#board').textContent = '暂时没有连上。请刷新页面重试。'; toast(e.message); }
})();
