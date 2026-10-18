# 麦麦现拼

到店自取，让同一家店的陌生人现场拼一个大套餐。

![不同套餐的演示广场](docs/images/plaza-overview.png)

上图为 10-19 纳纳红黄主题的真实浏览器页面。演示广场的五位发起人随机拼不同套餐，剩余餐品和金额使用各自的快照；人物为虚构。旧单到点结束后会补上新单，「我的拼单」也会循环补充新的体验卡，后来的访客随时能试玩。

大套餐一个人吃不完，就和同店的人各选几样，算清每人的那份，到店对卡片取餐。网页不碰支付，不代下单，不领券、不绑券。

## 本地运行

需要 Node.js 24+（本机验证版本 24.13.0）。

```sh
npm ci
npm run dev
```

打开命令打印的 `http://127.0.0.1:8787`。默认是 **演示模式**，无需 Token，不会调用上游。菜单和套餐是真实采集的快照，拼单人、昵称和尾号为虚构。

自动循环只在 demo 启用：新单使用新 ID 和新截止时间，旧单不延长；已经参与的卡片保留到正常结束和清理；「我的拼单」优先显示进行中的卡片。

演示完整流程：发起（最多再允许 1 或 2 人）→ 相似拼单确认 → 模拟拼友加入 → 模拟已下单（每人得到自己的取餐码）→ 我已凭码取走我这份 → 模拟拼友取走 TA 那份。所有模拟入口只在 demo 模式注册。

[步骤动图](docs/images/demo-walkthrough.gif) · [多套餐手机广场](docs/images/varied-plaza-mobile-390.jpg) · [桌面截图](docs/images/demo-desktop.jpg) · [手机截图](docs/images/demo-mobile.jpg) · [界面步骤视频](docs/images/demo-walkthrough.mp4)。动图和视频由真实界面状态截图序列组成，非连续屏幕录像。

## 页面预览

[首页与小水母](docs/images/demo-desktop.jpg) · [随机多套餐广场](docs/images/varied-plaza-desktop.jpg) · [完整步骤动图](docs/images/demo-walkthrough.gif)

| 我的拼单 | 等拼补偿（理想版模拟） |
| --- | --- |
| ![我的拼单和个人取餐卡](docs/images/my-groups-demo.jpg) | ![等拼补偿和继续等待立减](docs/images/waiting-perks-demo.jpg) |

<details>
<summary>查看更多流程：认领餐品、等满 30 分钟、拼满与取餐</summary>

认领同一单剩下的餐品，确认自己的那份：

![认领剩余餐品](docs/images/joining-share.png)

等满 30 分钟，选择继续等待立减，或按单点价格 8.5 折模拟下单：

![继续等待或单点的模拟选择](docs/images/waiting-choice.png)

拼满、已出餐和已取完的单子分别展示：

![拼单成功和取餐状态](docs/images/groups-success.png)

</details>

截图来自当前演示界面。补偿券、继续等待立减和下单付款均为模拟，不发券、不扣款；旧早餐截图不作为当前菜单展示。

## 真实菜单模式

仅在本地服务端配置自己的 Token：

```sh
cp .env.example .env
chmod 600 .env
```

已有 `.env` 时不要再次复制覆盖。在 `.env` 填好 `MCD_MCP_TOKEN=` 并设 `MCD_MODE=live`，再执行 `npm run dev`。

当前仅开放三乡四店，默认到店自取 `beType=1 / orderType=1`。Token 不进入浏览器、仓库或交接包。实时和演示数据库默认分别为 `data/live.sqlite` / `data/demo.sqlite`，禁止混用同一库。

| 配置 | 默认 | 作用 |
| --- | --- | --- |
| `MCD_MODE` | `demo` | `live` 使用官方只读接口，`demo` 使用脱敏夹具 |
| `MCD_MCP_TOKEN` | 空 | 仅 live / T0 探测需要 |
| `PORT` | `8787` | 监听 `127.0.0.1` 的本地端口 |
| `DATABASE_PATH` | 按模式分库 | 留空使用默认路径 |
| `MIN_SHARE_PRICE_CENTS` | `3000` | 推荐套餐的价格阈值；识别到多件套餐时也会推荐 |
| `DEMO_MENU_PERIOD` | `auto` | 演示菜单时段；可设 `breakfast` / `lunch` / `dinner` 提前体验，计时仍用真实时间 |
| `DEMO_SPEED` | `1` | 演示计时倍速 1–60，live 固定 1 |

## 规则

- 规定时间 10–60 分钟，默认 30 分钟，发起后不能延长。
- 同店同套餐的相似单，最多列三单，按截止时间最早排序。
- 发起人先选自己的餐品，其他人选剩余部分。每人至少一件；最后一位需接完剩余餐品。
- 每份最多三人。4 件及以上套餐，发起人至少拿 1 份饮料和 1 份主食；6 件及以上至少 2 饮料和 2 主食（按实际数量封顶），主食有两份以上时至少留一份给拼友。
- 按各自餐品单点价权重分套餐价，算到整数分，零头归发起人。任一单件没有可靠单点价时，整单按件数均分并明确说明。
- 匿名设备不能拼自己的单、同一尾号不能重复加入；每设备十分钟最多加入三单。发起人可以移出未确认成员。
- 所有人确认后，发起人才能标记下单；演示按钮为“拼满了，下单”，付款统一为模拟、不扣钱。各自尾号和取餐码只返回本人；每个人凭自己的码取走那份，全员取完结束。取餐提醒由网页 30 秒轮询获取。
- 到点结束招募，没实际下单的单转为到点下架。已标记下单的成员仍可在自己的卡片查看取到状态；停止招募和个人卡片收尾分开。
- 实时模式只在北京时间 11:30–14:30、18:30–21:30 开放拼单；演示保留随时体验入口。
- 等待计时不超过原截止时间，取到后停止。理想版补偿仅给发起人：15 分钟 2 元券；30 分钟选择单点 8.5 折，或继续等待每样立减 1.5 元。继续等后可整套餐下单：独自拿整套按套餐价减立减，有拼友时发起人那份按 8.5 折。这些都是模拟展示，不实际发券或收款。
- 只留昵称、尾号后四位、匿名设备标识及团单信息；结束 24 小时后自动删除。当前匿名设备限制属于无登录的基础防占位，不能把清 Cookie 后的新设备识别成同一个人。

## MCP 与公开数据

菜单、明细、算价按门店和参数缓存十分钟。访客只接收白名单中的门店 / 餐品字段。门店搜索强制按位置搜索，不读取账号收藏；常点、随单购卡等字段不进入公开夹具。

演示按北京时间自动选早餐（10:30 前）、午市（10:30–17:00）、晚市（17:00 起），缓存和报价按这三个时段隔离。预约用餐时间决定快照所属时段，页面另标实际采集时间。缺少该时段记录时会明确提示历史快照回退，不能视为该时段可售。

10-19 凌晨通过官方 `reservationDate` 提前查得当日 12:00、19:00 菜单。三乡、谷都大道、新天地各有 **29 / 24 / 30** 个真实可发起套餐，午晚市分别验证；三店示例自动退出。神湾大道两次均返回 `600054`（预约时间不在可预约时间范围），该接口当前只给早餐预约选项：其午晚市真实数为 **0**，页面保留明确提示的 4 个早餐历史快照及 7 个「示例」，不计入真实数。每个单件都尝试询价；空商品列表的零总额仍是未知价，触发按件均分。

现在直接体验午市或晚市：

```sh
DEMO_MENU_PERIOD=lunch npm run dev
# 或 DEMO_MENU_PERIOD=dinner npm run dev
```

完整数量、名单、实际采集时间和后台复查安排见 [菜单记录](docs/menu-capture-20261019.md) 与 [逐套核验表](docs/reviews/20261019-menu-counts.md)。

`query-store-coupons` 和 `available-coupons` 的实际 schema / 工具描述均涉及账号可用或可领取的券，暂不接入。到点后请在官方 App 查看自己账号的券；静态理想版券档正常展示。

真实工具 schema、四店验证和价格单位差异见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。

```sh
npm run probe:mcp
npm run probe:mcp -- .local/t0-calls.json
npm run capture:fixtures
npm test
npm run typecheck
```

原始探路响应只留 `.local/probes/`，审阅脱敏后才导出 `fixtures/`。不要把新接口的任意响应直接推入仓库。

## 施工与验收

- [当前状态](docs/STATUS.md)、[验证记录](docs/validation.md)、[原方案和施工卡](docs/INDEX.md)。
- [美术与图标覆盖](docs/art-slots.md)：纳纳主题和 27 件图片已接入；玉米、苹果等无专图时使用拼单袋。
- Hono + TypeScript + Node.js SQLite，本地单命令启动。迁移 SQL 保持 D1 兼容；Cloudflare D1 运行适配器及部署尚未完成。
- 10-18 v1 有 Mac mini 独立验收；10-19 最新任务改由 Codex 负责完整核验，不再等待 mini 复核。

## 官方来源

- [麦当劳 MCP 接入指南](https://github.com/M-China/mcd-mcp-server)
- [开发者大赛](https://github.com/M-China/mcd-developer-innovation-challenge)
- `CONTEST_DECLARATION.md` 为官方模板原字节副本，来源与哈希见 [校验记录](docs/official-sources.md)。

代码与纳纳的图片按梅宝决定一并公开；许可范围见下文。报名 issue 和最终提交由梅宝本人处理。

## 版权声明

本项目用于麦当劳 MCP 大赛参赛展示。原创代码采用 [PolyForm Noncommercial 1.0.0](LICENSE)，可在许可证允许的非商业用途下使用、学习和修改，商用须另获授权；完整条款以原文为准。`package.json` 保持 `private: true`，防止误发布 npm 包。

纳纳绘制的 `public/assets/theme/` 图片采用 **CC BY-NC-ND 4.0（署名—非商业性使用—禁止演绎）**，见 [图片许可与署名](public/assets/theme/LICENSE.md)。转载需署名、限非商业用途，不得分发改作。代码许可证不授予麦当劳商标、菜单数据或第三方素材权利，详见 [NOTICE.md](NOTICE.md)。[官方许可证来源及原文字节校验](docs/official-sources.md) 已留档。
