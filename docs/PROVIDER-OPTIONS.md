# 服务商选项：哪些能调，哪些不能据此开放

在本次核对的版本中，书架已验证可保存的服务商偏好只有 **Codex 订阅的回答详略、推理摘要**。在当前模型下打开「服务商选项」，改值后点「保存」；打开或取消并不写入。它们是连接器共享默认值，不只影响当前会话。其他七组没有新增写入口；原本可选的会话思考档位继续用原选择器。Codex 速度仍是候选，不是可用功能。

## 怎样读证据

[逐项总表](../tests/provider-options/coverage.json)用 `route + variant + field` 标识一行。`route` 是调查分组，不是运行时识别规则；同名模型、同一协议、有一张可写表单，都不能单独授权书架修改实际发送请求的实例。八组共 **65 行**，其中七条专线的 62 行来自各自独立审查后的矩阵。

| 分类 | 行数 | 能得出的结论 |
| --- | ---: | --- |
| 已验证 `verified` | 2 | 书架保存单字段，重开从所有者读回，下一条真实连接器构造的请求随之改变。证据止于本地传输边界。 |
| 候选 `candidate` | 1 | 固定版本有可核对的契约和请求分支，书架保存到下一请求的验证尚缺；不开放，不能按已支持交付。 |
| 原已有 `builtin` | 15 | 当前模型的目录与会话档位已经提供此效果。不另加控件，也不算新增功能。 |
| 限定不支持 `unsupported` | 20 | 证据指向**表中这一版本、模型、协议或配置**不提供该项语义；不代表整个厂商、其他协议或未来版本。 |
| 缺口 `gap` | 27 | 不能证明所有者、窄写入口、模型能力或实际效果中的一环。每行写明缺哪一环；不以“没看到”代替否定证据。 |

每行保留固定包版本（`packagePin`）、出处（`source`）、实例归属（`ownerProof`）、可写入口或限制（`writeSurface`）、复跑命令及观察（`requestProof`）和分类理由（`reason`）。下文的「缺口」「不支持」均按上述范围理解，不是线上推理结论。

## Codex 订阅：两项已验证，一项候选

固定组合：`openai-codex`、DSH `0.2.2-rc.5`、`dsh-codex-subscription@3.2.28`、pi-ai `1.3.0`（[归档校验值](../tests/provider-options/pins.json#L89)）。书架提交 `61aed96623bc15fec46eaca9060296aa1f9195cf`；t5 实施，t6 独立复现，t7 独立审查。

| 偏好 | 适用条件和可选值 | 已观察到的下一请求 |
| --- | --- | --- |
| 回答详略 `outputVerbosity` | 精确模型在连接器公布的 `verbosityModels` 内。`default / low / medium / high`；恢复默认跟随模型。 | 保存 `low` 后 `text.verbosity=low`；重置 `default` 后取夹具模型默认 `high`，不是所有模型都固定发 high。 |
| 推理摘要 `reasoningSummary` | 仅对生成 `reasoning` 的请求生效。`auto / concise / detailed / none`。 | 两个显式摘要分别写入 `reasoning.summary`；`auto` 保留构造器原值；`none` 移除摘要，不移除推理强度。非推理模型无 `reasoning`。 |

书架按[当前路由与模型核对可写状态](../src/codex-options.js#L11-L30)，通过所有者的 `codex-subscription/preferences/status` 读取，保存前复核，向 `preferences/update` 只提交所改字段，再独立读取。两项共[六次保存并重开](../tests/provider-options/exercise.mjs#L32-L56)；[同名 API 反例](../tests/provider-options/exercise.mjs#L58-L66)不使用订阅 RPC。隔离 profile、虚构账号、真实连接器与 SDK，最终 POST 在[本地 Fetch 边界](../tests/provider-options/local-transport.mjs#L9-L24)截获，供应商连接为零。这不是日常桌面、真实账号或线上回答质量验收。

### 速度 `speedMode`：为何仍不开放

- **档位归谁。** t32 核对上述发布包与定版源码。偏好属当前 profile 的连接器，不是逐会话或逐模型设置；是否能加速却取决于当前账号的可信目录和精确模型。[目录解析](<https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/model-catalog.js#L142-L151>)及[状态字段](<https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/index.js#L314-L336>)分别声明 `fastModels`、`ultrafastModels`。有一个档不意味着有另一个；`ultraModels`、未知 tier、模型名推断或来源不明的目录都不算。只有所有者可写、允许内联且当前模型唯一启用才考虑展示。
- **请求和用量。** [固定构造器](<https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/pi-ai-runtime.js#L156-L190>)的普通聊天分支：有效 `fast` → `service_tier: 'priority'`，有效 `ultrafast` → `'ultrafast'`；`standard`（重置值）或不适用档不加此键，极速不可用时不降为 fast。共享存值在另一个模型上无效，不等于已保存 standard，不自动改回。应在保存前明示其他会话受影响及[Fast 消耗更多 Credits](<https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/client-locales.js#L355-L356>)、[Ultrafast Beta 更快消耗订阅额度及 Credits](<https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/client-locales.js#L203-L204>)；不承诺次数、价格或倍数。
- **缺哪条证据。** 现有[保存夹具](../tests/provider-options/host.mjs#L61-L70)只准写前两项，传输记录也不取 `service_tier`。Task 4 须对双档模型分别保存 fast、ultrafast、重置 standard，逐笔重开读回并检查下一条 SDK 请求的该键存在性、值和其他字段不变；另验仅 fast、仅 ultrafast、无档或未知档、写前撤档零补丁、同名 API 零订阅 RPC。零外连通过后才可晋级，否则列缺口；前两项的六次保存不能给速度背书。

## 其他七条线路：逐组合结论

这些是固定连接器实际构造请求或明确拒绝选档的观察，不是书架保存了新的偏好。下列链接保留每个组合的版本、源码位置、写入限制和复跑断言。

### OpenAI API — [8 行证据](../tests/provider-routes/openai-api/evidence.json)

DSH pi-ai 连接器 `0.2.2-rc.5`、pi-ai `1.3.0`、OpenAI SDK `7.19.0`；`cb4b53eb2a0a`，独立审查 t19。

| 路径 | 回答详略 | 推理摘要 |
| --- | --- | --- |
| 官方 Responses | 缺口：SDK 有 `text.verbosity`，宿主无模型声明及偏好入口 | 缺口：构造器能默认请求 `auto`，宿主未传摘要偏好 |
| 官方 Chat Completions | 缺口：顶层详略不是 Responses 字段，缺模型/写入证据 | 不支持：该版创建请求有 `reasoning_effort`，无摘要选项 |
| 自定义 Responses | 缺口：同名模型不证明详略能力，也无独立写入口 | 缺口：本地默认 `auto` 不证明该中转接受，也无偏好写入口 |
| 自定义 Chat Completions | 缺口：没有专用字段及中转声明 | 缺口：没有专用字段或网关扩展契约 |

以上四条都不借用 Codex 订阅的能力目录或 RPC。

### Anthropic / Claude — [10 行证据](../tests/provider-routes/claude/evidence.json)

DSH pi-ai 连接器 `0.2.2-rc.5`、pi-ai `1.3.0`、Anthropic SDK `0.129.0`，Messages；`63dca424acd9`，独立审查 t21。

- **Sonnet 4.5、4.6**：两条 `cacheRetention` 都是缺口；`short` 发短时标记、`long` 在适用配置下发 `ttl=1h`、`none` 不发标记。时长不是缓存开关，不能证明线上命中。`no-long-ttl` 的 4.5 分支仅一小时保留不支持，短时标记仍在。
- **Sonnet 4.5**：`thinkingBudgets.minimal/low/medium/high` 四个固定 token 预算分别是缺口。构造器确实使用预算，但仅有表单命名空间不能定位活动实例；错配表单能读回 `long/4608`，下一请求仍为 `short/3584`。
- **Sonnet 4.6**：自适应推理分支不支持逐档固定 token 数。两款模型的 `reasoningEffort` 都是已有会话档位。

### Google / Gemini — [10 行证据](../tests/provider-routes/gemini/evidence.json)

DSH `0.2.2-rc.5`、pi-ai `1.3.0`、Google GenAI `2.21.0`；`5225b404678f`，独立审查 t23。以下结论在 **Google Generative AI** 和 **Vertex API Key** 两种协议分别核对，不借用另一协议的证据。

| 每种协议的模型 | 会话档位如何进请求 | 不开放的选项 |
| --- | --- | --- |
| `gemini-2.5-flash` | `reasoningEffort` 已有；档位选择对应的数值预算 | `thinkingLevel` 不支持（该分支发预算不发等级）；`thinkingBudget` 有写入归属缺口：错配表单读回 6144，活动请求仍发 3072 |
| `gemini-3.1-pro-preview` | `thinkingLevel` 已有；low/high 分别发 `LOW/HIGH` | 此分支不支持 `thinkingBudget`，不带数值预算；不再做第二个等级下拉框 |

### DeepSeek — [4 行最终证据](../tests/provider-routes/deepseek/evidence.json)

DSH `0.2.2-rc.5` 的官方 API Key 与账号连接器；以 `57d317234e44`、独立审查 **t39** 为准。`deepseek-official` 和 `deepseek-account` 分别为 **`maxTokens` 缺口、`reasoningEffort` 已有**。

在已知夹具所有者上改最大输出 token 数，确实会改变 `max_tokens`；它不是模型上下文窗口。反例在同一宿主登记唯一可写备用表单和同名模型，推理却由另一实例处理；`settingsNs` 不能证明谁发出了请求。两条线路都不开放书架写入。会话档位沿用目录，不覆盖部署者的思考策略。

### 通义千问 / Qwen — [10 行证据](../tests/provider-routes/qwen/evidence.json)

DSH pi-ai 连接器 `0.2.2-rc.5`、pi-ai `1.3.0`；DashScope 原生连接器及 runtime/core `0.7.5`；`4f0161f39fe6`，独立审查 t27。

| 组合 | `enableThinking` | `thinkingBudget` |
| --- | --- | --- |
| CN Token Plan / `qwen3.6-flash` | 已有：会话 off/high 发 `enable_thinking=false/true` | 不支持：该随包映射不发送预算 |
| CN Token Plan / `qwen3.8-max` | 不支持二态选择：没有 off，不能把省略档位当作可选的关闭 | 不支持：此映射不发送预算 |
| 同名中转 `qwen3.6-flash` | 缺口：同名的 OpenAI/Qwen 请求格式不同 | 缺口：显式声明字段能序列化，未证明真实中转、单位或范围 |
| 原生 DashScope / `qwen-plus` | 缺口：发现结果无逐字段能力，按次策略可覆盖设置 | 缺口：表单可给出数字，但模型/单次覆盖会改变有效预算 |
| 原生 DashScope / `Qwen3-235B-A22B-Thinking-2507` 固定检查点 | 关闭不支持：发布者定版模型卡声明仅思考，能序列化 false 不是能力证明 | 缺口：固定思考不等于预算固定或可调，缺部署范围及有效值证明 |

### Kimi — [8 行证据](../tests/provider-routes/kimi/evidence.json)

DSH pi-ai 连接器 `0.2.2-rc.5`、pi-ai `1.3.0`、OpenAI SDK `7.19.0`；订阅连接器 `1.5.1`；`8cba86f`，独立审查 t29。

- **`moonshotai`、`moonshotai-cn` 分别核对**：`kimi-k2.6` 思考模式已有，会话 off/high 切换请求的 `thinking.type`；`kimi-k2.7-code` 不支持关闭，显式 off 在发送前被拒。省略交给默认，不是关闭。
- **`opencode/kimi-k2.6`** 的官方思考偏好是缺口：同名、同字段不证明共享所有者。**`moonshotai/kimi-k2.6`** 的连接器思考默认值也是缺口：写入会影响整条线路，不能冒充本模型开关。
- **`kimi-subscription/kimi-for-coding`**（K2.8 Preview）有强度档却没有 off；**`kimi-for-coding-highspeed`**（K2.7 Code Highspeed）固定思考、无可选档。两条订阅变体均不支持二态开关；这些断言未使用真实订阅登录。

### 智谱 GLM — [12 行证据](../tests/provider-routes/glm/evidence.json)

DSH pi-ai 连接器与 LLM `0.2.2-rc.5`、pi-ai `1.3.0`、OpenAI SDK `7.19.0`；`d963e22aa153`，独立审查 t31。

- **`zai/glm-5.2`、`zai-coding-cn/glm-4.6v`** 各三项：开启、关闭均由已有会话档实现；选 high 发 `thinking.type=enabled`，选 off 发 `disabled`。无会话档且无线路默认时仍发 `disabled`，所以不支持把“默认”表达为省略 `thinking`。国际组合会随 high 发 `reasoning_effort`，CN 组合不发。
- **`zai/glm-5.3`** 不支持显式 off，即便无默认档的请求也能出现 `disabled`。**`opencode-go/glm-5.2`** 不支持该智谱格式开关。**`zai/glm-5.2 (reasoningEfforts=false)`** 夹具隐藏能力后不支持选开关，此时请求确实省略字段；三项都是指定组合的反例。
- **`zai`、`zai-coding-cn`** 两条共享思考偏好均为缺口：缺独立模式读写入口，整条线路的默认强度不等价。未绑定所有者的 **`zhipuai` 标准 API / 自定义 profile** 同样是缺口：缺实际连接器、模型声明和请求，未用别的网关代证。

## WorkBuddy：保留项，单列回归

WorkBuddy **不计入八组，也不算新增功能**。保持[既有档位探测与容量选择](../README.md#L163-L165)：无已声明档位时可按连接器能力就地探测；逐模型容量仅在连接器声明相应能力时出现，不固定为某个容量。沿用[原探测测试](../tests/workbuddy-probe.test.mjs)。本次汇合没有重新验收真实账号、容量切换或桌面回归。

## 如何复核

从仓库根目录核对清单，无需连接器、包缓存或凭据；[覆盖断言](../tests/provider-coverage.test.mjs)检查八组、每个变体/字段的分类、重复/遗漏、七份矩阵的原始证据以及 Codex 证据来源：

```sh
node --test tests/provider-coverage.test.mjs
```

以下是前序独立核对的**复跑入口**，不是说本次汇合重新运行了全部专线。需已有测试依赖及各夹具校验过的固定归档；Qwen 原生与 Kimi 订阅另有专线归档。缺材料不算通过，不使用日常配置、真实凭据或在线推理来补证据。

```sh
node tests/provider-options/codex-roundtrip.mjs --offline
node --test tests/provider-routes/openai-api/contract.test.mjs
node --test tests/provider-routes/claude/contract.test.mjs
node --test tests/provider-routes/gemini/contract.test.mjs
node --test tests/provider-routes/deepseek/contract.test.mjs
node --test tests/provider-routes/qwen/contract.test.mjs
node --test tests/provider-routes/kimi/contract.test.mjs
node --test tests/provider-routes/glm/contract.test.mjs
```
