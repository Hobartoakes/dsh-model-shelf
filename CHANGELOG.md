# 版本记录

## 1.4.0 当前验证（已发布）

当前品牌图形使用条件未确认，显示中性默认图标；增加紧凑服务商卡片。候选包已安装本机 desktop 并交互验收；[v1.4.0 GitHub Release](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.4.0) 已公开。当前所有品牌均因适用条件未确认而显示同一默认图标，因此不提供品牌识别效果。

最终发布归档 312350 字节，SHA-256 `d9e0e9c5406f21d60e96319d8b946ada96f13de0def3c7217242d090cbaef542`；匿名下载大小与哈希一致。最终归档在四版隔离宿主分别通过完整生命周期。本机 desktop 已通过官方 CLI 从公开 URL 安装正式归档；安装后的客户端哈希与发布代码一致，bundle 顺序和 patch 不变。公开 URL 在 rc.5 隔离宿主完整生命周期通过。发布归档保留打包时状态，不替换已发布文件。

| DSH | 真实边界 | 离线 UI | 完整 runtime |
| --- | --- | --- | --- |
| 0.2.1-rc.2 | PASS | PASS | PASS |
| 0.2.1-rc.4 | PASS | PASS | PASS |
| 0.2.1-rc.5 | PASS | PASS | PASS |
| 0.2.2-alpha.2 | PASS | PASS | PASS |



2026-11-01：自动测试覆盖四版官方目录边界，离线模拟 UI 检查 44 项通过；同一候选归档在 Windows 四版真实隔离宿主分别完成安装、禁用、重新启用和卸载。rc.2 与 rc.4 的早期运行曾在进程树清理时报错，之后带诊断的完整重跑通过；rc.5 曾有一次同类失败及一次通过。独立 CLI 测试仅额外加入专用 pnpm 路径，未继承用户环境；受保护桌面文件指纹不变。先前候选在实际 DSH 界面验证紧凑行、展开、搜索与收藏页；当前回退方案在本机界面确认紧凑行及默认图标。未发送模型请求。

## 1.3.1 历史验证（已发布）

- 2026-10-30 公开发布 [v1.3.1](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.3.1)，非草稿、非预发布；[发布提交 d35c588](https://github.com/Hobartoakes/dsh-model-shelf/commit/d35c588b457bcf247dc0fb47df98d7abae185bae) 已推送 main，标签固定指向该提交。
- 2026-10-30 经用户要求，通过官方 CLI 将本机日常 desktop profile 从 1.3.0 升级到 1.3.1（当前 DSH 0.2.1-rc.5）：安装归档 SHA256 与发布字节一致，`bundle` 顺序与 `cordis.patch.yml` 未变，重启 DSH 后加载；Harness 本身未升级。
- 精确允许 DSH 0.2.1-rc.2、0.2.1-rc.4、0.2.1-rc.5、0.2.2-alpha.2，不使用宽泛版本范围。rc.5 是 2026-10-30 观测到的 latest/next。
- 保留真实目录、选择和偏好语义；新增官方包边界矩阵、隔离完整 runtime 验证与安全回归。
- 适配宿主输入栏 `--dsh-composer-model-text-display` / `--dsh-composer-model-icon-display`；紧凑图标保持完整可访问名称、主题颜色、Enter / Space 与宽栏恢复。
- 运行器支持显式 Node/CLI 入口，校验实际 runtime，隔离 DSH/agents/home/cwd/npm 配置，保护日常 GUI，finally 核对受保护指纹并等待 owned 进程退出；当前版收藏与备注不再被旧 1.1.0 条件跳过。
- 控制器独立复跑构建、128/128 单测、41 项浏览器检查（0 页面错误）、发布与 diff 检查；两项最终独立审查均通过，0 待修问题。最终归档四版完整 runtime 各 8/8 通过，16 个阶段无页面/控制台错误，模型 stream 为 0，48 个 owned 进程均退出关闭、保护文件指纹不变。
- 公开归档 **297213 字节 / 32 个文件**，SHA256 `2ab701bb4e7d1ef27790e6772bd24f724eda2d55ea65a8cca31007292cc5ba03`；不带 Authorization/Cookie 的公开下载 HTTP 200、大小与哈希一致。公开 URL 在 rc.5、alpha.2 的独立安装生命周期各 **8/8** 通过，非仅上传成功。
- 本次为发布后的源码文档记录，不重新打包、替换归档或移动标签；归档中保留打包时的未发布状态。详细分层、身份及限制见[验证报告](docs/VALIDATION.md)，不继承下方 1.3.0 的日常安装或验收结论。

## 1.3.0 · 手动整理与排序

已公开发布（非草稿、非预发布）：[GitHub Release v1.3.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.3.0)；归档：[dsh-model-shelf-1.3.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.3.0/dsh-model-shelf-1.3.0.tgz)。发布提交 `42760acc4b47c0f392ec6ccf482dd594ac450761` 已推送 main 与 v1.3.0 标签；精确门禁见[发布检查清单](docs/RELEASE-CHECKLIST.md)。

- 收藏改为逐条平铺，可交错排列不同服务商的模型。
- 支持服务商整组移至不常用（覆盖以后新增的模型）；恢复服务商仅解除整组覆盖，保留单模型原分类，不影响收藏或当前会话模型。
- 记住上次手动打开的标签页，包括空收藏页；没有记录时才按当前模型分类打开。
- 主列表 / 不常用分别手动排序服务商，收藏按完整模型身份排序；支持独立拖动把手与可用键盘操作的上移 / 下移按钮，搜索时禁用排序，不支持跨列表拖放。
- 排序刷新后保留；离线身份保留位置，新条目追加末尾，取消后重新收藏追加末尾。
- 保持 `engines.dsh: 0.2.1-rc.2`，不扩大宿主兼容范围。
- 实现已合入 main（`5efddd0`、`851101d`）；控制器实际运行本版 **42 项单元测试 + 40 项离线浏览器检查通过**，未捕获页面错误为 0，并完成构建、发布文件检查与 `npm pack`。
- 控制器运行本地归档及公开 URL 的 `node tests/clean-profile.mjs`，均为 **7/7 项真实隔离 profile 集成检查通过**，覆盖官方 CLI 安装 / 禁用 / 重新启用 / 卸载与原生选择器恢复；隔离测试期间 desktop 指纹保持不变。
- 公开归档 **269184 字节**，SHA256：`bd1387e6e52bc1ba44a0c9541d124882ef40f5c6b83f9fd6b7ff37425e52e9a5`；控制器无登录公开下载 HTTP **200**，哈希一致。
- 实际 desktop 已通过官方 CLI 从 **1.2.1 升级至 1.3.0**，客户端哈希与源码构建产物一致；仅本插件 dependency 改变，bundle 顺序与 patch 不变。现有 GUI 浏览器仍返回 `authentication-required`，**当前 GUI 激活 / 交互验收待完成**。既有无关插件的兼容性警告未获豁免。详见[验证报告](docs/VALIDATION.md)；旧版本验证与截图不作为本版安装证据。
- **发布后文档记录**：已发布归档不可变，包含较早的打包时状态；本次源码文档更新不替换归档或标签，不计划重新打包。最终哈希现可记入源码文档。npm 尚未发布，也不是本版计划发行渠道。

## 1.2.1 · 兼容 DSH 0.2.1（未发布）

- 兼容性从 **DSH 0.2.0-rc.2** 提到 **0.2.1-rc.2**（`engines.dsh` 与发布检查同步更新）。
- 模型目录服务契约逐项核对无变化：`modelDirectories.directoryFor()`、快照字段（`current` / `routable` / `groups` / `failures` / `status` / `pending` / `error` / `retainedEffort`）、`select()` 的 `{ok, value|error}` 与 `session/writer-held`、`resetConnected()`、`load()`、`sessions.subagentAddress()` 全部保持原样，业务逻辑无需改写。逐项记录见新增的 [`docs/HOST-COMPATIBILITY.md`](docs/HOST-COMPATIBILITY.md)。
- 0.2.1 起宿主自己也往 `conversation.input.model` 注册官方选择器（priority `0`）。本插件继续以 `priority: -100` 胜出，规则不变：同 priority 才冲突，最低 priority 渲染。
- **已知取舍**：0.2.1 新增的子插槽 `conversation.input.model.label`（宿主 1017 徽标用它给模型名加角标）本插件**不声明**，因此书架内的模型名按纯文本显示、不带该角标。同一个键只能被声明一次，声明它会让宿主自己的模型选择插件在每次加载时报 `slot "…" is already declared`（已实测，与注册先后无关），属于把宿主插件搞坏，故不做。
- 新增一条浏览器断言锁定该取舍：注册项不得带 `children`。离线浏览器检查 31 项、单元测试 36 项通过；隔离干净 profile 集成测试在真实 0.2.1 宿主下通过，未捕获页面错误为 0。
- CTXPATCH / WorkBuddy 探测链路不受影响：它读的是 `dsh-workbuddy-connect` 自己挂载的同源状态文档，不是 DSH 模型目录；0.2.1 的目录里本来也没有逐模型容量字段。

## 1.2.0 · 思考强度就地检测、恢复默认与逐模型上下文容量（已发布 GitHub Release v1.2.0）

预构建安装包：[dsh-model-shelf-1.2.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.2.0/dsh-model-shelf-1.2.0.tgz)。

- 新增**「恢复服务商默认」**：当前模型被固定过思考强度时，面板底部出现该按钮；点击后按“不下发 `reasoningEffort`”的方式恢复为服务商默认，语义与 DSH 原生选择器的 Default 一致。此前若模型不声明档位，固定过的档位没有任何入口可以取消。
- 新增**就地检测思考强度**：当某模型未声明档位、且 WorkBuddy 把它列为待检测对象时，模型面板底部直接给出「检测思考强度」（先确认、再检测）；检测成功后就地出现档位下拉，不必再切到 WorkBuddy 设置页去点气泡。
- 新增**逐模型上下文容量**：对打了 CTXPATCH 补丁的 `dsh-workbuddy-connect`，面板底部出现「上下文容量」下拉，列出该模型声明的每个窗口（如 `300K` / `1M`）并显示“当前生效”，可选择「服务商默认」解除固定。这是该插件原本**只有全局开关**之外真正逐模型的入口。
- 复用方式：通过 `dsh-workbuddy-connect` 自己挂载的同源路由 `GET /plugins/dsh-workbuddy-connect/ai/status` 读取检测状态、容量与本次进程密钥，再用 `POST /plugins/dsh-workbuddy-connect/ai/probe` 发起检测或写入容量。**不读取该插件的私有记录文件**，也不绕过它的授权、限流与“仅本机 + 密钥”双重校验；请求始终由该插件在宿主侧组装。
- 档位来源标注：档位来自检测时，下拉旁显示「已探测」。
- 诚实降级：WorkBuddy 未安装、未登录、路由不可达、返回无法解析的内容，或**没有打 CTXPATCH 补丁**（状态文档里没有 `contextWindowPatch`）时，对应的控件不出现，面板其余功能不受影响；已检测但模型面板尚未刷新时，显示「已探测到档位：…（模型面板尚未更新）」并提供「刷新档位」，而不是伪造一个上游并不接受的档位。
- 状态文档读取按服务商缓存 60 秒，避免每次打开面板都去触发该插件的状态路由（它同时会拉取额度信息）。
- 新增 `tests/workbuddy-probe.test.mjs`（22 项）与 8 项浏览器端检查；浏览器套件新增 `DSH_TEST_CDP_URL`，在无法自行拉起浏览器的环境中可挂到已启动的浏览器上运行。
- 新增 `docs/WORKBUDDY-PROBE.md` 说明这条跨插件依赖的契约与降级边界。
- 配套的宿主侧补丁在独立工程 `dsh-workbuddy-connect-patch`：`node patch.mjs [--install]` 重新生成并安装打了补丁的插件包。

## 1.1.1 · 可复制文字（已发布 GitHub Release v1.1.1）

预构建安装包：[dsh-model-shelf-1.1.1.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.1.1/dsh-model-shelf-1.1.1.tgz)。

- 修复模型书架 UI 中文字无法用鼠标拖选复制的问题。
- 将分组标题、模型行、当前模型按钮改为 `div[role=button]` 并添加 `user-select:text`，使服务商名称、服务商 ID、模型名称、模型 ID、账号备注等文字均可拖动选中复制。
- 保留键盘操作（Enter / Space）与 aria 属性，选中模型、折叠分组等功能行为不变。
- 测试更新：14 项偏好测试、21 项离线浏览器检查通过。

## 1.1.0 · 收藏与账号备注（已发布 GitHub Release v1.1.0）

预构建安装包：[dsh-model-shelf-1.1.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.1.0/dsh-model-shelf-1.1.0.tgz)。

- 新增独立的**收藏**列表：手动点击“☆ 收藏 / ★ 已收藏”，不影响主列表 / 不常用分类，也不会选择模型。
- 新增**账号备注**：按服务商配置 ID 分别保存，可区分同一平台下的多个 API 账号。
- 备注显示在模型行、分组标题、当前模型按钮，并支持按备注搜索。
- 备注编辑：Enter 保存，Escape 或“取消”放弃，清空保存即删除备注；按原文显示，不执行 HTML。
- 收藏和备注兼容 1.0.0 的本地偏好：旧数据缺少新字段时默认为空，原分类和折叠保留。
- 偏好仍保存在当前浏览器；不自动读取或验证实际账号身份，不保存密钥。
- 测试更新：14 项偏好测试、20 项离线浏览器检查通过。
- 新增收藏列表演示截图 `docs/images/favorites-list.png`。
- 文档补充：收藏与账号备注用法、多账号需各自建 API 配置的通俗说明、备注编辑键盘行为、1.0.0 → 1.1.0 偏好兼容与尚未验证项。
- 修复“账号备注”按钮紧贴分组右边框的间距问题。

## 1.0.0 · 首次发行版本

发行状态以 npm registry 和维护者发布记录为准；此处描述该版本内容。

- 正式命名为 **模型书架 · DSH Model Shelf**，包名 `dsh-model-shelf`。
- 作者 **Hobartoakes**，采用 **MIT License**。
- 最大 640px × 720px 的模型选择面板，适配窄窗口和浅色 / 深色主题。
- 按服务商分组，支持单组折叠、全部展开和全部折叠。
- 用户手动管理主列表和不常用列表，可移入和移回，不按使用频率自动分类。
- 同时显示服务商名称、服务商 ID、模型名称和模型 ID。
- 搜索支持模型名称、ID 与服务商，保留键盘操作。
- 复用原生模型选择服务和思考强度选项，处理选择失败及过期异步响应。
- 分类和折叠偏好保存于当前浏览器。
- 从早期本地原型 `dsh-model-organizer` 导入旧偏好，已有新偏好不覆盖，旧键不删除。
- 声明已验证的 DSH 0.2.0-rc.2，其他宿主版本和平台不作兼容承诺。
- 提供隐私说明、模拟数据演示图、发布检查、离线回归和隔离 profile 集成测试流程。
- 验证结果及限制见 [验证报告](docs/VALIDATION.md)。

## 早期本地原型（未公开发布）

- 原型名称为 `dsh-model-organizer`，已在 Windows DSH 0.2.0-rc.2 的现有 GUI 验证。
- 正式项目在独立目录中整理；没有修改原型已安装的包或当前 desktop profile。
