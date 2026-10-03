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
- [x] 10 项偏好测试、16 项离线浏览器检查、7 项隔离 profile 集成检查通过。
- [x] 真实干净 profile 中验证安装、禁用、重新启用和卸载，禁用 / 卸载后原生选择器可打开。
- [x] 目标包出现在实际客户端图中，广告的 JS 资源响应 200，界面真实挂载。
- [x] 修复首次创建模型目录时缺少 remote.session 注入声明的问题。
- [x] 验证过程未修改当前 desktop manifest 或 patch，未复制用户凭据，未发起真实模型调用。
- [x] 保持 private: true，通过 prepublishOnly 防止未授权 npm 发布。

详细过程见 [验证报告](VALIDATION.md)。

## 下一阶段仍未执行

- [ ] 再次确认 npm 包名可用性，以及准备 npm 发布账号和权限。
- [ ] 用户明确授权 npm 发布后，才将 private 改为 false。
- [ ] 发布 npm 包和 / 或 GitHub Release 预构建安装包。
- [ ] 按 awesome-dsh-plugin 当时的贡献规范提交目录收录 PR。
- [ ] 收录同步后，从 dsh-market 实测一键安装。
- [ ] 有公开新版本时验证真实升级流程；当前未验证跨版本升级。
- [ ] 其他 DSH 版本及平台经过实测后，才扩展兼容声明。

`pnpm run check:release` 只检查发布文件，不执行发布。`prepublishOnly` 会额外检查发布授权；private: true 时仍会阻止 npm 发布。

当前电脑原型的旧归档没有被覆盖。正式项目在独立目录中整理，测试使用独立 DSH_HOME、独立 profile、随机本地端口，不替换正在使用的 GUI。
