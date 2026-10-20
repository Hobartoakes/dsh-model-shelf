import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const issues = [];
const publishing = process.argv.includes('--publish');
if (publishing && pkg.private !== false) issues.push('npm 发布仍未授权：确认发布后才将 private 改为 false。');
if (publishing && (pkg.publishConfig?.registry !== 'https://registry.npmjs.org/' || pkg.publishConfig?.access !== 'public' || pkg.publishConfig?.tag !== 'latest')) issues.push('公开发布必须限定官方 npm registry、public 和 latest 标签。');
const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
if (!author || /待补|todo|placeholder/i.test(author)) issues.push('填写真实作者名称。');
const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
if (!repository || !/^git\+https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?$/i.test(repository)) issues.push('填写真实 GitHub 仓库地址（git+https://github.com/owner/repo.git）。');
if (pkg.name !== 'dsh-model-shelf') issues.push('包名应为 dsh-model-shelf。');
if (pkg.license !== 'MIT') issues.push('用户已确认 MIT；license 应为 MIT。');
try {
  const license = await readFile(new URL('LICENSE', root), 'utf8');
  if (!license.startsWith('MIT License') || !license.includes('Hobartoakes') || !license.includes('Permission is hereby granted')) issues.push('LICENSE 内容与 MIT / 作者声明不符。');
} catch { issues.push('缺少实际 LICENSE 文件。'); }
for (const path of ['lib/index.js', 'lib/client.js', 'docs/images/main-list.png', 'docs/images/uncommon-list.png', 'docs/images/dark-list.png']) {
  try { await access(new URL(path, root)); } catch { issues.push(`缺少发布文件：${path}`); }
}
const SUPPORTED_DSH = '0.2.1-rc.2';
if (pkg.engines?.dsh !== SUPPORTED_DSH) issues.push(`当前仅验证 DSH ${SUPPORTED_DSH}；扩大兼容范围前需补充验证记录。`);

// 文档与当前版本同步：版本一变，这些文档都要跟着改，漏改会在发布前暴露，
// 而不是等到用户装完包才发现 README 还写着上一个宿主版本。
const version = pkg.version;
const docs = [
  'README.md',
  'CHANGELOG.md',
  'docs/VALIDATION.md',
  'docs/RELEASE-CHECKLIST.md',
  'docs/HOST-COMPATIBILITY.md'
];
const docText = new Map();
for (const path of docs) {
  try { docText.set(path, await readFile(new URL(path, root), 'utf8')); }
  catch { issues.push(`缺少文档：${path}`); }
}
const doc = (path) => docText.get(path) ?? '';
// 1. CHANGELOG 必须有当前版本的条目，且不能仍是"未发布"占位（除非本就没打算发布）。
if (!doc('CHANGELOG.md').includes(`## ${version}`)) {
  issues.push(`CHANGELOG.md 缺少 ${version} 的版本条目。`);
}
// 2. README 的兼容性表必须声明当前验证的宿主版本。
if (!doc('README.md').includes(SUPPORTED_DSH)) {
  issues.push(`README.md 未声明已验证的 DSH ${SUPPORTED_DSH}。`);
}
// 3. VALIDATION 的"范围与结果"必须指向当前版本，而不是上一个。
// 只查"文档里出现过当前版本号"太弱：历史小节同样会提到它。这里锚定
// "范围与结果"小节的第一行"包：…"——那一行描述的是"本次验证的对象"，
// 版本一变它就必须改，正是最容易漏的一处。
const validation = doc('docs/VALIDATION.md');
const scopeMatch = /## 范围与结果[\s\S]*?\n\s*-\s*包：\*\*dsh-model-shelf ([^*]+)\*\*/.exec(validation);
if (scopeMatch === null) {
  issues.push('docs/VALIDATION.md 缺少"范围与结果"小节的"包：dsh-model-shelf <版本>"行。');
} else if (scopeMatch[1].trim() !== version) {
  issues.push(`docs/VALIDATION.md 的"范围与结果"仍写 ${scopeMatch[1].trim()}，应为当前版本 ${version}。`);
}
// 4. 每个 docs/*.md 都必须被 package.json 的 files 白名单收录，否则用户装包后看不到。
const shipped = new Set((pkg.files ?? []).filter((entry) => typeof entry === 'string'));
for (const path of docs) {
  if (shipped.has(path)) continue;
  // 允许通配覆盖（如 docs/*.md），逐项判断太脆。
  const covered = [...shipped].some((entry) => {
    const pattern = entry.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
    return new RegExp(`^${pattern}$`).test(path);
  });
  if (!covered) issues.push(`${path} 未列入 package.json 的 files，用户安装后看不到该文档。`);
}
if (issues.length) {
  console.log('发布检查尚未通过（不执行发布）：');
  issues.forEach((issue) => console.log(`- ${issue}`));
  process.exitCode = 1;
} else {
  console.log('发布文件检查通过；这不代表已执行 npm 发布或目录收录。');
  if (pkg.private) console.log('npm 发布保持禁用；仅进行源码仓库准备和本地验证。');
}
