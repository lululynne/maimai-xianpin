# 麦麦现拼 · 补抓午市/晚市菜单，让「发起拼单」有更多套餐（10-19 01:3x · Mac mini 阿景）

梅宝 10-19 01:22 原话：「你去看看那个发起拼单，可不可以多点套餐，因为纳纳画了好多个单品logo，爸爸你在隔壁都没用上」

## 现状（我在 mini 核过）
- fixtures/mcp-calls.json 是 10-18 08:12 抓的，只有早餐：每家店 query-meal-detail 只抓了 3 个，所以演示里每家店只能发起 3 种套餐（满分厚松饼堡双人餐、脆香油条豆浆组合、一早现磨超值二件套）。
- 纳纳画的单品图标（麦辣鸡腿堡、汉堡、鸡翅、薯条、可乐、雪碧/柠檬、橙汁、牛奶、红茶、甜筒、营养卷、玩具等）在早餐套餐里大多碰不到。public/app.js 的 mealIcon() 已经按单品名配图，菜单补上就会自动用上。
- Token 只在 MacBook 本地 .env，mini 连不过去，所以这一步只能 MacBook 做。

## 要做
1. **10-19 午市 11:30–14:30 内**跑一轮 probe，**晚市 18:30–21:30 内**再跑一轮。四家店 1420082 / 1420800 / 1420277 / 1421248 都要。
2. 每轮每家店：query-meals 全量；对其中能拼的套餐（名称含 双人/多人/组合/件套/分享/桶/盒/套餐，或价格 ≥ src/catalog.ts 的 minPriceCents）逐个 query-meal-detail + calculate-price（整套和每个单件单点价）。目标每家店 ≥ 10 个可发起套餐，优先：麦辣鸡腿堡类双人/三人餐、鸡翅/麦乐鸡分享盒、全家桶、带圣代或麦旋风的组合、开心乐园餐。
3. 早餐那 12 条保留，三个时段的抓取合并进同一个 fixtures/mcp-calls.json（capture-fixtures.ts 现在只读 .local/probes，保留旧文件一起重生成即可）。只用允许清单里的店级只读工具，不碰 my-coupons / create-order。
4. 演示模式按当前时段显示菜单：早餐时段（营业至 10:30）只出早餐套餐，其他时间出午晚市套餐；没有该时段抓取时退回全部。改在 src/catalog.ts 的 shareableMenu，加单测。
5. npm test 全过；起演示服务确认某家店发起页 ≥ 10 个套餐，单品卡上出现纳纳的图标（不是全是拼单袋）。截 390 宽一张发起页。

## 分支
在 ui/nana-mcd-theme 上做（当前 HEAD 6773ce3ba076d62e97f4cfcd6c0cdada06bf0085，我刚把托盘图标放大回来），推同一分支，main 仍由你单写，合并照 20261018-maimai-xianpin-ui-theme-merge.md。

## 回执
同目录写 20261019-maimai-xianpin-more-meals-DONE.md：两轮抓取时间、每家店可发起套餐数和名单、commit 号、截图路径。抓不到（比如某时段 MCP 报错）就如实写，别拿早餐数据凑。

## 追加 10-19 02:3x（mini，HEAD 6773ce3ba076d62e97f4cfcd6c0cdada06bf0085）
- 演示加了 src/sample-meals.ts：7 个标「示例」的套餐（参考价，非 MCP 核价），只在演示模式、当前时段真实可拼套餐 < 10 时补位；你中午真菜单够 10 个就自动不出现。请把采集 worktree 基线更新到 6773ce3ba076d62e97f4cfcd6c0cdada06bf0085 再跑 11:35 那轮，否则自动推会因远端前进而跳过。
- 报名与转公开：纳纳查到官方规则，报名 issue 必须带公开仓库地址，排名按 star 截至 10-26 0 点。梅宝打算约 10-22 转公开并报名；README/声明文件/MCP_INTEGRATION 需在那之前就绪。

## 转公开前清单（mini 10-19 02:5x 记，晚市采集结束后由 mini 自己改，codex 不用动）
- README 末尾加「版权声明」：本项目仅为麦当劳 MCP 大赛参赛展示，保留所有权利；未经许可禁止复制、修改和商用；纳纳绘制的图片同样保留权利。
- package.json 加 "license": "UNLICENSED"、"private": true；仓库不放 LICENSE 文件。
- 若纳纳核到比赛规则要求开源许可证，以官方原文为准再改。

## 转公开前清单·改定（mini 10-19 02:5x，纳纳核过规则：只要求「以开源形式发布至 GitHub」，不指定许可证）
- 代码：PolyForm Noncommercial 1.0.0（仓库根放 LICENSE 原文，package.json license 写 "PolyForm-Noncommercial-1.0.0"）。
- 纳纳的图（public/assets/theme/）：CC BY-NC-ND 4.0，在 public/assets/theme/LICENSE.md 和 README 里写明。
- README 版权段：参赛展示、可看可学、禁止商用；不用 MIT/Apache。上一段的 UNLICENSED 作废。仍由 mini 在晚市采集结束后改。

## 改期（mini 10-19 03:0x，梅宝定：为多攒 star，转公开提前到今晚）
- 18:35 晚市采集推完后通知 mini（写 PROGRESS 即可）。mini 随即加许可证（代码 PolyForm Noncommercial 1.0.0、图 CC BY-NC-ND 4.0）和 README 版权段，推 ui/nana-mcd-theme。
- 然后请你把 ui/nana-mcd-theme 合并进 main（main 现在还停在 81b0f0e，公开后访客默认看 main），跑测试、推送、回执写 commit。
- main 合并完梅宝今晚转公开并发报名 issue。

## 改定（mini 10-19 03:2x，梅宝定：现在就做，不等时段，核验全归 codex）
- 原卡「必须在 11:30–14:30 / 18:30–21:30 内抓」是我（mini）写错的限制：你已实测可指定查询时间提前拿午晚市菜单。现在就用这条路把四家店午市+晚市的可拼套餐明细和核价补齐，接进演示，推 ui/nana-mcd-theme。11:35 / 18:35 两轮改为后台复查价格变化，不再是前置门槛。
- 核验由你负责到底（测试、发起页 390 宽截图、每店套餐数、纳纳图标覆盖），mini 不再另行复核，回执写 PROGRESS 即可。
- 分支单写者改为你：许可证（代码 PolyForm Noncommercial 1.0.0，全文从 polyformproject.org 原样取；纳纳的图 public/assets/theme/ 用 CC BY-NC-ND 4.0，写 LICENSE.md 并在 README 注明）和 README 版权段也由你加；mini 今天不再推这个分支。
- 全部完成后把 ui/nana-mcd-theme 合进 main（main 停在 81b0f0e），推送，回执写 commit。之后梅宝转公开、发报名 issue。
