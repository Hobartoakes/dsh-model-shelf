import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
const SUPPORTED_DSH = ['0.2.1-rc.2', '0.2.1-rc.4', '0.2.1-rc.5', '0.2.2-alpha.2', '0.2.2-rc.1', '0.2.2-rc.3'];
const CURRENT_DSH = '0.2.2-rc.3';
const BASELINE_COMMIT = 'c6835819f86f9a24ed9514b718f97681198ee82f';
const BASELINE_ARCHIVE = '2adb0e7bee1d107013ad2b5947ec3ad46912d04fc539c2427801558719484f22';
// A targeted compatibility update does not re-certify the historical archives.
// Historical tiers remain allowed only while the entire executable stays identical.
const BASELINE_CLIENT = '59fa8e89c0a00e48176b91afc65d3035b2352e8d76a9508322fe8e53f8f5a8db';
try {
  const digest = createHash('sha256').update(await readFile(new URL('lib/client.js', root))).digest('hex');
  if (digest !== BASELINE_CLIENT) issues.push('生产客户端字节已变；不得继承历史宿主证据，须重新确定验证范围。');
} catch { issues.push('无法核对生产客户端历史基线字节。'); }
const exactMatrix = SUPPORTED_DSH.join(' || ');
if (pkg.engines?.dsh !== exactMatrix) issues.push(`engines.dsh 必须是精确白名单 ${exactMatrix}；不接受未测试版本或范围。`);

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
// Current evidence must be in a current-version section, not a historical mention.
// Preparation is allowed to remain explicitly unpublished; this check never uploads.
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const currentSections = new Map();
for (const path of docs) {
  const match = new RegExp(`^## ${escapedVersion} 当前验证（(未发布|已发布)）\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm').exec(doc(path));
  if (!match) issues.push(`${path} 缺少 ${version} 当前验证及明确发布状态。`);
  else currentSections.set(path, match[2]);
}
for (const path of ['README.md', 'docs/VALIDATION.md', 'docs/HOST-COMPATIBILITY.md']) {
  const section = currentSections.get(path) ?? '';
  if (!section.includes(BASELINE_COMMIT) || !section.includes(BASELINE_ARCHIVE)) issues.push(`${path} 历史证据缺少精确源码提交或公开归档校验绑定。`);
  for (const runtime of SUPPORTED_DSH) {
    const row = section.split(/\r?\n/).find(line => line.split('|')[1]?.trim() === runtime);
    const cells = row?.split('|').slice(2, 5).map(cell => cell.trim());
    const expected = runtime === CURRENT_DSH ? 'PASS' : 'HISTORICAL';
    if (!cells || cells.length !== 3 || cells.some(cell => cell !== expected)) issues.push(`${path} 缺少 ${runtime} 的真实边界 / 离线 UI / 完整 runtime 三层 ${expected}；当前目标不得借用历史或低层证据。`);
  }
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
