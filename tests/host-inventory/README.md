# 哪些已发布 DSH 可以组成真实包测试？

**结论（2026-11-22）：50 个官方版本标签中，38 个可以取到书架四个关键组件的可核验归档，12 个不能按这套四包夹具测试。** 这里的「可以」指可以固定输入去做实验，不是已经运行，更不是 38 个桌面版均兼容。逐版结果在[来源矩阵](./matrix.json)；所有 `runtime` 值均为 `not-run`，仅指本次采集。桌面开关、模型切换和停用后原生入口须引用独立的同一候选包验收。

## 已覆盖和不能替代的证据

取 [npm CLI 核心目录](https://registry.npmjs.org/@deepseek-ai%2Fdsh)、[官方 Git 标签](https://api.github.com/repos/deepseek-ai/deepseek-harness/tags)及[官方 releases](https://api.github.com/repos/deepseek-ai/deepseek-harness/releases) 的版本并集。本次逐包下载并核对了 486 个不同的 npm 发布归档。npm 有 48 个核心；GitHub 有 44 个匹配标签、43 个公开 release；六个早期 npm 核心没有对应 tag，也未提供 registry gitHead 或 provenance 链接。不能从后来分支补造当时的锁。

| 发布组合 | 数量 | 可以检验什么 / 为什么不能照搬 |
| --- | ---: | --- |
| 四包齐全（`four-package-fixture`） | 38 | 最早为 `0.1.2-alpha.2`。用各自 picker、renderer 的发布 factory 与 slots、store 的发布 ESM；结合该版本 Cordis、Web 和依赖。不是完整浏览器，也不推断行为相同。 |
| 包布局不同（`different-package-layout`） | 8 | `0.0.1-rc.5`、`0.1.0-rc.2/.3/.6/.7/.8`、`0.1.1-rc.1/.2`：有 picker 和 slots，但并非都由独立 renderer/store 提供。逐行看 `reason`、`components` 和 frontend 归档；如做实测应保留本版 Web 的模块所有者，不用新版补洞。 |
| 旧 picker 名称（`legacy-picker`） | 2 | `0.0.1-rc.1/.2` 的 [Web rc.1](https://registry.npmjs.org/@deepseek-ai%2Fdsh-web-app/0.0.1-rc.1)、[Web rc.2](https://registry.npmjs.org/@deepseek-ai%2Fdsh-web-app/0.0.1-rc.2) 要求 `dsh-client-ui-model`、`dsh-client-ui-models` 和 `dsh-frontend`；这三个官方身份目前返回 404。core→Web 的 caret 可以选到后来的 rc.5，但将其配上现代 picker 不能证明原组合。 |
| 仅源码发布标签（`no-npm-core`） | 2 | [0.1.2-alpha.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1)、[0.1.3-alpha.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.3-alpha.1) 有 release、commit 与 CLI 源清单，npm 没有同版核心；本次约定的 Windows URL 也没有返回安装器。源码不是已分发的 CLI/桌面字节。 |

[旧清单的版本与公开 pins](./legacy-pins.json) 从原始普查提取：其中 173 个四组件 SRI 均可与本次下载的字节核对。46 个已取到的现代 picker bundle 都含原调研的五个字面量（slot 名、目录、subagent、reset、inject）；所以按符号出现与否，**无法区分**这 46 个的运行行为。

## 优先测试组合

1. **基准：Windows x64 `0.2.2-rc.5`。** [核心声明](https://registry.npmjs.org/@deepseek-ai%2Fdsh/0.2.2-rc.5) 固定 Web 为 rc.5；[Web 声明](https://registry.npmjs.org/@deepseek-ai%2Fdsh-web-app/0.2.2-rc.5) 固定 frontend、picker、renderer、conversation；[Web 补丁](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/packages/bundle/web-app/cordis.patch.yml) 确实登记这三个客户端插件。slots、store、primitives 是 [picker](https://registry.npmjs.org/@deepseek-ai%2Fdsh-client-ui-model-selection/0.2.2-rc.5) 和 [frontend](https://registry.npmjs.org/@deepseek-ai%2Fdsh-web-frontend/0.2.2-rc.5) 的构建依赖，不是 core 直接安装的生产依赖。用该 commit 的[锁](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/pnpm-lock.yaml)和[vendored Cordis 清单](https://github.com/deepseek-ai/deepseek-harness/blob/9c2670d3bce5275e0d1610272958121af87787bb/vendor/cordis/package.json)：Cordis **4.1.0**，loader/include **1.1.0**、timer **1.2.0**、cosmokit **1.9.0**、schemastery **3.19.0**；Web 解析到 React / React DOM **18.3.1**，不同于仓库测试的 **18.2.0**。
2. **邻版：`0.2.3-alpha.1`。** 有独立 [npm 核心](https://registry.npmjs.org/@deepseek-ai%2Fdsh/0.2.3-alpha.1) 和组件字节，也使用 Cordis **4.1.0**；可以作同一 Cordis、不同 DSH 归档的对照。不能照抄 rc.5 的桌面结论。
3. **运行环境边界：`0.2.3-alpha.2`。** [核心](https://registry.npmjs.org/@deepseek-ai%2Fdsh/0.2.3-alpha.2) 声明 Node `^24.22.3 || >=26.13.1`；本次采集用的 Node 24.21.0 不满足完整宿主启动条件。[对应锁](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/pnpm-lock.yaml)和[vendored Cordis](https://github.com/deepseek-ai/deepseek-harness/blob/4b399c39a6d1479cd84ca591b4d7c88e24d38a96/vendor/cordis/package.json) 所对应的组合是 **4.2.0-alpha.1**，loader/include **1.2.0-alpha.1**、timer **1.3.0-alpha.1**、cosmokit **1.10.0-alpha.1**、schemastery **3.20.0-alpha.1**。优先在满足引擎条件的隔离环境检验，不能用 4.1.0 代跑宣称通过。
4. **更早的结构边界：** 在首个四包版与最后的缺件版各取真实归档；其余四包候选跨十种 Cordis（4.0.2、4.0.3、4.0.4、4.0.5-alpha.1/.2、4.0.5、4.0.6-alpha.1/.2、4.1.0、4.2.0-alpha.1），选版时应按逐行来源而不是按 DSH 大小号猜。缺件版只能检验其自身入口或明确留白。

截至本次调研，[原夹具加载器](../host-packages.mjs#L150-L182)只接受 `0.2.1-rc.2/.4/.5`、`0.2.2-alpha.2`、`0.2.2-rc.1/.3` 六个版本和三个 Cordis 别名，且把原生 UI primitives 映射为调用即抛错的代理。**这六组是已有加载器输入；另 32 组是可固定的新输入，不是现有测试已经支持或跑过的行。** 完整原生绘制还要真实 primitives、frontend 模块解析、React、注入的服务和会话；替身只可支持明确的组件边界，不可计为打开/切换/停用的桌面验收。

[官方 Windows nightly feed](https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml) 本次指向 rc.5，大小 299593552，SHA-512（base64）`wWySRp7Hk5gcH324jBxAc7KV0mniHzQDofyQexOJMIAWXBkgHTsRCr3IrdwX1XO8OIhDZsLYmve4mLxskikYIg==`。50 个约定的 Windows x64 URL 中 13 个 HEAD 200；两版 0.2.3 alpha 均非 200。只请求元信息，未下载/执行安装器；404 只说明该 URL 没取到，不能排除其他渠道、命名或历史分发。

## 怎么查一行或重做调查

[收集器](../../scripts/inventory-hosts.mjs)从核心的实际依赖边出发；不因两个包版本号相同就连边。`selection` 区分：精确声明、tag 对应 commit 的工作区版本、无锁时满足所有已观测声明的最低已发布版本。最后一种只是可重现的候选，`alternativeMax` 是允许的更高版本示例，不是 npm 真实安装记录。`edges.field` 区分运行、可选、peer 和开发声明；`lock.importerLinks` 来自上游锁的 importer 段，不是桌面随附的锁。

按 `hosts[].version` 找版本，`components` 中是角色到精确包 ID 的映射。用 ID 查 `archives` 即可得真实 tarball URL、SHA-512 SRI、SHA-256、字节数、依赖声明和入口。核心、四组件、Web、Cordis 及其相关包是**针对书架的子图**，不是可直接安装的完整 host 锁。快照不内置上游包代码；网络重采会按 URL 验字节、核对包内 manifest（身份和全部四类依赖声明）与 registry，再保存收据，任何不一致报错。离线校验只检查记录之间的一致性，不重新下载。

从工作树根目录运行（已有项目开发依赖即可，无须安装 DSH 或修改 profile）：

```sh
# 检查完整快照与旧 SRI 是否一致
node tests/host-inventory/verify.mjs tests/host-inventory/matrix.json tests/host-inventory/legacy-pins.json
# 只读联网调查，写到新的输出，成功后再决定是否替换快照
node scripts/inventory-hosts.mjs > tests/host-inventory/refetched.json
node tests/host-inventory/verify.mjs tests/host-inventory/refetched.json tests/host-inventory/legacy-pins.json
# 只需重点版本时可只传精确版本（这是子集，不交给全量覆盖校验）
node scripts/inventory-hosts.mjs 0.2.2-rc.5 0.2.3-alpha.2
```
