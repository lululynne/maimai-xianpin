# 麦麦现拼 v1 · mini 独立验收（2026-10-18 22:1x CST）

对象：lululynne/maimai-xianpin main a42abf644bbf2f9d6d2e37070c2b30c50c28f6f4（mini 新 clone，Node 24.13.0）

- npm ci 通过；npm test 45/45；npm run typecheck 通过。
- git ls-files 无 .env / sqlite；按 sk-/JWT/Bearer 形态扫全仓零命中。
- 无 Token 起 demo（PORT=8797）：首页 200，Playwright 390×844 scrollWidth=clientWidth=390，零 pageerror；三乡店真实快照、3 张演示拼单、¥23.94/套餐 ¥39.90 正常显示。
- 本次 mini 只验了首页渲染与 API；发起→卡片→已取到全流程以 MacBook 的 Chrome 走查为准，未在 mini 重走。

五处请复核的裁定：
1. Cookie 设备号只做基础防占位：接受，v1 边界，对外文案不得宣称防刷。
2. 创建不计入十分钟三单：接受。
3. 到点关招募、留存按原截止 +24h 封顶：接受。
4. 未知单点价按件均分回退 + 两个券工具隔离：接受，券工具保持关闭。
5. D1 适配与部署：另开单，未授权前不部署、不转公开、不报名。

结论：v1 本地演示验收通过，可给梅宝看效果。正式美术与 D1 另开单。
