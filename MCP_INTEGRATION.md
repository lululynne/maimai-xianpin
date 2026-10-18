# MCP 接入记录

## 当前状态

**T0 待本地 Token，尚未实测。** 未执行带 Token 的 `initialize`、`tools/list` 或菜单/算价调用。以下协议与工具语义来自官方公开文档，不能代替实测证据。

- Endpoint：`https://mcp.mcd.cn`
- Transport：Streamable HTTP，使用官方 MCP TypeScript SDK。
- 鉴权：服务端从 `.env` 读取 `MCD_MCP_TOKEN`，只放入 Authorization 请求头。
- 官方公开文档：https://github.com/M-China/mcd-mcp-server

## 工具边界

运行时固定允许：`query-nearby-stores`、`query-meals`、`query-meal-detail`、`calculate-price`、`now-time-info`。

禁止任何未在固定名单内的工具；算价参数也不能嵌入账号、优惠券或凭据字段。前端不提供通用 MCP 调用入口。

### 拆分卡需复核的两项

官方工具表将 `query-store-coupons` 描述为“查询用户当前门店下可用的优惠券列表”，将 `available-coupons` 描述为“查询用户当前可领取的麦麦省的优惠券列表”。两者都可能受 Token 所属账号影响，不能作为已确认的门店公共数据。

因此目前都不调用、不输出到访客、不存入公开演示夹具。券相关功能在确认公共数据边界前保持关闭；理想版补偿档位的静态展示不受影响。这是按照拆分卡“不让访客碰梅宝个人账号数据”的上位约束收紧名单，待 Mac mini 复核。

## T0 待填的四个答案

| 问题 | 当前证据 |
| --- | --- |
| 菜单有没有价格字段？ | 待真实 `query-meals` 调用 |
| 套餐明细能否拆出单件？ | 待真实 `query-meal-detail` 调用 |
| `calculate-price` 单位是否为分？ | 官方示例有整数价格；仍待同商品真实响应交叉核对 |
| `available-coupons` 是门店级还是账号级？ | 官方描述为用户可领取的券，先按账号相关关闭；未调用 |

## 实测证据格式

1. 先执行 `npm run probe:mcp`：原样保存 `tools/list` 的工具列表、inputSchema 和实际存在的 outputSchema，记录抓取时间；没有 outputSchema 就明确记缺失。
2. 审阅 schema 后，按四家店 `1420082 / 1420800 / 1420277 / 1421248` 编排公开只读批次。到店参数以 `beType=1`、`orderType=1` 为目标，具体字段类型服从真实 schema。
3. 选择可拆的套餐，核对可选子项和件数，分别算套餐和单件价格，不传优惠券参数。
4. 原始业务响应仅放 `.local/probes/`。审阅并脱敏后保存 `fixtures/`，附来源、时间和哈希；没有实测数据就不制造“真实菜单”夹具。
5. 将真实 schema 原样补入本文件，更新四个答案与探测覆盖表。
