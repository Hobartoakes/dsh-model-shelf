# Shelf Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收藏直接选择，服务商整组整理，分类与收藏均可手动排序且刷新保留。

**Architecture:** 扩展现有偏好纯函数，UI 从统一派生结果生成展示和键盘导航。收藏独立平铺，服务商分类维持分组；排序仅更新本地偏好，不调用宿主模型切换。

**Tech Stack:** JavaScript ESM、React createElement、CSS、node:test、Playwright（现有依赖）。

**Spec:** [已确认范围与实现默认决定](../specs/2026-10-22-shelf-organization-design.md)

## Global Constraints
- 不增加依赖，不修改 API 配置，不调用真实模型作为验收。
- 身份始终为 `(provider ID, model ID)`；收藏独立于分类。
- 搜索期间禁止排序，不跨列表拖动；刷新保留，新条目末尾加入。
- 不自动按使用频率分类或排序，不新增跨设备同步。
- 不默认提交、推送、发布或替换已安装插件；实现前按 using-git-worktrees 创建隔离工作树，用户明确要求原地时再遵从。

## Review Focus
- 旧 v1、损坏字段及存储不可用：已有收藏分类不丢失，降级提示仍有效（任务 1）。
- 服务商恢复与原单模型分类相遇：解除覆盖而非清空单模型分类（任务 1、2）。
- 暂时离线、目录刷新、新模型：旧位置不丢、新条目追加（任务 1、3）。
- 拖动后的点击及文字拖选：不误切换模型、不误折叠组（任务 3）。
- 搜索、切换标签或删除拖动条目时放下：取消过期拖动，不改错列表（任务 3）。

## 文件职责
- `src/preferences.js`：规范化、分类覆盖、稳定排序与记住标签；保留现有存储键和旧字段。
- `src/client.js`：派生展示、分组/平铺、分类操作、交互状态及导航。
- `src/style.css`：平铺行、把手、落点和焦点样式；沿用主题变量。
- `tests/preferences.test.mjs`：纯函数与持久化。
- `tests/browser.mjs`：真实 DOM 操作与现有宿主模拟回归。
- `README.md`：行为、分类恢复语义、排序与存储说明。

### Task 1: 可迁移的分类和排序偏好
**Files:** Modify `src/preferences.js`; Test `tests/preferences.test.mjs`.

**Interfaces:**
- 继续导出 `partitionModels(groups,prefs,list,query='') -> Group[]`，收藏筛选仍可返回组但不以组顺序决定收藏顺序。
- 新字段：`uncommonProviders: string[]`、`providerOrder: {main:string[],uncommon:string[]}`、`favoriteOrder: string[]`、`lastList: 'main'|'uncommon'|'favorites'|null`；version 保持 1，缺字段默认空。
- 新增 `isUncommon(prefs,providerId,modelId) -> boolean`、`setProviderUncommon(prefs,providerId,value) -> Preferences`。
- 新增 `orderedKeys(savedKeys,currentKeys) -> string[]`：返回当前存在键，已保存的在前，新键按输入顺序追加，不就地修改参数。
- 新增 `reorderKeys(keys,sourceKey,targetKey) -> string[]`：按源/目标原索引将源移到目标位置，无效键不变。
- 新增 `favoriteRows(groups,prefs,query='') -> {group,model,key}[]`，按 favoriteOrder 排序；同名不同服务商不合并。
- 持久化更新时保存包括离线键的完整顺序；目标分类新进入服务商从旧目标顺序移除再追加；不清掉其单模型分类。

- [ ] 写失败测试：`provider override keeps favorites and original model classification`，归档 one 后 main 只剩 two，favorites 仍含 one/same；解除覆盖后 one/other 的原不常用标记保留；新增 one/new 继承覆盖。
- [ ] 写失败测试：`ordering normalizes old data and keeps offline identity`，旧值等于新默认值加旧字段；重复/非字符串顺序清洗；`orderedKeys(['two','offline','one'],['one','two','new'])` 等于 `['two','one','new']`；源偏好仍保留 offline。
- [ ] 写失败测试：`ordering is independent and refresh durable`，main 重排不改变 uncommon，收藏顺序不受分组影响，存储重建后 lastList 与顺序完全相同；取消后再收藏追加末尾。
- [ ] 运行 `node --test tests/preferences.test.mjs`，确认新增断言失败而非环境错误。
- [ ] 实现上述接口；沿用存储错误和 storage 事件通知，添加损坏字段与跨窗口更新断言。
- [ ] 重跑 `node --test tests/preferences.test.mjs`，所有用例通过。

### Task 2: 收藏平铺、服务商整理、标签记忆
**Files:** Modify `src/client.js`, `src/style.css`, `tests/browser.mjs`.

**Interfaces:** 消费任务 1 的分类和 favoriteRows 接口；新增明确的 UI 标识 `data-provider-id` 与现有 `data-model-key`；标签切换更新 lastList。

- [ ] 在浏览器夹具加入失败断言：不同服务商同 ID 各收藏一条，收藏无分组折叠控件，两个模型均可见；点选提交准确 provider/model。共用同一派生行列表进行上下键导航。
- [ ] 增加整组移走、恢复、原单模型分类保留、目录追加模型与收藏仍可选的断言；覆盖组内“移回”提示必须先恢复服务商。
- [ ] 增加关闭重开及页面 reload 后恢复收藏标签的断言，空收藏也保留；无 lastList 时仍按当前模型分类打开。
- [ ] 运行 `node scripts/build.mjs` 后 `node tests/browser.mjs`，确认新增断言失败。
- [ ] 实现平铺分支，复用模型行身份/选取/错误处理；收藏不显示展开折叠工具，保留身份与备注。服务商标题提供整组操作，动作阻止冒泡。
- [ ] 实现标签恢复与分类提示；不改 WorkBuddy 功能和原生切换接口。
- [ ] 运行 `node --test tests/*.test.mjs`、`node scripts/build.mjs`、`node tests/browser.mjs`，确认全绿。

### Task 3: 可访问的拖动排序与整体验收
**Files:** Modify `src/client.js`, `src/style.css`, `tests/browser.mjs`, `README.md`.

**Interfaces:** 拖动载荷 `{list,kind:'provider'|'favorite',key}`；组件内保存，不信任外部 text/plain。使用任务 1 reorderKeys。落下时重新校验列表、搜索为空、源目标仍存在且类型一致；拖动结束清理状态。

- [ ] 添加浏览器失败测试：服务商 A/B 主列表互换，不常用顺序不变；收藏跨服务商互换；reload 仍相同；新收藏在末尾。
- [ ] 添加失败测试：把手拖动不选择模型/折叠组，搜索后拖放和上下移动均不可用；跨标签、拖动中目录移除源、拖动取消均不写顺序。
- [ ] 添加键盘上移/下移同等排序测试；当前第一条不可上移、末条不可下移；排序后焦点可继续操作，朗读区提示新位置。
- [ ] 运行 build 和 browser 测试，确认新增行为失败。
- [ ] 实现独立拖动把手、落点样式与上移下移替代控件。文字本体不设置 draggable，保留复制能力。拖动期间抑制误触选择。
- [ ] 增加浅色、深色、窄窗口检查：无横向溢出，完整身份可读，操作不遮挡；保留现有锁定、失败提示及 WorkBuddy 回归断言。
- [ ] 更新 README，明确整组覆盖/恢复、记住标签、排序、新条目末尾和不跨设备同步。
- [ ] 运行 `node --test tests/*.test.mjs`、`node scripts/build.mjs`、`node tests/browser.mjs`；检查 `git diff --check` 和最终 diff。browser 脚本会重写截图，逐一核对，不夹带无关产物。
- [ ] 独立审查仅在用户授权成员后安排；否则先完成自身复查并如实标明无独立审查。提交或安装前另行获得授权。

## 自查与交付
三个任务覆盖规格全部六项验收；分类、排序和持久化接口一致，五项 Review Focus 均有对应测试。构建只证明本地实现，不证明当前 GUI 已启用。交付变更与测试证据，安装/启用及现有 GUI 验收另列，不能以本地测试代替。
