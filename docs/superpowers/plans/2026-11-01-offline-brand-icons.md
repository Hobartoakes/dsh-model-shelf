> 历史设计：2026-11-01 用户改选仅使用适用条件可核实的品牌标志；当前候选版各品牌均回退中性默认图标。

# 模型书架离线图标实施计划

> 执行前先审阅；使用 executing-plans 或 subagent-driven-development，按测试先行逐项实施。

**目标：** 为服务商和模型系列提供完全离线、明确匹配的图标，提升大列表辨识度。

**架构：** 静态资源固定使用 Lobe Icons 提供的指定版本，构建时内联；映射规则集中维护，优先精确匹配已知 ID，其次使用有边界的型号匹配，模糊或未知时使用统一默认图标。图标反映目录标签而不是已验证的网络端点或上游模型。沿用现有 React 和构建脚本，不引入运行时网络请求。

**技术：** JavaScript、React、CSS、Node 测试、Playwright；现有构建脚本将源码合并到客户端 bundle。

**设计：** `docs/superpowers/specs/2026-11-01-offline-brand-icons-design.md`。

## 全局约束

- 与当前 `feat/compact-provider-cards` 未提交修改共存；先记录工作树和基线，不覆盖或清理已有改动。
- 不新增联网图标请求、手动设置、账号偏好字段、自动分类或实际上游身份声明。
- 固定资源版本、保留 MIT 许可和版权声明，记录各品牌的已知规则；有明确冲突的素材使用默认图标，不把图标或 ID 说成实际端点验证。此前用户授权本机安装与 GitHub 发布；不覆盖已有标签或 Release。
- 首批目标：截图中的 DeepSeek、WorkBuddy、ChatGPT subscription，以及 DeepSeek / GPT / Claude 模型系列；无法识别的使用默认图标。

## 审查重点

1. 用户自定义服务商 ID、同平台多账号与不同备注：不得错认或使备注影响图标。
2. `gpt`、`claude`、`deepseek` 出现在不相干模型 ID 中：不得宽泛子串误判。
3. 缺失或无许可资源：离线默认图标可见，无破图或外网请求。
4. 浅色、深色、窄窗口和长名称：图标不挤掉按钮、不引入大块缩进、不改变屏幕阅读器名称。
5. 650+ 模型、首次打开和滚动：记录同机对照及请求计数，不用模拟目录性能结果冒充真实环境验收。

### 任务 1：资源与映射

**文件：** 新建 `src/icons.js`、`tests/icons.test.mjs`、`docs/ICON-ATTRIBUTIONS.md`；修改 `scripts/build.mjs` 和必要的 `package.json` 打包清单。

**接口：** `providerIcon(providerId)` 和 `modelIcon(modelId)` 返回已声明的图标键，未知值返回 `default`；图标资源由构建脚本内联到客户端 bundle，不在运行时请求 URL。

- [ ] 记录现有未提交 diff，运行 `npm test`、`npm run test:browser` 作为对照。
- [ ] 固定 Lobe Icons 提交 `8b7bbc433d38437fa2b0cca58ae896917162b812`（静态包 1.101.0），核对 DeepSeek、WorkBuddy、OpenAI、Claude 四个 SVG 原文件及品牌规则；收录完整 MIT 许可文本、来源和哈希。明确冲突者回退默认图标，不宣称拥有额外商标授权。
- [ ] 在 `tests/icons.test.mjs` 添加测试：已知 `deepseek-official`、`workbuddy`、`openai-codex` 映射各自图标；`gpt-6.1-terra`、`claude-sonnet-4-5`、`deepseek-v4.1-flash` 映射相应系列；不相关子串、冲突、空值回退 default；大小写一致。运行 `node --test tests/icons.test.mjs`，先观察新增用例失败。
- [ ] 修改 `src/icons.js` 中 `providerIcon(providerId)`、`modelIcon(modelId)` 及集中规则：精确匹配优先，受约束的版本前缀为次；不可由标签宣称实际端点。构建时将可信静态资源转为本地内容，不将外部 SVG 作为 HTML 注入。
- [ ] 扩充 `tests/browser.mjs`，验证 `workbuddy` 与 `openai-codex` 服务商和三种系列、收藏行及未知项的实际图标均存在，按 UI 显示断言而非只测映射键；先对旧原型执行并观察失败。
- [ ] 运行 `node --test tests/icons.test.mjs` 和 `npm run build`，确认通过并检查许可证文件被打包。

### 任务 2：列表展示与性能验证

**文件：** 修改 `src/client.js`、`src/style.css`、`tests/browser.mjs`；必要时更新 `README.md`。

**接口：** 使用任务 1 的 `providerIcon(providerId)`、`modelIcon(modelId)`；图标不改变已有可访问名称或点击目标。

- [ ] 先添加浏览器测试：收起及展开服务商均有图标；模型行和收藏行有图标；未知项显示默认图标；模型图标紧邻型号、不保留额外空位；不同备注不改变同平台图标。确认旧界面运行新测试失败。
- [ ] 增加窄窗口、长名称、深浅主题、键盘焦点和主列表/不常用/收藏交互回归；拦截请求并断言打开和滚动过程无图标相关网络请求。
- [ ] 在服务商标题及模型行插入装饰性、`aria-hidden` 的本地图标；保留所选模型提示及已有交互，调整模型行缩进而不改变排序控件。
- [ ] 执行 `npm run build`、`npm test`、`npm run test:browser` 和 `git diff --check`；检查现有紧凑卡片修改未丢失。
- [ ] 使用同一机器与同一个 650+ 模型测试目录分别记录变更前后的首次打开、再次打开和滚动表现、请求数量及测量方法；若无法获得真实目录，标记仅合成数据并明确未做真实环境验收，不将结果外推。
- [ ] 独立审查映射、素材条件、可访问性、离线性和测试缺口；修复重要问题后重新运行全部测试。

### 任务 3：安装与 GitHub 发布

**文件：** `package.json`、`README.md`、`CHANGELOG.md`、`docs/VALIDATION.md`、`docs/RELEASE-CHECKLIST.md` 等按项目发布规则更新；不改写历史证据。

- [ ] 核验 GitHub 仓库权限、最新标签及 Release，选择不冲突的新版本；执行项目发布门禁及实际可用的隔离宿主测试，诚实记录未覆盖的版本与环境。
- [ ] 在本机安装前记录 desktop profile 插件版本与相关配置；按官方 CLI 仅更新模型书架并保留 bundle 顺序，安装后核对版本与构建文件哈希。刷新现有 GUI 并尝试实际界面验收；如需要用户登录或重启，只报告实际状态，不以离线测试代替。
- [ ] 整理并检查 diff，提交推送到正确的 GitHub 仓库，创建新版本 Release、上传经过验证的归档与校验文件；不替换旧版本。核对公开下载、哈希、Release 状态及本地安装状态，分别汇报。
