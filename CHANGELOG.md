# 版本记录

## 1.3.0 · 手动整理与排序

发布目标：[GitHub Release v1.3.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.3.0)；目标归档：[dsh-model-shelf-1.3.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.3.0/dsh-model-shelf-1.3.0.tgz)。目标链接不是已上传或公开下载已验证的声明；精确门禁见[发布检查清单](docs/RELEASE-CHECKLIST.md)。

- 收藏改为逐条平铺，可交错排列不同服务商的模型。
- 支持服务商整组移至不常用（覆盖以后新增的模型）；恢复服务商仅解除整组覆盖，保留单模型原分类，不影响收藏或当前会话模型。
- 记住上次手动打开的标签页，包括空收藏页；没有记录时才按当前模型分类打开。
- 主列表 / 不常用分别手动排序服务商，收藏按完整模型身份排序；支持独立拖动把手与可用键盘操作的上移 / 下移按钮，搜索时禁用排序，不支持跨列表拖放。
- 排序刷新后保留；离线身份保留位置，新条目追加末尾，取消后重新收藏追加末尾。
- 保持 `engines.dsh: 0.2.1-rc.2`，不扩大宿主兼容范围。
- 实现已合入 main（`5efddd0`、`851101d`）；控制器实际运行本版 **42 项单元测试 + 40 项离线浏览器检查通过**，未捕获页面错误为 0，并完成构建、发布文件检查与 `npm pack`。
- 控制器运行 `node tests/clean-profile.mjs`，**7/7 项真实隔离 profile 集成检查通过**，覆盖安装 / 禁用 / 重新启用 / 卸载，当前 desktop 指纹保持不变。此证据不替代当前 desktop 安装、现有 GUI 验收或公开发行验证；详见[验证报告](docs/VALIDATION.md)。旧版本验证与截图不作为本版安装证据。

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
