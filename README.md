# 麦麦现拼

到店自取，让同一家店的陌生人现场拼一个大套餐。

当前是 **T0 接入准备批次**，尚未完成真实菜单验证，也没有可交付的演示页面。以 `docs/STATUS.md` 为施工状态；原方案及拆分卡保存在 `docs/briefs/`。

## 本地接入准备

需要 Node.js 24+。

```sh
npm ci
cp .env.example .env
chmod 600 .env
```

已有 `.env` 时不要重复复制覆盖。仅在本地 `.env` 的 `MCD_MCP_TOKEN=` 后填写自己的 Token。

```sh
npm run probe:mcp
npm test
npm run typecheck
```

探路命令先连接官方 `https://mcp.mcd.cn`，执行 `tools/list`，将 schema 存入被 Git 忽略的 `.local/probes/tools-list.json`。先审阅真实 schema，再按真实参数编排四家店的公开只读探测批次：

```sh
npm run probe:mcp -- .local/t0-calls.json
```

批次格式为 `[{"name":"query-meals","arguments":{...}}]`；工具参数必须以真实 `tools/list` 为准。调用结果先留本地，审阅脱敏后才转入 `fixtures/`。

## 固定规则

- 只到店自取；网页不下单、不支付、不领券、不绑券。
- 规定时间 10–60 分钟，默认 30 分钟，发起后不能延长。
- 相似拼单确认弹窗、按截止最早排序、最多三单。
- 理想版补偿券档位只展示；不代表实际发券。
- Token 只在本地服务端使用；仓库和交接包均不含 Token。
- 团单只留昵称、尾号后四位和匿名设备标识；结束 24 小时后删除。

## 官方来源

- [麦当劳 MCP 接入指南](https://github.com/M-China/mcd-mcp-server)
- [开发者大赛](https://github.com/M-China/mcd-developer-innovation-challenge)
- `CONTEST_DECLARATION.md` 为官方模板原字节副本，来源及校验见 `docs/official-sources.md`。

仓库保持私有，转公开、报名和最终提交由梅宝处理。
