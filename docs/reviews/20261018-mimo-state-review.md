# 真实 MiMo 状态机审阅原文

通道：MiMo CLI，`xiaomi/mimo-v2.6-pro`，会话 `ses_ffe5eb39af870ffeqV2320gdbB`。附件仅 `groups.ts` / `db.ts` / `app.ts`，未给麦当劳 Token、`.env`、个人记忆或运行数据库。审阅在 demo 填充入口加入前启动，该入口另由 API 隔离测试和浏览器验证。

---

按清单逐项看 `groups.ts` / `db.ts` / `app.ts`，只报能实际触发的逻辑问题。

## 发现问题

### 1. 每设备十分钟三单 — 可绕过

`app.ts:23-25` 每次请求：cookie 缺失或不合 UUID 格式就 `randomUUID()` 换新设备。`groups.ts:64` 的 `joinCount(device, …)` 只按这个 cookie 计数。

触发：删掉 `maimai_device`（或隐私窗口 / 换浏览器）再 `POST /api/groups/:id/join`，设备 ID 变新，计数归零。十分钟内可加入任意多单。

同一机制顺带打穿 `groups.ts:62`「不能拼自己的单」：用设备 A 开单，丢 cookie 得到设备 B，即可加入自己的单（换一个 tail4 即可通过 `groups.ts:63`）。

### 2. create 不计入三单

`groups.ts:40-55` 建单不查 `joinCount`、也不 `recordJoin`；限制只在 `groups.ts:64` 的 join 路径。

触发：同一设备连续 `POST /api/groups`，可无限开单，不受十分钟三单约束。

### 3. 取到提醒 — 附件里没有

三份文件里与「取到」相关的只有：`groups.ts:100-101` 写 `pickedUpAt`/`endedAt`，`groups.ts:120` 的 `idealCouponYuan`（按等待时长给券），以及 `app.ts:35` 的 `couponsEnabled: false`。没有任何提醒或通知的发出逻辑。若需求是取餐提醒，这三份附件里找不到对应实现。

### 4. 结束 24 小时删除 — 一处边界不一致

`db.ts:23-24` 按 `ended_at` 删，过期单 `ended_at = deadline`。

`groups.ts:100` 取餐时 `endedAt = Math.min(this.now(), g.deadline)`：先到点、已下单、deadline 之后才标已取（`groups.ts:97` 只挡 `state !== 'ordered'`，不挡超时），`endedAt` 仍是 `deadline`。删除按 deadline 起算，可能在实际取餐后不足 24 小时就删。

若需求是「截止时间后 24h 删」则一致；若是「结束后（含取餐）24h 删」则不一致。触发：deadline 前标 ordered，deadline 后标 picked-up，观察删除时点。

## 核对后未发现

- **10–60 分钟不可延长**：`deadline` 只在 `groups.ts:51` 生成一次，`action`（`groups.ts:78-106`）没有改 `deadline`/`minutes` 的分支。无延长路径。
- **抢同一餐品**：join 在事务内重算 `remaining`（`groups.ts:65-67`），`choose`（`groups.ts:21-24`）要求非空、去重、全部落在 `remaining`；`db.ts:17-21` 的 `BEGIN IMMEDIATE` + 同步回调，同进程不交错。未发现可重复领同一 `partId` 的路径。
- **发起人踢未确认成员**：`groups.ts:86-92` 限 host（`:86`）、限 `open`/`full`、目标须存在、未确认、非 host。已确认成员和 host 自己都踢不掉。
- **所有人确认才标记已下单**：`groups.ts:94` 要求 `state === 'full'` 且 `members.some(m => !m.confirmed)` 为假；ordered/kick/picked-up 均在 `groups.ts:86` 之后要求 host。
- **cookie 不泄露**：`app.ts:25` `httpOnly` + `sameSite: 'Strict'` + https 才 `secure` + `path: '/'`、不设 `domain`。`groups.ts:118` 显式剥掉 `device`，响应体不回传。`app.ts:14` CSP、`:20-22` Origin/Sec-Fetch-Site/JSON POST 限制也在。
- **个人账号工具隔离（demo/live）**：`db.ts:13-15` 模式不一致直接 `DATABASE_MODE_MISMATCH`，工具模式不能开正式库。组内 `device` 互不可见、`tail4` 仅组内可见（`groups.ts:118`）。

## 附带（属第 1 条同一根）

身份只有这枚 cookie：发起人丢 cookie 后不再是成员（`groups.ts:81` 按 device 找不到自己），无法 confirm/kick/ordered/picked-up，整单只能烂到过期。这是第 1 条的另一面，不是单独的新洞。
