# 保留六个品牌图标：公开离线分发依据复核

**决定保持 B：保留图标，先核实分发依据。本文不是发布批准。**

- 场景以本任务给定事实为准：`dsh-model-shelf 1.5.1-local.2` 随 GitHub Release tgz 分发 Lobe Icons Static PNG `1.97.0` 的 DeepSeek、OpenAI、Cline、Qwen、Qoder、TRAE 六图标，本地显示目录/模型标签，不验证真实上游、不表示背书。本轮没有重新审计插件代码或已发布 tgz。
- **访问时间：下列全部网络证据均在 2026-11-09 20:30–20:50（按分钟记录；Asia/Shanghai，UTC+08:00）重新访问；个别归档检查另记精确时间。** 动态页面以本轮浏览器实际显示语言为准。搜索只用于定位官方来源，不以搜索摘要代替规则正文。
- 两份指定旧材料已阅读，仅作待核实历史。只新建本文；不改图标、旧笔记、README 或包；未安装、发布、运行测试、读取真实 profile/受限历史目录、委派代理、联系权利人或提交表单。公开压缩包仅在浏览器内存读取，未安装或执行其内容。
- 本文是一般信息与证据整理，不是法律意见、侵权判决或法律保证。合理指称、商标性使用、合同成立及地域适用均可能需要人类法律判断。

## 1. 可决策结论

**Lobe 的 MIT 明确允许复制和分发，包括把受其许可的素材放进离线插件 tgz；它不需要逐一列举 GitHub Release 才能适用。但这只回答 Lobe 能授予的版权许可，不证明六家品牌权利已全部清理，更不自动授予商标权。**

| 品牌 | 分类：官方品牌/素材证据 | 本场景的准确结论与缺项 |
| --- | --- | --- |
| DeepSeek | **附条件＋明确限制** | 官方素材用于实际接入其模型/API 的开发者，禁止误认合作、冒充及随意修改。当前不验证上游，**未证明符合该条件**，也不能反推实际一定未接入。缺实际展示事实与条件适用判断；不是普遍要求事先书面许可。见 §3。 |
| OpenAI | **证据不可得（许可细则未完整复核）** | 官方页面前段可读，但后续抓取截断、浏览器遇验证。旧文的“直接相关、不可转让、可终止”等细则不能标成此次已核实的现行结论。缺可完整读取的现行条款及适用判断。见 §4。 |
| Cline | **明确提供素材／附展示指引；再分发授权未覆盖；服务条款有明确限制** | 品牌页及下载包不是明确的开放版权/商标再分发许可；服务条款限制未获许可的知识产权复制分发，并对暗示背书要求事先书面同意。后者不等于所有中性标签都要书面同意。缺这些文本与 Lobe 图形、独立标签场景的适用判断。见 §5。 |
| Qwen | **明确限制（事先书面同意条款）** | 现行服务协议明确把 Qwen 标识纳入事先书面同意要求；不是单纯“未找到授权”。该协议针对个人服务，是否约束本插件独立指称用途及模型品牌，仍需判断。模型开放许可不代替标志授权。见 §6。 |
| Qoder | **未覆盖＋CN 协议有明确限制** | 国际条款只授予服务访问/使用权；CN 条款对未许可相关权利要求另取书面许可。没有本插件离线品牌图形再分发的专项许可证据，但不能据此宣布全球用途均被禁止。见 §7。 |
| TRAE | **未覆盖＋CN 协议有明确限制** | 国际条款不是素材分发许可；CN 条款要求行使未明示授权权利前另取书面许可。服务合同范围与 Lobe 图形指称用途需分开判断；Trae Agent 的 MIT 不是 TRAE 商标通行证。见 §8。 |

“未覆盖/证据不可得”表示本轮材料未回答，不表示法律禁止。**没有证据支持一律索要六家书面授权；也没有证据支持“保留决定＋MIT＝全部发布门槛满足”。**

## 2. Lobe 1.97.0：复制分发许可明确，包内却没有 LICENSE 文件

**来源与原文：**

1. [npm 官方注册表该版本元数据](https://registry.npmjs.org/@lobehub%2ficons-static-png/1.97.0)：`"license":"MIT"`、`"version":"1.97.0"`、`"gitHead":"a94750e3f5f8fc33757b839d85030e742284e43a"`。[该提交的静态包清单](https://raw.githubusercontent.com/lobehub/lobe-icons/a94750e3f5f8fc33757b839d85030e742284e43a/packages/static-png/package.json)同为 `1.97.0` / MIT。
2. [实际 npm tgz](https://registry.npmjs.org/@lobehub/icons-static-png/-/icons-static-png-1.97.0.tgz)于 **20:41:18 +08:00** 在内存解压并读取归档目录：17,048,802 字节，1,814 条目；无 LICENSE、COPYING 或 NOTICE，非 PNG 条目只有包清单和 README。SHA-512 与注册表完全一致：`vyCHQJBxhk9dJxhsCQ3G6U1I4rP8HFiOgxn73IM2s1XAYHupmMJIfm80jRjd83xjM8jSI+SMGsMmjADy0qHwHg==`。[UNPKG 完整目录](https://unpkg.com/@lobehub/icons-static-png@1.97.0/?meta)亦为 1,814 条目；[LICENSE 请求](https://unpkg.com/@lobehub/icons-static-png@1.97.0/LICENSE)与 [LICENSE.md 请求](https://unpkg.com/@lobehub/icons-static-png@1.97.0/LICENSE.md)均返回 404。**不能写成“上游静态包内附完整 LICENSE”。**
3. [该包 README](https://unpkg.com/@lobehub/icons-static-png@1.97.0/README.md)写：`This project is [MIT](./LICENSE) licensed.` 完整许可可从[注册表 gitHead 对应的官方仓库 LICENSE](https://raw.githubusercontent.com/lobehub/lobe-icons/a94750e3f5f8fc33757b839d85030e742284e43a/LICENSE)重新取得：
   > Copyright (c) 2023 LobeHub
   >
   > … use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software …
   >
   > The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
   >
   > … WITHOUT WARRANTY … NONINFRINGEMENT.

**场景对应：**版权许可文本明确包含复制、发布、分发与再许可，不限定在线展示、非商业或某个发行渠道。保留完整版权及许可声明是明确条件；不应因未出现“离线插件”四字而否认这些已授予权利。反之，MIT 中没有品牌商标授权，也不保证 Lobe 对第三方原图拥有全部权利。此处“明确许可”限于许可人有权许可的作品/权利。

允许工作区的[许可副本](<../../src/assets/LOBE-ICONS-LICENSE.txt>)已读，文本与上述 MIT 一致；**未核验它是否进入每个已公开的插件 tgz**，这是一项分发材料核对，不是现已确认缺失。

**额外的准确性修正：**上述包目录的六个 PNG 完整性元数据与[历史归属表](<../ICON-ATTRIBUTIONS.md>)逐项对照，TRAE 行的历史 SHA-256 少一位；公开包元数据为 `d768c1a9bb9cc20453243feceb1b47072c392fa0696104133f79e59279c98bd6`。其余五行与元数据吻合。本轮未重新计算插件内 PNG 的哈希，不把这项对照当成已发布插件字节验证。

## 3. DeepSeek：不能用“目录标签”自动满足实际接入条件

[官方 awesome-deepseek-integration 品牌规范](https://raw.githubusercontent.com/deepseek-ai/awesome-deepseek-integration/main/docs/_logo%20svg/guidelines.md)本轮可完整读取：

> 我们为使用和分发DeepSeek模型、API的开发者提供了DeepSeek官方品牌素材……
>
> 请在 实际接入DeepSeek的模型或API 的前提下使用，不得故意虚假宣传、诱导误认与DeepSeek有合作。
>
> ……不得随意修改。
>
> 对于不符合规范的使用方，我们有权撤销使用DeepSeek品牌素材的许可。

[同仓库 CC0 LICENSE §4(a)](https://raw.githubusercontent.com/deepseek-ai/awesome-deepseek-integration/main/LICENSE)另明确：

> No trademark or patent rights … are … licensed or otherwise affected by this document.

- **版权：**Lobe MIT 与 DeepSeek 仓库 CC0 是不同许可依据；不能未经素材来源/范围核对就把 CC0 套到 Lobe PNG，但 CC0 明文排除商标的边界很清楚。
- **品牌：**官方确实给出有条件的使用许可，不是“完全没授权”。不冒充、不误导、准确完整展示与实际接入都是条件；免责声明仅处理部分误认风险，不能替代实际接入条件。
- **渠道：**规范未逐项处理 Lobe 衍生图形的离线捆绑及下游分发。没有因此产生一条可直接引用的“GitHub tgz 禁止令”。若不用此有条件许可而主张独立合理指称，须由人类判断其法律依据，本文不作裁判。

## 4. OpenAI：保留证据缺口，不沿用旧页当现行证明

[OpenAI 官方品牌页](https://openai.com/brand/)本轮 `web_fetch` 返回 HTTP 200，仅取得前段：

> The "OpenAI" name, the OpenAI logo, the "ChatGPT" and “GPT” brands, and other OpenAI trademarks, are property of OpenAI.
>
> … how to use and display our trademarks and copyrighted work in their own assets and materials.

正文之后被工具截断；浏览器访问同页出现 **Cloudflare Turnstile**，已停止重试，未绕过验证。故：

- **版权/商标：**本轮确认该页同时讨论商标和版权作品，但开头不足以确定某个 PNG 的版权授权范围；未完整重验授予条款、显示限制、终止与不可转让细则。它们在[旧研究](<2026-11-01-brand-icon-permissions.md>)中只是历史引文，不是本轮已确认的现行证据。
- **渠道：**没有可据本轮完整条文确认的 OpenAI 品牌离线再分发许可，也没有可据此断言的全面禁止。Lobe MIT 层的复制分发权仍如 §2，但不能代替 OpenAI 权利分析。
- **缺项：**待人类正常通过验证后读取完整现行页面，再判断“直接相关”如何适用于未验证上游的目录标签，以及条款是否涉及本分发链。当前不能写“OpenAI 已满足发布条件”。

## 5. Cline：提供下载不等于无限再分发许可

[官方品牌页](https://cline.bot/brand)的静态抓取只得导航；浏览器实际正文可读：

> Download official Cline brand assets and learn about our brand guidelines
>
> Use the horizontal lockup where possible. Vertical lockups, bot icons, and wordmarks are also included.
>
> Light and dark variants for product surfaces and app listings.

其[官方品牌 ZIP](https://cline.bot/assets/branding/brand/cline-brand-assets.zip)于 **20:42:25–20:42:45 +08:00** 仅在内存读取：33 条目，1,602,964 字节；唯一文字说明 README 写 `All SVG and PNG exports are generated from Source SVGs.`，未见 LICENSE 或另列的版权/商标再分发授权文本。不能把“Download”解释成禁止使用，也不能将它扩张为任意捆绑及转授权。

[官方服务条款](https://cline.bot/tos)浏览器显示 Last Modified: September 25, 2025：

- §4.2 把 `images … logos` 纳入 Intellectual Property，并写：`Use of any Intellectual Property for any purpose not expressly permitted by these Terms is strictly prohibited.` 同节列出不得未经许可 `distribute, copy, reproduce … display … publish`。
- §2.2 禁止以 `could reasonably imply … endorsement, affiliation, or sponsorship` 的方式指称服务，除非有 `prior express written consent`。
- [Cline 官方代码仓库 Apache-2.0 LICENSE §6](https://raw.githubusercontent.com/cline/cline/main/LICENSE)：`This License does not grant permission to use the trade names, trademarks, service marks, or product names …`，其描述作品来源等例外不能未经分析就变成本图形的通用许可。

**场景对应：**品牌页支持“素材供使用”的事实，但未明确解决插件离线再分发；条款也不是“任何不暗示关系的指称一律需事先书面许可”。§4.2 的服务/IP 范围、品牌页与开源许可关系，以及 Lobe PNG 的版权来源是需判断的边界；不自动宣告该中性目录标签违约或侵权，也不因代码开源而宣告品牌授权已齐。

## 6. Qwen：现行文字明确要求事先书面同意，但先判断适用范围

[官方服务协议](https://qwen.ai/termsservice)静态抓取仅为外壳，浏览器显示中文全文，**生效日期 2026-09-10**。开头限定 Qwen、Qwenstudio 及面向个人用户的相关应用/网站；主体为 Nth Power Global Tech Singapore Pte. Ltd.。第四节：

> 请您在任何情况下都不要私自使用本公司的包括“Qwen”、“Alibaba”等在内的任何商标、服务标记、商号、域名、网站名称或其他显著品牌特征等（以下统称为“标识”）。未经本公司事先书面同意，您不得将本条款前述标识以单独或结合等任何方式展示、使用，或实施其他处理该些标识的行为。

同节对服务内图片/图像等内容规定未经许可不得擅自使用与转让。[Qwen3 官方 README 的 License Agreement](https://raw.githubusercontent.com/QwenLM/Qwen3/main/README.md)写：

> All our open-weight models are licensed under Apache 2.0.

**场景对应：**模型权重的 Apache 声明不是品牌 PNG 开放许可；上述服务协议有真实的明确限制，应升级旧文的“仅未发现授权”表述。若发布主体及用途落入该标识条款且无其他有效依据，文本所要求的是事先书面同意。**但不能仅因图标名为 Qwen，就不经合同/地域/用途分析认定该协议普遍约束独立模型目录分发者，或否定依法可成立的合理指称。**缺项主要为法律适用判断，而非盲目再搜索一份模型许可证。

## 7. Qoder：国际版与 CN 不能混成同一结论

- [国际 Terms of Service](https://qoder.com/product-service)，Last updated: April 29, 2026，主体 BRIGHT ZENITH PRIVATE LIMITED。§4.1：`All rights not expressly granted to you under these Terms are reserved by us.` §4.2 仅授予 `non-transferable, non-sublicensable, and revocable right to access and use the Services`。§16.9：`Nothing in these Terms limits your rights or obligations under any applicable open source licence.`
- [Qoder CN 官方入口](https://qoder.cn/product-service)正常重定向至[官方托管的 Qoder CN 用户协议](https://terms.alicdn.com/legal-agreement/terms/c_platform_service_agreement/20231023213402278/20231023213402278.html)，更新日期 **2026-05-20**，主体通义云启（杭州）信息技术有限公司及/或关联公司。第五节(a)列出本服务的商标、服务标记等，接着写：
  > 除根据本协议我们向您许可的内容外，其他权利仍由我们保留，您在行使该等权利前须另行获得我们的书面许可。
  第五节(b)许可仍限于访问和使用服务，并再次保留未明示授权权利。

**场景对应：**这些是服务/IP 条款，不是品牌素材的开放分发规范。国际版不能作为“品牌已获转授权”的依据；CN 版确有未授权权利的书面许可门槛，但其服务范围与本插件从 Lobe 获取的独立图形之间的关系未被本文裁定。未查到覆盖本场景的专项品牌授权，不等于认定所有外部指称均禁止。缺项为适用主体、权利来源与指称用途的判断，而不是必须立刻发授权申请。

## 8. TRAE：服务使用许可与品牌素材再分发仍须分离

- [国际 Terms of Service](https://www.trae.ai/terms-of-service)浏览器可读，Last Updated: **September 17, 2026**，主体 SPRING (SG) PTE. LTD. 或关联公司。§6：`non-exclusive, limited, non-transferable, non-sublicensable, revocable right to access and use the Services`；§7 要求用户上传内容涉及的标识 `owned by or duly licensed to you`。这是服务/上传内容条款，**不是本插件必须向 TRAE 取得一切标志使用许可的独立证明**。
- [TRAE CN 用户协议](https://www.trae.cn/terms-of-service)浏览器显示更新时间 **2026/10/22**，主体北京引力弹弓科技有限公司及/或关联方。“我们享有本服务的权利”列明服务包含商标、用户界面、网页、图表等，并写：
  > 本协议未明示授权的其他权利仍由我们保留，你在行使该等权利前须另行获得我们的书面许可。
- [ByteDance 的 Trae Agent 官方仓库 LICENSE](https://raw.githubusercontent.com/bytedance/trae-agent/main/LICENSE)确为 MIT，原文含 `copy … publish, distribute, sublicense`；但[项目 README](https://raw.githubusercontent.com/bytedance/trae-agent/main/README.md)描述的是 CLI agent 项目。没有把本次 Lobe `trae-color` 图形及 TRAE 商标权明确纳入该许可的证据，不能移植为全品牌授权。

**场景对应：**本轮未找到明确覆盖第三方插件离线再分发这张品牌 PNG 的官方专项许可；CN 版存在明确的书面许可保留条款，其合同适用性仍待判断。不得把“服务不可再许可”直接等同“任何从 Lobe 来的图标都不得分发”，也不得忽略真实存在的 CN 文字。

## 9. 保持六个图标时的最小后续动作

以下仅是建议，**本轮不实施**：

1. **材料修正，无须先索要六家授权：**保留完整 Lobe MIT 及 `Copyright (c) 2023 LobeHub`；把来源写准为“Lobe 静态 PNG 1.97.0，完整许可取自其发布 gitHead 的官方仓库”，不误称 npm 静态包自带 LICENSE。核对已有插件 tgz 是否真正附带该许可；修正归属表的 TRAE 哈希笔误。源码 MIT 与第三方品牌权利分栏说明。
2. **准确指称，不作未验证保证：**保留品牌文字与小图标，说明“仅标识目录条目，不验证实际上游、官方身份、合作或背书”；不要把自定义目录 ID 或 API 兼容性说成“官方接入”。不用六家图标充当插件自身品牌或认证徽章。免责声明只能减少误认，不能治愈许可范围问题。
3. **小范围人工材料核对：**留存六个 PNG 的版本/完整性信息、实际 UI 与 Release 展示语境；核对比例、颜色、清晰度及是否被用来暗示服务关系。本文未做视觉/产物验收，不能宣称显示规范已满足。
4. **必须由用户决定的法律问题：**(a) 是否依赖 DeepSeek 的有条件品牌许可，若依赖如何证明实际接入；(b) Qwen 的明确标识条款、Qoder/TRAE CN 的保留权利条款，以及 Cline 服务/IP 限制是否约束当前发布主体和行为；(c) 若不依赖这些合同许可，独立的指称/商标适用性与图形版权依据是否足够。应按实际国家/地区和展示语境判断；需要时让有资格的法律专业人士审阅。只有确定适用的授权条款要求同意且现有依据不足时，才形成针对性许可问题，而不是预设六家全部书面批准。
5. **OpenAI 是证据缺口：**由人类正常通过页面验证后补齐现行细则；不把旧结论冒充重查结果。此事不要求本轮移除或替换图标。

**真正阻碍的层级：**本轮研究可交付；但不能给出“六图标所有权利明确允许、已满足全部公开发布门槛”的结论。明确存在的条件/限制为 DeepSeek 实际接入、Qwen 事先书面同意条款、Qoder/TRAE CN 未许可权利的书面许可条款及 Cline 服务/IP/背书限制；它们是否构成本插件的实际法律阻碍尚需适用性判断。另有 OpenAI 当前规则未完整取得这一证据阻碍。不能把这些降格为纯粹缺少归属文字，也不能把它们升格为已经作出的侵权判决。

OpenRouter / Hugging Face 非本轮六个预置图标的分发对象，未扩展品牌调查。按需联网获取本身也不是版权或商标的豁免理由；Qwen 文档链接 Hugging Face 只是模型发布渠道信息，不是 Hugging Face 图标授权。

## 10. 主执行者补充：最终候选材料核验（非研究代理的执行）

2026-11-09，主执行者只读检查本次已安装归档 `dist-local2-6px-reviewed/dsh-model-shelf-1.5.1-local.2.tgz`，全包 SHA-256 仍为 `13279e8c94afb944b003ec8ef678487ab99491ac2e2dcbc317d1551ff645c9b2`。内存读取两个目标成员并断言，命令 exit 0，无解包落盘、无安装/构建/测试：

- `package/src/assets/LOBE-ICONS-LICENSE.txt` 确实在包内，全文与工作区许可副本逐字节一致，含 LobeHub 2023 版权及完整 MIT；SHA-256 `add9d7531d1b21646317a8958e38fc727506fa39d24bdecb44154d943c82753a`。故“最终候选漏附完整 MIT”的疑虑在此关闭；不外推其他历史公开包。
- `package/src/assets/trae-color.png` 实算 SHA-256 `d768c1a9bb9cc20453243feceb1b47072c392fa0696104133f79e59279c98bd6`，与上游元数据及本地 artifact-local2-reviewed.json 对应项一致。历史归属表仅为哈希文字笔误，不是 PNG 字节被修改。
- 本轮以此记录作准确补充，未修改旧归属表或已安装归档；后续正式发行材料应更正笔误，不覆盖当前已验证包。六图标保持原样。上述核验不解决品牌规则适用性、OpenAI 取证或五版完整生命周期证据。
