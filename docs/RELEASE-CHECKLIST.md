# 发布检查清单

项目：**dsh-model-shelf / 模型书架**。作者：**Hobartoakes**。许可：**MIT**。

## 已确认与完成

- [x] 确认正式名称、作者及 GitHub 仓库地址，补齐 author / repository / homepage / bugs。
- [x] 用户确认 MIT，添加正式 LICENSE 和版权署名。
- [x] 创建公开仓库 https://github.com/Hobartoakes/dsh-model-shelf。
- [x] 查询 npm：准备期间 `dsh-model-shelf` 尚未注册；查询不是预留。
- [x] 中文介绍、英文摘要、安装 / 卸载 / 使用说明。
- [x] 仅声明已验证的 DSH 0.2.0-rc.2，说明平台与依赖服务。
- [x] 1.2.1 起兼容声明扩展到 **0.2.1-rc.2**：`engines.dsh` 已更新，模型目录契约逐项核对无变化，干净 profile 集成测试在真实 0.2.1 宿主下通过。逐项记录见 [HOST-COMPATIBILITY.md](HOST-COMPATIBILITY.md)。
- [x] 手动分类、模型身份显示、本地保存范围与上游模型映射限制。
- [x] 隐私说明、版本记录和模拟数据演示截图。
- [x] 包文件白名单与 Git 排除规则，排除真实对话、本机备份、依赖目录和测试数据目录。
- [x] 显式构建；用户安装预构建归档时不需要构建脚本。
- [x] 14 项偏好测试、21 项离线浏览器检查、7 项隔离 profile 集成检查通过（含 1.1.0 收藏与账号备注）。
- [x] 1.1.0 文档同步：README 用法与多账号说明、CHANGELOG、隐私说明、验证报告。
- [x] 真实干净 profile 中验证安装、禁用、重新启用和卸载，禁用 / 卸载后原生选择器可打开。
- [x] 目标包出现在实际客户端图中，广告的 JS 资源响应 200，界面真实挂载。
- [x] 修复首次创建模型目录时缺少 remote.session 注入声明的问题。
- [x] 验证过程未修改当前 desktop manifest 或 patch，未复制用户凭据，未发起真实模型调用。
- [x] 用户明确授权 npm 发布后，将 private 改为 false，并限定公开发布到官方 registry；prepublishOnly 仍检查发布元数据。

详细过程见 [验证报告](VALIDATION.md)。

## 下一阶段仍未执行

- [ ] 再次确认 npm 包名可用性，以及准备 npm 发布账号和权限。
- [x] 用户明确授权 npm 发布，并解除 private 发布保护。
- [x] 发布 [GitHub Release v1.0.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.0.0) 并上传预构建安装包。
- [x] 验证未登录公开下载、SHA256 一致，以及官方 CLI 从公开 URL 安装、禁用、重新启用和卸载。
- [ ] 发布 npm 包（尚未执行）。
- [x] 按 awesome-dsh-plugin 当时的贡献规范提交目录收录 PR：[#7630](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7630)（单文件条目，CI `check` 与 `Submission gate` 均通过，等待维护者合并）。
- [ ] 收录同步后，从 dsh-market 实测一键安装。
- [x] 发布 [GitHub Release v1.1.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.1.0) 并上传预构建安装包。
- [x] 验证 1.1.0 的未登录公开下载与 SHA256 一致（206017 字节，`AE5C461B…C81523`）。
- [ ] 验证 1.1.0 的官方 CLI 从公开 URL 安装、禁用、重新启用和卸载。
- [x] 发布 [GitHub Release v1.1.1](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.1.1) 并上传预构建安装包。
- [x] 发布 [GitHub Release v1.2.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.2.0) 并上传预构建安装包（思考强度就地检测、恢复服务商默认、逐模型上下文容量）。
- [x] 验证 1.2.0 的未登录公开下载与 SHA256 一致（245192 字节，`C47E9135…B6B588`）。
- [x] 验证 1.2.0 的官方 CLI 从公开 URL 安装：隔离 `DSH_HOME` 中 `dsh plugin --profile desktop add <release URL> --ignore-scripts` 成功装为 1.2.0，bundle 正确注册，安装后的 `lib/client.js` 与本地发布产物 SHA256 一致，`remove` 后包与 bundle 条目一并清除。
- [ ] 有公开新版本时验证真实升级流程；当前未验证跨版本升级，1.0.0 → 1.1.0 仅覆盖本地偏好兼容。
- [ ] 其他 DSH 版本及平台经过实测后，才扩展兼容声明；目前已实测 **0.2.0-rc.2 与 0.2.1-rc.2**（均 Windows），macOS / Linux 仍未验证。
- [ ] 1.2.1 尚未发布：发布前需重新打包、走公开下载与 SHA256 校验、以及官方 CLI 从公开 URL 安装/禁用/卸载验证（参照 1.2.0 一节的做法）。
- [ ] 0.2.1 的 1017 角标缺口：宿主侧把 `conversation.input.model.label` 的声明权从 `ui-model-selection` 上移到 `ui-conversation`（或提供替换者可复用的 children 继承）后，本插件即可恢复角标。可向 DSH 提 issue 跟踪。

`pnpm run check:release` 只检查发布文件，不执行发布。private 标志解除并不代表包已经发布；还必须完成 npm 登录、二次验证（如要求）、归档审查、实际上传和 registry 核验。

这份清单记录发布准备阶段的检查；npm 的实际可用版本以 registry 为准。

当前电脑原型的旧归档没有被覆盖。正式项目在独立目录中整理，测试使用独立 DSH_HOME、独立 profile、随机本地端口，不替换正在使用的 GUI。

## 版本更新时必改的文档

版本号或宿主版本一变，下面每一项都要跟着改。漏改不会立刻报错，而是等用户装完包才发现 README 还写着上一个版本——1.2.1 迁移时就漏过 `docs/VALIDATION.md` 与 `docs/RELEASE-CHECKLIST.md`。

| 文件 | 必改内容 |
| --- | --- |
| `package.json` | `version`；兼容宿主变化时改 `engines.dsh`；新增文档要加进 `files` 白名单 |
| `scripts/check-release.mjs` | `SUPPORTED_DSH` 常量与对应断言（扩大兼容范围时） |
| `CHANGELOG.md` | 新增当前版本的条目（`check:release` 会校验 `## <version>` 存在） |
| `README.md` | 「兼容性」表的宿主版本、正文的版本说明；如需可补角标/缺口说明 |
| `docs/VALIDATION.md` | 「范围与结果」的**包版本行**（`check:release` 锚定这一行）；文末新增该版本小节 |
| `docs/RELEASE-CHECKLIST.md` | 版本相关待办的勾选与新增；「尚未验证」随实测范围更新 |
| `docs/HOST-COMPATIBILITY.md` | 宿主版本变化时逐项核对并更新；标题的迁移方向 |

`scripts/check-release.mjs` 会自动校验其中四项：CHANGELOG 有当前版本条目、README 声明了当前宿主版本、VALIDATION 的范围行是当前版本、以及每个 `docs/*.md` 都在 `files` 白名单内。所以**改完文档先跑一次 `pnpm run check:release`**，它会在发布前把漏改指出来。

历史小节（已发布版本的验证记录、CHANGELOG 旧条目）不要改写，按项目约定历史文本是证据；要改的是"描述当前状态"的那些位置。
