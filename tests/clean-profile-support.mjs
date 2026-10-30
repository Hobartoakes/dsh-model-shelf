// Test-only safety seams shared by the opt-in Windows runner and pure regression tests.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { connect } from 'node:net';

export const runtimeVersions = ['0.2.1-rc.2', '0.2.1-rc.4', '0.2.1-rc.5', '0.2.2-alpha.2'];
export function selectCarrier(ambient) {
  const { DSH_TEST_CLI_ENTRY: entry, DSH_TEST_NODE_EXECUTABLE: node } = ambient;
  assert.equal(Boolean(entry), Boolean(node), 'Set both DSH_TEST_CLI_ENTRY and DSH_TEST_NODE_EXECUTABLE');
  if (entry) return { command: node, args: [entry], electron: false };
  const install = ambient.DSH_TEST_INSTALL_DIR ?? join(ambient.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness');
  return { command: join(install, 'DeepSeek Harness.exe'), args: ['--expose-internals', join(install, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')], electron: true };
}

export async function createIsolation(root, node, ambient) {
  const env = {};
  for (const name of ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'OS', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS']) {
    const key = Object.keys(ambient).find(key => key.toLowerCase() === name.toLowerCase());
    if (key) env[name] = ambient[key];
  }
  const dirs = { DSH_HOME: 'dsh-home', DSH_AGENTS_HOME: 'agents-home', HOME: 'user', USERPROFILE: 'user', APPDATA: 'appdata', LOCALAPPDATA: 'localappdata', TEMP: 'tmp', TMP: 'tmp', PNPM_HOME: 'pnpm-home', XDG_CONFIG_HOME: 'xdg-config', XDG_CACHE_HOME: 'xdg-cache', XDG_DATA_HOME: 'xdg-data', npm_config_store_dir: 'store' };
  for (const [key, path] of Object.entries(dirs)) { env[key] = resolve(root, path); await mkdir(env[key], { recursive: true }); }
  const cwd = resolve(root, 'cwd'); await mkdir(cwd, { recursive: true });
  env.PATH = [dirname(node), join(env.SystemRoot ?? 'C:/Windows', 'System32'), env.SystemRoot ?? 'C:/Windows'].join(process.platform === 'win32' ? ';' : ':');
  Object.assign(env, { CI: 'true', NO_COLOR: '1', DSH_TELEMETRY_DISABLED: '1', COREPACK_ENABLE_AUTO_PIN: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', npm_config_ignore_scripts: 'true', npm_config_ignore_pnpmfile: 'true', npm_config_registry: 'https://registry.npmjs.org/', npm_config_update_notifier: 'false' });
  for (const kind of ['user', 'global']) { env[`npm_config_${kind}config`] = join(root, `${kind}.npmrc`); await writeFile(env[`npm_config_${kind}config`], '', { flag: 'wx' }); }
  return { env, cwd };
}

// Edge needs the real Windows identity root for known-folder lookup, even with
// --user-data-dir. This is browser-only; no environment spread from the caller.
export function browserEnvironment(isolated, ambient) {
  assert.ok(ambient.USERPROFILE, 'Windows browser requires platform USERPROFILE');
  return { ...isolated, USERPROFILE: ambient.USERPROFILE };
}

export function normalizeArchive(input, base) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^[a-z]:[\\/]/i.test(input)) {
    const url = new URL(input);
    assert.ok(url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && !url.search && !url.hash && /^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+\.tgz$/.test(url.pathname), 'Refusing unsafe archive URL');
    return url.href;
  }
  return resolve(base, input);
}

export function assertRuntimeVersion(output, expected) {
  const actual = output.trim();
  assert.match(actual, /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/, 'Invalid runtime version output');
  assert.ok(runtimeVersions.includes(actual), 'Untested runtime version refused');
  if (expected) assert.equal(actual, expected, 'Runtime version mismatch');
  return actual;
}

export function parseStartupURL(output, protectedOrigins) {
  const text = output.replace(/\x1b\[[0-9;]*m/g, '');
  // Require the completed announcement line, not a partial token chunk.
  const match = /dsh web:\s+(https?:\/\/[^\s]+)\s/.exec(text);
  if (!match) return null;
  const url = new URL(match[1]);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && Number(url.port) > 0 && !url.username && !url.password, 'Refusing unsafe test origin');
  assert.ok(!protectedOrigins.some(origin => new URL(origin).port === url.port), 'Refusing protected GUI port');
  assert.ok(url.searchParams.get('token'), 'Missing startup token');
  return url;
}

export function redact(text, secrets = []) {
  let result = String(text).replace(/https?:\/\/[^\s"'<>]+/gi, value => {
    try { const url = new URL(value); return url.search || url.hash || url.username || url.password ? `${url.origin}/[REDACTED]` : value; } catch { return '[REDACTED-URL]'; }
  }).replace(/(bearer\s+)[^\s"'<>]+/gi, '$1[REDACTED]')
    .replace(/((?:[?&]|\b)(?:token|api[_-]?key|secret|password)["']?\s*[:=]\s*["']?)[^\s"'<>,&}]+/gi, '$1[REDACTED]');
  for (const secret of secrets) if (secret) result = result.replaceAll(secret, '[REDACTED]');
  return result;
}

export async function fingerprint(files) {
  return Promise.all(files.map(async file => {
    try { return createHash('sha256').update(await readFile(file)).digest('hex'); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }));
}

export async function withFingerprintGuard(files, operation, onCheck = () => {}) {
  const before = await fingerprint(files);
  let value, failure;
  try { value = await operation(); } catch (error) { failure = error; }
  try {
    const after = await fingerprint(files);
    onCheck({ before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) });
    assert.deepEqual(after, before, 'Protected profile fingerprint changed');
  } catch (error) { failure = failure ? new Error(`${failure.message}\n${error.message}`) : error; }
  if (failure) throw failure;
  return value;
}

const bounded = async (promise, ms, message) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(message)), ms); })]); }
  finally { clearTimeout(timer); }
};

export function createProcessOwner({ env, cwd }) {
  const owned = new Set(), receipts = [];
  function launch(command, args) {
    const started = Date.now();
    const child = spawn(command, args, { env, cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const receipt = { pid: child.pid, command, args, started, exited: false, closed: false };
    const item = { child, receipt, output: '', error: null }; receipts.push(receipt); owned.add(item);
    const collect = data => { item.output = (item.output + data.toString()).slice(-200000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', error => { item.error = error; });
    child.on('exit', (code, signal) => { Object.assign(receipt, { exited: true, code, signal }); });
    item.done = new Promise(resolve => child.once('close', (code, signal) => { Object.assign(receipt, { closed: true, code, signal }); owned.delete(item); resolve(item); }));
    return item;
  }
  async function stop(item) {
    if (item.receipt.closed) return;
    if (!item.receipt.exited && item.child.pid) {
      if (process.platform === 'win32') {
        // The live ChildProcess is the ownership capability. Re-check executable,
        // creation time and command-line marker before any PID-specific tree kill.
        const quote = value => `'${String(value).replaceAll("'", "''")}'`;
        const expected = resolve(item.receipt.command);
        const marker = item.receipt.args.find(arg => /\.(?:mjs|js)$/i.test(arg)) ?? item.receipt.args[0] ?? '';
        const script = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${item.child.pid}'; if ($null -eq $p) { exit 0 }; if ($p.ExecutablePath -ne ${quote(expected)} -or ([DateTimeOffset]$p.CreationDate).ToUnixTimeMilliseconds() -lt ${startedFloor(item.receipt.started)} -or -not $p.CommandLine.Contains(${quote(marker)})) { Write-Error 'Owned process identity mismatch'; exit 91 }; & taskkill.exe /PID ${item.child.pid} /T /F; exit $LASTEXITCODE`;
        const killer = launch(join(env.SystemRoot ?? 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script]);
        await bounded(killer.done, 30000, 'Owned process-tree terminator timed out');
        if (killer.receipt.code !== 0 && !item.receipt.closed) throw Error('Owned process-tree termination failed: ' + redact(killer.output));
      } else item.child.kill('SIGKILL');
    }
    await bounded(item.done, 15000, 'Owned process did not exit; handle retained for finally cleanup');
  }
  async function run(command, args, timeout = 120000) {
    const item = launch(command, args);
    try {
      await bounded(item.done, timeout, 'Test CLI timed out');
      if (item.error) throw item.error;
      if (item.receipt.code !== 0) throw Error(`Test CLI exit ${item.receipt.code}: ${redact(item.output).slice(-10000)}`);
      return item.output;
    } finally { await stop(item); }
  }
  return { launch, stop, run, receipts, get activeCount() { return owned.size; }, async closeAll() {
    const failures = [];
    for (const item of [...owned]) try { await stop(item); } catch (error) { failures.push(error.message); }
    if (failures.length || owned.size) throw Error('Owned cleanup failed: ' + failures.join('; '));
  } };
}
const startedFloor = value => value - 2000;

export async function assertListenerClosed(url) {
  await new Promise((resolve, reject) => {
    const socket = connect({ host: url.hostname === '[::1]' ? '::1' : url.hostname, port: Number(url.port) });
    socket.setTimeout(2000);
    socket.once('connect', () => { socket.destroy(); reject(Error('Owned test listener remains open')); });
    socket.once('error', error => { socket.destroy(); error.code === 'ECONNREFUSED' ? resolve() : reject(error); });
    socket.once('timeout', () => { socket.destroy(); reject(Error('Cannot establish owned listener cleanup')); });
  });
}
