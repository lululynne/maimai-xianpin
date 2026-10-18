# 10-19 本机午晚市采集

当前状态：采集代码及多时段回放已准备，真实午市 / 晚市记录仍待时段到来；每店至少 10 套、图标覆盖及 390px 发起页截图尚未验收。

任务输入：[补菜单卡](briefs/20261019-maimai-xianpin-more-meals.md)，SHA-256 `5f6caeb3a5ec5b91c40706c149c52f479f75be092612071fc0d162ff6e86ff40`；[主题合并卡](briefs/20261018-maimai-xianpin-ui-theme-merge.md)，SHA-256 `ea42db9360d32cc416fd98af3943bedc4b64cdee0ee225d46d8d09aaa2953da2`。

## 运行安排

MacBook 的 launchd 一次性任务计划在北京时间 **2026-10-19 11:35、18:35** 各运行一次。执行代码固定在本机独立 worktree `/Users/lulu/maimai-xianpin/.local/capture-runtime`，避免主工作目录切换分支影响采集。登录和网络需要可用；若休眠后醒来已超出该轮三小时时段，脚本拒绝补抓并记错过，不将其他时段冒充本轮。

```sh
node --env-file-if-exists=.env --import tsx scripts/capture-daypart.ts 2026-10-19 lunch
node --env-file-if-exists=.env --import tsx scripts/capture-daypart.ts 2026-10-19 dinner
```

脚本首先检查日期和时段，之后才读取 Token、连接 MCP。四店依次全量读菜单；优先抓桶、家庭餐、分享盒、麦乐鸡、麦辣双人餐及甜品组合，继续遍历符合任务名称或价格条件的所有候选。逐套保存明细和整套核价，每个不同单品都尝试单点核价；未知价保持未知。

原始文件用唯一时间前缀，旧文件不覆盖。导出将旧夹具与新记录合并、去重、脱敏并更新 manifest。明细或匹配整套核价不全的记录保留为证据，不放进可发起菜单。早餐 / 午晚市、同码不同价格和缓存跨 10:30 已有单测。

## 日志与交接

以下路径均相对于独立采集 worktree：

- `.local/probes/`：原始只读调用；不进入 Git 或 HostDzire。
- `.local/menu-captures/2026-10-19-lunch.json`、`2026-10-19-dinner.json`：真实开始 / 结束时间、四店候选与完成名单、未知价、单品分类及失败原因。
- `.local/menu-captures/*-job.json`：自动检查、提交和推送状态。
- `.local/menu-captures/*.log`：本机任务日志。

两次任务跑完后执行类型检查和测试；仅当 worktree 干净基线未变、远端主题分支仍等于该基线时，自动提交三个夹具文件并推 `ui/nana-mcd-theme`。远端已推进或检查失败则保留本机结果、要求人工整合，不强推。不会自动合并 main 或部署。

进度回执写到 HostDzire：`/home/ajingops/mimo-work/tasks/20261019-maimai-xianpin-more-meals-PROGRESS.md`，上传后回读 SHA-256。实际采集和截图全部核验后再写任务要求的 `-DONE.md`。

## 尚待完成

真实两轮采集、每店至少 10 套的实际结果、新单品分类复核、390px 发起页图标截图、新主题媒体、main 合并及 mini 新一轮接收。代码准备和排程不等于这些项目已完成。
