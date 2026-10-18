# 来源与校验

## 交接输入

入口：本机既有 SSH alias `hostdzire-inbox`；已复核其配置指向当前 HostDzire，不沿用旧 RackNerd 地址。

| 本地文件 | 远端来源 | SHA-256 |
| --- | --- | --- |
| `briefs/20261018-maimai-xianpin-v1-tasks.md` | `/home/ajingops/mimo-work/tasks/20261018-maimai-xianpin-v1-tasks.md` | `acb4faacd6f29188c84f26bead78851cbc8398c806a8d9e5375a325c985d0d5c` |
| `briefs/20261017-maimai-xianpin-plan.md` | `/srv/inbox-chroot/living-room/纳纳/20261017-麦麦现拼-方案.md` | `1d041b4dd6066d6647c5948f1632732a4c5a832c89afdc25ecb578033d15f247` |

两件文件均逐件对比本地和远端哈希，一致。

## 比赛声明

- 官方仓库：`M-China/mcd-developer-innovation-challenge`
- 官方文件：https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/CONTEST_DECLARATION.md
- 获取：2026-10-18，由官方 raw URL 原字节下载，未追加来源注释、未改写文案。
- 官方内容 API 的 Git blob SHA：`136e76f3160317049f19f5ba03f4d0fedd70fc3c`
- 本地 `git hash-object CONTEST_DECLARATION.md`：相同。
- 本地 SHA-256：`cd28101bcb29cc8fb24b372fe91ce6b42c4a1487a54e01f7ade0c8c6a84241b7`
- 文件大小：1522 bytes。
- `.gitattributes` 对该文件禁用文本换行转换，保持官方字节。

正式提交比赛前再次核对官方版本；本文只记录来源，不修改声明正文。
