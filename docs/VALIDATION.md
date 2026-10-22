# 验证报告

## 范围与结果

- 包：**dsh-model-shelf 1.3.0**，作者 Hobartoakes，MIT；已完成本地构建、打包与真实隔离 profile 安装生命周期验证，不代表已公开发行。
- DSH 兼容声明保持 **0.2.1-rc.2**，不扩大已声明范围；历史宿主核对见 [HOST-COMPATIBILITY.md](HOST-COMPATIBILITY.md)。
- 当前实现已合入 main（`5efddd0`、`851101d`）。据控制器本轮执行结果：**42 项单元测试 + 40 项离线浏览器检查通过，未捕获页面错误为 0**；构建、发布文件检查与 `npm pack` 已执行成功。
- 控制器运行 `node tests/clean-profile.mjs`：**7/7 项通过**，在真实隔离宿主完成安装 / 禁用 / 重新启用 / 卸载，当前 desktop 指纹保持不变。本次文档收尾未重跑测试、构建或安装。
- **当前 desktop 安装、现有 GUI 验收、公开上传 / 下载及公开 URL 安装仍待完成**。当前 GUI 浏览器返回 `authentication-required`，验收待鉴权后进行；隔离宿主成功不替代当前 GUI 验收。
- 离线浏览器检查使用模拟目录；历史演示截图不代表 1.3.0 当前界面，不含真实用户数据。

下方编号 1–3 节及旧版本小节保留历史验证范围与数字，不是 1.3.0 本轮结果；本版状态见文末 1.3.0 小节。

## 1. 偏好数据（14 项）

覆盖主列表默认值、手动移入 / 移回、不同服务商相同 ID 独立管理、身份键无碰撞、服务商 / ID 搜索、非法存储清理、刷新保留、暂时缺失模型保留分类、存储异常提示、跨窗口同步及释放订阅。

1.1.0 新增：

- 收藏是独立于主列表 / 不常用分类的覆盖层，按 `(provider ID, model ID)` 区分。
- 1.0.0 旧数据缺少 `favorites` / `providerNotes` 时默认为空，原分类与折叠保留。
- 账号备注按服务商配置 ID 分别保存，可区分同名平台下的不同 API 账号，并参与搜索。
- 备注会去除控制字符、裁剪并限制 120 字符，空备注不保存。

另验证正式改名后导入本地原型偏好：只在新键不存在时导入，不删除旧键，不覆盖已有新偏好。

## 2. 离线浏览器（21 项）

使用模拟目录验证：

- 640px 宽、最高 720px 的面板及窗口边界。
- 服务商和精确模型 ID 显示。
- 手动分类不触发模型选择、不影响其他服务商的同 ID 模型。
- 分类刷新保留、移回主列表。
- 折叠保留；搜索临时展开，不覆盖折叠偏好。
- 选择失败提示、传输异常恢复、思考强度保留。
- 搜索键盘选择、Escape、焦点循环。
- 迟到的异步结果不会关闭重新打开的面板。
- 不可用模型保留身份和思考强度提示。
- 深色主题、窄窗口、插件卸载清理样式。

1.1.0 新增：

- 收藏刷新后保留、按服务商区分，且不会改变不常用分类，也不会选择模型。
- 同名平台下不同服务商 ID 的账号备注可分别保存、分别显示，并可按备注搜索。
- 备注编辑：Enter 保存、Escape / 取消放弃、清空保存即删除；备注按原文显示，不执行 HTML。
- 账号备注按钮与分组边框保持间距（自动化断言，≥8px）。
- 收藏列表与备注编辑器在 390px 窄窗口内不溢出。

页面没有未捕获的 JavaScript 错误。公开截图只取该模拟页面中的选择面板。

## 3. 真正的干净 profile（7 项）

每次运行创建新的测试 DSH_HOME 和工作目录，只从随安装包提供的 web 模板初始化 profile，不使用用户现有 web / desktop 配置。

1. 以 --ignore-scripts 安装预构建归档。manifest 仅含本插件，bundle 为随宿主提供的 base、web-app 加本插件。
2. 启动独立测试宿主（127.0.0.1、操作系统分配端口、--no-open），确认实际客户端图中含本插件和原生模型选择器。
3. 私下完成测试宿主的启动 URL 鉴权，广告的插件 JS 资源响应 200；真实界面显示“模型书架 · Model Shelf”和“不常用”标签；1.1.0 还在该真实界面中保存账号备注并收藏模型，刷新后仍保留。
4. 在测试 profile 禁用插件，重启测试宿主后插件不在客户端图中，插件样式和触发器消失；原生模型按钮与菜单可打开。
5. 重新启用插件，客户端图和增强界面恢复。
6. 清理测试插件 patch 行后卸载，dependency 和 bundle 均移除，原生选择器仍可打开。
7. 比较用户当前 desktop manifest 与 patch 的哈希，验证它们没有被修改。

测试仅修改测试目录。每个测试宿主启动在不同临时端口，不使用或替换当前 GUI 的端口，结束后停止测试进程。启动 token 不打印、不上传；证据只保存在被 Git / npm 排除的 tests/artifacts 中。

### 干净环境发现并修复的问题

第一次创建模型目录时，Cordis 服务方法继承调用方的能力声明。原型未显式注入 remote.session，在已有目录的会话中不易暴露，但在干净 profile 会导致选择器回退。

正式版已明确声明 remote 与 remote.session，并增加对应回归断言。修复后，从零初始化、禁用、重新启用与卸载均通过。测试还检查控制台没有被错误边界掩盖的插槽失败。

## 复现

```powershell
pnpm install --frozen-lockfile
pnpm run build
pnpm test
pnpm run test:browser
pnpm pack --pack-destination dist-draft
pnpm run test:clean-profile
pnpm run check:release
```

干净 profile 测试当前仅支持 Windows，默认寻找本机 DeepSeek Harness 安装目录与 Edge。可设置 DSH_TEST_INSTALL_DIR 或 DSH_TEST_BROWSER_EXECUTABLE。请先构建并打包；默认读取 dist-draft 下与 package.json 版本一致的本地归档（本轮 1.3.0 本地包已由控制器生成并通过 7/7 项检查；文档收尾后由控制器重新打包，最终归档另行核验）。

## 尚未验证

- macOS、Linux 和其他 DSH 版本。
- 不同公开版本之间的升级；1.0.0 → 1.1.0 的本地偏好兼容已由单元测试覆盖，但真实安装包的升级流程尚未实测。
- 账号备注不会自动读取或验证实际账号身份；多账号区分依赖宿主中存在多个服务商配置 ID。
- npm registry 安装和 dsh-market 一键安装需在对应发行或收录完成后另行验证；本项目尚未发布 npm，目录收录 PR 已提交（[#7630](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7630)）但尚未合并，因此 dsh-market 侧仍不可安装。

本报告不是对所有宿主版本的兼容性保证，也不验证 API 中转服务的实际上游模型身份。

## GitHub Release v1.0.0 公开发行验证（历史记录）

本节记录 **1.0.0** 的公开发行验证，当时不含收藏与账号备注。

- 已发布 [v1.0.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.0.0)，预构建归档为 [dsh-model-shelf-1.0.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.0.0/dsh-model-shelf-1.0.0.tgz)。
- 未发送 Authorization 或登录 Cookie，使用公开下载链接成功获取安装包，大小 **150041 字节**。
- 下载内容与上传前审查的归档 SHA256 一致：`f20edcf6f954e40e0050438adeda5cd84ce493474e6a772c79eaa141cf1211d8`。
- 使用官方 CLI **直接从公开 HTTPS 链接安装**，而非只安装本地副本，7 项隔离 profile 集成检查再次通过。
- 安装后的真实客户端图、广告的 JS 资源、增强模型面板均正常；禁用、重新启用和卸载正常，原生选择器可打开。
- 当前 desktop manifest 和 patch 的哈希保持不变，所有临时测试服务在完成后停止。

复现公开链接安装验证：

```powershell
node tests/clean-profile.mjs "https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.0.0/dsh-model-shelf-1.0.0.tgz"
```

## GitHub Release v1.1.0 公开发行验证

- 已发布 [v1.1.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.1.0)，预构建归档为 [dsh-model-shelf-1.1.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.1.0/dsh-model-shelf-1.1.0.tgz)，大小 **206017 字节**。
- 先创建草稿 Release 并上传归档；从 Release API 下载（携带登录态）验证字节与本地一致后才公开。
- 公开后**未发送 Authorization 或登录 Cookie**，使用公开下载链接成功获取安装包，大小 **206017 字节**。
- 下载内容与上传前审查的归档 SHA256 一致：`AE5C461B1CAED4B13761F6A65B9D4756E122E3BBBF78ADFC84B62DC128C81523`。
- v1.0.0 的归档与标签保持不变。
- 当前 desktop 已从本地候选包升级到 1.1.0；此项公开链接验证未再次修改 desktop。

## GitHub Release v1.2.0 公开发行验证

- 已发布 [v1.2.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.2.0)，预构建归档为 [dsh-model-shelf-1.2.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.2.0/dsh-model-shelf-1.2.0.tgz)，大小 **245192 字节**。
- 归档自 Release 提交 `3f67282` 的干净工作树打包；打包前后连续两次构建产物 SHA256 一致（`lib/` 与 `src/` 同步，无脏文件）。
- 公开后**未发送 Authorization 或登录 Cookie**，使用公开下载链接成功获取安装包，大小 **245192 字节**。
- 下载内容与本地构建归档 SHA256 一致：`C47E9135C2620E306ACC2E26644CB0E707DFDCF406680DC42BE5962CD9B6B588`。
- 使用官方 CLI **直接从公开 HTTPS 链接安装**到隔离 `DSH_HOME`：`dsh plugin --profile desktop add <release URL> --ignore-scripts` 装为 **dsh-model-shelf 1.2.0**，`dsh.profile.bundles` 正确追加 `dsh-model-shelf`。
- 安装后的 `lib/client.js` 与本地发布产物 SHA256 一致（`DA3CCDFE…E35BF`），`cordis.patch.yml`、`src/workbuddy-probe.js`、`docs/WORKBUDDY-PROBE.md` 均在包内。
- `dsh plugin --profile desktop remove dsh-model-shelf` 后包目录与 bundle 条目一并清除。
- v1.0.0、v1.1.0、v1.1.1 的归档与标签保持不变。
- 本版新增的验证：单元测试 36 项（新增 22 项）与离线浏览器回归 29 项（新增 8 项）全部通过，0 个未捕获页面错误。

发布后的验证记录不改变已发布的归档和 v1.0.0 标签；归档包含发布前的报告快照，最新验证记录以本页及 Release 说明为准。

## 1.2.1 · 兼容 DSH 0.2.1-rc.2（未发布）

- 包：**dsh-model-shelf 1.2.1** 本地候选包，本机 desktop profile 已安装。
- DSH：**0.2.1-rc.2**（`app.asar` 内 `dsh/desktop-runtime.json` 声明 `release.version: 0.2.1-rc.2`、`hostProtocolVersion: 4`）。
- **36 项单元测试**通过（`node --test tests/*.test.mjs`）。
- **29 项离线浏览器检查**通过（`node tests/browser.mjs`），含一条锁定"注册项不声明 `conversation.input.model.label` 子插槽"的断言；该断言经临时反向修改验证确实会失败。0 个未捕获页面错误。
- **7 项隔离干净 profile 集成检查**通过（`node tests/clean-profile.mjs`）：真实 0.2.1 宿主 + 隔离 `DSH_HOME`，覆盖安装、禁用、重新启用、卸载，且桌面 manifest 与 patch 指纹未被改动。
- 真实宿主探针：插件与 `@deepseek-ai/dsh-client-ui-model-selection` 同时在客户端图中，书架触发器与面板正常渲染，未捕获页面错误为 0。
- `pnpm run check:release` 通过。
- 模型目录相关契约在 0.2.0 → 0.2.1 间无变化，业务逻辑未改写；改动集中在元数据、文档与一条测试断言。逐项记录见 [HOST-COMPATIBILITY.md](HOST-COMPATIBILITY.md)。

### 本版已知取舍

0.2.1 新增的子插槽 `conversation.input.model.label`（宿主自带 1017 徽标插件用它给模型名加角标）本插件**不声明**，因此书架内的模型名按纯文本显示、不带该角标。原因：同一个键只能被声明一次，声明它会让宿主自己的模型选择插件在每次加载时抛 `slot "…" is already declared`（已实测，与注册先后无关）。完整分析见 HOST-COMPATIBILITY.md 的「有意不做」一节。

### 尚未验证

- macOS、Linux 和其他 DSH 版本。
- npm registry 安装与 dsh-market 一键安装（本项目未发布 npm）。
- 跨公开版本的真实升级流程；1.2.1 尚未发布，本地偏好兼容仅由单元测试覆盖。

## 1.3.0 · 手动整理与排序

- 实现已合入 main：`5efddd0`、`851101d`。本版增加平铺收藏、服务商整组不常用覆盖 / 恢复、标签页记忆、服务商与收藏的拖动 / 键盘按钮排序，以及离线身份顺序保留。
- 控制器本轮实际运行 **42 项单元测试 + 40 项离线浏览器检查，全部通过，未捕获页面错误为 0**；本版构建、发布文件检查及 `npm pack` 成功。本次文档收尾仅运行发布文件检查与 diff 检查，不重复上述套件。
- 控制器运行 `node tests/clean-profile.mjs`：**7/7 项真实隔离 profile 集成检查通过**，覆盖安装 / 禁用 / 重新启用 / 卸载；当前 desktop manifest 与 patch 指纹保持不变。这是本版独立执行的结果，不沿用旧版证据。
- **目标环境待完成**：当前 desktop 安装；刷新现有 GUI 后验收。当前 GUI 浏览器返回 `authentication-required`，验收待完成，不将无法进入页面记为功能通过或失败。
- **最终归档待完成**：文档收尾后由控制器重新打包，审查最终归档内容并计算 SHA256；最终哈希写入 Release 说明，不嵌入归档内文档，避免自引用。
- **公开发布待完成**：[v1.3.0 Release](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.3.0) / 归档上传、无登录公开下载与 SHA256 校验、公开 URL 安装验证。该链接仅为发布目标；npm 尚未发布，也不是本版计划发行渠道。
- README 的截图为旧版本模拟数据历史图，未更新为 1.3.0 截图，不证明本版当前 GUI 状态。`engines.dsh` 保持 **0.2.1-rc.2**；精确门禁见[发布检查清单](RELEASE-CHECKLIST.md)。
