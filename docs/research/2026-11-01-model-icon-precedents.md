# 模型与服务商图标：开源项目先例

核查日期：2026-11-01。以下是源码可观察行为，不是权利链或法律意见；离线仅指图标资源，不代表模型推理或应用全部功能离线。

## Cherry Studio

- **展示与匹配**：[模型同步选择列表](https://github.com/CherryHQ/cherry-studio/blob/72041cd52010d19ea961dc93cf7bc1c71cc39d4e/src/renderer/pages/settings/ProviderSettings/ModelList/ModelSyncPreviewPanel.tsx) 使用 `useIcon(getModelLogoRef(model))` 渲染圆形头像，无图标时用模型名称首字母。[logo.ts](https://github.com/CherryHQ/cherry-studio/blob/72041cd52010d19ea961dc93cf7bc1c71cc39d4e/src/renderer/utils/model/logo.ts) 优先 API 模型 ID，否则取复合 ID 中的模型部分；标准化后先尝试 ID、再尝试名称；有 provider ID 时传给联合解析器。该文件并未单独证明联合解析器内部的优先级。
- **资源与离线**：仓库分别存有 [models](https://github.com/CherryHQ/cherry-studio/tree/72041cd52010d19ea961dc93cf7bc1c71cc39d4e/packages/ui/icons/models) 和 [providers](https://github.com/CherryHQ/cherry-studio/tree/72041cd52010d19ea961dc93cf7bc1c71cc39d4e/packages/ui/icons/providers) SVG，含明暗版本；本地资源具备随构建分发后离线展示的条件，未实测发布包或所有自定义图标路径。具体每个 SVG 的原始权利人和获取来源未由这些文件证明。
- **许可**：[仓库 LICENSE](https://github.com/CherryHQ/cherry-studio/blob/72041cd52010d19ea961dc93cf7bc1c71cc39d4e/LICENSE) 为 AGPL-3.0 文本；这不是各第三方品牌商标的授权证明。本次查看的上述图标文件和许可文本未确认逐项商标授权或单独免责声明，不代表不存在。

## Lobe Icons（LobeHub 的模型/服务商图标库）

- **展示与匹配**：[README](https://github.com/lobehub/lobe-icons/blob/8b7bbc433d38437fa2b0cca58ae896917162b812/README.md) 展示 `ModelIcon model="gpt-4o"` 与 provider ID 接口。以有源码证据的 React Native 实现为例：[ModelIcon](https://github.com/lobehub/lobe-icons/blob/8b7bbc433d38437fa2b0cca58ae896917162b812/packages/react-native/src/features/ModelIcon/index.tsx) 将 ID 小写，按 [modelConfig](https://github.com/lobehub/lobe-icons/blob/8b7bbc433d38437fa2b0cca58ae896917162b812/packages/react-native/src/features/modelConfig.ts) 的关键词正则顺序取首个匹配，无命中使用默认图标；例如 Claude、Gemini、DeepSeek。相对地，[ProviderIcon](https://github.com/lobehub/lobe-icons/blob/8b7bbc433d38437fa2b0cca58ae896917162b812/packages/react-native/src/features/ProviderIcon/index.tsx) 按关键词忽略大小写精确匹配，不命中回退。这里不能以 RN 实现代称 LobeChat 当前选择器行为。
- **资源与离线**：[静态 SVG 包说明](https://github.com/lobehub/lobe-icons/blob/8b7bbc433d38437fa2b0cca58ae896917162b812/packages/static-svg/README.md) 提供 npm 静态 SVG/PNG/WebP 和 unpkg CDN 示例；仓库也含[具体 SVG](https://github.com/lobehub/lobe-icons/blob/8b7bbc433d38437fa2b0cca58ae896917162b812/packages/static-svg/icons/openai.svg)。资源预先随应用打包或本地部署可离线；运行时直接引用 CDN 则依赖网络或缓存，未做离线实测。
- **许可**：[LICENSE](https://github.com/lobehub/lobe-icons/blob/8b7bbc433d38437fa2b0cca58ae896917162b812/LICENSE) 声明 MIT，要求在副本或实质部分保留版权及许可声明，并含不侵权等保证的免责声明。此为项目许可声明，不能据此推定第三方标识权利人授权、LobeHub 已取得授权或 DSH 获得商标使用权；本次所查文件未发现逐品牌授权证明或专项商标免责声明。

## Open WebUI

- **展示与匹配**：[选择器](https://github.com/open-webui/open-webui/blob/f7ac7ee10962ddec0017f5c29b6740d9b9c5faca/src/lib/components/chat/ModelSelector/Selector.svelte) 渲染 [ModelItem](https://github.com/open-webui/open-webui/blob/f7ac7ee10962ddec0017f5c29b6740d9b9c5faca/src/lib/components/chat/ModelSelector/ModelItem.svelte)：图片请求本实例 `/models/model/profile/image?id=...&lang=...`，加载失败回退 `/favicon.png`。这里的匹配是按模型 ID 请求头像，并非已证明按品牌名自动匹配。官方[模型文档](https://github.com/open-webui/docs/blob/main/docs/features/workspace/models.md)说明可上传自定义模型头像；未追踪该端点所有默认图片来源和服务商图标路径。
- **离线与许可**：实例本地头像和 favicon 若由本地服务提供，图标请求无需外网；外部来源、首次加载及实际部署尚未验证。[当前 LICENSE](https://github.com/open-webui/open-webui/blob/f7ac7ee10962ddec0017f5c29b6740d9b9c5faca/LICENSE) 为 Open WebUI License，包含品牌保留条件和例外，另指向历史许可；不能笼统当成 MIT。`ModelItem` 注释特别指明回退 logo 受该许可约束。此许可不是其他厂商标识的授权。

## 对 DSH 的边界

把模型身份与接入服务商分开；显式映射优先于名称启发式，未知时用中性首字母/通用图标，避免错误归属。若分发品牌图片，应逐项核对原始来源、版权、商标政策及适用场景并保留证据；开源许可、对方实际展示、署名或免责声明均不能单独证明商标授权。授权不明时不将图标使用视为已获许可。
