# MiMo 预约快照只读审查 · 2026-10-19

真实 MiMo CLI，`xiaomi/mimo-v2.6-pro`，会话 `ses_ffe5eaf8513e3ffefFSw0p6VdX`。本机模型目录核到该通道为普通 API `https://api.xiaomimimo.com/v1`；不计作 Token Plan 用量。仅附五份源码，不含 .env、Token、数据库或原始接口数据。Codex 负责最终处置。

## Codex 处置

1. 当前时段存在真实菜单时，明细 / 价格不允许借用其他时段，已加回归测试；全缺时段仍按任务要求明确展示历史回退。
2. 回放工具在有当前时段数据时只输出该时段餐品；API 中显示实际回退标记。
3. 无当前时段抓取时的历史回退保留，发起页明确提示；神湾大道午晚市查询失败真实保留，未算入午晚市数量。
4. success=true 但 data=null 的异常快照排除，已加回归测试。
5. 不采纳一律丢弃匹配商品行 0 元的建议；真实匹配的免费项允许为 0，空 productList 仍为未知，两者有既有测试区分。
6. 缺单件价仍按 mini 已裁定规则允许整单按件数均分；每个单件已逐个询价。统计增加单价完整数量，不将可发起数量称为单价全部完整。

以下审查针对整合前的源码版本，部分问题已在结果返回前修复。

## 原文

```json
{
  "findings": [
    {
      "id": 1,
      "severity": "high",
      "file": "demo.ts",
      "lines": "55-65",
      "title": "recorded() 在当前时段无匹配采集时回退到其它时段，午晚价格/明细会串",
      "problem": "recorded 先按 menuPeriod(this.now()) 过滤 periodOf(c)===period，但 matching 为空时 candidates 回退为 all，最后 priced.at(-1) ?? valid.at(-1) ?? candidates.at(-1) 可能取出 lunch 的 calculate-price / query-meal-detail 当作 dinner 回放（或相反）。这直接违反「午晚价格不可串」。",
      "evidence": "demo.ts:58-59 `const matching = all.filter(c => periodOf(c) === period); const candidates = matching.length ? matching : all;`；:63 无时段约束的兜底。keyFor 剥掉 reservationDate 后（:13）午/晚同 key 存同一 Map，更依赖 periodOf 过滤，兜底即串价。catalog.ts:104/115 还会把串来的价格以当前时段键缓存 10 分钟。",
      "fix": "价格/明细类工具去掉跨时段兜底：matching 为空时抛 DEMO_CAPTURE_NOT_AVAILABLE，不要用另一时段 capture。若要保留「只有午餐采集」的可用性，也只允许同一 MenuDaypart 内回退，并显式标记 _stalePeriod；否则 catalog 的 price/meal 缓存会把串价钉死一个 CACHE_MS。"
    },
    {
      "id": 2,
      "severity": "high",
      "file": "demo.ts",
      "lines": "76-92",
      "title": "query-meals 按菜单捕获时段 when 过滤，而不是按回放时段 period，其它时段套餐会进当前菜单",
      "problem": "拼 rows 时用 `availability.get(code).has(when)`（when=该条 query-meals 的 periodOf），不是 `has(period)`（period=当前回放时段）。只要存在 dinner 的 query-meals 采集，dinner-only 套餐会进入 lunch 回放的 meals/categories；_availablePeriods 虽标了 dinner，原始工具结果仍已泄漏。",
      "evidence": "demo.ts:80-81 `if (!availability?.get(code)?.has(when)) continue;`，行尾 :92 输出 rows 全量。配合 catalog.ts:96-99 的 current/all 兜底，会在午餐时段展示晚餐套餐。",
      "fix": "纳入 rows 的条件改为 `availability.get(code)?.has(period)`（按当前回放时段）；需要展示「今日还有哪些时段」时只读 _availablePeriods，不要把非当前时段的 row 放进 meals。"
    },
    {
      "id": 3,
      "severity": "high",
      "file": "catalog.ts",
      "lines": "92-99",
      "title": "已有 availablePeriods 元数据时仍按 daypart/all 兜底，午餐可点到晚餐套餐",
      "problem": "realShareableMenu 在 specific 为空后用 availableDayparts（lunch/dinner 都映射成 regular）过滤，再 `return all`。demo 路径下 _availablePeriods 已存在，却仍可能返回仅 dinner 可售的套餐；随后 meal()→price() 触发 finding 1 的跨时段回退，得到晚餐价。",
      "evidence": "catalog.ts:94-99：specific 用 availablePeriods，空则 current 用 availableDayparts（dayparts 映射见 demo.ts:92 lunch/dinner→regular），再 `return current.length ? current : all`。注释只覆盖 live 菜单无元数据的情况，未处理「有 periods 元数据但不匹配」。",
      "fix": "若某店结果带 _availablePeriods：只返回 includes(menuPeriod(menuTime())) 的套餐，不允许 daypart/all 兜底。仅当 availablePeriods 与 availableDayparts 均缺失（纯 live）才允许 `return all`。"
    },
    {
      "id": 4,
      "severity": "medium",
      "file": "demo.ts",
      "lines": "15, 28-31, 76-79",
      "title": "successful() 与 catalog.unwrap 对 data==null 的判定不一致",
      "problem": "successful 只要求 success===true，不要求 data!=null；unwrap 会把 success 且 data==null 当 MCD_BUSINESS_ERROR。data 为 null 的 query-meals 会被放进 menus，call() 里 `menu.result.structuredContent.data.meals` 直接 TypeError；calculate-price 同类 capture 还会进 valid，再被 catalog.unwrap 打成业务错误而不是 DEMO_CAPTURE_NOT_AVAILABLE。",
      "evidence": "demo.ts:15 vs catalog.ts:18 `body?.success !== true || body?.data == null`；demo.ts:79-80 对 data.meals 未做空值防护（仅 ?? {} 保护 meals，不保护 data 本身）。",
      "fix": "successful 改为 `!c.result?.isError && c.result?.structuredContent?.success === true && c.result?.structuredContent?.data != null`，与 unwrap 同一合同；constructor 写入 menus 前再校验 data 为对象。"
    },
    {
      "id": 5,
      "severity": "medium",
      "file": "catalog.ts",
      "lines": "42-47",
      "title": "空价处理不一致：subtotal===0 被当有效价，recorded 又会回退到无价 capture",
      "problem": "readProductPrice 在 productList 有行且 subtotal===0 时返回 0（视为真价）；而注释写明未匹配产品会「success=true、零总额」。0 元会被 meal/单件价采用，稀释拼单。另一侧 demo.ts:62-63 在 priced 为空时回退 valid.at(-1)/candidates.at(-1)，会把 empty productList 的成功响应或未成功响应当 calculate-price 结果返回，错误类型也从 DEMO_CAPTURE_NOT_AVAILABLE 变成 MCD_BUSINESS_ERROR/null 价。",
      "evidence": "catalog.ts:44-46 仅拒绝 subtotal<0，0 通过；demo.ts:61-63 无标价时仍返回 capture。capture-daypart.ts:91-93 吞掉单件价失败后 unitPriceCents=null 仍入 captured。",
      "fix": "1) readProductPrice 对 subtotal===0 返回 null（免费单品若需要支持，用独立标记而不是 0 价）；2) calculate-price 在当前时段无 priced capture 时抛 DEMO_CAPTURE_NOT_AVAILABLE，不要回退空价/失败 capture；3) 统计上区分 priceCents 完整与 unitPriceCents 缺失（见 finding 6）。"
    },
    {
      "id": 6,
      "severity": "medium",
      "file": "capture-daypart.ts",
      "lines": "88-107, 118-123",
      "title": "真实采集统计把单件价缺失的套餐算进 captured/offered，抬高「已采集」计数",
      "problem": "整套价缺失会拒绝，但单件 calculate-price 失败或 readProductPrice 得 null 只被吞掉，parts.unitPriceCents=null 仍 `summary.captured.push`；`captured.length>=10` 与 finally 里 `offered`（只按 code 在不在 shareableMenu）都不要求单件价完整。目标是「整套和单件价格」都真实读取，该统计会把不可完整拼单拆账的条目算作成功。",
      "evidence": "capture-daypart.ts:89-97 try/catch 仅重抛 MCD_OUTSIDE_CAPTURE_WINDOW，unitPriceCents 可为 null 仍 push；:107 用 captured.length>=10；:121-123 offered 只按 code 交集。catalog.ts:128 同样吞掉单件价异常。",
      "fix": "summary.captured 仅收齐整套价且关键单件价均非 null 的条目，或拆出 `capturedPartial`；status 的 >=10 与 offered 统计改为基于完整条目；单件价缺失在 report.errors/rejected 留痕，避免把早餐回退/示例/半截数据混进真实采集数。"
    }
  ]
}
```
