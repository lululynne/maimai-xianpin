# 美术预留位（供 Mac mini 另开美术单）

10-19 主题版已经接入纳纳提供的餐品、门店、菜单板、托盘、倒计时和取餐铃等图标，路径为 `public/assets/theme/`。`public/app.js` 的 `mealIcon()` 按实际餐品名自动匹配；套餐少需要补菜单，不能凭空添加餐品和价格。本批次保留现有图标和排版。

尚待另单：麦乐鸡、分享盒专属图标，16:9 封面和方形封面。下面保留原来的通用插槽供后续扩充。

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

## 10-19 实际覆盖验收

主题目录有 27 件现有 PNG，保持原图不重绘。Chrome 390 宽逐店发起页图片均加载成功；三乡亲子八件餐实际显示 `spicy-chicken-burger`、`wing`、`fries-game`、`milk`、`cola`、`toy-gift` 图标，玉米 / 苹果使用 `pindan` 纸袋。菜单格另覆盖普通汉堡、麦辣类、鸡翅与薯条图，实际名称中的麦香鱼、麦香鸡、巨无霸已补匹配。

甜筒、营养卷等本次真实套餐没有返回，不能凭有图就编造商品；它们可在明确标「示例」的体验内容中出现。玉米、苹果、酱料没有专属素材，保持纸袋回退；麦乐鸡目前用鸡翅类图，专图仍可后续另单。截图见 `images/compose-parts-mobile-390.jpg` 与 `images/fallback-mobile-390.jpg`。

图片许可见 `public/assets/theme/LICENSE.md`（纳纳署名，CC BY-NC-ND 4.0），不受根目录代码许可证替代。
