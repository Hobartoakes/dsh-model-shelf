import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { create as createTar } from 'tar';

const repo = fileURLToPath(new URL('../', import.meta.url));
const docs = ['README.md', 'CHANGELOG.md', 'docs/VALIDATION.md', 'docs/RELEASE-CHECKLIST.md', 'docs/HOST-COMPATIBILITY.md'];
const matrixDocs = ['README.md', 'docs/HOST-COMPATIBILITY.md', 'docs/VALIDATION.md'];
const version = '1.6.0';
const releaseCommit = 'a73633645e67155564736a738dc10412c165bd97';
const releasedClientSHA256 = '2194c0c72775533d1f109ca2e53455fb48d10f39b4001d8d53d39d7922304f00';
const heading = '## ' + version + ' 发布与验证';
const pilot = 'f88baf4c10f821900b789913f0345f639c70858a6066df89c6bb42f633d7b6b7';
const published = '934f9368f5c34fc6e66b987784b2bdda9da966d3ea35d13f0c6e9bbc912acc96';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const gate = (root, ...args) => spawnSync(process.execPath, [join(root, 'scripts/check-release.mjs'), ...args], { cwd: root, encoding: 'utf8' });
function passes(result) { assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout; }
function refuses(result, message) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, message);
}

function refusesOnlyChangedClient(result) {
  refuses(result, /生产客户端字节与旧宿主修复后复验的候选不符/);
  assert.equal(result.stdout.match(/^- /gm)?.length, 1, result.stdout);
}

// Source inputs from the immutable release tree, not the moving checkout. Never fetch on a miss.
const releasedBlobs = new Map();
function releasedBlob(path) {
  if (releasedBlobs.has(path)) return releasedBlobs.get(path);
  const object = releaseCommit + ':' + path;
  const r = spawnSync('git', ['--no-lazy-fetch', '--no-replace-objects', 'cat-file', 'blob', object], { cwd: repo });
  assert.equal(r.status, 0, 'Missing offline v' + version + ' fixture (local Git with --no-lazy-fetch required): ' +
    object + '\n' + (r.error?.message ?? r.stderr?.toString()));
  if (path === 'lib/client.js') assert.equal(sha256(r.stdout), releasedClientSHA256, 'wrong released client SHA-256');
  releasedBlobs.set(path, r.stdout);
  return r.stdout;
}

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'shelf-gate-'));
  try {
    await mkdir(join(root, 'scripts'));
    await copyFile(join(repo, 'scripts/check-release.mjs'), join(root, 'scripts/check-release.mjs'));
    for (const path of [...docs, 'package.json', 'LICENSE', 'lib/client.js', 'lib/index.js',
      ...['main-list', 'uncommon-list', 'dark-list'].map(name => 'docs/images/' + name + '.png')]) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), releasedBlob(path));
    }
    const text = path => readFile(join(root, path), 'utf8');
    const put = (path, value) => writeFile(join(root, path), value);
    const run = (...args) => gate(root, ...args);
    await fn({ root, text, put, run, pkg: JSON.parse(await text('package.json')) });
  } finally { await rm(root, { recursive: true, force: true }); }
}

async function changedDoc({ text, put, run }, path, old, replacement) {
  const original = await text(path);
  assert.ok(original.includes(old), 'fixture does not contain ' + old);
  await put(path, original.replace(old, () => replacement));
  try { refuses(run(), new RegExp(path.replaceAll('.', '\\.'))); }
  finally { await put(path, original); }
}

test('pre-pack check accepts the pinned stable package, not a claim of final acceptance', () => fixture(({ run }) => {
  assert.match(passes(run()), /打包前.*不代表.*桌面验收/);
}));

test('pre-pack check still checks the actual worktree and its client bytes', async () => {
  const digest = sha256(await readFile(join(repo, 'lib/client.js')));
  const result = gate(repo);
  if (digest === releasedClientSHA256) assert.match(passes(result), /打包前.*不代表.*桌面验收/);
  else refusesOnlyChangedClient(result);
});

test('GitHub-only release refuses npm even with historical registry settings', () => fixture(async ({ pkg, put, run }) => {
  refuses(run('--publish'), /不发布到 npm/);
  await put('package.json', JSON.stringify({ ...pkg, private: false, publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/', tag: 'latest' } }));
  refuses(run(), /private: true/);
  refuses(run('--publish'), /不发布到 npm/);
  refuses(run('--final-desktop'), /用法/);
  refuses(run('--typo'), /用法/);
}));

test('gate rejects old whitelist, missing floor/ceiling and next-line prerelease leakage', () => fixture(async ({ pkg, put, run }) => {
  for (const dsh of ['*', '0.2.2-rc.5', '0.2.1-rc.2 || 0.2.1-rc.4 || 0.2.1-rc.5 || 0.2.2-alpha.2 || 0.2.2-rc.1 || 0.2.2-rc.3',
    '>=0.0.1-rc.5', '>=0.0.1-rc.1 <0.3.0-0', '>=0.0.1-rc.5 <0.3.0']) {
    await put('package.json', JSON.stringify({ ...pkg, engines: { dsh } }));
    refuses(run(), /engines\.dsh.*准入/);
  }
}));

test('five shipped documents must each distinguish this stable release from history', () => fixture(async f => {
  for (const path of docs) {
    await changedDoc(f, path, heading, '## ' + version + ' 历史记录');
    await changedDoc(f, path, heading, heading + '（未验证）');
  }
  await changedDoc(f, 'README.md', heading, heading + '\n\n' + heading);
}));

test('current evidence summaries cannot promote inventory, offline UI, pilot or untested hosts', () => fixture(async f => {
  for (const path of matrixDocs) {
    for (const row of ['官方包契约 | 逐版另查', '离线 UI | 45/45', 'Windows 0.2.2-rc.5 | 查同包记录', '其他桌面宿主 | 未测', '最终归档 | 包外验收']) {
      await changedDoc(f, path, row, row.split(' | ')[0] + ' | PASS');
    }
  }
  await changedDoc(f, 'README.md', '| 其他桌面宿主 | 未测', '| 0.2.3-alpha.2 | PASS | 桌面 |\n| 其他桌面宿主 | 未测');
}));

test('pilot has its own immutable record; the new tgz hash does not go inside the tgz', () => fixture(async f => {
  const path = 'docs/VALIDATION.md';
  await changedDoc(f, path, pilot, published);
  await changedDoc(f, path, 'clean-0.2.2-rc.5-1795363695552-3d73b594/result.json', 'clean-older-run/result.json');
  for (const digest of [pilot, published, 'a'.repeat(64)]) {
    await changedDoc(f, 'CHANGELOG.md', heading, heading + '\n最终归档 SHA-256：' + digest);
  }
}));

test('old evidence remains bound to its own archive and cannot become current rc.3 coverage', () => fixture(async f => {
  const path = 'docs/HOST-COMPATIBILITY.md';
  for (const binding of [published, '5a8d72f741c770cc55cdf379fc120f8412a4c798', '2adb0e7bee1d107013ad2b5947ec3ad46912d04fc539c2427801558719484f22', 'c6835819f86f9a24ed9514b718f97681198ee82f']) {
    await changedDoc(f, path, binding, 'missing');
  }
  await changedDoc(f, path, '| 0.2.2-rc.3 | PASS | PASS | PASS |', '| 0.2.2-rc.3 | PASS | PASS | 未测 |');
}));

test('current validation scope, shipped docs, assets, license and candidate bytes are required', () => fixture(async f => {
  await changedDoc(f, 'docs/VALIDATION.md', '- 包：**dsh-model-shelf ' + version + '**', '- 包：**dsh-model-shelf 1.5.3**');
  await f.put('package.json', JSON.stringify({ ...f.pkg, files: f.pkg.files.filter(path => path !== 'docs/HOST-COMPATIBILITY.md') }));
  refuses(f.run(), /HOST-COMPATIBILITY\.md.*files/);
  await f.put('package.json', JSON.stringify({ ...f.pkg, files: [...f.pkg.files, 'dist-draft'] }));
  refuses(f.run(), /包外/);
  await f.put('package.json', JSON.stringify(f.pkg));
  await f.put('lib/client.js', 'not the repaired client');
  refuses(f.run(), /客户端字节/);
  await rm(join(f.root, 'docs/images/main-list.png'));
  await f.put('LICENSE', 'missing terms');
  const result = f.run(); refuses(result, /LICENSE/); assert.match(result.stdout, /main-list\.png/);
}));

// Only an isolated checker fixture. It does not install a host or supply release evidence.
async function desktopFixture(f) {
  const archive = join(f.root, 'dsh-model-shelf-' + version + '.tgz');
  const path = join(f.root, 'desktop-result.json');
  await createTar({ gzip: true, cwd: f.root, prefix: 'package/', file: archive }, ['package.json', 'lib', ...docs]);
  const route = model => JSON.stringify(['test-provider', model]);
  const shelf = (label, from, to) => ({ label, success: true, pageErrors: [], expectedPlugin: true, routeBefore: route(from),
    selectedKey: route(to), routeAfterReload: route(to), labelBefore: 'TEST ' + from, labelAfter: 'TEST ' + to });
  const native = (label, model) => ({ label, success: true, pageErrors: [], expectedPlugin: false, nativeFallback: true,
    nativeMenu: { trigger: 'Select ' + model, expanded: true, text: 'Model: ' + model } });
  const fingerprints = ['manifest', 'patch', 'lock', 'package', 'client'].map(sha256);
  const receipt = { checks: ['uninstall removes dependency and bundle without orphaned plugin patch rows'], archiveSHA256: sha256(await readFile(archive)), clientSHA256: sha256(await readFile(join(f.root, 'lib/client.js'))),
    packageVersion: version, installedVersion: version, success: true, carrier: 'Windows Desktop', runtime: { actual: '0.2.2-rc.5' },
    phases: [shelf('installed', 'a', 'b'), native('disabled', 'b'), shelf('reenabled', 'b', 'a'), native('uninstalled', 'a')],
    protectedFiles: { unchanged: true, before: fingerprints, after: [...fingerprints] }, activeProcesses: 0, browserClosed: true, providerStats: { streams: 0 },
    realModelCalls: false, credentialCopies: false, installScripts: false };
  return { archive, receipt, async check(r) { await writeFile(path, JSON.stringify(r)); return f.run('--final-desktop', archive, path); } };
}

test('one changed client byte invalidates an otherwise accepted archive and receipt', () => fixture(async f => {
  const { receipt, check } = await desktopFixture(f);
  passes(await check(receipt));
  const client = await readFile(join(f.root, 'lib/client.js'));
  client[0] ^= 1;
  await f.put('lib/client.js', client);
  refusesOnlyChangedClient(await check(receipt));
}));

test('external desktop check hashes the supplied archive; even a same-version repack invalidates the receipt', () => fixture(async f => {
  const { archive, receipt, check } = await desktopFixture(f);
  assert.match(passes(await check(receipt)), new RegExp(receipt.archiveSHA256));
  for (const change of [{ archiveSHA256: pilot }, { packageVersion: '1.5.3' }, { installedVersion: '1.5.3' }, { clientSHA256: '0'.repeat(64) },
    { clientSHA256: '5b9994ad20eceaea799bcb6b1467d09982289e6d34ca44708a1ed6c00b053421' } /* pilot, not repaired */,
    { carrier: 'explicit Node + official runCli wrapper' }, { runtime: { actual: '0.2.3-alpha.2' } }, { success: false }]) {
    refuses(await check({ ...receipt, ...change }), /桌面记录/);
  }
  await writeFile(archive, Buffer.concat([await readFile(archive), Buffer.from('changed')]));
  refuses(await check(receipt), /SHA-256/);
}));

test('external receipt must show a real switch, native menus and clean shutdown, not just PASS', () => fixture(async f => {
  const { receipt, check } = await desktopFixture(f);
  for (const change of [r => r.phases.pop(), r => { r.phases[0].routeBefore = r.phases[0].selectedKey; },
    r => { delete r.phases[0].labelAfter; }, r => { r.phases[2].routeAfterReload = r.phases[2].routeBefore; },
    r => { r.phases[1].nativeMenu.expanded = false; }, r => { r.phases[3].nativeMenu.text = ''; },
    r => { r.phases[0].pageErrors.push('error'); }, r => { r.protectedFiles.unchanged = false; },
    r => { r.protectedFiles.after[1] = 'changed'; }, r => { r.checks = []; }, r => { r.activeProcesses = 1; }, r => { r.providerStats.streams = 1; }]) {
    const r = structuredClone(receipt); change(r); refuses(await check(r), /桌面记录/);
  }
}));
