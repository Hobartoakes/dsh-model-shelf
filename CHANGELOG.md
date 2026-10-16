# 版本记录

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
