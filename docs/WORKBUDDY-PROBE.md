# 与 dsh-workbuddy-connect 的跨插件契约（1.2.0）

本文说明模型书架为什么、以及如何向另一个插件要“思考强度档位”，以及对方变化时本插件会怎样。实现见 [`src/workbuddy-probe.js`](../src/workbuddy-probe.js)。

## 为什么需要另一个插件

DSH 的思考强度来自模型目录：目录里声明了 `thinkingLevelMap`，模型面板才有档位可选。

WorkBuddy 线路的 `deepseek-v4.1-*` 这类模型**不声明档位**——上游只给 `{effort, summary}` 形状的行，档位集合是客户端知识，目录带不出来。`dsh-workbuddy-connect` 因此提供了一次“探测”：用极小的请求逐档试，验证哪些拼写被上游接受，把结论记在本地，并在目录里以 `supportedEfforts` 的形式发布出来（声明集合永远优先，探测只补空缺；`non-validating` 的结论一律不发布，因为上游对任意值都应答）。

于是就有了那条割裂的链路：**档位在这里选，能不能测出来却要在那里点**。1.2.0 把“探测”这个动作搬进了模型书架。

## 用到的是路由，不是文件

模型书架**不读取** `~/.dsh/.workbuddy-ai-probe.json` 之类的私有记录文件。读文件看似更简单，但会绕过对方的三件事：指纹失效判定、账号隔离、以及“声明优先”的优先级；文件格式也不是对外契约。

实际使用的是对方**为自己的浏览器端挂载的两个同源路由**：

| 方法与路径 | 用途 | 是否改变状态 |
| --- | --- | --- |
| `GET /plugins/dsh-workbuddy-connect/status`（国际版为 `/ai/status`） | 读取 `probe.candidates`（哪些模型需要检测）、`probe.results`（已检测结论）、各模型的容量与本次进程的 `probeKey` | 否 |
| `POST /plugins/dsh-workbuddy-connect/probe`（国际版为 `/ai/probe`） | `{"action":"probe","model":"<id>"}` 请求一次检测；`{"action":"set-model-context-window","model":"<id>","contextWindow":<正整数或 null>}` 固定或解除该模型的上下文容量（后者需要 CTXPATCH） | 是 |

两条路由都由对方把守：`Host`/`Origin` 必须是环回地址，探测路由还要求 `X-WorkBuddy-Probe-Key` 等于本次进程随机生成的密钥（密钥只随状态文档下发）。模型书架是**同源页面**，因此天然满足这些条件；它不绕过、也不削弱任何一道校验，探测请求的组装、上游调用、限流与记账全部由对方在宿主侧完成。

模型书架只做两件附加判断：当前模型确实没有声明档位，以及用户点过确认。

## 行为契约

| 对方的状态 | 模型书架的表现 |
| --- | --- |
| 未安装 / 已禁用 / 路由 404 | 不显示任何检测入口，其余功能不受影响 |
| 已登录但该模型不在 `candidates` | 不显示入口（该模型的档位要么已声明，要么无需检测） |
| 在 `candidates`，尚无结论 | 显示「该模型未声明思考强度，可由 WorkBuddy 检测」+「检测思考强度」 |
| 结论 `validating` | 就地出现档位下拉，旁标「已探测」；目录尚未刷新时显示「已探测到档位：…（模型面板尚未更新）」+「刷新档位」 |
| 结论 `non-validating` | 说明“上游接受任意档位取值，因此不提供档位选择” |
| 未登录 | 该模型无可用档位时提示「WorkBuddy 未登录，无法检测该模型的思考强度」 |
| 响应不是状态文档（代理页、空体、数组等） | 与“未安装”同样处理：静默降级 |

失败一律降级为“没有这项功能”，不会抛异常、不会阻塞面板、不会显示半个控件。文档格式按字段逐个校验后才进入 React 状态。

## 逐模型上下文容量（CTXPATCH）

思考强度之外，同一个面板还提供**每个模型自己的上下文容量**。这需要宿主侧的一处补丁，因为原版插件在这件事上只有一个全局开关。

### 原版为什么做不到

模型的容量来自它的 adapter 在 `resolveModel()` 里给出的回答，`dsh-llm` 只做校验（`INVALID_MODEL_CONTEXT`），**没有任何覆盖层**；`ctx.llm.registerAdapter()` 对同一 provider 是独占注册，重复注册抛 `DUPLICATE_ADAPTER`，所以别的插件也不能顶替它。DSH 自带的逐模型容量编辑器写的是 `llm-pi-ai` 的 provider 配置，而 WorkBuddy 是自定义 adapter + 动态目录，不在这份配置里。

插件内部唯一相关的旋钮是 `useMaximumContextWindow` 这个**变体级布尔**（而且只有国际版有）：打开后 `WorkBuddyCatalog.current()` 把整条线路的模型一起换成最大窗口。

### 补丁做了什么

独立工程 `dsh-workbuddy-connect-patch` 在四处动刀，每一处都是唯一命中的锚点替换：

1. `WorkBuddyCatalog` 增加 `contextWindowOverrides` 表与 `applyContextWindowOverride()`：覆盖值压过声明值与全局开关，被覆盖前的窗口记进 `defaultContextWindow`。
2. 新增 `WorkBuddyContextStore`：一个变体一个文件（`~/.dsh/.workbuddy-ai-context.json` / `.workbuddy-context.json`），按模型 id 存覆盖值，原子写入，损坏或版本不符即视为“没有覆盖”。
3. 控制路由新增 `set-model-context-window`：只接受正整数或 `null`，且当模型声明了容量集合时**必须落在集合内**；写盘失败如实返回 `state: "failed"`。
4. 状态文档新增 `contextWindowPatch`（补丁标识）、`contextWindowOverrides`（整张表）与每个模型行的 `supportedContextWindows`、`contextWindowOverride`。

包版本**故意保持上游的 `0.7.1`**，这样该插件自己的更新检查仍然诚实；补丁通过状态文档里的 `contextWindowPatch` 表明身份。安装脚本用 `pnpm remove` + `pnpm add --force`，避免 pnpm 复用同一版本的旧缓存。

### 模型书架这一侧

- 只有文档里出现 `contextWindowPatch` 时，`contextWindowFor()` 才返回数据；没有它，控件不出现（老宿主读到的是完全正常的面板）。
- 容量选择只列该模型**声明的**容量；当前值若不在声明集合里（例如补丁之外写入的值），作为“当前值”额外列出，不会被悄悄丢掉。
- 写成功后强制重取一次状态文档，并 `load()` 刷新目录，让新容量立刻反映到“当前生效”。

## 成本与礼貌

- 状态路由同时会去拉取额度信息，因此结果**按服务商缓存 60 秒**，打开面板不会变成轮询；探测成功后会强制刷新一次。
- 探测会向上游发送若干请求（消耗额度），所以界面上先确认再发送，取消则一个请求都不发。
- 探测结论由对方持有，模型书架不缓存、不复制、不落盘。

## 对方演进时的兼容性

- 路由是对方的**私有接口**，不承诺稳定。任一路由改名或消失时，本插件退回“未安装”的行为，不会报错。
- 状态文档只读三个字段（`status`、`probeKey`、`probe.*`），其余字段（额度、目录来源、账单）一律忽略。
- 路径按服务商 ID 写死为字面量（`workbuddy`、`workbuddy-ai`），与对方“两个变体各自持有字面量”的做法一致：共享表达式会让两半各自构建的产物有漂移空间。

## 测试

- `tests/workbuddy-probe.test.mjs`：路由解析、文档校验、状态判定、缓存 TTL、失败降级、密钥与请求体、容量行校验与 `formatCapacity`。
- `tests/browser.mjs`：用 `window.fetch` 桩模拟这两条路由，验证“候选 → 确认 → 取消不发请求 → 确认后发送 → 就地出现档位并标注来源 → 目录未刷新时的诚实提示 → 恢复服务商默认 → 逐模型固定/解除容量 → 未打补丁的宿主不显示容量控件”。
- 宿主补丁有自己的测试：`dsh-workbuddy-connect-patch/test/context-window.test.mjs` 直接 import 打补丁后的 bundle，驱动真实的目录类、存储类、动作解析器与控制路由处理器（含密钥与环回校验）。
