import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { archives, checkedDirectory, pins } from './archives.mjs';
import { createIsolation, browserEnvironment } from '../clean-profile-support.mjs';

const [mode] = process.argv.slice(2);
assert.ok(process.argv.length === 3 && ['--prepare', '--offline'].includes(mode), 'Use --prepare or --offline');
if (mode === '--prepare') {
  await archives({ prepare: true });
  console.log('Verified registry archives:', pins.archives.length);
} else {
  const artifacts = fileURLToPath(new URL('../artifacts', import.meta.url));
  await checkedDirectory(artifacts);
  const root = await mkdtemp(join(artifacts, 'codex-profile-'));
  try {
    const { env, cwd } = await createIsolation(root, process.execPath, process.env);
    Object.assign(env, { NO_PROXY: '*', NODE_TEST_CONTEXT: 'offline' });
    if (process.env.DSH_TEST_BROWSER_EXECUTABLE) env.SHELF_BROWSER_EXE = process.env.DSH_TEST_BROWSER_EXECUTABLE;
    await archives({ into: root }); // no network fallback and no preexisting modules
    const worker = fileURLToPath(new URL('exercise.mjs', import.meta.url));
    // Edge requires the OS identity root to look up Windows known folders.
    // Pass only that one browser argument, not the parent's environment.
    const identity = browserEnvironment(env, process.env).USERPROFILE ?? '';
    const child = spawn(process.execPath, [worker, root, identity], { cwd, env, stdio: 'inherit', windowsHide: true });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    if (code !== 0) process.exitCode = code || 1;
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
}
