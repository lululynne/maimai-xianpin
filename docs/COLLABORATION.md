# 协作与审阅

本批次使用真实 MiMo CLI，没有把 Codex 子代理命名成米末。

- CLI：`/Users/lulu/.mimocode/bin/mimo`
- 模型：`xiaomi/mimo-v2.6-pro`
- 当前登录：已有 Xiaomi API 通道；本批次不记作 Token Plan 使用，未购买、续费或修改计费设置。
- T3 会话：`ses_ffe5eb3a6600bffeYaSkQKa018`。米末只拿到纯函数规格，返回 TypeScript 与 24 个测试；Codex 审核、补齐严格类型检查并整合。
- 独立审阅：只给三件状态机 / SQLite / Hono 源码；原文见 `reviews/20261018-mimo-state-review.md`。没有提供 Token 或 `.env`。

## Codex 对复查结论的处置

| 米末发现 | 核对结论 / 处置 |
| --- | --- |
| 清 Cookie 能绕过设备限制、换设备可拼自己的单 | 真实限制。v1 任务要求的是匿名浏览器设备号的基础限制，不能证明真人唯一。README 和状态已明确这一边界，交 mini 复核。没有引入会把同店公共 Wi-Fi 下不同陌生人一起封住的按 IP 三单限制。 |
| 发起不计入“十分钟三单” | 当前规则限定“加入三单”，原方案还明确不设拼单总数上限；创建没有计入加入次数是按此实现。若 mini 希望另设创建防滥用策略，再单独定，不偷改为发起/加入合并限额。 |
| 三件附件中找不到提醒 | 审阅附件没有包含前端。`public/app.js` 每 30 秒读取 `/api/mine`，状态转为已取到时提示；两个浏览器身份 API 测试及 Chrome 演示流已验证读回状态。 |
| 到点后才取到，留存不是从取到再算 24h | 当前“结束”按原截止时间封顶，避免延长留存；已下单单子仍能在个人卡片收尾，但不恢复招募。规则解释已写进 README 和回执，请 mini 确认。 |
| 其余状态、占位互斥、踢人、确认条件等 | 没有报告可触发的新破坏路径；仍须 mini 独立运行验收，不能把这份有限范围审阅当成全系统保证。 |

米末原文中把数据库 live/demo 隔离称为个人工具隔离，这不足以验证 MCP 工具白名单；真正的白名单、参数与账号字段隔离另由 Codex 源码和测试验证。

## 10-19 预约回放审阅

再次使用真实 `/Users/lulu/.mimocode/bin/mimo`，模型 `xiaomi/mimo-v2.6-pro`，会话 `ses_ffe5eaf8513e3ffefFSw0p6VdX`。在隔离目录仅提供五件 TS 源码，没有提供 Token、`.env`、原始业务响应或数据库。当前 Xiaomi 配置实际指向 `https://api.xiaomimimo.com/v1` 普通 API，本轮不记作已购 Token Plan，未更改计费设置。

米末提出跨段借价、菜单合并、null 成功体等问题；Codex 修复当前段缺价不借其他段、当前段菜单筛选、null 校验，并补回归。整段缺失时历史回退是卡中明定规则，因此保留但加 API / UI 提示；匹配的真实零价不应一律拒绝；未知单点价继续采用已认可的整单按件均分。完整原文及六条裁决见 [20261019-mimo-reservation-review.md](reviews/20261019-mimo-reservation-review.md)。米末有限审阅不代替 Codex 的数据及浏览器核验。
