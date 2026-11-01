# 离线品牌图标分发：官方公开条件研究

> 本文为此前 Lobe 图标原型的历史研究。当前候选包已移除这些品牌 SVG，均回退默认图标。Anthropic 官方商标指南要求事先许可及材料批准：https://www.anthropic.com/legal/trademark-guidelines 。

调查日期：2026-11-01（Asia/Shanghai）。范围：第三方模型书架把官方原图随源码或 npm 包分发，并在服务商或模型列表中离线显示；不包含改实现。本记录仅整理公开一手材料和工程判断，不是法律意见或法律结论。页面可能更新；发布前重查，并以实际协议、主体、地域和权利人书面答复为准。

## 结论与实际应用

| 品牌 | 可确认的公开材料 | 对本场景的工程判断 |
| --- | --- | --- |
| DeepSeek | 官方素材供使用或分发其模型/API 的开发者使用，明确要求实际接入；可因不合规范撤销。 | **有条件的候选**：先核实实际集成、素材、展示语境与分发链。公开规范没有明确逐项讨论插件离线打包、向安装者再分发及其后续再分发，不能把它视作全部问题已经解决。 |
| OpenAI | 官方品牌页面列出许可及显示条件：非独占、不可转让、可终止，并限定与 OpenAI 服务直接相关。 | **有条件但离线再分发未确认**：不能简单称必须每次申请，也不能从显示许可直接推断打包及下游分发权限；就具体素材、发行渠道、最终用户显示、不可转让和撤销后的处理询问官方。 |
| Claude / Anthropic | Anthropic 运营的 claude.dev 网站条款明确不授予其名称及标识的使用权，站点其他内容亦未开放任意复制。 | **现有证据不足**：不要依该站点条款打包；申请对指定文件、分发和列表展示的许可，或找到适用于该资源的更具体官方授权。该网站条款并不证明所有其他 Anthropic 授权都不存在。 |
| WorkBuddy | 官方第三方接入指南只在分享能力直接相关入口使用规定素材；国际版服务协议对其定义的腾讯标识有书面同意条款。 | **此列表用途不能从分享指引确认**；联系 WorkBuddy 请求针对具体素材与离线分发的许可。国际协议有其主体、地域和服务范围，不直接断定其必然约束本项目或该图形。 |

因此，**不能仅据目前证据整体批准四种官方图标离线发布**。DeepSeek 和 OpenAI 可分别继续做条件核查，不等同于已经通过发布审查。保守备选是暂用自绘通用图形和准确文字，不暗示官方、合作或背书；文字的具体使用也应检查相关条件。

本地现场（初研之后已更新）：[package.json](../../package.json) 声明本项目 MIT 并将 `src`、`lib` 纳入发布文件；[现有归属说明](../ICON-ATTRIBUTIONS.md)列出了原型使用的 Lobe Icons 四款图标、哈希及已知条件；[图标映射](../../src/icons.js)的注释说目录标签并非经验证的上游身份。上述为工作树现状，不证明已发布版本、实际网络路由、第三方图形版权或商标授权。尤其 `deepseek-official` 字符串本身不证明实际接入。应检查具体资源与生成产物及每个真实展示位置，而不是仅看映射键。

## DeepSeek：官方素材和条件

官方规范原文：[DeepSeek 品牌素材使用规范](https://raw.githubusercontent.com/deepseek-ai/awesome-deepseek-integration/main/docs/_logo%20svg/guidelines.md)：

> 我们为使用和分发DeepSeek模型、API的开发者提供了DeepSeek官方品牌素材，方便开发者在对外提供服务中展示和使用。

> 请在 实际接入DeepSeek的模型或API 的前提下使用，不得故意虚假宣传、诱导误认与DeepSeek有合作。

> 请确保 准确、清晰、完整及美观地 使用DeepSeek的素材内容，避免使用错误、仿冒或低质的素材内容，且不得随意修改。

> 不得利用DeepSeek的素材内容，故意冒充DeepSeek官方，或通过歧义、暗示等诱导误认为是DeepSeek官方。

> 对于不符合规范的使用方，我们有权撤销使用DeepSeek品牌素材的许可。

官方 [ICON.svg](https://github.com/deepseek-ai/awesome-deepseek-integration/blob/main/docs/_logo%20svg/ICON.svg) 是可核对的候选素材，官方目录记录的 Git blob 为 `2e4650aee9fd05f4681c426cdb74ee2aeff1fb07`。仓库根 [LICENSE](https://raw.githubusercontent.com/deepseek-ai/awesome-deepseek-integration/main/LICENSE) 为 CC0 1.0，其第 4(a) 节说：

> No trademark or patent rights held by Affirmer are waived, abandoned, surrendered, licensed or otherwise affected by this document.

**版权/软件许可与商标分开**：该仓库的 CC0 文本不能替代品牌许可；对单一 SVG 是否及如何适用根许可证、专门品牌规范与根许可证的关系，以及第三方下游权利，不能仅由根 LICENSE 判定。品牌规范对使用者和实际接入设条件，也没有明确讲述仓库克隆、npm 分发、非接入用户取得包、可撤销许可与已发包之间的处理。应向 DeepSeek确认这些具体场景，保留获取日期、文件哈希和书面答复。

## OpenAI：标志许可和边界

[OpenAI Design Guidelines（官方品牌页）](https://openai.com/brand/) 的「如何使用我们的徽标」及「使用条款」显示：

> 仅在与 OpenAI 服务直接相关时使用徽标。

> 严格按照提供原样使用徽标，并确认其归 OpenAI 所有。

> 未经许可或超出 OpenAI 条款范围使用徽标。

上句位于「禁止做法」之下，并不是独立授权。页面还要求不得误导关系或背书、不得比自身品牌更显著、不得修改标志。条款原文：

> ﻿﻿我们授予的许可是非排他性的（我们也可以授予他人），且不可转让（您不得将该许可转授给他人）。

> ﻿﻿我们可随时终止标志使用许可，届时必须立即停止使用。

> 对于其他事宜，包括使用徽标的许可申请、关于本指南的疑问，或超出上述案例范围的沟通，请联系 partnercomms@openai.com⁠⁠。

这是官方中文页面在访问时所显示的文本；原始 URL 同上，站点可能按地域重定向。该页面对品牌标志提供的是有条件的标志使用规则，不是对插件源码的 MIT 授权，也不是任何官方素材的通用开源许可证。公开文字未明确说明随开源仓库、npm 及离线安装包复制或用户间再分发是否落入授权，以及不可转让如何作用于该分发链；因此向 `partnercomms@openai.com` 提交实际列表截图、文件、渠道、下游用途及撤销处理方式询问。准确标识 OpenAI 服务与仅凭自定义目录 ID 标识不是同一回事。

## Claude / Anthropic：网站内容与商标

[Anthropic 运营的 claude.dev 网站条款](https://claude.dev/terms/)明确声明其仅覆盖该站，不代替 Claude 产品协议；「Code samples」及「Other content」分别写：

> Code samples on the Site are licensed under the MIT License unless a sample says otherwise.

> All other content on the Site belongs to Anthropic or its licensors. This includes articles, images, video, and design.

> You may not otherwise copy, republish, or sell it without our written permission.

「Trademarks」写：

> “Anthropic,” “Claude,” and related names and logos are trademarks of Anthropic. These terms grant you no right to use them.

因此，网站代码样例的 MIT 许可不能推导为图片、标志或商标许可。该站点条款不是对所有其他官方资产或协议的普遍禁令；本次未找到明确覆盖本场景的另一项官方许可。若使用该站点素材或拟依赖其他来源，向页面列出的 `legal@anthropic.com` 询问文件、复制分发与实际 UI 场景；未取得可核验授权前暂不打包。

## WorkBuddy：分享入口许可范围与腾讯协议

[WorkBuddy 开放平台：第三方应用](https://open.workbuddy.cn/docs/third-party-app)「使用 WorkBuddy 品牌标识」说明：

> 接入分享能力后，你需要在自己应用内唤起分享的入口展示 WorkBuddy 标识（分享面板的分享目标项、设置页的接入标识位），让用户看清内容将发往哪里。

> 仅在与 WorkBuddy 分享能力直接相关的入口使用，不得用于你的应用图标、开屏、广告投放与对外宣传物料

> 使用品牌中心下载的官方徽标包，或 SDK 提供的标准素材；按原样使用，可等比缩放，不得拉伸、压扁、裁剪、旋转或添加阴影与特效

这份指引针对接入分享能力的开发者；服务商或模型列表不当然属于该范围。提供素材下载不等于许可任意使用或再分发。指引给出品牌中心与 `openworkbuddy@tencent.com` 联系方式，但该邮箱列于标识冲突申诉处，是否受理品牌许可需先确认。

另见 [Tencent WorkBuddy Service Agreement §9.3](https://www.workbuddy.cn/document/term#section-9)，页面标示 2026 年 8 月更新，协议 §1.1 针对 `workbuddy.ai` 服务及所列国际签约主体；其 §9.3 原文：

> Without the prior written consent of the Tencent, you shall not display, use, or otherwise dispose of the aforesaid Tencent Logos in any way, either alone or in combination, without Tencent's prior written consent.

该协议将腾讯商标等定义为 Tencent Logos，示例列出 Tencent 和 Tencent Cloud；不能仅凭该段认定 WorkBuddy 某个具体图形必然属于其定义，也不能把国际服务协议直接套用到所有中国区用途。其服务使用许可和开源组件归属分别见 §6.1 与 §16.7，均不能推出模型书架离线分发 WorkBuddy 品牌素材的权利。协议 §4.2 列 `workbuddy_ai@tencent.com` 为服务咨询联系方式；可附实际地区与场景询问，并请求转至品牌权利人。

## 发布前核对清单

1. 固定每个图标官方来源、版本/哈希、图形形式与确切使用位置；核对使用者、渠道及适用地区，勿把名称匹配当作真实接入证明。
2. 分别核对素材复制/分发权、标志展示条件及源码软件许可证；不要把本项目 MIT、模型权重许可证或示例代码许可证扩展到官方标志。明确是否覆盖源码、构建产物、npm 包、安装者离线显示及下游再分发。
3. 提供界面截图与发行计划，请各品牌方确认缩放、留白、颜色、服务关系、商业/非商业和下游范围；保留书面答复。无明确覆盖时继续用默认图标。
4. 品牌许可可变更或终止；制定发布前复核、替换和后续版本移除的流程。既有版本和副本能否处理须单独确认，不能承诺可以追回。
