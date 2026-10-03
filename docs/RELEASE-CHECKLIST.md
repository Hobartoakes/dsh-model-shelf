# 发布检查清单

项目：**dsh-model-shelf / 模型书架**。作者：**Hobartoakes**。许可：**MIT**。

## 已确认与完成

- [x] 确认正式名称、作者及 GitHub 仓库地址，补齐 author / repository / homepage / bugs。
- [x] 用户确认 MIT，添加正式 LICENSE 和版权署名。
- [x] 创建公开仓库 https://github.com/Hobartoakes/dsh-model-shelf。
- [x] 查询 npm：准备期间 `dsh-model-shelf` 尚未注册；查询不是预留。
- [x] 中文介绍、英文摘要、安装 / 卸载 / 使用说明。
- [x] 仅声明已验证的 DSH 0.2.0-rc.2，说明平台与依赖服务。
- [x] 手动分类、模型身份显示、本地保存范围与上游模型映射限制。
- [x] 隐私说明、版本记录和模拟数据演示截图。
- [x] 包文件白名单与 Git 排除规则，排除真实对话、本机备份、依赖目录和测试数据目录。
- [x] 显式构建；用户安装预构建归档时不需要构建脚本。
- [x] 14 项偏好测试、21 项离线浏览器检查、7 项隔离 profile 集成检查通过（含 1.1.0 收藏与账号备注）。
- [x] 1.1.0 文档同步：README 用法与多账号说明、CHANGELOG、隐私说明、验证报告。
- [x] 真实干净 profile 中验证安装、禁用、重新启用和卸载，禁用 / 卸载后原生选择器可打开。
- [x] 目标包出现在实际客户端图中，广告的 JS 资源响应 200，界面真实挂载。
- [x] 修复首次创建模型目录时缺少 remote.session 注入声明的问题。
- [x] 验证过程未修改当前 desktop manifest 或 patch，未复制用户凭据，未发起真实模型调用。
- [x] 用户明确授权 npm 发布后，将 private 改为 false，并限定公开发布到官方 registry；prepublishOnly 仍检查发布元数据。

详细过程见 [验证报告](VALIDATION.md)。

## 下一阶段仍未执行

- [ ] 再次确认 npm 包名可用性，以及准备 npm 发布账号和权限。
- [x] 用户明确授权 npm 发布，并解除 private 发布保护。
- [x] 发布 [GitHub Release v1.0.0](https://github.com/Hobartoakes/dsh-model-shelf/releases/tag/v1.0.0) 并上传预构建安装包。
- [x] 验证未登录公开下载、SHA256 一致，以及官方 CLI 从公开 URL 安装、禁用、重新启用和卸载。
- [ ] 发布 npm 包（本次任务未执行）。
- [ ] 按 awesome-dsh-plugin 当时的贡献规范提交目录收录 PR。
- [ ] 收录同步后，从 dsh-market 实测一键安装。
- [ ] 发布 [GitHub Release v1.1.0](https://github.com/Hobartoakes/dsh-model-shelf/releases) 并上传预构建安装包（源码已就绪，尚未发布）。
- [ ] 验证 1.1.0 的未登录公开下载、SHA256 一致，以及官方 CLI 从公开 URL 安装。
- [ ] 有公开新版本时验证真实升级流程；当前未验证跨版本升级，1.0.0 → 1.1.0 仅覆盖本地偏好兼容。
- [ ] 其他 DSH 版本及平台经过实测后，才扩展兼容声明。

`pnpm run check:release` 只检查发布文件，不执行发布。private 标志解除并不代表包已经发布；还必须完成 npm 登录、二次验证（如要求）、归档审查、实际上传和 registry 核验。

这份清单记录发布准备阶段的检查；npm 的实际可用版本以 registry 为准。

当前电脑原型的旧归档没有被覆盖。正式项目在独立目录中整理，测试使用独立 DSH_HOME、独立 profile、随机本地端口，不替换正在使用的 GUI。
