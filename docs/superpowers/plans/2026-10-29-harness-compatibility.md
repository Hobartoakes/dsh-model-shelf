# Model Shelf Harness 兼容适配实施计划

## 2026-10-30 目标更新

恢复时重新查询[官方版本标签](https://registry.npmjs.org/-/package/@deepseek-ai/dsh/dist-tags)：`latest` 和 `next` 已是 `0.2.1-rc.5`，`alpha` 仍是 `0.2.2-alpha.2`。依照用户最终“兼容最新版本、全权负责无需提问”的要求，本轮增加 rc.5，保留原三版；发布时只允许实际验证的四版，不扩展到未知未来版本。已完成任务的历史三版证据不改写为四版证据。

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans for native execution, or subagent-driven-development if the user selects delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留模型书架 1.3.0 的现有功能与浏览器偏好，适配 Harness 0.2.1-rc.2、0.2.1-rc.4、最新 0.2.1-rc.5 和 0.2.2-alpha.2。

**Architecture:** 继续使用宿主的 `modelDirectories.directoryFor(sessionId)`、共享目录 store 和 `directory.select()`，不复制模型路由、会话投影或权限逻辑。保留 `conversation.input.model` priority -100，仍不重复声明宿主所有的 label 子插槽。只修改有契约证据或回归失败的兼容点。

**Tech Stack:** 现有 JavaScript ESM、宿主 React、Node test runner、Playwright/Edge；本机随 DSH 提供的 Node 24。不更换技术栈。

**Spec:** 本次会话的人类请求“模型书架是我自己写的插件，现在需要适配到 harness 的最新版本”；随后选择 **C｜两者都支持**，即同时覆盖 rc.2、rc.4、alpha.2。范围与约束完整记于本计划，不新增业务功能。

## Global Constraints

- 当前目标版本精确为 `0.2.1-rc.2`、`0.2.1-rc.4`、`0.2.1-rc.5`、`0.2.2-alpha.2`，不承诺未测试 rc.3、rc.6 或任意未来版本；rc.5 为 2026-10-30 新增目标，须补实际验证。
- 保留 `dsh-model-shelf.preferences.v1`、收藏、主列表/不常用、整组覆盖、排序、账号备注、旧原型偏好迁移。
- 不修改当前 desktop profile、不升级 Harness、不改其他插件、不读取/复制用户凭据、不发起真实模型付费请求。
- 用户追加授权：全权完成，不再提问；验证后按既有 GitHub Release 流程更新文档、提交、推送并发布 `1.3.1`。由 lead 统一集成和发布，成员不操作 index/提交；不能用历史 1.3.0 证据冒充本版验收。
- 当前新克隆仓库基线为 `ed58827`，初始工作树干净；在这份新副本中工作，不影响用户已有安装。若用户选择 worktree，再建立，不自动添加。
- 联网包仅从官方 registry 下载并校验 integrity；测试依赖安装关闭安装脚本。宿主临时启动只用于经确认的隔离测试，使用随机本地端口，不替换当前 GUI，退出时清理进程。
- 各版本的实现、边界测试、完整隔离宿主、当前 GUI 验收、安装与发布分别记录；某一层未完成必须明确标注，不能放宽版本声明来绕过失败。

## 已取得证据

- 本机 Desktop runtime 清单是 0.2.1-rc.2；已装模型书架 1.3.0 的 `engines.dsh` 精确限定 rc.2。
- 2026-10-29 官方 npm dist-tags：latest=rc.2，next=rc.4，alpha=alpha.2；用户据此选择三版兼容。
- 三版各四个官方包（model-selection、slots、api-session-controller、conversation）已校验完整性，放在工作区兄弟目录 `.model-shelf-compat/<version>/`；其 `receipts.json` 保存来源和完整性证据。
- 三版 `ModelDirectoryState`、`load`、`select`、`resetConnected`、`directoryFor` 保持相同对外签名。alpha.2 原生 UI 新增可选目录 badge 的 `resolveText` 注入；书架自身不是原生组件，不能据此盲目增加依赖。
- 当前 live slot 是 single/session，书架 priority -100 有效；宿主窄输入栏约定 `--dsh-composer-model-text-display` / `--dsh-composer-model-icon-display`。
- 已重新运行 `node --test tests/*.test.mjs`：42/42 通过。未运行本次浏览器、三版完整宿主或安装验收。

## Review Focus

1. 目录尚未加载、服务商离线、同名模型跨服务商时，身份和偏好不能丢失或串号。
2. 模型切换失败、断线和迟到响应不能卡死 selecting、误关新打开的面板或覆盖新选择。
3. 子智能体不可选、会话 locked 时不发送选择请求；可用入口与原生共享状态。
4. 窄栏折叠为图标时按钮仍有完整可访问名称，弹窗、键盘、文字复制和宽栏显示不退化。
5. 官方选择器/label 声明与本插件先后加载或卸载时不能冲突；不可把某个上游未声明能力自行补成“支持”。

## 文件责任

- `src/client.js`、`src/style.css`：只承载经确认的界面契约兼容；不改偏好模型与 WorkBuddy 独立契约。
- `tests/browser.mjs`：继续测试真实书架构建物的交互，增加窄栏和可访问性回归。
- `tests/host-compatibility.test.mjs`：新增宿主边界集成测试，加载指定版本真实发布代码，模拟外部 RPC 而不是整份目录实现；检查书架注入、选择/恢复、slot 共存和释放。
- `tests/host-packages.mjs`：可复现下载精确官方测试包、校验完整性、装配客户端模块；不接触用户 profile。
- `tests/clean-profile.mjs`：保留原 Windows 真实测试，增加显式指定 CLI/runtime 的入口；不能再把结果 runtime 写死为 rc.2。
- `package.json`、`scripts/check-release.mjs`：版本与精确兼容白名单、可执行发布检查。
- `lib/client.js`、`lib/index.js`：只由现有 build 脚本生成。
- `README.md`、`CHANGELOG.md`、`docs/HOST-COMPATIBILITY.md`、`docs/VALIDATION.md`、`docs/RELEASE-CHECKLIST.md`：本轮矩阵与证据边界，保留历史记录。

### Task 1: 三版宿主边界与准入

**Interfaces:** 消费宿主 `directoryFor(id) -> {store,load,select,resetConnected}` 与 `slots.inject/register`；产出可重复的三版真实包边界测试。

- [x] 补宿主测试包获取器：参数为精确版本；只接受上述三版，固定包名、registry、完整性校验，缓存放 `tests/vendor/`；导出 `loadHostPackages(version)` 给边界测试。网络失败明确失败，不静默跳过。
- [x] 测试使用各版真实 `ModelDirectory` 与 `SlotCore`，外部选择 RPC 返回可控的成功/失败/拒绝；断言书架提交完整 provider/model/effort，失败后可重试，子智能体不提交，卸载后原生占位恢复，重复 label 声明不会发生。
- [x] 写版本准入测试，使用真实 SemVer 判定（includePrerelease=true）：三版应允许，0.2.0-rc.2、0.2.1-rc.5、0.2.2-alpha.3 不允许。先确认现有 manifest 对 rc.4/alpha.2 测试失败。
- [x] 必要时最小修复书架边界；若接口保持兼容，不为制造改动重写逻辑。
- [x] 验证命令：`node --test tests/host-compatibility.test.mjs`，三版均通过；再运行完整 `node --test tests/*.test.mjs`。

### Task 2: 新版输入栏布局回归

**Interfaces:** 消费 slot 的 `locked` 和宿主两项 CSS 自定义属性；产出可折叠、可访问的书架触发器，存储与选择逻辑不变。

- [x] 在 `tests/browser.mjs` 新增场景：设置 text-display=none / icon-display=block，断言文字隐藏、图标可见、完整当前模型仍是 accessible name，Enter/Space 能打开；撤销变量后恢复文字。先运行确认现有实现失败。
- [x] `src/client.js` 给触发器保留完整 aria-label 并添加纯装饰图标；`src/style.css` 按宿主变量切换，缺少变量时保持现有宽栏外观。不导入宿主 UI primitives，不占用 label 子插槽。
- [x] `node scripts/build.mjs` 后运行 `node tests/browser.mjs`；现有全部场景与新增场景通过，零未捕获页面错误。

### Task 3: 隔离宿主矩阵与交付

**Interfaces:** 消费 Task 1/2 的构建物；新增最新 rc.5 的真实边界和准入，再产出四版完整隔离报告和草稿包。

- [ ] 复用既有真实边界框架，核对 rc.5 官方包与依赖、固定完整性；先观察 rc.5 准入 RED，再加入实际边界测试及准入。保留旧三版，拒绝未测 rc.6 等未来版本。
- [ ] 将草稿版本更新为 1.3.1；`engines.dsh` 使用四版的显式 OR 白名单。发布检查逐一核对目标版本、打包文件和本轮文档，不把仅改声明当修复。
- [ ] `tests/clean-profile.mjs` 允许通过 `DSH_TEST_CLI_ENTRY` 与 `DSH_TEST_NODE_EXECUTABLE` 指定隔离 CLI；未指定仍保留 Windows Desktop 默认。检测实际 runtime 版本，写入结果；拒绝使用当前 GUI 端口，全部进程 finally 关闭。
- [ ] 复用已准备的原三版官方 runtime，另行准备 rc.5；不安装到当前 profile。每版单独 DSH_HOME 与 DSH_AGENTS_HOME、随机 loopback 端口、无凭据，验证安装/启动/禁用/重新启用/卸载、原生回退与真实目录数据流；先验证 rc.2，再扩展四版。
- [ ] 如测试环境不允许完整宿主启动，停止宣称该层通过，保留代码和失败原因，向用户明确剩余验收，不自动给版本豁免。
- [ ] 运行 `node scripts/build.mjs`、`node --test tests/*.test.mjs`、`node tests/browser.mjs`、四版隔离集成命令、`node scripts/check-release.mjs`、`git diff --check`。
- [ ] 用 pnpm 打包至 `dist-draft/`，核对内容与 SHA256。文档按当时真实状态标注待发布/未安装到日常环境，区分四版证据层级。
- [ ] 经所选执行方式完成独立复核，修复实证发现；lead 统一提交、推送到 Hobartoakes/dsh-model-shelf，发布 v1.3.1 GitHub Release 与预构建归档。
- [ ] 验证无登录公开下载、SHA256 与发布归档一致、公开 URL 隔离安装；然后记录最终发布状态。不得覆盖既有 1.3.0 归档、移动旧标签或自动切换日常安装。

## 交接与权限（2026-10-30 更新）

- 用户已确认 C（三版目标）、B（委派实施/复核），追加全权负责、无需提问、文档更新和发布授权，并于 2026-10-30 明确要求继续。
- 源码当前检查点：`compat/harness-matrix@5ffa023`；上游 main 仍为基线 `ed58827`，尚未推送或发布本次版本。
- Task 1 已完成：`61933fe` 增加真实宿主边界和准入测试；`b0dacd1` 修复独立审查发现的 Windows 联接缓存越界。独立规格、质量复核均通过。
- Task 2 已完成：`5ffa023` 实现折叠图标和完整可访问名称，独立规格、质量审查均通过。2026-10-29 lead 执行记录为构建通过、101/101 单测、41 项浏览器检查、0 页面错误。
- 三版完整官方 runtime 已在隔离目录准备，CLI/版本检查 9/9 通过；这不是完整宿主安装验收。
- Task 3 正在推进隔离安装矩阵、1.3.1 文档与归档；之后还有最终审查、推送、公开发布及公开 URL 安装验证。不能把上述边界/UI 证据当作这层已经完成。
- 并行责任：集成成员独占 Task 3 产品文件，lead 维护本计划及本地交接、执行最终集成与发布；不重做已通过的任务。
- 当前权限 danger-full-access、审批 never；不请求权限提升，不绕过拒绝。
