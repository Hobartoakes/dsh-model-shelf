import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const docs = ['README.md', 'CHANGELOG.md', 'docs/VALIDATION.md', 'docs/RELEASE-CHECKLIST.md', 'docs/HOST-COMPATIBILITY.md'];
const whitelist = '0.2.1-rc.2 || 0.2.1-rc.4 || 0.2.1-rc.5 || 0.2.2-alpha.2';
const current = '## 1.3.1 当前验证（未发布）\n\n| DSH | 真实边界 | 离线 UI | 完整 runtime |\n| --- | --- | --- | --- |\n| 0.2.1-rc.2 | PASS | PASS | PASS |\n| 0.2.1-rc.4 | PASS | PASS | PASS |\n| 0.2.1-rc.5 | PASS | PASS | PASS |\n| 0.2.2-alpha.2 | PASS | PASS | PASS |\n\n未安装到日常环境。\n';
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'shelf-release-'));
  try {
    await mkdir(join(root, 'scripts')); await mkdir(join(root, 'docs/images'), { recursive: true }); await mkdir(join(root, 'lib'));
    await writeFile(join(root, 'scripts/check-release.mjs'), await readFile(new URL('../scripts/check-release.mjs', import.meta.url)));
    const pkg = { name: 'dsh-model-shelf', version: '1.3.1', private: false, author: 'Hobartoakes', repository: 'git+https://github.com/Hobartoakes/dsh-model-shelf.git', license: 'MIT', engines: { dsh: whitelist }, files: [...docs, 'lib', 'docs/images/*.png'] };
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg));
    await writeFile(join(root, 'LICENSE'), 'MIT License\nHobartoakes\nPermission is hereby granted');
    for (const path of ['lib/index.js', 'lib/client.js', 'docs/images/main-list.png', 'docs/images/uncommon-list.png', 'docs/images/dark-list.png']) await writeFile(join(root, path), 'fixture');
    for (const path of docs) await writeFile(join(root, path), current + (path === 'docs/VALIDATION.md' ? '\n## 范围与结果\n- 包：**dsh-model-shelf 1.3.1**\n' : ''));
    const run = () => spawnSync(process.execPath, [join(root, 'scripts/check-release.mjs')], { cwd: root, encoding: 'utf8' });
    await fn({ root, pkg, run });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('release gate accepts exact tested matrix without pretending publication', () => fixture(async ({ run }) => {
  const result = run(); assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /不代表|not.*publish/i);
}));

test('release gate refuses every broad or untested host admission expression', () => fixture(async ({ root, pkg, run }) => {
  for (const dsh of ['*', '^0.2.1-rc.2', '>=0.2.1-rc.2', '0.2.1-rc.2', whitelist + ' || 0.2.1-rc.3', whitelist + ' || 0.2.2', whitelist + ' || 0.3.0']) {
    await writeFile(join(root, 'package.json'), JSON.stringify({ ...pkg, engines: { dsh } }));
    const result = run(); assert.equal(result.status, 1, dsh); assert.match(result.stdout, /白名单|matrix|精确/i);
  }
}));

test('historical mention cannot stand in for current evidence in any of five docs', () => fixture(async ({ root, run }) => {
  for (const path of docs) {
    const original = await readFile(join(root, path), 'utf8');
    await writeFile(join(root, path), original.replace('## 1.3.1 当前验证（未发布）', '## 1.3.0 历史记录'));
    const result = run(); assert.equal(result.status, 1, path); assert.ok(result.stdout.includes(path));
    await writeFile(join(root, path), original);
  }
}));

test('release gate requires all three tiers per runtime in current matrix documents', () => fixture(async ({ root, run }) => {
  for (const path of ['README.md', 'docs/VALIDATION.md', 'docs/HOST-COMPATIBILITY.md']) {
    const original = await readFile(join(root, path), 'utf8');
    for (const changed of [original.replace('| 0.2.1-rc.4 | PASS | PASS | PASS |', ''), original.replace('| 0.2.2-alpha.2 | PASS | PASS | PASS |', '| 0.2.2-alpha.2 | PASS | PASS | PENDING |')]) {
      await writeFile(join(root, path), changed); const result = run(); assert.equal(result.status, 1, path); assert.ok(result.stdout.includes(path));
    }
    await writeFile(join(root, path), original);
  }
}));

test('repository current docs satisfy the release contract rather than only historical mentions', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/check-release.mjs', import.meta.url))], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('release gate requires shipped docs and current validation package identity', () => fixture(async ({ root, pkg, run }) => {
  await writeFile(join(root, 'package.json'), JSON.stringify({ ...pkg, files: docs.filter(path => path !== 'docs/HOST-COMPATIBILITY.md') }));
  assert.equal(run().status, 1);
  await writeFile(join(root, 'package.json'), JSON.stringify(pkg));
  await writeFile(join(root, 'docs/VALIDATION.md'), current + '\n## 范围与结果\n- 包：**dsh-model-shelf 1.3.0**\n');
  assert.equal(run().status, 1);
}));
