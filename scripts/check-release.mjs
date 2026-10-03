import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const issues = [];
const publishing = process.argv.includes('--publish');
if (publishing && pkg.private !== false) issues.push('npm 发布仍未授权：确认发布后才将 private 改为 false。');
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
if (pkg.engines?.dsh !== '0.2.0-rc.2') issues.push('当前仅验证 DSH 0.2.0-rc.2；扩大兼容范围前需补充验证记录。');
if (issues.length) {
  console.log('发布检查尚未通过（不执行发布）：');
  issues.forEach((issue) => console.log(`- ${issue}`));
  process.exitCode = 1;
} else {
  console.log('发布文件检查通过；这不代表已执行 npm 发布或目录收录。');
  if (pkg.private) console.log('npm 发布保持禁用；仅进行源码仓库准备和本地验证。');
}
