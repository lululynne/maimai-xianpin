# 当前施工状态

日期：2026-10-18。施工目录：`/Users/lulu/maimai-xianpin`。仓库：`lululynne/maimai-xianpin`（PRIVATE）。

## 已完成的接活准备

- 从当前 SSH 入口 `hostdzire-inbox` 接收了任务卡与原方案，两件文件 SHA-256 与远端一致。
- 核对空仓库，建立本地工程与 Git 忽略边界；`.env` 权限为 600。
- 接入官方 MCP SDK；建立固定公开只读名单，嵌套优惠券/账号参数也会在联网前被拒绝。
- T0 探路脚本就绪；没有 Token 时退出码 2，不会发出请求。
- 找到官方比赛声明原文，字节副本的 Git blob 哈希与官方内容 API 一致。
- `npm test`：4/4 通过。`npm run typecheck` 通过。

## 尚未完成

| 施工项 | 状态 |
| --- | --- |
| T0 | 探路工具准备完成；等待本地 Token；真实 schema、四家店夹具和四个实测答案未完成 |
| T1 | 依赖和 TypeScript 基础已准备；Hono 服务、SQLite、live/demo 切换未完成 |
| T2–T9 | 未开始；不使用猜测菜单替代 T0 真实夹具 |
| T10 | 仅官方声明已原样取得，其他交付材料尚未完成 |
| T11 | 尚无 Mac mini 复验、梅宝验收或对外发布 |

## 下一步

梅宝在本地 `.env` 填好 `MCD_MCP_TOKEN` 后，先运行 `npm run probe:mcp`，读真实 schema，再编排四店公开只读探测。完成 T0 后按任务卡依次做 Hono/SQLite 和演示模式。

## 需 Mac mini 复核的发现

官方文档的 `query-store-coupons` 与 `available-coupons` 均使用“用户可用/可领取”的描述。为守住个人账号边界，暂时从访客可用工具中移除。依据和影响见 `MCP_INTEGRATION.md`。
