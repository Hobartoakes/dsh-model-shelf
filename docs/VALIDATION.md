# 验证报告

## 范围与结果

- 包：**dsh-model-shelf 1.1.0**（已发布 [GitHub Release v1.1.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.1.0)），作者 Hobartoakes，MIT。
- DSH：**0.2.0-rc.2**，Windows 安装版的 Electron CLI。
- 浏览器：本机 Microsoft Edge，真实浏览器测试。
- **14 项偏好测试 + 21 项离线浏览器检查 + 7 项干净 profile 检查通过**。
- 测试没有发起真实模型调用，也没有复制用户凭据。

## 1. 偏好数据（14 项）

覆盖主列表默认值、手动移入 / 移回、不同服务商相同 ID 独立管理、身份键无碰撞、服务商 / ID 搜索、非法存储清理、刷新保留、暂时缺失模型保留分类、存储异常提示、跨窗口同步及释放订阅。

1.1.0 新增：

- 收藏是独立于主列表 / 不常用分类的覆盖层，按 `(provider ID, model ID)` 区分。
- 1.0.0 旧数据缺少 `favorites` / `providerNotes` 时默认为空，原分类与折叠保留。
- 账号备注按服务商配置 ID 分别保存，可区分同名平台下的不同 API 账号，并参与搜索。
- 备注会去除控制字符、裁剪并限制 120 字符，空备注不保存。

另验证正式改名后导入本地原型偏好：只在新键不存在时导入，不删除旧键，不覆盖已有新偏好。

## 2. 离线浏览器（21 项）

使用模拟目录验证：

- 640px 宽、最高 720px 的面板及窗口边界。
- 服务商和精确模型 ID 显示。
- 手动分类不触发模型选择、不影响其他服务商的同 ID 模型。
- 分类刷新保留、移回主列表。
- 折叠保留；搜索临时展开，不覆盖折叠偏好。
- 选择失败提示、传输异常恢复、思考强度保留。
- 搜索键盘选择、Escape、焦点循环。
- 迟到的异步结果不会关闭重新打开的面板。
- 不可用模型保留身份和思考强度提示。
- 深色主题、窄窗口、插件卸载清理样式。

1.1.0 新增：

- 收藏刷新后保留、按服务商区分，且不会改变不常用分类，也不会选择模型。
- 同名平台下不同服务商 ID 的账号备注可分别保存、分别显示，并可按备注搜索。
- 备注编辑：Enter 保存、Escape / 取消放弃、清空保存即删除；备注按原文显示，不执行 HTML。
- 账号备注按钮与分组边框保持间距（自动化断言，≥8px）。
- 收藏列表与备注编辑器在 390px 窄窗口内不溢出。

页面没有未捕获的 JavaScript 错误。公开截图只取该模拟页面中的选择面板。

## 3. 真正的干净 profile（7 项）

每次运行创建新的测试 DSH_HOME 和工作目录，只从随安装包提供的 web 模板初始化 profile，不使用用户现有 web / desktop 配置。

1. 以 --ignore-scripts 安装预构建归档。manifest 仅含本插件，bundle 为随宿主提供的 base、web-app 加本插件。
2. 启动独立测试宿主（127.0.0.1、操作系统分配端口、--no-open），确认实际客户端图中含本插件和原生模型选择器。
3. 私下完成测试宿主的启动 URL 鉴权，广告的插件 JS 资源响应 200；真实界面显示“模型书架 · Model Shelf”和“不常用”标签；1.1.0 还在该真实界面中保存账号备注并收藏模型，刷新后仍保留。
4. 在测试 profile 禁用插件，重启测试宿主后插件不在客户端图中，插件样式和触发器消失；原生模型按钮与菜单可打开。
5. 重新启用插件，客户端图和增强界面恢复。
6. 清理测试插件 patch 行后卸载，dependency 和 bundle 均移除，原生选择器仍可打开。
7. 比较用户当前 desktop manifest 与 patch 的哈希，验证它们没有被修改。

测试仅修改测试目录。每个测试宿主启动在不同临时端口，不使用或替换当前 GUI 的端口，结束后停止测试进程。启动 token 不打印、不上传；证据只保存在被 Git / npm 排除的 tests/artifacts 中。

### 干净环境发现并修复的问题

第一次创建模型目录时，Cordis 服务方法继承调用方的能力声明。原型未显式注入 remote.session，在已有目录的会话中不易暴露，但在干净 profile 会导致选择器回退。

正式版已明确声明 remote 与 remote.session，并增加对应回归断言。修复后，从零初始化、禁用、重新启用与卸载均通过。测试还检查控制台没有被错误边界掩盖的插槽失败。

## 复现

```powershell
pnpm install --frozen-lockfile
pnpm run build
pnpm test
pnpm run test:browser
pnpm pack --pack-destination dist-draft
pnpm run test:clean-profile
pnpm run check:release
```

干净 profile 测试当前仅支持 Windows，默认寻找本机 DeepSeek Harness 安装目录与 Edge。可设置 DSH_TEST_INSTALL_DIR 或 DSH_TEST_BROWSER_EXECUTABLE。请先构建并打包；默认读取 dist-draft 下与 package.json 版本一致的本地归档（当前为 1.1.0）。

## 尚未验证

- macOS、Linux 和其他 DSH 版本。
- 不同公开版本之间的升级；1.0.0 → 1.1.0 的本地偏好兼容已由单元测试覆盖，但真实安装包的升级流程尚未实测。
- 账号备注不会自动读取或验证实际账号身份；多账号区分依赖宿主中存在多个服务商配置 ID。
- npm registry 安装和 dsh-market 一键安装需在对应发行或收录完成后另行验证；本项目尚未发布 npm，也未提交市场收录 PR。

本报告不是对所有宿主版本的兼容性保证，也不验证 API 中转服务的实际上游模型身份。

## GitHub Release v1.0.0 公开发行验证（历史记录）

本节记录 **1.0.0** 的公开发行验证，当时不含收藏与账号备注。

- 已发布 [v1.0.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.0.0)，预构建归档为 [dsh-model-shelf-1.0.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.0.0/dsh-model-shelf-1.0.0.tgz)。
- 未发送 Authorization 或登录 Cookie，使用公开下载链接成功获取安装包，大小 **150041 字节**。
- 下载内容与上传前审查的归档 SHA256 一致：`f20edcf6f954e40e0050438adeda5cd84ce493474e6a772c79eaa141cf1211d8`。
- 使用官方 CLI **直接从公开 HTTPS 链接安装**，而非只安装本地副本，7 项隔离 profile 集成检查再次通过。
- 安装后的真实客户端图、广告的 JS 资源、增强模型面板均正常；禁用、重新启用和卸载正常，原生选择器可打开。
- 当前 desktop manifest 和 patch 的哈希保持不变，所有临时测试服务在完成后停止。

复现公开链接安装验证：

```powershell
node tests/clean-profile.mjs "https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.0.0/dsh-model-shelf-1.0.0.tgz"
```

## GitHub Release v1.1.0 公开发行验证

- 已发布 [v1.1.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.1.0)，预构建归档为 [dsh-model-shelf-1.1.0.tgz](https://github.com/Hobartoakes/dsh-model-shelf/releases/download/v1.1.0/dsh-model-shelf-1.1.0.tgz)，大小 **206017 字节**。
- 先创建草稿 Release 并上传归档；从 Release API 下载（携带登录态）验证字节与本地一致后才公开。
- 公开后**未发送 Authorization 或登录 Cookie**，使用公开下载链接成功获取安装包，大小 **206017 字节**。
- 下载内容与上传前审查的归档 SHA256 一致：`AE5C461B1CAED4B13761F6A65B9D4756E122E3BBBF78ADFC84B62DC128C81523`。
- v1.0.0 的归档与标签保持不变。
- 当前 desktop 已从本地候选包升级到 1.1.0；此项公开链接验证未再次修改 desktop。

发布后的验证记录不改变已发布的归档和 v1.0.0 标签；归档包含发布前的报告快照，最新验证记录以本页及 Release 说明为准。
