# 验证报告

## 1.3.1 当前验证（已发布）

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | PASS | PASS | PASS |
| 0.2.1-rc.4 | PASS | PASS | PASS |
| 0.2.1-rc.5 | PASS | PASS | PASS |
| 0.2.2-alpha.2 | PASS | PASS | PASS |

真实边界是各版固定完整性校验的官方目录/slots/store/renderer；RPC/投影边界合成。离线 UI 是相同插件构建物的模拟目录浏览器回归，并非四版前端。先完成 rc.2 pilot，再扩展四版；随后控制器对**最终发布归档**在四版官方 built frontend 独立复跑，各 **8/8**。最终矩阵 16 个阶段页面/控制台错误均为 **0**、stream 为 **0**，48 个 owned 进程退出关闭、浏览器关闭、保护文件指纹一致。覆盖安装、禁用、重新启用、卸载、原生回退、真实选择/实时目录刷新、收藏备注/刷新保持、紧凑控制/键盘/宽栏恢复；失败诊断保留，不伪装跳过或成功。

**归档身份边界：**pilot SHA256 为 `13917e93b91ff295e8c47ad8f39d92ca26d8fe01295b489cf9f9dbf558f13643`；最终归档 SHA256 为 `2ab701bb4e7d1ef27790e6772bd24f724eda2d55ea65a8cca31007292cc5ba03`，**297213 字节 / 32 个普通文件**。两者没有混用。最终包经两个独立审查、控制器四版矩阵后发布；本次发布后文档不重新打包、不替换已发布字节，所以归档保留打包时的未发布状态，最新结论以源码文档和 Release 为准。

## 范围与结果

- 包：**dsh-model-shelf 1.3.1**，作者 Hobartoakes，MIT；[GitHub Release v1.3.1](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.3.1) 于 2026-10-30 09:43:41（Asia/Shanghai）公开发布，非草稿、非预发布。2026-10-30 17:33 经用户要求，通过官方 CLI 将本机日常 desktop profile 从 1.3.0 升级到 1.3.1（当前 DSH 0.2.1-rc.5）：安装后 `node_modules/dsh-model-shelf` 为 1.3.1、客户端 SHA256 与发布字节一致，profile 仅依赖行改为 1.3.1 归档，`bundle` 顺序与 `cordis.patch.yml` 未变，重启 DSH 后加载；Harness 本身未升级。
- 精确版本 rc.2 / rc.4 / rc.5 / alpha.2（完整版本号见上表）；未测版本不得绕过检查。
- 控制器独立复跑构建、**128/128** 单测（0 跳过）、**41** 项浏览器检查（0 未捕获页面错误）、发布检查和 `git diff --check`。单元含四版真实边界与安全/发布回归，不把总数当作完整宿主验收数量。Task3 与跨任务最终独立审查均 PASS、无待修问题。
- 本轮不连接/修改当前 GUI，不复制真实凭据，不发起模型请求或付费探测；日常 GUI 激活未验证，不是本次发布门禁。
- [发布提交 d35c588](https://github.com/Hobartoakes/dsh-model-shelf/commit/d35c588b457bcf247dc0fb47df98d7abae185bae) 已推送 main，`v1.3.1` 标签固定于该提交。源码和构建身份已独立核对；客户端 SHA256 为 `7b0164d922b7871f06f14683c28dcc4e0bd7601d5b51d01476f8c3584e5a5fe7`。

### 发布后的公开验证

- 对[公开归档](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.3.1/dsh-model-shelf-1.3.1.tgz)使用独立 Node fetch，不发送 Authorization/Cookie：HTTP **200**、**297213 字节**、SHA256 与本地最终包一致。[SHA256SUMS](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.3.1/SHA256SUMS) 也匿名下载成功并逐字匹配；GitHub asset digest 同样一致。
- 官方 CLI 直接从公开 URL 安装，在 **rc.5 与 alpha.2 各 8/8** 通过，覆盖全部四个重启式生命周期阶段；8 阶段零页面/控制台错误、stream 0、24 个 owned 进程及浏览器全部关闭、保护指纹不变。rc.2/rc.4 的证明是相同归档的本地安装矩阵，不冒称这两版也重复跑了公开 URL。
- 本地原始证据不随包或仓库发布，保留路径如下；公开可核对的身份见 Release 及校验文件。

```text
最终包四版：.superpowers/sdd/2026-10-29-harness-compatibility/lead-final-matrix-1793323267085.json
匿名下载：tests/artifacts/public-release-1793324714812/download-verification.json
公开URL两版：.superpowers/sdd/2026-10-29-harness-compatibility/lead-public-matrix-1793324813871.json
```

### 本轮隔离方法

完整 runtime 已预装在专用目录，不改日常 Harness。设置 `DSH_TEST_CLI_ENTRY`、`DSH_TEST_NODE_EXECUTABLE`、`DSH_TEST_EXPECTED_VERSION` 与 `DSH_TEST_ACTIVE_ORIGIN` 后运行 `node tests/clean-profile.mjs <archive>`。未指定显式 carrier 时保留 Windows Desktop 默认；两个入口参数必须一起给。可选 `DSH_TEST_INSTALL_DIR`、`DSH_TEST_BROWSER_EXECUTABLE`。版本来自真实 `--version`，显式 runtime 另校验 CLI/app-boot/web-app/frontend manifest。

每次创建独立 DSH_HOME、DSH_AGENTS_HOME、user home、空 cwd、npm 配置、store、cache 和 tmp，环境从零 allowlist 建立。清除继承的 DSH/Node/Electron/代理/凭据；所有安装脚本禁用。Edge 的 Windows known-folder 查找必须保留实际 USERPROFILE，仅浏览器这一项例外，Host/CLI 仍完全隔离；浏览器使用显式新建 user-data-dir，CDP 核实路径，不接触个人浏览器资料。服务只绑定 loopback:0、no-open；启动认证 URL/token 留在内存并脱敏，不写入证据。

无凭据 profile 的真实模型目录为空，所以测试仅插入标明 TEST ONLY 的外部 LlmAdapter 元数据，模型 stream 拒绝执行并计数，真实宿主目录/RPC/Session/slots 与官方前端保持原样。独立 Documents 配置防止默认工作区落入真实用户目录。**生命周期采用重启验收**：安装/卸载走官方 CLI；停止已拥有的测试 server 后写隔离 profile 的 disabled patch，再启动检查禁用/重新启用状态。每阶段使用新的随机 origin，不声称同一进程 live hot-unmount；收藏/备注和当前选择只验证同源页面 reload 保持，不把不同端口重新填写当成跨重启持久化。热生命周期的边界/离线测试是另一层证据。进程按 owned handle/PID/executable/创建时间/入口校验后关闭并等真实 exit/close，确认监听已关闭；finally 无论成功失败都检查日常 desktop manifest/patch 指纹。该证明仅覆盖这两个文件，不扩大为整个日常 profile 未变。

### 本轮复现与发布边界

先构建/打包，再按精确版本逐一运行。同一套环境参数适用于 `0.2.1-rc.2`、`0.2.1-rc.4`、`0.2.1-rc.5`、`0.2.2-alpha.2`。pnpm 11 `pack` 不接收 `--ignore-scripts` CLI 选项；通过 `npm_config_ignore_scripts=true` 禁止生命周期，使用明确 Node + pnpm.mjs。

```powershell
# working directory: C:/Users/13015/Documents/deepseek-harness/default-workspace/dsh-model-shelf
$node = 'C:/Users/13015/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node.exe'
$pnpm = 'C:/Users/13015/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs'
& $node scripts/build.mjs
& $node --test tests/*.test.mjs
& $node tests/browser.mjs
$env:npm_config_ignore_scripts = 'true'
& $node $pnpm pack --pack-destination dist-draft
$env:DSH_TEST_CLI_ENTRY = 'C:/Users/13015/Documents/deepseek-harness/default-workspace/.model-shelf-compat/runtimes/0.2.1-rc.2/runtime-cli.mjs'
$env:DSH_TEST_NODE_EXECUTABLE = $node
$env:DSH_TEST_EXPECTED_VERSION = '0.2.1-rc.2'
$env:DSH_TEST_ACTIVE_ORIGIN = 'http://127.0.0.1:59983'
& $node tests/clean-profile.mjs dist-draft/dsh-model-shelf-1.3.1.tgz
& $node scripts/check-release.mjs
git diff --check
```

macOS/Linux、真实账号/模型请求、跨公开版本升级、npm/market 安装、日常 GUI 均未在本轮验证。最终字节矩阵、公开发布、匿名下载与上述两版公开 URL 验证已经分别完成；本节为发布后的源码记录，不改变归档或标签。以下旧记录只证明对应历史版本。

## 历史 1.3.0 范围与结果

**以下至文末保留对应版本的历史证据与当时未完成项，不描述 1.3.1 当前状态。**

- 包：**dsh-model-shelf 1.3.0**，作者 Hobartoakes，MIT；已公开发布 GitHub Release（非草稿、非预发布），完成公开下载校验、公开 URL 隔离安装生命周期验证及实际 desktop 升级。
- DSH 兼容声明保持 **0.2.1-rc.2**，不扩大已声明范围；历史宿主核对见 [HOST-COMPATIBILITY.md](HOST-COMPATIBILITY.md)。
- 当前实现已合入 main（`5efddd0`、`851101d`）。据控制器本轮执行结果：**42 项单元测试 + 40 项离线浏览器检查通过，未捕获页面错误为 0**；构建、发布文件检查与 `npm pack` 已执行成功。
- 控制器对本地归档及公开 URL 分别运行 `node tests/clean-profile.mjs`：均为 **7/7 项通过**，在真实隔离宿主完成安装 / 禁用 / 重新启用 / 卸载与原生选择器恢复；隔离测试期间 desktop 指纹保持不变。本次发布后文档跟进仅运行发布文件检查与 diff 检查，不重跑测试、构建或安装。
- 实际 desktop 已经官方 CLI 从 **1.2.1 升级到 1.3.0**，客户端哈希与源码构建产物一致；仅本插件 dependency 改变，bundle 顺序与 patch 不变。**现有 GUI 激活 / 交互验收仍待完成**：浏览器返回 `authentication-required`，须鉴权后继续；安装或隔离宿主成功不替代当前 GUI 验收。
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

干净 profile 测试当前仅支持 Windows，默认寻找本机 DeepSeek Harness 安装目录与 Edge。可设置 DSH_TEST_INSTALL_DIR 或 DSH_TEST_BROWSER_EXECUTABLE。开发时先构建并打包；默认读取 dist-draft 下与 package.json 版本一致的本地归档，也可显式传入公开归档 URL。1.3.0 最终归档已发布并通过公开 URL 的 7/7 项检查，本次发布后文档跟进不重新打包。

## 尚未验证

- macOS、Linux 和其他 DSH 版本。
- 不同公开版本之间的升级仍未验证；本轮已实测本地安装的 1.2.1 → 公开版 1.3.0 官方 CLI 升级，但 1.2.1 未公开发布，不将此结果扩大为跨公开版本升级保证。1.0.0 → 1.1.0 的本地偏好兼容已由单元测试覆盖。
- 账号备注不会自动读取或验证实际账号身份；多账号区分依赖宿主中存在多个服务商配置 ID。
- npm registry 安装和 dsh-market 一键安装未验证；npm 尚未发布且不是本版计划发行渠道。目录收录 PR [#7630](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7630) 历史上已提交、当时尚未合并，本轮未重新核验当前收录状态。

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
- **实际 desktop 安装完成**：控制器通过官方 CLI 从 1.2.1 升级至 1.3.0；安装后客户端哈希与源码构建产物一致。仅 `dsh-model-shelf` dependency 改变，bundle 顺序与 patch 不变。既有无关插件 balance / dsml / account-pool / security provider 出现兼容性警告，未授予任何豁免。
- **当前 GUI 激活 / 交互验收待完成**：浏览器返回 `authentication-required`，须鉴权并刷新现有 GUI 后继续；不将无法进入页面记为功能通过或失败。
- **公开发布完成**：[v1.3.0 Release](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.3.0) 为非草稿、非预发布。发布提交 `42760acc4b47c0f392ec6ccf482dd594ac450761` 已推送 main 与 v1.3.0 标签。npm 尚未发布，也不是本版计划发行渠道。
- **最终归档及公开下载验证完成**：[dsh-model-shelf-1.3.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.3.0/dsh-model-shelf-1.3.0.tgz)，**269184 字节**，SHA256：`bd1387e6e52bc1ba44a0c9541d124882ef40f5c6b83f9fd6b7ff37425e52e9a5`。控制器无登录下载返回 HTTP **200**，大小及哈希一致。
- **公开 URL 安装验证完成**：控制器运行 `node tests/clean-profile.mjs "https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.3.0/dsh-model-shelf-1.3.0.tgz"`，**7/7 通过**，覆盖官方 CLI 安装 / 禁用 / 重新启用 / 卸载与原生选择器恢复；该隔离测试期间 desktop 指纹保持不变。
- **发布后记录**：已发布归档不可变，内含较早的打包时状态文字。本次四份源码文档更新不替换归档、不移动标签，也不计划重新打包；因此最终哈希可记录在源码文档中，不产生归档自引用。文档跟进的提交 / 推送由控制器另行执行。
- README 的截图为旧版本模拟数据历史图，未更新为 1.3.0 截图，不证明本版当前 GUI 状态。`engines.dsh` 保持 **0.2.1-rc.2**；精确门禁见[发布检查清单](RELEASE-CHECKLIST.md)。
