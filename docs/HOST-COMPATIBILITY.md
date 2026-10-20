# DSH 0.2.0-rc.2 → 0.2.1-rc.2 宿主兼容性核对

本文记录把 dsh-model-shelf 从 DSH **0.2.0-rc.2** 迁到 **0.2.1-rc.2** 时逐项核对的契约，以及一处**有意不做**的适配。

核对对象是本机安装的 0.2.1-rc.2 宿主（`app.asar` 内 `dsh/desktop-runtime.json` 声明 `release.version: 0.2.1-rc.2`、`hostProtocolVersion: 4`），以及随宿主发布的官方插件 `@deepseek-ai/dsh-client-ui-model-selection` 与 `@deepseek-ai/dsh-client-ui-slots`。

## 逐项结论

| 契约 | 结论 |
| --- | --- |
| 服务名 `ctx.modelDirectories.directoryFor(sessionId)` | 不变，仍是 `modelDirectories` |
| `inject` 清单 `['slots','modelDirectories','sessions','remote','remote.session']` | 不变 |
| 目录快照字段 `current` / `routable` / `groups` / `failures` / `status` / `pending` / `error` / `retainedEffort` | 不变，无新增、无删除 |
| `state.groups[].models[].reasoning.{efforts, defaultEffort}` | 不变 |
| `directory.load(): Promise<snapshot>` | 不变 |
| `directory.select()` 返回 `{ok:true, value:undefined}` / `{ok:false, error:{code,message}}` | 不变；`session/writer-held` 仍是有效错误码 |
| `directory.resetConnected()` | 不变，仍由 `connection/reset` 触发 |
| `ctx.sessions.subagentAddress(sessionId)` | 不变 |
| `slots.inject(key, callback)` 语义 | 不变 |
| `slots.register()` 的 `priority` 选项 | 不变；`-100` 仍然胜出 |
| WorkBuddy 探测 / 逐模型容量（CTXPATCH） | 不受影响：读的是 `dsh-workbuddy-connect` 自己挂载的同源状态文档，不是 DSH 模型目录 |

模型目录相关的全部契约在两个版本间**没有变化**，因此本插件的业务逻辑无需改写；迁移只涉及元数据与一处设计取舍。

## 座位占用：`priority: -100` 为什么仍然有效

`conversation.input.model` 由 `@deepseek-ai/dsh-client-ui-conversation` 声明为 `{kind:"single", scope:"session"}`。0.2.1 起宿主自带的 `@deepseek-ai/dsh-client-ui-model-selection` 也往这个座位里注册（不传 `priority`，即 0）。

`single` 插槽的规则有两条，合起来决定了结果：

1. **同 priority 才冲突。** `SlotCore.register` 只在该 priority 上已有占用时抛错，提示 `register at a different priority to shadow it (lowest renders)`。
2. **最低 priority 渲染。** 条目按 priority 升序排列，渲染端取 `entriesOfSlot(key)[0]`。

本插件用 `priority: -100`，官方插件是 `0`，两者不在同一格、不抛错，且 `-100` 排在前——本插件胜出，官方 `ModelSelect` 不渲染。这与 0.2.0 的行为一致。

另一个有利性质：**胜出的条目崩溃会被"退位"**（`abdicate`），官方选择器随即接管。所以本插件的缺陷最多让界面回落到原生选择器，不会留下空白座位。

## 有意不做：不声明 `conversation.input.model.label`

0.2.1 给这个座位新增了子插槽 `conversation.input.model.label`（`{kind:"single", scope:"session", inline:true}`），宿主自带的 1017 徽标插件往里注册，给模型名加一个角标。

本插件**不声明它**，代价是书架内的模型名不带 1017 角标。原因是声明权只能有一份：

- 想让 `renderSlot(...)` 可用，注册条目必须自己 `children` 里声明这个键——渲染端只为声明了 `children` 的条目合成 `renderSlot`。
- 而同一个键只能被声明一次。官方插件已经声明了它，本插件再声明就会让官方插件在**每次加载**时抛 `slot "conversation.input.model.label" is already declared`。

谁在后注册谁抛错，与本插件注册早晚无关（已用官方 `@deepseek-ai/dsh-client-ui-slots@0.2.1-rc.2` 实测两种顺序）。实测确认：本插件一旦声明，真实宿主里就会出现一条未捕获的 `pageerror`，注册方是宿主自己的插件——这是把宿主插件搞坏，不是外观损失。

因此选择**不声明**：书架内的模型名按纯文本显示，宿主自带插件与原生座位完全不受影响。

如果将来宿主不再声明这个键（或提供了第三方可用的声明入口），本插件只需在 `apply()` 的注册项里加回 `children`，并在组件里经 `renderSlot` 取模型名即可；`tests/browser.mjs` 中已有一条断言锁定"当前不声明"这个决定，改动时它会先行失败。

## 验证

- 单元测试 36 项通过（`node --test tests/*.test.mjs`）。
- 离线浏览器检查 31 项通过（`node tests/browser.mjs`），含一条锁定"不声明子插槽"的断言。
- 隔离干净 profile 集成测试（`node tests/clean-profile.mjs`）：真实 0.2.1 宿主 + 隔离 `DSH_HOME`，插件出现在客户端图中，触发器与面板正常渲染，未捕获页面错误为 0。
- 本机 desktop profile 已安装 1.2.1，`engines.dsh` 为 `0.2.1-rc.2`。

## 尚未验证

- macOS、Linux。
- 其他 DSH 版本（0.2.1 之外）。
- npm registry 安装与 dsh-market 一键安装（本项目未发布 npm）。
