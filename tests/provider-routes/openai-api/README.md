# OpenAI API：哪些参数能由书架保存？

固定版本下，两项都没有可供书架使用的单字段读写入口。[逐项证据](evidence.json)分开了官方端点和自定义中转，每类再分 Responses 与 Chat Completions。这里的 `openai-api` 是调查分组，不是运行时 provider ID。

## 复跑

在已备好仓库测试依赖的开发工作树中（本次 Node 24），从根目录运行：

```sh
# 仅冷缓存需要：获取并校验公开归档，不安装插件、不请求模型。
node tests/provider-options/codex-roundtrip.mjs --prepare
# 验收始终离线；缺归档、哈希不符、意料外的请求、未执行到真实序列化均失败。
node --test tests/provider-routes/openai-api/contract.test.mjs
```

复用[归档校验器](../../provider-options/archives.mjs)和[完整性清单](../../provider-options/pins.json)，不启动 Codex。固定的 DSH 连接器、pi-ai 与 OpenAI SDK 解压到专线的临时目录。每次在空的 HOME/DSH_HOME 和一个虚构 key 下挂载连接器。测试仅观察注册的目录/适配器；不替换配置解析、模型能力、请求构造或 SDK 序列化。终端 Fetch 检查序列化后的请求，只回本地 SSE，禁止建立 socket，不记录整条请求。

## 判定依据

- [配置所有者](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/packages/llm/llm-pi-ai/src/index.ts#L149-L177)是公布该路由 `settingsNs` 和 `settingsPath` 的实例；[协议选择](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/packages/llm/llm-pi-ai/src/provider.ts#L168-L192)可以覆盖目录默认值。不能仅凭 `openai/gpt-5.4` 判断直连，更不能借用同名 `openai-codex/gpt-5.4` 的偏好。
- [实际表单](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/packages/llm/llm-pi-ai/src/config.ts#L287-L385)没有这两个字段。已声明的 `reasoning` 是推理档位；[模型能力](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/packages/llm/llm-pi-ai/src/adapter.ts#L376-L392)、[转发给 streamSimple 的参数](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/packages/llm/llm-pi-ai/src/adapter.ts#L475-L482)和[线路默认值白名单](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/packages/llm/llm-pi-ai/src/adapter.ts#L148-L165)都不是任意请求参数入口。
- [Responses](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/ai/src/api/openai-responses.ts#L391-L407)会在构造有 effort 的推理请求时填入默认摘要 `auto`；[官方 Chat](https://github.com/openai/openai-node/blob/v7.19.0/src/resources/chat/completions/completions.ts#L2073-L2444)的请求类型有 `reasoning_effort`，无摘要选项，[装配逻辑](https://github.com/earendil-works/pi/blob/71023aec1546d6d677a65669c5665c0927ce0dd0/packages/ai/src/api/openai-completions.ts#L971-L979)亦与此一致。两种协议的详略参数位置不同；SDK 提供类型不是具体模型的能力或书架的写入权限。
- [离线夹具](wire-probe.mjs)核对 15 次请求：两种端点 × 两种协议，另加保留 `openai` 路由名但改向中转的 Responses。每个场景比较 `gpt-5.4` 的 low/high 和不声明推理的 `gpt-4.1`；自定义路由的能力是明确的夹具输入，不是对真实网关的探测。[同名反例](contract.test.mjs)另验书架不向订阅端读或写。

这不是线上推理、真实账号/中转行为、其他连接器或 GUI 保存闭环的证明。没有候选可供本轮保存，故不添加运行时代码或控件；已有的会话推理档位不算新增。
