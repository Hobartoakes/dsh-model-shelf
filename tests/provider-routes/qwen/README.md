# 千问路线：思考开关和预算

结论是**不新增书架控件**。逐项输入在[证据清单](./evidence.json)。其中的 route/variant 只用于汇总，不能当作书架识别上游的方法。

| 组合 | 开关 | 预算 |
| --- | --- | --- |
| Token Plan CN / qwen3.6-flash | 现有会话档位：off → false，high → true | 随包配置不发送 |
| Token Plan CN / qwen3.8-max | 可选 low、medium、xhigh；无 off。明确传 off 被拒；省略 effort 是另一条请求路径 | 随包配置不发送 |
| 同 ID 的自定义 Chat Completions 中转 | 与上两行不共享厂商格式；按其自有声明构造，不推定上游 | 明确声明预算字段才会发送；不证明上游采用 |
| 原生 DashScope / qwen-plus | 独立参数能进请求，但有调用策略可覆盖 | 同左；表单整数校验不代表具体模型预算范围 |
| 手配固定思考检查点 | [发布者模型卡](https://huggingface.co/Qwen/Qwen3-235B-A22B-Thinking-2507/blob/6cbffae6d8e28b986a6b17bd36f42f9fa0f1f0a5/README.md#L37)明确只能思考；构造器照样能序列化 false，不做开关 | 未证明；模式固定不等于预算可调或固定 |

## 复跑

本次使用 Node 24.21.0。在已有本项目测试依赖（包括 tar）的环境运行。冷缓存时，仅为准备**公开测试发行包**执行前两行；不安装连接器、不跑生命周期脚本。T2 的缓存已准备则略过第一行。第三行纯离线，缺包、摘要不符、请求未到序列化边界、外连尝试均不得算通过。

~~~sh
node tests/provider-options/codex-roundtrip.mjs --prepare
node tests/provider-routes/qwen/native-archives.mjs --prepare
node --test tests/provider-routes/qwen/contract.test.mjs
~~~

[宿主和 SDK 锁](../../provider-options/pins.json)与[本路线附加锁](./native-archives.mjs)分别限定 DSH 0.2.2-rc.5 / pi-ai 1.3.0 和原生百炼三包 0.7.5。附加缓存仅保留系统临时目录 dsh-model-shelf-qwen-archives 下的 SHA-512 校验归档；每次重解到新的临时 profile，清除后不复用裸模块。宿主家目录、工作目录、凭据和连接器注册服务均与日常环境隔离。

## 证据能说明什么

- [测试子进程](./probe.mjs)启动未改的 Cordis 插件。Token Plan CN 用实际注册的 PiAiAdapter、随包目录和 OpenAI 序列化器；原生版用实际注册的 DashScope 服务和同版本 AiLlmAdapter。两者只在 [Fetch 边界](./wire.mjs)截取序列化后的 POST，返回固定 SSE；不启动浏览器或服务器，不检查账号凭据，不执行模型推理。
- [原生服务向客户端公布的路由](https://unpkg.com/@dsh-ai-providers/runtime@0.7.5/lib/index.js#L109-L127)有活动状态、模型 id、容量，但无这两项参数的有效值、模型范围或策略。目录只指向 llmRoutes；[自带表单](https://unpkg.com/@dsh-ai-providers/dashscope@0.7.5/lib/client.js#L40-L69)把它作为列表编辑。[宿主版本化路径修改](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.5/packages/settings/settings/src/index.ts#L363-L395)即使能定位某一叶子，也不消除[更高优先级策略](https://unpkg.com/@dsh-ai-providers/runtime@0.7.5/lib/index.js#L1560-L1578)或模型能力缺口。不能以表单读回推定下次生效，也不替用户改变连接或兼容协议。
- 输入的 profile、路由表、策略、凭据和 SSE 响应都是夹具；测试不是账号、上游接受、线上效果或书架保存/重开的证明。样本不覆盖所有千问插件、国家地区和中转商。没有可安全接入的候选，因此没有适配器或新增写入口。
