# 服务商选项：哪些能调，哪些不能据此开放

在本次核对的版本中，书架新增可保存的服务商偏好只有 **Codex 订阅的回答详略、推理摘要、响应速度**。在普通会话中打开当前模型的选择面板，找到「服务商选项」。改选或点「恢复默认」只是草稿，点该行的「保存」才写入；取消或关闭不写。三项都是连接器的共享默认值。其他七组没有新增写入口；已有的会话思考档位继续用原选择器。

## 怎样读证据

[逐项总表](../tests/provider-options/coverage.json)用 `route + variant + field` 标识一行。`route` 是调查分组，不是运行时识别规则；同名模型、同一协议、有一张可写表单，都不能单独授权书架修改实际发送请求的实例。八组共 **65 行**，其中七条专线的 62 行来自各自独立审查后的矩阵。

| 分类 | 行数 | 能得出的结论 |
| --- | ---: | --- |
| 已验证 `verified` | 3 | 书架保存单字段，重开从所有者读回，下一条真实连接器构造的请求随之改变。证据止于本地传输边界。 |
| 原已有 `builtin` | 15 | 当前模型的目录与会话档位已经提供此效果。不另加控件，也不算新增功能。 |
| 限定不支持 `unsupported` | 20 | 证据指向**表中这一版本、模型、协议或配置**不提供该项语义；不代表整个厂商、其他协议或未来版本。 |
| 缺口 `gap` | 27 | 不能证明所有者、窄写入口、模型能力或实际效果中的一环。每行写明缺哪一环；不以“没看到”代替否定证据。 |

每行保留固定包版本（`packagePin`）、出处（`source`）、实例归属（`ownerProof`）、可写入口或限制（`writeSurface`）、复跑命令及观察（`requestProof`）和分类理由（`reason`）。下文的「缺口」「不支持」均按上述范围理解，不是线上推理结论。

## Codex 订阅：三项已验证偏好

固定组合：`openai-codex`、DSH `0.2.2-rc.5`、`dsh-codex-subscription@3.2.28`、pi-ai `1.3.0`（[归档校验值](../tests/provider-options/pins.json#L89)）。详略、摘要的书架提交 `61aed96623bc15fec46eaca9060296aa1f9195cf`；t5 实施，t6 独立复现，t7 独立审查。 速度的目录来源由 t32 核对，书架到请求的闭环在 t11 验证。

| 偏好 | 适用条件和可选值 | 已观察到的下一请求 |
| --- | --- | --- |
| 回答详略 `outputVerbosity` | 精确模型在连接器公布的 `verbosityModels` 内。`default / low / medium / high`；恢复默认跟随模型。 | 保存 `low` 后 `text.verbosity=low`；重置 `default` 后取夹具模型默认 `high`，不是所有模型都固定发 high。 |
| 推理摘要 `reasoningSummary` | 当前书架仅对已验证的 `gpt-5.4` 低/中/高档或其声明的中档默认开放；必须走订阅线路且请求生成 `reasoning`。`auto / concise / detailed / none`。 | 两个显式摘要分别写入 `reasoning.summary`；`auto` 保留构造器原值；`none` 移除摘要，不移除推理强度。非推理模型无 `reasoning`。 |
| 响应速度 `speedMode` | 标准、快速、极速（Beta）；只显示当前账号目录对本模型声明的加速档。 | 快速发 `service_tier=priority`，极速发 `ultrafast`，恢复标准后省略该键。 |

书架通过[连接器偏好接口](../src/codex-options.js)读取，保存前复核，只发单字段补丁并独立重读。遇到冲突或未确认，请点「重新读取服务商选项」确认当前值（其他未保存的草稿会丢弃）。更新回执不明确时，即使独立重读看到了目标值，也不会声称本次保存成功或自动重试；「已保存，当前实例尚未同步」不代表当前实例已采用。隔离 profile 的[书架操作](../tests/provider-options/exercise.mjs)有 12 次保存并重开（详略 2、摘要 4、速度 6），[本地传输](../tests/provider-options/local-transport.mjs)截获 31 条最终 SDK 请求；同名 API 零订阅 RPC，零供应商连接。不是日常桌面或线上推理验收。

### 响应速度：哪些档会出现？

书架不根据模型名猜速度。它核对完整 `openai-codex` 路由、唯一启用模型与可写的内联偏好，并要求连接器报告当前账号目录已刷新成功（`online/ok`）。在 3.2.28 中，[目录与能力元数据来自同一批模型](<https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/model-catalog.js#L368-L379>)；当前模型还必须分别出现在[快速或极速列表](<https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/index.js#L329-L336>)。仅有一个加速档时，只提供该档和标准；无档、只含未知档、仅有缓存或缺能力信息，都不显示速度控件。

**用量提示：快速可能增加 Credits 消耗；极速（Beta）可能更快用完订阅额度和 Credits。** 保存的是当前连接器的共享偏好。如果换到只支持快速的模型，而共享值是极速，普通请求使用标准速度；书架显示原共享值，不改成快速或标准。只有主动保存才会修改其他会话使用的默认值。

[隔离用例](../tests/provider-options/exercise.mjs#L17-L74)对双档模型保存快速、极速、标准，并在两个单档模型保存适用档或重置。六次均重开读回，检查下一条普通请求的 `service_tier` 和不变的 `text`、`reasoning`。另有无档、未知档和不适用共享值的反例。草稿打开后，独立测试客户端刷新真实连接器目录并撤掉所选档，书架只复核状态，零补丁。[固定请求分支](<https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/pi-ai-runtime.js#L156-L190>)不保证供应商实际接受、加速、收费或特定套餐资格。

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

## WorkBuddy：已有功能，单列回归

WorkBuddy 不计入八组。未声明思考档位时，用户可以确认后请求连接器探测；容量只列出连接器为该模型声明的值，选择「服务商默认」解除容量固定。未打 CTXPATCH 补丁时不显示容量选项。两者都不是 Codex 偏好。

在[浏览器夹具](../tests/browser.mjs)中，打开或取消探测没有写入。主动确认探测、设置 1M、恢复容量默认，合计恰好三次 POST，全部到 WorkBuddy 自己的路由，订阅选项 RPC 为零。对同一个 Codex 目标，子代理没有选模、WorkBuddy 请求或选项 RPC，切回普通会话才有一次偏好读取。本次没有登录 WorkBuddy，也没有对真实账号做容量切换或付费探测。

## 本次验证与复跑

以下是 2026-11-27 在 Windows、Node 24.21.0、npm 11.19.0、Edge 158.0.4370.33 下从仓库根目录复跑的开发验收结果。需要已有测试依赖、浏览器和按固定版本校验的归档；[隔离夹具说明](../tests/provider-options/README.md)区分准备缓存与离线执行。未安装、未发布本开发版。

| 命令 | 退出码 | 观察结果 |
| --- | ---: | --- |
| `npm run build` | 0 | 重建的客户端与本轮输入字节相同。 |
| `npm test` | 0 | 完整 Node 套件 289/289，0 跳过；包含下述历史发布检查的正反对照。 |
| `npm run test:browser` | 0 | 48 项，未捕获页面错误 0；使用合成目录和 WorkBuddy 路由。 |
| `node tests/provider-options/codex-roundtrip.mjs --offline` | 0 | 三个字段、12 次保存并重开、31 条本地序列化请求，供应商连接 0。包括同名 API、撤档、冲突与读回失败。 |
| `node --test tests/codex-options.test.mjs tests/provider-option-panel.test.mjs tests/workbuddy-probe.test.mjs` | 0 | 权限、单字段补丁、读回、过期草稿、速度分档和 WorkBuddy 等专项 62/62，0 跳过。 |
| `node tests/host-inventory/run-contracts.mjs --offline 0.0.1-rc.5 0.2.2-rc.5` | 0 | 两端均实际加载官方组件，结果均为 `package-contract`；同名不同线路正确切换，拒绝后保留原模型，子代理无选模请求；停用或缺必要能力后原生菜单可打开。 |
| `node --test tests/provider-options/host-fallback.mjs` | 0 | 两端各 1 项、0 跳过：缺可选服务仍能选模、固定 low、对同一模型明确恢复默认（请求不含强度）；退让后均仅一个原生入口。 |
| `npm pack --dry-run --json --ignore-scripts` | 0 | 干跑清单 93 个文件，没有打包依赖；没有生成或安装交付归档。 |

### 为什么开发验收通过，发布预检仍拒绝

首次 `npm test` 退出 **1**（285/287，2 失败，0 跳过）：打包预检和包外桌面回执的两个正例，错把开发客户端当作已发布的 1.6.0。修复的是[测试输入](../tests/release-check.test.mjs)，没有放宽[发布检查](../scripts/check-release.mjs)。现在在临时目录用固定的 1.6.0 文件运行当前检查脚本；包外回执是测试样本，不是真实桌面验收。专项 `node --test tests/release-check.test.mjs` 为 12/12、0 跳过：同一归档和回执原先可通过，只改候选客户端一个字节就因哈希不符被拒绝。

复跑 `npm test` 须有支持 `--no-lazy-fetch` 的 Git，且本地对象库中已有提交 `a73633645e67155564736a738dc10412c165bd97`（v1.6.0）和所需文件。测试只读这些对象，另验旧客户端 SHA-256 `2194c0c72775533d1f109ca2e53455fb48d10f39b4001d8d53d39d7922304f00`。仅解压本包不提供历史对象；实测对象库不可用时，测试点名缺失输入、退出 1，不跳过、不联网补取。

在**实际开发工作树**直接运行 `node scripts/check-release.mjs` 仍退出 **1**，唯一原因是开发客户端 `15b891e3a940d2dcc6acaf23a706db0957e6788c8ece4ca6780ec2e74ab5dd96` 与旧候选不符。未改发布哈希、旧回执或版本号。两个官方宿主样本都未启动完整桌面；本次没有线上推理、没有取得新发行凭据或发布授权。

### 七条专线均另行执行

`npm test` 的顶层匹配不含嵌套专线；下列命令逐一重跑，均退出 0、无跳过、无供应商连接。这里统计的是固定连接器在本地构造的请求，不是七条线路新增了可保存设置。

| 专线 | 单独运行的契约 | 通过/总数 | 本地请求数 |
| --- | --- | ---: | ---: |
| OpenAI API | `node --test tests/provider-routes/openai-api/contract.test.mjs` | 3/3 | 15 |
| Claude | `node --test tests/provider-routes/claude/contract.test.mjs` | 2/2 | 26 |
| Gemini | `node --test tests/provider-routes/gemini/contract.test.mjs` | 8/8 | 14 |
| DeepSeek | `node --test tests/provider-routes/deepseek/contract.test.mjs` | 4/4 | 18 |
| Qwen | `node --test tests/provider-routes/qwen/contract.test.mjs` | 7/7 | 14 |
| Kimi | `node --test tests/provider-routes/kimi/contract.test.mjs` | 2/2 | 17 |
| GLM | `node --test tests/provider-routes/glm/contract.test.mjs` | 2/2 | 15 |

[包成员回归](../tests/provider-coverage.test.mjs)核对 npm 实际列出的[客户端](../lib/client.js)、本文、总表、固定归档清单、隔离辅助模块、选项与宿主测试，以及七条专线各自的契约和证据矩阵。不含厂商源码包、凭据、捕获数据、缓存或临时 profile。冷缓存需先按[Codex](../tests/provider-options/README.md)、[Qwen](../tests/provider-routes/qwen/contract.test.mjs#L1-L8) 和 [Kimi](../tests/provider-routes/kimi/contract.test.mjs#L1-L6) 的说明另行准备公开归档；宿主样本使用自己的[固定版本与校验值](../tests/host-inventory/matrix.json)。[DeepSeek 专线](../tests/provider-routes/deepseek/contract.test.mjs#L44-L63)另需固定版本的本地依赖树（`DSH_DEEPSEEK_TEST_PACKAGES`）或现有官方安装的程序文件，不使用其 profile。本次离线复跑未下载归档。
