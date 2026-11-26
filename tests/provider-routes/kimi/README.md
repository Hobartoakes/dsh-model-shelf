# Kimi 思考模式：哪些已经能选，哪些不能加开关

**这组固定版本没有新增书架设置。** Moonshot 的 `kimi-k2.6`（国际与中国站）已可用[现有会话档位](../../../src/client.js#L525-L549)切换思考；同线路的 `kimi-k2.7-code` 则不接受 `off`。两者共享路线默认值：在测试配置中把 `reasoning` 设为 `off`，会让后一模型在未指定会话档位时直接报错。它不是单模型开关。

[八行证据](./evidence.json)按模型列出所有者、配置范围、序列化结果与缺口。另有两种不能借用的接口：

- OpenCode 提供同名 `kimi-k2.6`，甚至发出同样的 `thinking.type`；它的[目录条目](https://unpkg.com/@earendil-works/pi-ai@1.3.0/dist/providers/data/opencode.json)、请求目的地和设置路径都是另一条线路。
- [Kimi 订阅连接器](https://github.com/BaronCyrus/dsh-kimi-subscription/blob/1e0164815c9af0ba429a59549ba3b033df2dd01f/src/pi-ai-runtime.js#L74-L130)中，普通 Code 能调 low/high/max，不能关闭；Highspeed 是固定思考，没有可选档位。[订阅偏好 RPC](https://github.com/BaronCyrus/dsh-kimi-subscription/blob/1e0164815c9af0ba429a59549ba3b033df2dd01f/src/login-coordinator.js#L192-L225)只管理搜索服务商。省略思考字段不等于关闭思考。

## 复跑

从仓库根目录执行。已有项目开发依赖即可；不安装连接器。首次准备所需的公开归档，缓存已存在时可略过。前一条复用 Codex 验证的[宿主版本与完整性清单](../../provider-options/pins.json)，后一条只缓存 Kimi 订阅 1.5.1 的[公开发布包](https://registry.npmjs.org/dsh-kimi-subscription/1.5.1)。

```sh
node tests/provider-options/codex-roundtrip.mjs --prepare
node tests/provider-routes/kimi/fixture.mjs --prepare
```

离线验证（缺包或 SHA-512 不符即失败，不跳过、不自动下载）：

```sh
node --test tests/provider-routes/kimi/contract.test.mjs
```

[测试](./contract.test.mjs)给子进程单独的临时目录、白名单环境和合成凭据；每次从校验过的归档加载真实连接器。[探针](./probe.mjs)用实际目录和请求构造器，在 Fetch 边界读取已经序列化的请求，拒绝 socket。通用线路走已注册的 DSH PiAiAdapter，订阅线路直接走订阅包的公开 provider 工厂，不启动认证或搜索服务。没有持久化设置、登录、书架保存/读回或供应商推理验收，因而没有 `verified` 项。
