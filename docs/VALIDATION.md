# 验证报告

## 范围与结果

- 包：**dsh-model-shelf 1.0.0**，作者 Hobartoakes，MIT。
- DSH：**0.2.0-rc.2**，Windows 安装版的 Electron CLI。
- 浏览器：本机 Microsoft Edge，真实浏览器测试。
- **10 项偏好测试 + 16 项离线浏览器检查 + 7 项干净 profile 检查通过**。
- 测试没有发起真实模型调用，也没有复制用户凭据。

## 1. 偏好数据（10 项）

覆盖主列表默认值、手动移入 / 移回、不同服务商相同 ID 独立管理、身份键无碰撞、服务商 / ID 搜索、非法存储清理、刷新保留、暂时缺失模型保留分类、存储异常提示、跨窗口同步及释放订阅。

另验证正式改名后导入本地原型偏好：只在新键不存在时导入，不删除旧键，不覆盖已有新偏好。

## 2. 离线浏览器（16 项）

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

页面没有未捕获的 JavaScript 错误。公开截图只取该模拟页面中的选择面板。

## 3. 真正的干净 profile（7 项）

每次运行创建新的测试 DSH_HOME 和工作目录，只从随安装包提供的 web 模板初始化 profile，不使用用户现有 web / desktop 配置。

1. 以 --ignore-scripts 安装预构建归档。manifest 仅含本插件，bundle 为随宿主提供的 base、web-app 加本插件。
2. 启动独立测试宿主（127.0.0.1、操作系统分配端口、--no-open），确认实际客户端图中含本插件和原生模型选择器。
3. 私下完成测试宿主的启动 URL 鉴权，广告的插件 JS 资源响应 200；真实界面显示“模型书架 · Model Shelf”和“不常用”标签。
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

干净 profile 测试当前仅支持 Windows，默认寻找本机 DeepSeek Harness 安装目录与 Edge。可设置 DSH_TEST_INSTALL_DIR 或 DSH_TEST_BROWSER_EXECUTABLE。请先构建并打包；默认读取 dist-draft 下的本地 1.0.0 归档。

## 尚未验证

- macOS、Linux 和其他 DSH 版本。
- 不同公开版本之间的升级。
- 此报告仅覆盖本地预构建归档；npm registry 安装和 dsh-market 一键安装需在对应发行或收录完成后另行验证。

本报告不是对所有宿主版本的兼容性保证，也不验证 API 中转服务的实际上游模型身份。
