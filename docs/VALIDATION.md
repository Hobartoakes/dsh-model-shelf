# 验证报告

## 1.5.3 当前验证（已发布）

[1.5.3 正式版](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.5.3) 已于 2026-11-17 23:56:09（Asia/Shanghai）公开发布并设为 Latest，非草稿、非预发布。[预构建归档](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.5.3/dsh-model-shelf-1.5.3.tgz) · [SHA-256 校验文件](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.5.3/SHA256SUMS.txt) · [完整性记录](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.5.3/release-integrity.json)。

1.5.3 承接 1.5.2-local.1 的兼容更新，保留生产代码、收藏排序、备注、品牌图标、偏好与 6px 局部布局。最终归档为 **433958 字节 / 51 个文件**，SHA-256 `934f9368f5c34fc6e66b987784b2bdda9da966d3ea35d13f0c6e9bbc912acc96`，源码提交 [5a8d72f](https://github.com/Hobartoakes/dsh-model-shelf/commit/5a8d72f741c770cc55cdf379fc120f8412a4c798)。

最终归档已通过官方 Windows x64 DSH 0.2.2-rc.3 的隔离安装、禁用、重新启用、卸载和原生回退；发布前完整单元/契约测试 167/167、离线 UI 45/45，页面错误 0，远端三份附件已下载并核对 SHA-256。本版未执行日常安装升级或 GUI 人工验收，未重启日常 DSH，未发布 npm。

本次发布后文档修正不重打包、不移动 v1.5.3 标签、不替换任何 Release 附件。归档内保留出包时文档快照；当前发布说明以本仓库默认分支和上述 Release 为准。

目标是官方 Windows x64 桌面更新源 0.2.2-rc.3（2026-11-13），不是 npm latest。已校验官方安装器的 SHA-512，并从发行载荷核对桌面、核心、前端、模型选择器、renderer、插件管理器均为 0.2.2-rc.3，Cordis 4.1.0。来源：[官方更新源](https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml)、[官方发行标签](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.3)。

根因：官方管理器明确拒绝 v1.5.1-local.2 的 `engines.dsh`；真实 rc.3 接口边界 11/11 通过。仅在白名单中加入精确 rc.3，不开放 rc.2、rc.4 或版本范围。生产源码、交互、偏好格式、图标与归属、缓存、6px 局部样式全部保留。1.5.3 最终归档已完成本次隔离生命周期和归档校验；下方历史结果只对应各自旧归档，不自动认证未来重打包版本。

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | HISTORICAL | HISTORICAL | HISTORICAL |
| 0.2.1-rc.4 | HISTORICAL | HISTORICAL | HISTORICAL |
| 0.2.1-rc.5 | HISTORICAL | HISTORICAL | HISTORICAL |
| 0.2.2-alpha.2 | HISTORICAL | HISTORICAL | HISTORICAL |
| 0.2.2-rc.1 | HISTORICAL | HISTORICAL | HISTORICAL |
| 0.2.2-rc.3 | PASS | PASS | PASS |

历史证据仅绑定已发布源码 `c6835819f86f9a24ed9514b718f97681198ee82f` 和公开归档 SHA-256 `2adb0e7bee1d107013ad2b5947ec3ad46912d04fc539c2427801558719484f22`，不是新包在旧宿主上的重测结果。历史本地候选 `13279e8c94afb944b003ec8ef678487ab99491ac2e2dcbc317d1551ff645c9b2` 是另一个归档，不作为当前日常安装状态的声明。




### 本次实测与边界

- 真实 rc.3 接口边界 11/11；新增准入断言已先红后绿。官方桌面载荷中的 model-selection 与固定 npm 工厂仅 CSS Modules 标识不同，renderer 工厂逐字节相同；没有用替代变量或修改后的宿主代码造通过。
- 本次完整单元/契约测试 167/167（0 失败、0 跳过，包含固定包边界单测但不重建旧宿主 runtime）；离线 UI 45/45、未捕获页面错误 0；完整 rc.3 官方桌面 Host 的安装、禁用、重新启用、卸载及原生回退全部通过。使用测试适配器仅返回合成目录，真实目录/RPC/session/slot 不替换；stream 调用数 0。
- 实际宿主验证品牌 PNG 已解码、收藏/键盘排序/备注/模型选择及刷新持久化；6px 图文左移精确成立，点击框、行高、文本宽度、收起卡片、平铺收藏不变。通过宿主 data-model-compact 和两个继承变量验证紧凑状态：该 fixture 390/360px 未进入，320px 进入；恢复 1280px 后文字恢复。宽度只是采样，不是契约。
- 已执行原构建脚本。此次 checkout 的 93 个 CRLF 行结尾使重建客户端 SHA-256 为 `40689b2e9cd45b31d59d667f3238866dd15d9d29ac0f9939652e937161d06f42`；与公开客户端按换行归一化后完全相等。为不重复改动旧实现，保留原生产客户端字节 `59fa8e89c0a00e48176b91afc65d3035b2352e8d76a9508322fe8e53f8f5a8db`，新包仍另做实际安装验证。源码、CSS、图标及版权说明未改。
- 测试工具修正：提供明确的短路径 workspace 隔离根；Windows taskkill 的非零回执与实际 close 回调存在先后竞态，新增先红后绿的确定性测试，改为有时限等待真实 close。仍拒绝活进程、身份不符、超时和未关闭监听端口；没有放宽关键断言。
- 测试准备阶段的 TEMP 写入拒绝、过长路径和旧测试错误地把 img 当 background-image 的失败均保留证据，不计为通过。没有修改 Windows 权限或运行版本豁免。原日常 profile 的 manifest、patch、锁文件与已安装生产包在最终验证中做指纹保护。
- 隔离验证使用已核验的官方 rc.3 桌面载荷；不以旧会话的端口、PID 或 npm latest 推断当前日常宿主版本及是否已加载新插件。
- 未验证：macOS/Linux、旧版本新归档完整 runtime 重测、真实付费模型调用、日常 GUI 人工验收。1.5.3 已正式公开发布；未在本次发布中升级日常 profile 或重启日常 DSH。既有品牌说明保留，不新增全部授权结论。

## 1.5.1-local.2 历史归档记录（打包时未发布，现已公开）

2026-11-07 缩进实现阶段只移植一条局部 CSS 并使用未修改的 [build.mjs](../scripts/build.mjs) 生成客户端。[indent-layout.mjs](../tests/indent-layout.mjs) 重用原合成 host HTML；该阶段未执行原完整 UI 套件。RED 六例均因左内边距 8px 而非 2px 失败；GREEN 在 1280/390/320px × 深浅色六例通过，左右 2px/14px，图文 X 坐标均 -6px；点击框、行高、文本宽度、收起卡片、平铺收藏几何不变，页面错误和外部网络请求均为 0。无真实模型调用。

本轮生成客户端 SHA-256：`59fa8e89c0a00e48176b91afc65d3035b2352e8d76a9508322fe8e53f8f5a8db`。原始记录在工作副本 tests/artifacts/indent-local2-red/geometry.json 和 tests/artifacts/indent-local2-green/geometry.json；六张绿色截图与输入摘要保留，不放入安装归档。

2026-11-10，发布准备阶段补齐当前候选真实边界 84/84、离线 UI 45/45（未捕获页面错误 0）与五版完整宿主四阶段。仅运行缺少当前候选证据的两个入口，其余单元测试未重跑；下列 local.1 的 150/151 仍是历史，不声明新的完整单元套件通过。

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | PASS | PASS | PASS |
| 0.2.1-rc.4 | PASS | PASS | PASS |
| 0.2.1-rc.5 | PASS | PASS | PASS |
| 0.2.2-alpha.2 | PASS | PASS | PASS |
| 0.2.2-rc.1 | PASS | PASS | PASS |

**alpha.2 的环境限定：** 官方 CLI/app-boot/web-app/frontend 均为 `0.2.2-alpha.2`。完整生命周期的通过环境选择官方 [dsh-v0.2.2-alpha.2 标签](https://github.com/deepseek-ai/deepseek-harness/tree/f3803c96974ad4a94195fb97e5c637e9c2a3afe3)中的六个 vendor：Cordis `4.0.6-alpha.1`、cosmokit `1.8.7-alpha.1`、include `1.0.11-alpha.1`、loader `1.0.7-alpha.1`、schemastery `3.18.6-alpha.1`、timer `1.1.8-alpha.1`。安装前后各 486 条约束通过，并启用 strict peer 检查。两份 npm lock 的来源差异仅这六包；四个 DSH 包的归档 SRI 不变。

普通 npm 范围解析选中上述 vendor 的 alpha.2 时，未安装书架的 control 也在 agent-preset 创建时报 `Cannot read properties of undefined (reading 'parent')`。选择 tag vendor family 后，同一无书架 control 和未改断言的完整四阶段分别通过。原失败保留，未改宿主源码、书架生产代码、版本豁免或发布断言。这证明当前依赖选择对该复现的影响，不证明某一个 vendor 独自是原因，也不等同全部第三方依赖闭包/官方二进制重建或所有 alpha.2 组合都通过。

完整 runtime 使用无凭据的隔离完整宿主，仅 LLM adapter 提供测试 metadata；真实原生目录、RPC、会话及 slot 均运行。每版 installed/disabled/reenabled/uninstalled 共 8 项通过，provider streams=0、page/console errors 为空、browserClosed=true、owned processes=0、真实 desktop manifest/patch 指纹不变。启用阶段在宿主确实进入 compact 的 320px 场景检查完整 aria-label、键盘操作及宽屏恢复；390px 不是固定契约断点。离线 UI 是同一真实客户端上的共享合成目录，不代表逐版日常桌面验收。

原始证据在维护者工作区保留，不放入安装归档；以下摘要可核对，发行侧记须继续绑定具体归档：

| 宿主/层 | 工作区证据 | SHA-256 / 结果 |
| --- | --- | --- |
| rc.2 runtime | [result](../tests/artifacts/clean-0.2.1-rc.2-1794248959531-39ab1043/result.json) | `f9969dd515b2b897fb5b89add7a1234e203eb5be474f7bb9552fad1c895cc1ff` |
| rc.4 runtime | [result](../tests/artifacts/clean-0.2.1-rc.4-1794249107285-c070f975/result.json) | `044dfc9c6df37cc38d6b50dde50fa40d384b2a1701a9912c5556c7e2d92e121d` |
| rc.5 runtime | [result](../tests/artifacts/clean-0.2.1-rc.5-1794249158242-078d2df4/result.json) | `8bd2ef3e103616f394e6ffccf39b65dd4977abf1cf6afe4ae1e07f700643e271` |
| alpha.2 tag-family runtime | [result](../tests/artifacts/clean-0.2.2-alpha.2-1794251239336-845df8e7/result.json) | `6b27acfe62e9eb43ee31b63f98368d07d29b4f981e3e2995ad475f90deb3f6d3` |
| rc.1 runtime | [result](../tests/artifacts/clean-0.2.2-rc.1-1794248133933-880ec10d/result.json) | `41edf971a2858257ac3fbc899c716d347aaca4cf7d831e17d7e8f7a9c9318771` |
| alpha.2 对照与来源差异 | [verification](../alpha2-selection-result-20261110.json) | `c99ffe6dd09e3837b201e69b85475d1dd7c1ced47a880bbfddb4038872ab525c` |
| 真实边界 | [log](../boundary-local2-20261110.log) | 84/84，fail/cancelled/skipped 均 0 |
| 离线 UI | [log](../offline-local2-20261110.log) | `c14b374df7c27f7dfac6bfbed79f7c4b2f58b193cb44bb31e3a0bc50be967e2b`，45/45 |

## 范围与结果

- 包：**dsh-model-shelf 1.5.3**。本轮重测官方 Windows x64 桌面 0.2.2-rc.3；最终归档成员、源码提交与校验值由本版外置完整性记录绑定。
- 本次实际：目标边界、单元、离线 UI 与隔离生命周期结果见当前验证段及本次证据。历史段只描述其自己的旧归档。
- 已正式公开发布为 GitHub Latest；本次发布未升级日常 profile、未重启 DSH，不调用真实模型。

## local.2 历史范围与结果

- 包：**dsh-model-shelf 1.5.1-local.2**。
- 已测不可变归档：[reviewed local.2](../dist-local2-6px-reviewed/dsh-model-shelf-1.5.1-local.2.tgz)，SHA-256 `13279e8c94afb944b003ec8ef678487ab99491ac2e2dcbc317d1551ff645c9b2`；client SHA-256 `59fa8e89c0a00e48176b91afc65d3035b2352e8d76a9508322fe8e53f8f5a8db`。
- 当前源码中的验收脚本和发行文档已有后续修正，与该旧归档不完全相同。生产客户端、CSS、图标不变；不能把旧归档 source-binding 当作当前全部文件匹配，也不能把当前结果自动算给未来重打包版本。新归档必须另外核对、验收及最终审查，旧归档不可原位覆盖。
- 2026-11-09 官方管理器已本地安装启用；真实日常界面/偏好验收尚待可访问的已登录入口。完整隔离宿主证据不能替代它。
- 尚未公开发布。GitHub Release 是授权渠道，不进行 npm 发布。品牌现行规则/适用性、最终发行增量审查及新归档绑定仍未完成，见[发布清单](RELEASE-CHECKLIST.md)。

## 1.5.1-local.1 历史验证（未发布）

2026-11-07：以 desktop 当前安装的 1.5.0 为基线制作兼容补丁。基线完整测试 137/138 通过；唯一原有失败是发布文档未满足完整生命周期门槛。新增 rc.1 的 11 项真实边界测试通过；离线模拟 UI 45 项通过、页面错误 0。无真实模型调用。

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | PASS | PASS | PENDING |
| 0.2.1-rc.4 | PASS | PASS | PENDING |
| 0.2.1-rc.5 | PASS | PASS | PENDING |
| 0.2.2-alpha.2 | PASS | PASS | PENDING |
| 0.2.2-rc.1 | PASS | PASS | PENDING |

离线 UI 的 PASS 指同一合成目录测试，不代表逐版桌面端验收。真实接口测试运行官方包并校验归档，RPC/会话投影使用测试数据。日常 desktop 安装与界面验收结果另记于本地 COMPATIBILITY-NOTES.md；不将发布检查失败隐藏或改成通过。

## local.1 历史范围与结果

- 包：**dsh-model-shelf 1.5.1-local.1**，本地兼容补丁，未公开发布。仅新增 0.2.2-rc.1 精确白名单及对应验证；运行时代码和偏好格式不变。

## 1.5.0 历史候选验证（未发布）

预置 DeepSeek、OpenAI、Cline、Qwen、Qoder 与 TRAE 图标；开启联网补充后，匹配到 OpenRouter、Hugging Face 时从固定版本 Lobe Icons 下载 PNG 并保存本地。其他未覆盖或使用条件不适用的品牌显示默认图标。联网补充默认关闭；图标表示目录标签，不验证实际上游或官方关系。

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | 待复测 | 待复测 | 待复测 |
| 0.2.1-rc.4 | 待复测 | 待复测 | 待复测 |
| 0.2.1-rc.5 | 待复测 | 待复测 | 待复测 |
| 0.2.2-alpha.2 | 待复测 | 待复测 | 待复测 |


2026-11-01：新增 Cline 图标及型号匹配前的候选归档曾在四版 Windows 隔离宿主完成安装、禁用、重新启用和卸载，浏览器检查 45 项通过；rc.5 额外验证了下载和缓存。新增内容后的最终归档尚待复测。本机安装的是更早的候选，实际界面已观察到 DeepSeek、OpenAI 图标和关闭的联网开关。

补充核对：真实书架包含主列表和不常用列表，Cline 一组有 460 个模型。通过桌面界面已发现带命名空间的模型 ID，但尚未逐项核对完整目录。不能将本次检查称为全部图标覆盖验收。

原生 `dsh_model/list` 连接桥接 Web 配置，只返回 5 个服务商，和桌面书架不一致，不能作为桌面目录证据。委托 DSH 调查桌面只读接口的单次任务在提交后发生 TRANSPORT 连接错误，终态未知；未重放。公开 Cline 目录只是辅助资料，不能证明桌面目录的完整性。

补充宿主验收：候选归档 SHA-256 `64d492b0a3b6331a759549c2911ad2fd41ac6c024b45b404a95d49b5a4617caf` 在 0.2.1-rc.2、rc.4、rc.5 和 0.2.2-alpha.2 的隔离 profile 均完成安装、禁用、重新启用、卸载，退出码为 0；rc.5 还通过联网下载和缓存检查。测试使用虚构目录，未发起模型请求，受保护 desktop 文件指纹不变。这些结果仅适用于该归档，不代表桌面目录全量核对或后续归档已完成验收。

上述候选已使用官方 CLI 安装到 desktop profile，安装后客户端文件哈希与候选构建相同；除本插件 dependency 外，manifest 其余字段与 patch 与安装前一致。运行中的桌面窗口有未发送输入，因此未刷新或重启；当前进程是否加载新候选仍未验证。CLI 报告了其他已安装插件的既有版本兼容警告，未修改这些插件或授予豁免。

## 1.5.0 历史范围与结果

- 包：**dsh-model-shelf 1.5.0**，未发布候选；新增图标后的最终归档及本机 GUI 验收待完成。


## 1.4.0 历史验证（已发布）

当前品牌图形使用条件未确认，显示中性默认图标；增加紧凑服务商卡片。候选包已安装本机 desktop 并交互验收；[v1.4.0 GitHub Release](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.4.0) 已公开。当前所有品牌均因适用条件未确认而显示同一默认图标，因此不提供品牌识别效果。

最终发布归档 312350 字节，SHA-256 `d9e0e9c5406f21d60e96319d8b946ada96f13de0def3c7217242d090cbaef542`；匿名下载大小与哈希一致。最终归档在四版隔离宿主分别通过完整生命周期。本机 desktop 已通过官方 CLI 从公开 URL 安装正式归档；安装后的客户端哈希与发布代码一致，bundle 顺序和 patch 不变。公开 URL 在 rc.5 隔离宿主完整生命周期通过。发布归档保留打包时状态，不替换已发布文件。

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | PASS | PASS | PASS |
| 0.2.1-rc.4 | PASS | PASS | PASS |
| 0.2.1-rc.5 | PASS | PASS | PASS |
| 0.2.2-alpha.2 | PASS | PASS | PASS |


2026-11-01：自动测试覆盖四版官方目录边界，离线模拟 UI 检查 44 项通过；同一候选归档在 Windows 四版真实隔离宿主分别完成安装、禁用、重新启用和卸载。rc.2 与 rc.4 的早期运行曾在进程树清理时报错，之后带诊断的完整重跑通过；rc.5 曾有一次同类失败及一次通过。独立 CLI 测试仅额外加入专用 pnpm 路径，未继承用户环境；受保护桌面文件指纹不变。先前候选在实际 DSH 界面验证紧凑行、展开、搜索与收藏页；当前回退方案在本机界面确认紧凑行及默认图标。未发送模型请求。

## 1.4.0 历史范围与结果

- 包：**dsh-model-shelf 1.4.0**，已发布；最终归档已在四版隔离宿主验证。


## 历史记录：早期工作树与受阻验收（当时未发布）

- 2026-11-01 本地构建通过，`npm test` 131/131，离线浏览器 44 项、页面错误 0；不代表完整 runtime 或实际 GUI 验收。
- 650 项合成目录的图标请求及开关/滚动测试记录见[合成性能报告](research/2026-11-01-icon-performance.md)；原始对照不含先前紧凑布局，不能将差异全部归因于图标。
- Windows Desktop 0.2.1-rc.5 的隔离测试在安装和禁用阶段通过，但关闭测试进程时 taskkill 非零，整体失败，未覆盖余下生命周期；已确认受保护文件指纹不变及报告的 PID 后续退出。独立 CLI 的隔离环境遇到临时目录 EPERM，未诊断、未绕过。
- 使用共享浏览器访问当前 GUI 返回 authentication required；未完成用户真实目录或实际 GUI 交互验收。当前工作树未安装、未提交或发布；下方 1.3.1 状态仅指已发布旧归档。
- 品牌图标按目录标签显示，不验证实际端点或上游；其使用条件与已知不确定性见[图标归属说明](ICON-ATTRIBUTIONS.md)和[品牌条件研究](research/2026-11-01-brand-icon-permissions.md)。

## 1.3.1 历史验证（已发布）

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | PASS | PASS | PASS |
| 0.2.1-rc.4 | PASS | PASS | PASS |
| 0.2.1-rc.5 | PASS | PASS | PASS |
| 0.2.2-alpha.2 | PASS | PASS | PASS |

真实边界是各版固定完整性校验的官方目录/slots/store/renderer；RPC/投影边界合成。离线 UI 是相同插件构建物的模拟目录浏览器回归，并非四版前端。先完成 rc.2 pilot，再扩展四版；随后控制器对**最终发布归档**在四版官方 built frontend 独立复跑，各 **8/8**。最终矩阵 16 个阶段页面/控制台错误均为 **0**、stream 为 **0**，48 个 owned 进程退出关闭、浏览器关闭、保护文件指纹一致。覆盖安装、禁用、重新启用、卸载、原生回退、真实选择/实时目录刷新、收藏备注/刷新保持、紧凑控制/键盘/宽栏恢复；失败诊断保留，不伪装跳过或成功。

**归档身份边界：**pilot SHA256 为 `13917e93b91ff295e8c47ad8f39d92ca26d8fe01295b489cf9f9dbf558f13643`；最终归档 SHA256 为 `2ab701bb4e7d1ef27790e6772bd24f724eda2d55ea65a8cca31007292cc5ba03`，**297213 字节 / 32 个普通文件**。两者没有混用。最终包经两个独立审查、控制器四版矩阵后发布；本次发布后文档不重新打包、不替换已发布字节，所以归档保留打包时的未发布状态，最新结论以源码文档和 Release 为准。

## 1.3.1 历史范围与结果

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
