# 发布检查清单

项目：**dsh-model-shelf / 模型书架**。作者：**Hobartoakes**。许可：**MIT**。

## 1.3.1 当前验证（已发布）

- [x] 用户授权隔离测试及后续发布；唯一产品 writer 完成准备，控制器负责独立审查、提交、推送与发布。
- [x] 版本 1.3.1；精确四版白名单 rc.2 / rc.4 / rc.5 / alpha.2，拒绝未测版本。
- [x] 四版官方真实目录/slot 边界及离线 UI 回归通过；不拿它们替代完整 runtime。
- [x] 同一 pilot 四版完整 runtime 各 8/8；随后控制器对**最终归档**独立复跑四版，各 8/8。覆盖安装 / 启动 / 禁用 / 重新启用 / 卸载、原生回退、目录选择/实时刷新、收藏备注/刷新保持、紧凑/宽栏与键盘；最终矩阵 16 个阶段零页面/控制台错误，stream 为 0，保护指纹不变、48 个 owned 进程关闭。
- [x] 控制器复跑构建、128/128 单测（0 跳过）、41 项浏览器检查（0 页面错误）、发布与 diff 检查。
- [x] Task3 与最终跨任务独立审查均 PASS、0 待修问题；32 个归档文件无 fixture/cache/凭据，源码与构建身份核验通过。
- [x] [发布提交 d35c588](https://github.com/Hobartoakes/dsh-model-shelf/commit/d35c588b457bcf247dc0fb47df98d7abae185bae) 已推送 main；[v1.3.1 Release](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.3.1) 非草稿、非预发布，上传的是上述已验证字节。
- [x] 无登录公开下载 HTTP 200、297213 字节、SHA256 一致；[校验文件](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.3.1/SHA256SUMS) 亦通过匿名下载。公开 URL 在 rc.5 与 alpha.2 的隔离生命周期各 8/8、共 8 阶段零页面/控制台错误、24 个 owned 进程关闭。
- [x] 发布后源码文档记录；不替换既有 1.3.0 / 1.3.1 归档或移动标签。
- [x] 2026-10-30 经用户明确要求，通过官方 CLI 将 v1.3.1 安装到本机日常 desktop profile（DSH 0.2.1-rc.5）：依赖行指向 1.3.1 归档、安装后版本与客户端哈希匹配发布字节，`bundle` 顺序与 `cordis.patch.yml` 未变；重启 DSH 后加载，Harness 未升级。

完整 runtime 生命周期是停止/重启后验收，不是同一进程热卸载；偏好证据是同源 reload，不是跨端口保留。当前版本已发布，并已安装到日常 desktop（重启后生效）。最终归档 SHA256 为 `2ab701bb4e7d1ef27790e6772bd24f724eda2d55ea65a8cca31007292cc5ba03`；本次仅补发布后源码记录，不重新打包，所以归档仍保留打包时的未发布文档。公开 URL 验证与发布不是发布检查器执行的行为。各层证据见[验证报告](VALIDATION.md)。

## 1.3.0 历史发布门禁

- [x] 安装、推送与发布已获用户授权；实际执行由控制器负责，本次仅收尾四份文档。
- [x] 实现已合入 main（`5efddd0`、`851101d`）；控制器实际运行本版 42 项单元测试与 40 项离线浏览器检查，全部通过，未捕获页面错误为 0。本次文档收尾未重跑。
- [x] 包版本为 1.3.0；同步 CHANGELOG、README、VALIDATION 与本清单。`engines.dsh` 保持 0.2.1-rc.2，发布检查器的 `SUPPORTED_DSH` 无需变更。
- [x] README / CHANGELOG 同步[已发布的 v1.3.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.3.0)及公开下载证据；旧截图保留历史模拟数据标签。
- [x] 控制器完成 1.3.0 构建、发布文件检查及 `npm pack` 本地打包。
- [x] 控制器运行 `node tests/clean-profile.mjs`，7/7 项真实隔离 profile 安装 / 禁用 / 重新启用 / 卸载检查通过；该隔离测试期间 desktop manifest 与 patch 指纹保持不变。
- [x] 最终发布归档为 **269184 字节**，SHA256：`bd1387e6e52bc1ba44a0c9541d124882ef40f5c6b83f9fd6b7ff37425e52e9a5`。
- [x] 控制器通过官方 CLI 完成实际 desktop **1.2.1 → 1.3.0** 安装，安装后的客户端哈希与源码构建产物一致；仅 `dsh-model-shelf` dependency 改变，bundle 顺序与 patch 不变。
- [ ] 控制器刷新现有 GUI 并验收；当前 GUI 浏览器返回 `authentication-required`，须完成鉴权后继续，当前激活 / 交互验收仍待完成。不得用离线测试、隔离宿主或历史 GUI 结论替代。
- [x] 发布提交 `42760acc4b47c0f392ec6ccf482dd594ac450761` 已推送 main 与 v1.3.0 标签。
- [x] v1.3.0 Release 已公开发布并上传最终归档，**非草稿、非预发布**。
- [x] 控制器无登录访问公开归档 URL，HTTP **200**，大小及 SHA256 与最终归档一致；随后运行 `node tests/clean-profile.mjs <公开归档 URL>`，**7/7 通过**，覆盖官方 CLI 安装 / 禁用 / 重新启用 / 卸载与原生选择器恢复，隔离测试期间 desktop 指纹不变。
- [x] 本次发布后记录将上述控制器证据同步至四份源码文档；不重跑构建、打包或安装。
- [ ] 控制器提交 / 推送本次发布后文档跟进（与已推送的发布提交分开）。

### 发布后记录与不可变归档

已发布归档保留打包时较早的状态文字；本次源码文档更新**不替换归档、不移动 v1.3.0 标签**。不计划重新打包，因此可在源码文档记录最终哈希，不产生归档哈希自引用。当前状态以本清单、[验证报告](VALIDATION.md)及 Release 记录为准。

实际 desktop 安装出现的 balance / dsml / account-pool / security provider 兼容性警告属于既有无关插件；没有授予任何兼容性豁免，也不将这些警告记为本插件 GUI 验收通过。

npm 尚未发布，且**不是本版计划发行渠道**；不把 npm 发布列为本次 GitHub Release 的待完成门禁。下方 npm 相关旧待办仅保留历史证据。

以下旧版完成项和待办是历史证据，不代表 1.3.1 已打包、安装或发布；1.3.0 的已发布证据保留于上方历史小节。

## 已确认与完成（历史记录）

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

[发布检查器](../scripts/check-release.mjs) 会核对精确四版 OR 白名单、五份文档当前版本的「当前验证（未发布/已发布）」段落、README / HOST-COMPATIBILITY / VALIDATION 的逐版本三层 PASS 表、VALIDATION 包版本行和文档打包白名单。历史出现同一版本号不能代替当前段落；PENDING 不会被放行。**改完文档跑一次 `pnpm run check:release`**；这只是准备门禁，不执行测试、提交或发布，也不能凭文档文字自行证明真实验收。

历史小节（已发布版本的验证记录、CHANGELOG 旧条目）不要改写，按项目约定历史文本是证据；要改的是"描述当前状态"的那些位置。
