import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Missing safety boundary is an assertion failure rather than an import crash in RED.
const support = await import('./clean-profile-support.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const api = name => { assert.equal(typeof support[name], 'function', `missing safety boundary: ${name}`); return support[name]; };
const temporary = async fn => {
  const root = await mkdtemp(join(tmpdir(), 'shelf-safety-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
};

test('child environment starts empty and isolates home, agents, cwd, npm and all inherited baggage', () => temporary(async root => {
  const create = api('createIsolation');
  const fixture = await create(root, process.execPath, {
    SystemRoot: process.env.SystemRoot ?? 'C:/Windows', PATH: 'untrusted/bin',
    DSH_PROFILE: 'desktop', DSH_SECRET_NEW_FLAG: 'leak', NODE_OPTIONS: '--require bad',
    ELECTRON_RUN_AS_NODE: '1', OPENAI_API_KEY: 'leak', SOME_AUTH: 'leak',
    HTTPS_PROXY: 'https://credentials.invalid', npm_config_userconfig: 'real-config',
  });
  for (const key of ['DSH_PROFILE', 'DSH_SECRET_NEW_FLAG', 'NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'OPENAI_API_KEY', 'SOME_AUTH', 'HTTPS_PROXY']) assert.equal(fixture.env[key], undefined, key);
  assert.notEqual(fixture.env.DSH_HOME, fixture.env.DSH_AGENTS_HOME);
  assert.notEqual(fixture.cwd, fixture.env.HOME);
  assert.notEqual(fixture.env.HOME, fixture.env.DSH_HOME);
  for (const key of ['DSH_HOME', 'DSH_AGENTS_HOME', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'PNPM_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'npm_config_userconfig', 'npm_config_globalconfig', 'npm_config_store_dir']) assert.ok(resolve(fixture.env[key]).startsWith(resolve(root) + '/'.replace('/', process.platform === 'win32' ? '\\' : '/')), key);
  assert.equal(fixture.env.npm_config_ignore_scripts, 'true');
  assert.equal(fixture.env.npm_config_ignore_pnpmfile, 'true');
  assert.equal(await readFile(fixture.env.npm_config_userconfig, 'utf8'), '');
  assert.ok(!fixture.env.PATH.includes('untrusted'));
}));

test('browser only restores Windows platform USERPROFILE without weakening CLI isolation', () => {
  const cli = { USERPROFILE: 'private-user', HOME: 'private-user', LOCALAPPDATA: 'private-local', DSH_HOME: 'private-dsh' };
  const env = api('browserEnvironment')(cli, { USERPROFILE: 'windows-user', API_KEY: 'never-copy', NODE_OPTIONS: 'never-copy', DSH_PROFILE: 'desktop' });
  assert.equal(env.USERPROFILE, 'windows-user');
  assert.equal(cli.USERPROFILE, 'private-user');
  assert.deepEqual(env, { ...cli, USERPROFILE: 'windows-user' });
});

test('explicit runtime requires both entry and executable; default stays Windows Desktop', () => {
  const carrier = api('selectCarrier');
  const selected = carrier({ DSH_TEST_CLI_ENTRY: 'C:/fixture/runtime-cli.mjs', DSH_TEST_NODE_EXECUTABLE: 'C:/tools/node.exe' });
  assert.equal(selected.command, 'C:/tools/node.exe');
  assert.deepEqual(selected.args, ['C:/fixture/runtime-cli.mjs']);
  assert.equal(selected.electron, false);
  assert.throws(() => carrier({ DSH_TEST_CLI_ENTRY: 'x' }), /both/i);
  const desktop = carrier({ LOCALAPPDATA: 'C:/local' });
  assert.equal(desktop.electron, true);
  assert.match(desktop.command, /DeepSeek Harness\.exe$/);
  assert.equal(desktop.args[0], '--expose-internals');
});

test('relative archive is made absolute before isolated child cwd changes', () => {
  const normalize = api('normalizeArchive');
  const root = resolve('fixture-root');
  assert.equal(normalize('dist-draft/shelf.tgz', root), join(root, 'dist-draft', 'shelf.tgz'));
  const url = 'https://github.com/owner/repo/releases/download/v1.3.1/shelf.tgz';
  assert.equal(normalize(url, root), url);
  for (const unsafe of ['http://example.com/shelf.tgz', url + '?token=secret', 'https://user:pass@github.com/owner/repo/releases/download/v1/shelf.tgz', 'file:///private.tgz']) assert.throws(() => normalize(unsafe, root), /refus/i);
});

test('runtime identity rejects mismatches and every version outside the exact matrix', () => {
  const identity = api('assertRuntimeVersion');
  for (const v of ['0.2.1-rc.2', '0.2.1-rc.4', '0.2.1-rc.5', '0.2.2-alpha.2']) assert.equal(identity(v + '\n', v), v);
  for (const v of ['0.2.0-rc.2', '0.2.1-rc.3', '0.2.1-rc.6', '0.2.1', '0.2.2-alpha.1', '0.2.2', '0.3.0']) assert.throws(() => identity(v, v), /untested/i);
  assert.throws(() => identity('0.2.1-rc.2', '0.2.1-rc.4'), /mismatch/i);
  assert.throws(() => identity('warning\n0.2.1-rc.2'), /version/i);
});

test('auth announcements reject protected port, non-loopback, missing token and credentials', () => {
  const parse = api('parseStartupURL');
  assert.equal(parse('starting', ['http://127.0.0.1:59983']), null);
  const url = parse('\x1b[32mdsh web: http://127.0.0.1:44444/?token=test-only\x1b[0m\n', ['http://127.0.0.1:59983']);
  assert.equal(url.origin, 'http://127.0.0.1:44444');
  for (const raw of ['http://127.0.0.1:59983/?token=x', 'http://localhost:59983/?token=x', 'http://example.com:44444/?token=x', 'http://0.0.0.0:44444/?token=x', 'http://127.0.0.1:0/?token=x', 'http://127.0.0.1:44444/', 'http://user:pass@127.0.0.1:44444/?token=x']) assert.throws(() => parse('dsh web: ' + raw + '\n', ['http://127.0.0.1:59983']), /refus|token/i);
});

test('diagnostics redact complete auth URLs, query tokens, bearer values and exact secrets', () => {
  const redact = api('redact');
  const value = redact('http://127.0.0.1:44444/?token=abc-secret&x=y token=xyz Authorization: Bearer bearer-secret {"token":"json-secret"} exact-secret', ['exact-secret']);
  for (const secret of ['abc-secret', 'xyz', 'bearer-secret', 'json-secret', 'exact-secret']) assert.ok(!value.includes(secret), secret);
});

test('protected fingerprints are compared even when the operation fails', () => temporary(async root => {
  const guard = api('withFingerprintGuard');
  const file = join(root, 'package.json'); await writeFile(file, 'before');
  await assert.rejects(guard([file], async () => { await writeFile(file, 'changed'); throw Error('fixture failed'); }), error => /fingerprint/i.test(String(error)) && /fixture failed/.test(String(error)));
  await writeFile(file, 'before');
  await assert.rejects(guard([file], async () => { throw Error('fixture failed'); }), /fixture failed/);
}));

test('owned timeout and failure cleanup wait for actual child exit', () => temporary(async root => {
  const create = api('createProcessOwner');
  const fixture = await api('createIsolation')(root, process.execPath, process.env);
  const owner = create({ env: fixture.env, cwd: fixture.cwd });
  try {
    await assert.rejects(owner.run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], 150), /timed out/i);
    assert.equal(owner.activeCount, 0);
    assert.ok(owner.receipts.every(row => row.exited && row.closed));
    await assert.rejects(owner.run(process.execPath, ['-e', 'console.error("token=synthetic-secret");process.exit(7)']), /exit 7/);
    assert.equal(owner.activeCount, 0);
    assert.ok(owner.receipts.every(row => row.exited && row.closed));
  } finally { await owner.closeAll(); }
}));
