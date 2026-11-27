# Codex：从书架到序列化请求的离线验收

在仓库根目录使用项目已有的 Node、Playwright 和本机 Edge/Chrome：

```sh
node tests/provider-options/codex-roundtrip.mjs --prepare
node scripts/build.mjs
node tests/provider-options/codex-roundtrip.mjs --offline
```

只有 prepare 会从 npm 官方注册表取固定 tarball，拒绝重定向，逐包核验 [pins.json](pins.json) 中的 SHA-512。offline 再验字节，在一次性目录解包，不运行安装脚本；缺件、校验失败或缺浏览器均非零退出。缓存位于仓内忽略的测试目录，不拿本机已安装的连接器作证据。

- **真实部件**：DSH 0.2.2-rc.5 发布前端、原生模型目录和插槽、Connection 两端（匿名 POST 必须 401）、SettingsForms 和 Cordis Loader；书架用本仓构建产物；[Codex 3.2.28 发布包](https://registry.npmjs.org/dsh-codex-subscription/3.2.28) 原样注册偏好 RPC 和 PiAiAdapter，pi-ai 1.3.0 序列化。可对照[偏好处理](https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/subscription-rpc.js#L236-L304)、[模型请求构造](https://github.com/WSL043/dsh-codex-subscription/blob/05690e4045030bf8d4a85dbd5049d866ea6cd014/src/pi-ai-runtime.js#L145-L192)。
- **测试边界**：一次性 profile 的文件后端、虚构 OAuth 和模型目录、会话投影和无关服务。确认已落盘，重开书架从连接器读取，再从真实适配器准备下一请求。只在 Fetch 边界解析最终字节；不持久化请求、头、原始状态或凭据。浏览器只访问本次随机端口；模型 worker 拒绝新建任何外连 socket。Windows 仅 Edge 子进程沿用系统 USERPROFILE 作 known-folder 查询；浏览器用户数据、HOME、APPDATA、所有 DSH 路径和临时文件仍显式位于一次性目录。断线测试仅延迟或丢弃真实响应的交付。
- **证据范围**：回答详略由目录声明准入；恢复默认以夹具返回的 high 作对照，不假设 medium。摘要只开放 gpt-5.4 已证实的显式 low/medium/high 或目录声明的 medium 默认；无推理对象的模型、其他默认组合、同名非订阅线路不由此获得摘要支持。none 删除摘要而不改 effort。验证的是固定组件的本地请求，不是全桌面启动、供应商接受请求或线上推理。保存前的复核不是跨客户端原子锁。
- **速度闭环**：[速度用例](exercise.mjs#L17-L74)在双档、仅快速、仅极速、无档与未知档的模型上对照同一连接器偏好。六笔速度保存后各自重开读回：普通请求 fast → `service_tier=priority`、ultrafast → `ultrafast`、标准或不适用 → 键缺失；文本详略和推理不变。独立测试客户端通过认证 RPC 实际刷新目录，草稿所选档被撤销时书架只复核状态、零补丁。三字段共 12 笔保存重开、31 条序列化请求，零供应商连接。
