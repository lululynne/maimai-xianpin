# 美术预留位（供 Mac mini 另开美术单）

当前小水母为 CSS 占位插画，功能不依赖正式图片。正式素材仍按原卡交纳纳 / 鲨宝，本批次没有向她们发送消息或制作正式美术。

前端路径常量位于 `public/app.js` 的 `ART`。素材统一放 `public/assets/`。交图后在同目录 `manifest.json` 中将对应键设为 `true`，页面即加载图片，业务逻辑不用改。

| 键 / 文件 | 建议画布 | 格式 | 使用位置 |
| --- | --- | --- | --- |
| `waiting` / `jelly-waiting.png` | 768 × 768 | 透明 PNG | 首页等人 |
| `full` / `jelly-full.png` | 768 × 768 | 透明 PNG | 已满状态备用 |
| `urgent` / `jelly-urgent.png` | 768 × 768 | 透明 PNG | 快到点状态备用 |
| `expired` / `jelly-expired.png` | 768 × 768 | 透明 PNG | 到点未拼成备用 |
| `empty` / `empty-plaza.png` | 960 × 480 | PNG | 空广场 |
| `ticket` / `ticket.png` | 960 × 600 | PNG | 小卡片底图，文字区域须低对比留白 |

README 头图建议 1600 × 900；站点图标建议 512 × 512。本批次已经提供真实页面步骤动图及截图，正式美术可在它们验收后替换。
