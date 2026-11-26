# Gemini：目录档位和数值预算不是同一项

本合同只覆盖 DSH pi-ai 的原生 Google Generative AI（provider `google`）及 Vertex（`google-vertex`，API key 模式）。每条协议都使用发布目录里的两个确切模型，不覆盖模型、协议、地址或推理能力。逐项结论和源码行号见[证据表](./evidence.json)。

| 目录模型 | 目录档位在实际请求中的含义 | 书架处理 |
| --- | --- | --- |
| `gemini-2.5-flash` | low、medium 映射为 `thinkingBudget`；没有 `thinkingLevel`。 | 保留档位。数值是供应商配置中每个档位的默认预算，不是会话输入；无法确认配置与活动适配器属于同一实例，不提供数字框。 |
| `gemini-3.1-pro-preview` | 目录有 low、medium、high；实测 low/high 分别发送 `thinkingLevel: LOW/HIGH`，忽略数值预算。 | 现有档位已可调等级，不再造下拉框。 |

**复跑**（仓库根目录，实测 Node 24.21.0）：

```sh
node --test tests/provider-routes/gemini/contract.test.mjs
```

需要已有测试依赖及[固定归档](../../provider-options/pins.json#L48-L61)。若缓存为空，另行在允许访问 npm 公共注册表的环境执行 `node tests/provider-options/codex-roundtrip.mjs --prepare`；此模式仅准备归档，不安装包，不运行 Codex 或 Gemini。离线命令不下载、不跳过：缺包或 SHA-512 不符即失败。每次解包到独立临时目录，使用空 HOME/DSH_HOME 和占位 key；不需要账号、浏览器或端口。

[夹具](./exercise.mjs)运行已发布的 SettingsForms、LlmRuntime、PiAiAdapter 和 Google SDK。配置文件的持久化用内存替代；[传输边界](./transport.mjs)拒绝 socket，在最终 Fetch 截获 SDK 已序列化的 POST，核对协议对应的目标和模型路径，只记录 `generationConfig.thinkingConfig` 并返回本地 SSE。

**为什么写后读回不够：** 同一实例持有表单和线路时，调整 low 让下一次 2.5 Flash 请求从 2048 变到 4096。换成另一个实际 PiAiAdapter 持有同名线路，保持唯一的配置目录项、设置路径、活动供应商行、模型与档位不变，表单读回 6144，请求却仍为 3072。revision 校验能防止写旧表单，不能证明这张表单属于活动线路。

这验证了指定版本的本地请求构造，不是线上推理，也不是新书架控件的保存验收。不外推其他 Gemini 型号、模型覆盖、兼容网关、Vertex ADC 或未测试的档位。
