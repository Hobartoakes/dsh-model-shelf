import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const issues = [];
const publishing = process.argv.includes('--publish');
if (pkg.private !== true) issues.push('GitHub 发行包必须保留 private: true 防止误发 npm。');
if (publishing) issues.push('本版仅通过 GitHub Releases 发行，不发布到 npm。');
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

// Component results, the pre-fix pilot and the exact stable desktop receipt are distinct.
// A final tgz digest belongs outside the archive.
const historical = pkg.version === '1.6.0';
const CANDIDATE = historical ? {
  version: '1.6.0', runtime: '0.2.2-rc.5', range: '>=0.0.1-rc.5 <0.3.0-0',
  client: '2194c0c72775533d1f109ca2e53455fb48d10f39b4001d8d53d39d7922304f00',
} : {
  version: '1.7.0', runtime: '0.2.2-rc.5', range: '>=0.0.1-rc.5 <0.3.0-0',
  client: '8171dcb86fd60d47c04eb69a8da900478fd7533f80a9efab4a20a3dab96c78f4',
};
const PILOT = {
  runtime: '0.2.2-rc.5',
  archive: 'f88baf4c10f821900b789913f0345f639c70858a6066df89c6bb42f633d7b6b7',
  client: '5b9994ad20eceaea799bcb6b1467d09982289e6d34ca44708a1ed6c00b053421',
  report: 'tests/artifacts/clean-0.2.2-rc.5-1795363695552-3d73b594/result.json',
};
const HISTORY = {
  title: '1.5.3 历史验证（已发布）',
  commit: '5a8d72f741c770cc55cdf379fc120f8412a4c798',
  archive: '934f9368f5c34fc6e66b987784b2bdda9da966d3ea35d13f0c6e9bbc912acc96',
  previousCommit: 'c6835819f86f9a24ed9514b718f97681198ee82f',
  previousArchive: '2adb0e7bee1d107013ad2b5947ec3ad46912d04fc539c2427801558719484f22',
  runtimes: ['0.2.1-rc.2', '0.2.1-rc.4', '0.2.1-rc.5', '0.2.2-alpha.2', '0.2.2-rc.1', '0.2.2-rc.3'],
};
const args = process.argv.slice(2);
const finalDesktop = args.length === 3 && args[0] === '--final-desktop';
if (args.length && !finalDesktop && !(args.length === 1 && publishing)) issues.push('用法：check-release.mjs [--final-desktop <final.tgz> <result.json> | --publish]');
const LOCAL_FINAL = '2e20f89bb7569ed0da2fdf02bba3f3875ecc3d81a78e64d9b94be67f1d60b300';
if (pkg.version !== CANDIDATE.version) issues.push('版本已变；请为新版本绑定自己的证据。');
if (pkg.engines?.dsh !== CANDIDATE.range) issues.push('engines.dsh 的准入应为 ' + CANDIDATE.range + '（不等于逐版实测）。');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  if (sha256(await readFile(new URL('lib/client.js', root))) !== CANDIDATE.client) issues.push(historical ? '生产客户端字节与旧宿主修复后复验的候选不符；须重新取得相应证据。' : '生产客户端字节与 1.7.0 独立验收的候选不符。');
} catch { issues.push('无法核对本候选生产客户端字节。'); }

const docs = ['README.md', 'CHANGELOG.md', 'docs/VALIDATION.md', 'docs/RELEASE-CHECKLIST.md', 'docs/HOST-COMPATIBILITY.md'];
const matrixDocs = ['README.md', 'docs/VALIDATION.md', 'docs/HOST-COMPATIBILITY.md'];
const currentTiers = [['官方包契约', '逐版另查'], ['离线 UI', historical ? '45/45' : '50/50'], ['Windows ' + CANDIDATE.runtime, '查同包记录'], ['其他桌面宿主', '未测'], ['最终归档', '包外验收']];
const sectionsOf = text => text.replace(/\r\n/g, '\n').split(/^## /m).slice(1).map(block => {
  const [title, ...lines] = block.split('\n'); return { title, body: lines.join('\n') };
});
const rowsOf = body => body.split('\n').filter(line => line.startsWith('|')).map(line => line.split('|').slice(1, -1).map(s => s.trim()));

function checkHistory(path, history) {
  if (![HISTORY.commit, HISTORY.archive, HISTORY.previousCommit, HISTORY.previousArchive].every(id => history.includes(id))) {
    issues.push(path + ' 的历史章节缺失旧源码/旧归档绑定。');
  }
  const rows = rowsOf(history);
  for (const host of HISTORY.runtimes) {
    const status = host === '0.2.2-rc.3' ? 'PASS' : 'HISTORICAL';
    if (!rows.some(row => isDeepStrictEqual(row, [host, status, status, status]))) issues.push(path + ' 的历史三层记录已变：' + host);
  }
}

for (const path of docs) {
  let sections;
  try { sections = sectionsOf(await readFile(new URL(path, root), 'utf8')); }
  catch { issues.push('缺少文档：' + path); continue; }
  const title = pkg.version + ' 发布与验证';
  if (sections[0]?.title !== title || sections.filter(s => s.title.startsWith(title)).length !== 1) issues.push(path + ' 必须以唯一的本版发布与验证章节开头。');
  const current = sections.find(s => s.title === title)?.body ?? '';
  const scope = sections.find(s => s.title === '范围与结果')?.body ?? '';
  if (matrixDocs.includes(path)) {
    const rows = rowsOf(current).slice(2); // header and Markdown alignment row
    if (!current.includes(CANDIDATE.range) || !isDeepStrictEqual(rows.map(row => row.slice(0, 2)), currentTiers) || rows.some(row => row.length !== 3 || !row[2])) {
      issues.push(path + ' 当前矩阵须区分准入、逐版官方包契约、离线 UI、同包桌面、未测和包外验收。');
    }
    checkHistory(path, sections.find(s => s.title === HISTORY.title)?.body ?? '');
  }
  const pilotLabel = 'Pilot 归档 SHA-256：' + '`' + PILOT.archive + '`';
  if (path === 'docs/VALIDATION.md') {
    const legacy = historical ? current : sections.find(s => s.title === '1.6.0 发布与验证')?.body ?? '';
    if (!legacy.includes(pilotLabel) || !legacy.includes('](../' + PILOT.report + ')')) issues.push(path + ' 缺少 pilot 归档与对应实测的绑定。');
    if (!scope.trimStart().startsWith('- 包：**dsh-model-shelf ' + pkg.version + '**') || !scope.includes('releases/download/v' + CANDIDATE.version + '/release-integrity.json')) issues.push(path + ' 范围与结果须指明当前包及包外验收记录。');
  }
  const described = path === 'docs/VALIDATION.md' ? current.replace(pilotLabel, '') + scope : current;
  if (/\b[a-f0-9]{64}\b/i.test(described)) issues.push(path + ' 当前章节不可借用旧哈希或嵌入最终归档的 SHA-256；该值只存包外。');
}

// A files entry can name a file, a glob, or an entire ancestor directory.
function ships(file) {
  const parts = file.split('/');
  return (pkg.files ?? []).some(pattern => typeof pattern === 'string' && parts.some((_, i) => posix.matchesGlob(parts.slice(0, i + 1).join('/'), pattern.replace(/\/$/, ''))));
}
for (const path of docs) if (!ships(path)) issues.push(path + ' 未列入 package.json 的 files。');
for (const path of ['release-integrity.json', 'SHA256SUMS.txt', 'dist-draft/release-' + CANDIDATE.version + '/release-integrity.json', 'dist-draft/final/acceptance.json', 'dist-draft/final/SHA256SUMS', PILOT.report]) {
  if (ships(path)) issues.push(path + ' 必须留在包外。');
}

const nonempty = s => typeof s === 'string' && !!s.trim();
function route(key) {
  try {
    const parts = JSON.parse(key);
    if (Array.isArray(parts) && parts.length === 2 && parts.every(nonempty)) return parts;
  } catch { /* absent or not a full provider/model key */ }
}

// Read the existing runner receipt, never run a host, mint a verdict from a version,
// or infer official-package contract results from desktop evidence.
function checkDesktop(r, digest) {
  const fail = reason => issues.push('桌面记录：' + reason);
  if (r.archiveSHA256 !== digest) fail('归档 SHA-256 与实际字节不符。');
  const previousStable = '81508429bf4fe15db5c1402b86cf8943145deb0cf048e915b093ec8e08487b73';
  if ((!historical && digest === previousStable) || [LOCAL_FINAL, PILOT.archive, HISTORY.archive, HISTORY.previousArchive].includes(digest)) fail('试验、本地或历史归档不能冒作最终包。');
  if (r.clientSHA256 === PILOT.client) fail('修复前 pilot 客户端不能作为修复后客户端的桌面记录。');
  if (r.packageVersion !== pkg.version || r.installedVersion !== pkg.version || r.clientSHA256 !== CANDIDATE.client ||
      r.carrier !== 'Windows Desktop' || r.runtime?.actual !== CANDIDATE.runtime || r.success !== true) fail('包、客户端、官方 Windows 载体、实际宿主版本或成功状态不匹配。');
  const phases = Array.isArray(r.phases) ? r.phases : [];
  if (!isDeepStrictEqual(phases.map(p => p.label), ['installed', 'disabled', 'reenabled', 'uninstalled'])) fail('缺少有序的安装、禁用、重新启用、卸载四阶段。');
  let selected;
  for (const p of phases) {
    const shelf = p.label === 'installed' || p.label === 'reenabled';
    if (p.success !== true || p.expectedPlugin !== shelf || !isDeepStrictEqual(p.pageErrors, [])) fail(p.label + ' 未成功或出现页面错误。');
    if (shelf) {
      const before = route(p.routeBefore); selected = route(p.selectedKey);
      if (!before || !selected || isDeepStrictEqual(before, selected) || p.routeAfterReload !== p.selectedKey ||
          !nonempty(p.labelBefore) || !nonempty(p.labelAfter) || p.labelAfter === p.labelBefore) fail(p.label + ' 缺少实际切换、标签改变或刷新后的完整路由。');
    } else if (p.nativeFallback !== true || p.nativeMenu?.expanded !== true || !nonempty(p.nativeMenu.trigger) ||
               !nonempty(p.nativeMenu.text) || !selected || !p.nativeMenu.text.includes(selected[1])) fail(p.label + ' 未证明原生菜单打开并显示所选模型。');
  }
  const proof = r.protectedFiles;
  if (proof?.unchanged !== true || !Array.isArray(proof.before) || proof.before.length !== 5 || !isDeepStrictEqual(proof.before, proof.after) ||
      r.activeProcesses !== 0 || r.browserClosed !== true || r.providerStats?.streams !== 0 || r.realModelCalls !== false ||
      r.credentialCopies !== false || r.installScripts !== false || !r.checks?.includes('uninstall removes dependency and bundle without orphaned plugin patch rows')) fail('未证明卸载清理、日常指纹保护或隔离安全边界。');
}

let digest;
if (finalDesktop) {
  try {
    if (basename(args[1]) !== pkg.name + '-' + pkg.version + '.tgz') issues.push('最终归档名与当前候选不符。');
    digest = sha256(await readFile(args[1]));
    checkDesktop(JSON.parse(await readFile(args[2], 'utf8')), digest);
  } catch (error) { issues.push('无法核对归档或桌面记录：' + error.message); }
}
if (issues.length) {
  console.log('本地交付检查未通过（不执行发布）：');
  issues.forEach(issue => console.log('- ' + issue));
  process.exitCode = 1;
} else if (finalDesktop) {
  console.log('已核对官方 Windows ' + CANDIDATE.runtime + ' 桌面记录及同一归档 SHA-256：' + digest + '；不代表发布或其他宿主通过。');
} else {
  console.log('打包前文件检查通过；不代表最终归档通过桌面验收或已经发布。');
}
