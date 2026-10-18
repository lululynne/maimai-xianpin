# 麦麦现拼

到店自取，让同一家店的陌生人现场拼一个大套餐。

![真实页面步骤演示](docs/images/demo-walkthrough.gif)

大套餐一个人吃不完，就和同店的人各选几样，算清每人的那份，到店对卡片取餐。网页不碰支付，不代下单，不领券、不绑券。

## 本地运行

需要 Node.js 24+（本机验证版本 24.13.0）。

```sh
npm ci
npm run dev
```

打开命令打印的 `http://127.0.0.1:8787`。默认是 **演示模式**，无需 Token，不会调用上游。菜单和套餐是真实采集的快照，拼单人、昵称和尾号为虚构。

演示完整流程：发起一单 → 相似拼单确认 → 小卡片 → “演示：模拟拼友加入并确认” → “演示：模拟官方渠道已下单” → “已取到，提醒大家”。所有模拟入口只在 demo 模式注册。

[桌面截图](docs/images/demo-desktop.jpg) · [手机截图](docs/images/demo-mobile.jpg) · [21 秒界面步骤视频](docs/images/demo-walkthrough.mp4)。动图和视频由真实界面状态截图序列组成，非连续屏幕录像。

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
| `DEMO_SPEED` | `1` | 演示计时倍速 1–60，live 固定 1 |

## 规则

- 规定时间 10–60 分钟，默认 30 分钟，发起后不能延长。
- 同店同套餐的相似单，最多列三单，按截止时间最早排序。
- 发起人先选自己的餐品，其他人选剩余部分。每人至少一件；最后一位需接完剩余餐品。
- 按各自餐品单点价权重分套餐价，算到整数分，零头归发起人。任一单件没有可靠单点价时，整单按件数均分并明确说明。
- 匿名设备不能拼自己的单、同一尾号不能重复加入；每设备十分钟最多加入三单。发起人可以移出未确认成员。
- 所有人确认后，发起人才能标记“已在官方渠道下单”。“已取到”提醒由网页 30 秒轮询获取。
- 到点结束招募，没实际下单的单转为到点下架。已标记下单的成员仍可在自己的卡片查看取到状态；停止招募和个人卡片收尾分开。
- 等待计时不超过原截止时间，取到后停止；理想版 15 分钟 2 元 / 超过 30 分钟 5 元券档只展示，不实际发券。
- 只留昵称、尾号后四位、匿名设备标识及团单信息；结束 24 小时后自动删除。当前匿名设备限制属于无登录的基础防占位，不能把清 Cookie 后的新设备识别成同一个人。

## MCP 与公开数据

菜单、明细、算价按门店和参数缓存十分钟。访客只接收白名单中的门店 / 餐品字段。门店搜索强制按位置搜索，不读取账号收藏；常点、随单购卡等字段不进入公开夹具。

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
- [美术预留位](docs/art-slots.md)：正式小水母、美术小件仍由 Mac mini 另开单。
- Hono + TypeScript + Node.js SQLite，本地单命令启动。迁移 SQL 保持 D1 兼容；Cloudflare D1 运行适配器及部署尚未完成。
- 本机验证与 Mac mini 独立验收是两步；没有把本地通过写成隔壁已验收。

## 官方来源

- [麦当劳 MCP 接入指南](https://github.com/M-China/mcd-mcp-server)
- [开发者大赛](https://github.com/M-China/mcd-developer-innovation-challenge)
- `CONTEST_DECLARATION.md` 为官方模板原字节副本，来源与哈希见 [校验记录](docs/official-sources.md)。

仓库当前保持私有。转公开、报名 issue 和最终提交由梅宝处理。
