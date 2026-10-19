# GitHub Pages 浏览器试玩

梅宝明确要求给 GitHub 仓库接入点开即玩的模拟网页。正式地址：

https://lululynne.github.io/maimai-xianpin/

## 范围

- 保留纳纳的红黄主题、全部现有图片及手机布局，使用已脱敏的午市真实菜单快照。
- 复用 `Catalog`、`DemoMcpClient`、`Groups`、`createApp` 和分摊算法；新增同步的浏览器存储适配器及 Web Crypto 适配。
- 在线版的拼单 API 在浏览器内部执行，不向官方 MCP 或其他访客发送请求。静态资源和快照由 GitHub Pages 提供。
- 每个标签页有自己的模拟身份和拼单记录，使用 sessionStorage 保留刷新前状态；关闭标签页后重新开始。存储被禁用或写满时自动降为内存体验。
- 页面明确标识「在线试玩 · 独立模拟」。参与者、尾号、付款、补偿和取餐码均为模拟，不产生真实订单、扣款或发券。
- `demoDevice` 只由浏览器运行入口内部注入且只在 demo 模式使用，不能通过请求参数指定；live 仍使用现有 Cookie。浏览器不依赖设置被禁止的 Cookie 请求头。
- 访客之间没有共享团单；真实跨人拼单仍属于 Node/SQLite 服务。新增 `/mcp` 服务不在本交付内。

## 构建和发布

`npm run build:demo` 输出 `dist/pages/`。构建显式选择 index、样式、浏览器脚本、图片、脱敏快照和许可证，不复制工作目录；打包时拒绝包含服务端 SQLite、官方 MCP 网络客户端或 Node 服务入口。资源使用内容哈希名称，支持 GitHub 项目子路径。

`.github/workflows/pages.yml` 在 main 的相关源码或菜单变更后执行 npm ci、全部测试、类型检查和浏览器构建，再通过 GitHub Pages artifact 发布。README 等纯文档改动不触发重复部署。

## 本机验收

- 76 项测试通过、TypeScript 检查通过、静态演示构建成功。
- 新增覆盖：菜单与多套餐广场、加入并确认、发起、模拟拼满/付款/取走、刷新后保留身份、不同访客独立、到点换新不延长旧截止、存储受限仍可体验。
- 浏览器存储与 SQLite 对比事务回滚、对象副本、加入计数及原截止加 24 小时清理语义。
- Chrome 实际点过：个人卡片 → 模拟拼友加入 → 模拟付款 → 本人取餐码 → 本人取走 → 拼友取走 → 已取完；另走发起 → 相似确认 → 新个人卡片。
- 390×844 手机视口：首页与发起弹窗无横向溢出；图片加载失败 0，浏览器 warn/error 0。

上线状态以 GitHub Actions 成功的 Pages deployment 和公网地址回读为准。
