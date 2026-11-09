# 图标来源和使用边界

图标表示目录标签，不验证实际端点、上游身份或合作关系。Lobe Icons 静态 PNG 包 [1.97.0](https://unpkg.com/@lobehub/icons-static-png@1.97.0/package.json) 声明 MIT；完整项目许可随包保存在 `src/assets/LOBE-ICONS-LICENSE.txt`。品牌及其标志归各自权利人所有，项目许可不等于全部商标权授权。

`src/catalog-icons.js` 中的 OpenAI、DeepSeek 和 Qwen 型号标识是 2026-11-01 读取的 [Cline 公开模型目录](https://api.cline.bot/api/v1/models)快照，用于精确匹配；它不是用户本机目录的导出，也不证明实际调用方或上游身份。

| 标识 | 模式 | 固定来源 | SHA-256（原始 PNG） |
| --- | --- | --- | --- |
| DeepSeek | 本地预置 | [deepseek-color.png](https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/deepseek-color.png) | `f98596fd7802ca0c5290c498fec578fa823988646332ee36c43b7920dc4936eb` |
| OpenAI | 本地预置 | [openai.png](https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/openai.png) | `8a33312f6bb17c1edddf8f9d7fbac09ce1d1d697d6601f37227afa879e94c52e` |
| Cline | 本地预置 | [cline.png](https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/cline.png) | `129a9431855f4fd24321ae0ef9b393b85d13ac62c755715d1bf2be0064d42df3` |
| Qwen | 本地预置 | [qwen-color.png](https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/qwen-color.png) | `de9bc7e285164e0d284a7b9555511c7f7767af7699d6272b3b67b376eeddbfb3` |
| Qoder | 本地预置 | [qoder-color.png](https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/qoder-color.png) | `707778741a50bac7bf8d8153b466f04a23fd404b5d8d1e5cfdb01b2a76a66196` |
| TRAE | 本地预置 | [trae-color.png](https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/trae-color.png) | `d768c1a9bb9cc20453243feceb1b47072c392fa0696104133f79e59279c98bd6` |
| OpenRouter | 用户开启后按需下载 | [openrouter.png](https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/openrouter.png) | 固定版本下载，具体字节经格式及大小验证 |
| Hugging Face | 用户开启后按需下载 | [huggingface-color.png](https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/huggingface-color.png) | 固定版本下载，具体字节经格式及大小验证 |

Qwen、Qoder 和 TRAE 素材来自以上固定版本的 Lobe Icons。Lobe MIT 对其许可覆盖作品明确允许复制及分发，完整许可已随包提供；这不外推为全部第三方商标权许可。未找到针对本插件的单独授权，不等于已认定禁止或侵权。官方条款中的书面同意要求、合同及地区适用范围与独立指称性使用应分别判断；不要求六个品牌一律满足同一个书面授权条件。仅作目录标识，不表示认证、合作或实际服务来源。详见[2026-11-09 分发依据研究](research/2026-11-09-retained-brand-distribution.md)。

DeepSeek 官方要求实际接入其模型或 API；既往 OpenAI 指引摘要涉及服务关联和不得暗示背书，但本轮现行全文因人工验证尚未读全，不能把旧摘要当作已完成现行核实；[Cline 品牌页面](https://cline.bot/brand)提供图标及品牌素材；OpenRouter 和 Hugging Face 提供品牌资源并要求恰当使用。目录 ID 不保证实际连接对象，插件不验证上游；使用者和后续分发者应核对具体使用场景及规则。Anthropic 官方商标指南要求事先授权和材料批准，WorkBuddy 的公开素材指引仅明确分享入口，本版均不预置或下载其品牌图形。参考[品牌条件研究](research/2026-11-01-brand-icon-permissions.md)，该文关于本版未含品牌素材的旧现场描述仅为历史。

实际目录还包括 CodeBuddy、MiniMax 和 Kimi。CodeBuddy 所属服务的[服务条款](https://staging-codebuddy.tencent.com/document/term)要求取得腾讯标识的事先书面同意；[MiniMax 品牌指南](https://www.minimax.cn/brand-vi)要求未特别覆盖的使用场景事先审查批准；[Kimi 标志条款](https://www.kimi.ai/policies/logo-usage-terms)将素材授权限定于特定用途。这些来源不能确认当前插件公开分发用途的许可，因此本候选继续使用默认图标；该记录不是对所有其他品牌的完整核查。
