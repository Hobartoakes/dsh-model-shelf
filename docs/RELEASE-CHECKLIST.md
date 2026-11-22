# 发布检查清单

## 1.6.0 发布与验证

渠道：仅 [1.6.0 正式版](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.6.0)。同一个正式 tgz 通过 Windows 隔离验收后再上传；不执行 npm publish，不动旧标签或旧附件。

1. **打包前：**运行 `pnpm run build`、`pnpm run check:release`、`pnpm test`、`pnpm run test:browser`，分别记录结果。来源清单不是行为测试；另按源码工作树 `tests/host-inventory/CONTRACTS.md` 核对逐版契约，把执行、回退、失败与未测分列。默认门禁只读文件，不需要预先有最终归档。
2. **冻结：**将正式 tgz 放到新的 `dist-draft/release-1.6.0/`，不要覆盖试验包或先前本地候选。检查成员、版本、准入、预构建客户端和归档 SHA-256；不夹带临时 profile、凭据或原始回执。
3. **桌面：**从工作树运行 `node tests/clean-profile.mjs <final.tgz>`，显式设置 `DSH_TEST_EXPECTED_VERSION=0.2.2-rc.5` 和 `DSH_TEST_ACTIVE_ORIGIN`（实际日常 GUI 的 origin，仅用于保护）。仅在官方 Windows Desktop 隔离环境操作。采集打开、真实路由/标签改变、刷新、停用后原生菜单、重新启用、卸载及指纹保护。
4. **包外核对：**运行 `node scripts/check-release.mjs --final-desktop <final.tgz> <本次result.json>`。该命令重算 tgz SHA-256 并核对 runner 输出；它不会启动桌面，也不证明其他版本。pilot、历史包、错误载体或重打包不接受旧回执。
5. **发布与安装：**提交对应源码并新建 `v1.6.0` 标签。上传验收过的 tgz、`SHA256SUMS.txt` 和脱敏的 `release-integrity.json`。确认正式 Latest；匿名下载三个附件核对原字节，再用官方管理器升级 desktop。核对安装版本、客户端、其他依赖、bundle 顺序与 patch；不自动重启或更改偏好。**不回写归档自身哈希再重打包。**

试验包在 Windows 0.2.2-rc.5 的 8/8 为修复前证据，出处见[验证报告](VALIDATION.md)。门禁核对修复后客户端字节；不得用 pilot 的客户端或回执签收最终包。本清单不是最终验收记录。

## 1.5.3 历史验证（已发布）

[1.5.3 正式版](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.5.3) 已于 2026-11-17 23:56:09（Asia/Shanghai）公开发布并设为 Latest，非草稿、非预发布。[预构建归档](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.5.3/dsh-model-shelf-1.5.3.tgz) · [SHA-256 校验文件](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.5.3/SHA256SUMS.txt) · [完整性记录](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.5.3/release-integrity.json)。

1.5.3 承接 1.5.2-local.1 的兼容更新，保留生产代码、收藏排序、备注、品牌图标、偏好与 6px 局部布局。最终归档为 **433958 字节 / 51 个文件**，SHA-256 `934f9368f5c34fc6e66b987784b2bdda9da966d3ea35d13f0c6e9bbc912acc96`，源码提交 [5a8d72f](https://github.com/Hobartoakes/dsh-model-shelf/commit/5a8d72f741c770cc55cdf379fc120f8412a4c798)。

最终归档已通过官方 Windows x64 DSH 0.2.2-rc.3 的隔离安装、禁用、重新启用、卸载和原生回退；发布前完整单元/契约测试 167/167、离线 UI 45/45，页面错误 0，远端三份附件已下载并核对 SHA-256。本版未执行日常安装升级或 GUI 人工验收，未重启日常 DSH，未发布 npm。

本次发布后文档修正不重打包、不移动 v1.5.3 标签、不替换任何 Release 附件。归档内保留出包时文档快照；当前发布说明以本仓库默认分支和上述 Release 为准。

目标是官方 Windows x64 桌面更新源 0.2.2-rc.3（2026-11-13），不是 npm latest。已校验官方安装器的 SHA-512，并从发行载荷核对桌面、核心、前端、模型选择器、renderer、插件管理器均为 0.2.2-rc.3，Cordis 4.1.0。来源：[官方更新源](https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml)、[官方发行标签](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.3)。

根因：官方管理器明确拒绝 v1.5.1-local.2 的 `engines.dsh`；真实 rc.3 接口边界 11/11 通过。仅在白名单中加入精确 rc.3，不开放 rc.2、rc.4 或版本范围。生产源码、交互、偏好格式、图标与归属、缓存、6px 局部样式全部保留。1.5.3 最终归档已完成本次隔离生命周期和归档校验；下方历史结果只对应各自旧归档，不自动认证未来重打包版本。

1.5.3 的本轮完整 runtime 重测仅覆盖官方 Windows x64 0.2.2-rc.3，未重建旧版本完整 runtime 矩阵。正式发布与 Latest 已完成，日常安装和人工验收未执行。



## 1.5.1-local.2 历史归档记录（打包时未发布，现已公开）

当前授权已由早期“仅准备”扩大为发布并本地安装，随后明确选择“保留图标，先核实分发依据”。早期范围限制是历史记录，不覆盖后续明确授权。

- [x] 6px 专项 6/6；当前候选真实边界 84/84、离线 UI 45/45。
- [x] 五版完整宿主四阶段；alpha.2 通过限于 tag 对齐的六个 vendor 版本，原 npm 解析失败不隐去，见[验证报告](VALIDATION.md)。
- [x] 通过官方插件管理器本地安装启用，核对其他直接依赖、bundle 顺序和 patch 不变量。
- [x] MIT 全文随已测归档存在；六个预置 PNG 未更改，TRAE 文档摘要修正。
- [ ] 现行 OpenAI 完整规则及品牌条款具体适用性缺项完成；不能要求全部品牌一律单独书面授权，也不能径直宣称全部清权。
- [ ] 最终发行增量独立审查、新归档内容/版本/实际验收绑定完成。旧归档不覆盖，旧结果不自动背书未来归档。
- [ ] 日常 desktop 的已登录界面和偏好实际验收。
- [ ] 按既有 GitHub Release 渠道提交、推送、打新标签及上传；不得覆盖旧标签/资产，不进行 npm 发布。

技术文档检查通过不等于上述未勾选项通过。不得访问仍受限原目录、改变版本豁免或权限边界；重启另行确认。

## 1.5.1-local.1 历史验证（未发布）

本轮仅桌面版本地兼容修复。rc.1 真实接口 11 项及离线 UI 45 项通过；完整安装/停用/启用/卸载矩阵未重跑，发布门槛继续拒绝此候选，不能声称可公开发布。安装须走官方插件管理器并保持其他直接依赖、bundle 顺序和 patch 不变。

## 1.5.0 历史候选验证（未发布）

预置 DeepSeek、OpenAI、Cline、Qwen、Qoder 与 TRAE 图标；开启联网补充后，匹配到 OpenRouter、Hugging Face 时从固定版本 Lobe Icons 下载 PNG 并保存本地。其他未覆盖或使用条件不适用的品牌显示默认图标。联网补充默认关闭；图标表示目录标签，不验证实际上游或官方关系。

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | 待复测 | 待复测 | 待复测 |
| 0.2.1-rc.4 | 待复测 | 待复测 | 待复测 |
| 0.2.1-rc.5 | 待复测 | 待复测 | 待复测 |
| 0.2.2-alpha.2 | 待复测 | 待复测 | 待复测 |


2026-11-01：新增 Cline 图标及型号匹配前的候选归档曾在四版 Windows 隔离宿主完成安装、禁用、重新启用和卸载，浏览器检查 45 项通过；rc.5 额外验证了下载和缓存。新增内容后的最终归档尚待复测。本机安装的是更早的候选，实际界面已观察到 DeepSeek、OpenAI 图标和关闭的联网开关。

## 1.4.0 历史验证（已发布）

当前品牌图形使用条件未确认，显示中性默认图标；增加紧凑服务商卡片。候选包已安装本机 desktop 并交互验收；[v1.4.0 GitHub Release](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.4.0) 已公开。当前所有品牌均因适用条件未确认而显示同一默认图标，因此不提供品牌识别效果。

最终发布归档 312350 字节，SHA-256 `d9e0e9c5406f21d60e96319d8b946ada96f13de0def3c7217242d090cbaef542`；匿名下载大小与哈希一致。最终归档在四版隔离宿主分别通过完整生命周期。本机 desktop 已通过官方 CLI 从公开 URL 安装正式归档；安装后的客户端哈希与发布代码一致，bundle 顺序和 patch 不变。公开 URL 在 rc.5 隔离宿主完整生命周期通过。发布归档保留打包时状态，不替换已发布文件。

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | PASS | PASS | PASS |
| 0.2.1-rc.4 | PASS | PASS | PASS |
| 0.2.1-rc.5 | PASS | PASS | PASS |
| 0.2.2-alpha.2 | PASS | PASS | PASS |


项目：**dsh-model-shelf / 模型书架**。作者：**Hobartoakes**。许可：**MIT**。


2026-11-01：自动测试覆盖四版官方目录边界，离线模拟 UI 检查 44 项通过；同一候选归档在 Windows 四版真实隔离宿主分别完成安装、禁用、重新启用和卸载。rc.2 与 rc.4 的早期运行曾在进程树清理时报错，之后带诊断的完整重跑通过；rc.5 曾有一次同类失败及一次通过。独立 CLI 测试仅额外加入专用 pnpm 路径，未继承用户环境；受保护桌面文件指纹不变。先前候选在实际 DSH 界面验证紧凑行、展开、搜索与收藏页；当前回退方案在本机界面确认紧凑行及默认图标。未发送模型请求。

## 1.3.1 历史验证（已发布）

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

## 历史发行待办（不构成本候选授权）

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

插件版本或准入政策改变时，更新下列文档。兼容宿主的小版本在既定范围内发布，只需按证据更新逐版记录，不必为添加一个版本号而重发。

| 文件 | 必改内容 |
| --- | --- |
| `package.json` | `version`；兼容宿主变化时改 `engines.dsh`；新增文档要加进 `files` 白名单 |
| `scripts/check-release.mjs` | 核对本候选的准入、修复后客户端，并分清 pilot 与历史章节的证据边界；不要让旧包或清单代替新验收 |
| `CHANGELOG.md` | 新增当前版本的条目（`check:release` 会校验 `## <version>` 存在） |
| `README.md` | 当前发布状态、安装 URL 与本地包名、兼容性表、中文介绍和英文摘要必须与当前版本一致；历史小节须明确标注 |
| `docs/VALIDATION.md` | 「范围与结果」包版本、各证据层与归档身份分开；最终归档哈希只写包外 |
| `docs/RELEASE-CHECKLIST.md` | 版本相关待办的勾选与新增；「尚未验证」随实测范围更新 |
| `docs/HOST-COMPATIBILITY.md` | 宿主版本变化时逐项核对并更新；标题的迁移方向 |

[发布检查器](../scripts/check-release.mjs)检查五份当前文档、准入、客户端字节、历史绑定和打包清单。`--publish` 始终拒绝 npm 发行；GitHub 的上传、公开下载、桌面验收均须分别验证。

发布后还要将已发布源码及发布后文档以非强制推送同步到默认分支，回读仓库首页核对版本、安装 URL、兼容范围和英文摘要；只推标签不代表默认分支文档已更新。保持已发布标签和附件不可变；如需修改安装包内的文档，应另发新版本，而非覆盖旧包。

历史小节（已发布版本的验证记录、CHANGELOG 旧条目）不要改写，按项目约定历史文本是证据；要改的是"描述当前状态"的那些位置。
