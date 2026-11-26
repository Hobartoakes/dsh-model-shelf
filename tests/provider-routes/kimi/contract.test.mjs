// Kimi mode contract, no product adapter. Run from the worktree root:
// First-time public archive preparation (no installation, no lifecycle scripts):
//   node tests/provider-options/codex-roundtrip.mjs --prepare
//   node tests/provider-routes/kimi/contract.test.mjs --prepare
// Offline verification (no download fallback; missing material fails the test):
//   node --test tests/provider-routes/kimi/contract.test.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { x as untar } from 'tar';
import { createIsolation } from '../../clean-profile-support.mjs';
import { archives, checkedDirectory, pins } from '../../provider-options/archives.mjs';

const name = 'dsh-kimi-subscription', version = '1.5.1';
const filename = name + '-' + version + '.tgz';
const integrity = 'sha512-DxIpwCrtB9+baUCBfckMBuRKDHxmwRhCtcMd7WlO0sTGA1XySuo2xWq4Di7PyQKMp5NlWICD+YyKcslijlu8LA==';
const cache = fileURLToPath(new URL('./node_modules/.cache/', import.meta.url));
const archive = join(cache, filename);

function verify(bytes) {
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), integrity, filename);
  return bytes;
}

async function prepare() {
  assert.deepEqual(process.argv.slice(2), ['--prepare']);
  for (const path of [fileURLToPath(new URL('./node_modules/', import.meta.url)), cache]) await checkedDirectory(path);
  try { assert.ok((await lstat(archive)).isFile()); verify(await readFile(archive)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const url = 'https://registry.npmjs.org/' + name + '/-/' + filename;
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    await writeFile(archive, verify(Buffer.from(await response.arrayBuffer())), { flag: 'wx' });
  }
  console.log('Verified ' + filename);
}

async function unpackSubscription(root) {
  let bytes;
  try { assert.ok((await lstat(archive)).isFile()); bytes = verify(await readFile(archive)); }
  catch (error) {
    if (error.code === 'ENOENT') throw Error('Missing Kimi archive. Run: node tests/provider-routes/kimi/contract.test.mjs --prepare');
    throw error;
  }
  const dest = join(root, 'node_modules', name);
  await mkdir(dest, { recursive: true });
  await pipeline(Readable.from([bytes]), untar({ cwd: dest, strip: 1, strict: true,
    filter: (path, entry) => ['package/package.json', 'package/lib/index.js'].includes(path) && entry.type === 'File' }));
  const manifest = JSON.parse(await readFile(join(dest, 'package.json')));
  assert.deepEqual([manifest.name, manifest.version], [name, version]);
}

if (process.argv[2] === '--prepare') await prepare();
else if (process.argv[2] === '--probe') await probe(process.argv[3]);
else {
  test('pinned Kimi providers serialize native selections but do not furnish a new shelf setting', async t => {
    const root = await mkdtemp(join(tmpdir(), 'shelf-kimi-'));
    try {
      const { cwd, env } = await createIsolation(root, process.execPath, process.env);
      const versions = new Map(pins.archives.map(([name, version]) => [name, version]));
      for (const [name, version] of [['@deepseek-ai/dsh-llm-pi-ai', '0.2.2-rc.5'], ['@earendil-works/pi-ai', '1.3.0'], ['openai', '7.19.0']]) {
        assert.equal(versions.get(name), version, 'Reinvestigate Kimi evidence after a dependency change: ' + name);
      }
      await unpackSubscription(root);
      await archives({ into: root }); // SHA-512 pinned public artifacts, no cold fetch
      const probe = fileURLToPath(import.meta.url);
      const { stdout } = await promisify(execFile)(process.execPath, [probe, '--probe', root], { cwd, env, windowsHide: true, timeout: 60000 });
      assert.deepEqual(JSON.parse(stdout), { serialized: 17, forbidden: 0 });
      t.diagnostic('17 POST bodies captured in memory; no unexpected fetch or socket');
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  test('Kimi mode evidence separates session toggles, fixed models and same-ID relays', async () => {
    let rows;
    try { rows = JSON.parse(await readFile(new URL('evidence.json', import.meta.url), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; rows = []; }

    const expected = [
      ['moonshotai/kimi-k2.6', 'thinkingMode', 'builtin'],
      ['moonshotai-cn/kimi-k2.6', 'thinkingMode', 'builtin'],
      ['moonshotai/kimi-k2.7-code', 'thinkingMode', 'unsupported'],
      ['moonshotai-cn/kimi-k2.7-code', 'thinkingMode', 'unsupported'],
      ['opencode/kimi-k2.6', 'officialThinkingPreference', 'gap'],
      ['moonshotai/kimi-k2.6', 'connectorThinkingDefault', 'gap'],
      ['kimi-subscription/kimi-for-coding', 'thinkingMode', 'unsupported'],
      ['kimi-subscription/kimi-for-coding-highspeed', 'thinkingMode', 'unsupported'],
    ];
    for (const [variant, field, status] of expected) {
      const matches = rows.filter(row => row.route === 'kimi' && row.variant === variant && row.field === field);
      assert.equal(matches.length, 1, 'missing or ambiguous evidence: ' + variant + ' ' + field);
      assert.equal(matches[0].status, status, variant + ' ' + field);
    }
    for (const row of rows) {
      assert.equal(row.route, 'kimi');
      assert.ok(['builtin', 'gap', 'unsupported'].includes(row.status), 'no proven new shelf write');
      for (const key of ['source', 'packagePin', 'ownerProof', 'writeSurface', 'requestProof', 'reason']) {
        assert.ok(row[key]?.length, row.variant + ' lacks ' + key);
      }
    }
  });
}

// Only the clean child executes the real providers. No socket or account service.
async function probe(root) {
  assert.equal(process.env.DSH_HOME, join(root, 'dsh-home'));
  const modules = join(root, 'node_modules') + sep;
  const verified = pathToFileURL(modules).href;
  const fromFixture = createRequire(join(root, 'fixture.cjs'));
  registerHooks({ resolve(specifier, context, next) {
    const result = next(specifier, context);
    if (context.parentURL?.startsWith(verified) && !isBuiltin(result.url)) assert.ok(result.url.startsWith(verified), specifier);
    return result;
  } });
  function pinned(name) {
    const entry = fromFixture.resolve(name);
    assert.ok(entry.startsWith(modules), name);
    return import(pathToFileURL(entry));
  }

  const chat = '/chat/completions';
  const endpoints = {
    moonshotai: 'https://api.moonshot.ai/v1' + chat,
    'moonshotai-cn': 'https://api.moonshot.cn/v1' + chat,
    opencode: 'https://opencode.ai/inference/v1' + chat,
    'kimi-subscription': 'https://api.kimi.com/coding/v1' + chat,
  };
  let forbidden = 0;
  const wire = [];
  Socket.prototype.connect = () => { forbidden++; throw Error('socket disabled'); };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    if (req.method !== 'POST' || !Object.values(endpoints).includes(req.url)) {
      forbidden++; throw Error('unexpected Fetch destination or method');
    }
    const body = await req.json();
    const fields = Object.fromEntries(['thinking', 'reasoning_effort', 'enable_thinking', 'reasoning'].filter(k => Object.hasOwn(body, k)).map(k => [k, body[k]]));
    wire.push({ url: req.url, model: body.model, fields });
    const chunk = { id: 'fixture', object: 'chat.completion.chunk', created: 1, model: body.model,
      choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] };
    return new Response('data: ' + JSON.stringify(chunk) + '\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
  };
  const [plugin, sub] = await Promise.all([pinned('@deepseek-ai/dsh-llm-pi-ai'), pinned('dsh-kimi-subscription')]);
  const key = 'synthetic-kimi-key', ref = 'KIMI_TEST_FIXTURE';
  const genericRoutes = ['moonshotai', 'moonshotai-cn', 'opencode'];
  let raw = Object.fromEntries(genericRoutes.map(id => [id, { apiKeyEnv: ref }]));
  let adapter, directory;
  // The host registration and credential services are test boundaries. Route
  // resolution, catalogue, supported efforts and request construction are not.
  plugin.apply({
    fiber: { entry: { options: { id: 'kimi-probe-pi' } } }, on() {}, inject() {},
    get: name => name === 'credentials' ? { resolve: r => { assert.equal(r, ref); return { value: key }; } } : undefined,
    waterfall: (_event, _request, headers) => headers,
    llm: {
      registerAdapter(ids, impl) { assert.deepEqual([...ids].sort(), [...genericRoutes].sort()); adapter = impl; },
      registerConfigurableProviders(entries) { directory = entries; }, registerModelDiscovery() {},
    },
  }, { providers: { get: () => raw } });
  for (const route of genericRoutes) {
    const [entry, ...rest] = directory.filter(e => e.provider === route);
    assert.equal(rest.length, 0);
    assert.equal(entry.settingsNs, 'kimi-probe-pi');
    assert.deepEqual(entry.settingsPath, ['providers', route]);
  }
  const toggle = 'kimi-k2.6', fixed = 'kimi-k2.7-code';
  const enabled = { thinking: { type: 'enabled' } }, disabled = { thinking: { type: 'disabled' } };
  async function capture(route, model, send, fields) {
    const before = wire.length;
    await send();
    assert.deepEqual(wire.slice(before), [{ url: endpoints[route], model, fields }], route + '/' + model);
  }
  const send = async (provider, model, reasoningEffort) => {
    for await (const _chunk of adapter.stream({ provider, model, reasoningEffort, signal: AbortSignal.timeout(8000),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }] })) { /* drain stream */ }
  };
  async function rejectedBeforeFetch(route, model, effort) {
    const before = wire.length;
    await assert.rejects(() => send(route, model, effort), { code: 'UNSUPPORTED_REASONING_EFFORT' });
    assert.equal(wire.length, before);
  }
  for (const route of genericRoutes) {
    const levels = (await adapter.resolveModel(route, toggle)).reasoning.efforts.map(e => e.id);
    assert.ok(levels.includes('off') && levels.includes('high'));
    for (const [effort, fields] of [['off', disabled], ['high', enabled]]) {
      await capture(route, toggle, () => send(route, toggle, effort), fields);
    }
    if (route === 'opencode') continue; // same model ID and bytes, different endpoint/owner path
    await capture(route, toggle, () => send(route, toggle), disabled);
    const fixedLevels = (await adapter.resolveModel(route, fixed)).reasoning.efforts.map(e => e.id);
    assert.ok(!fixedLevels.includes('off') && fixedLevels.includes('high'));
    await rejectedBeforeFetch(route, fixed, 'off');
    await capture(route, fixed, () => send(route, fixed), {});
    await capture(route, fixed, () => send(route, fixed, 'high'), enabled);
  }
  // A deployment default is wider than the selected model. This is a fixture
  // input, not a settings mutation. Session effort takes precedence.
  raw = { ...raw, moonshotai: { ...raw.moonshotai, reasoning: 'off' } };
  await capture('moonshotai', toggle, () => send('moonshotai', toggle), disabled);
  await capture('moonshotai', toggle, () => send('moonshotai', toggle, 'high'), enabled);
  await rejectedBeforeFetch('moonshotai', fixed, undefined);

  // Exercise the dedicated connector's public provider (not an assumed alias of
  // the generic kimi-coding route). OAuth, account and web-search are not booted.
  const provider = sub.createKimiSubscriptionProvider();
  assert.equal(provider.id, 'kimi-subscription');
  const modelFor = id => { const m = provider.getModels().find(m => m.id === id); assert.equal(m.provider, provider.id); return m; };
  const steady = modelFor('kimi-for-coding-highspeed'), tiered = modelFor('kimi-for-coding');
  assert.equal(steady.reasoning, false); // not selectable; does not mean inference is disabled
  assert.ok(Object.values(steady.thinkingLevelMap).every(value => value === null));
  assert.equal(tiered.thinkingLevelMap.off, null);
  assert.deepEqual(Object.values(tiered.thinkingLevelMap).filter(x => x !== null), ['low', 'high', 'max']);
  const native = (model, effort, fields) => capture(provider.id, model.id, async () => {
    const events = provider.streamSimple(model, { messages: [{ role: 'user', content: 'fixture', timestamp: 1 }] },
      { apiKey: key, reasoning: effort, signal: AbortSignal.timeout(8000) });
    for await (const event of events) assert.notEqual(event.type, 'error', event.error?.errorMessage);
  }, fields);
  await native(steady, undefined, {});
  await native(tiered, undefined, {});
  await native(tiered, 'high', { reasoning_effort: 'high' });
  const readPreference = sub.createKimiRpcHandler({}, { searchPreference: { get: () => 'default', writable: () => true } });
  const descriptor = await readPreference('preferences/status', {}, AbortSignal.timeout(1000));
  assert.deepEqual(descriptor, { ok: true, value: { searchProvider: 'default', writable: true, codexDetected: false } });
  assert.equal(forbidden, 0);
  console.log(JSON.stringify({ serialized: wire.length, forbidden }));
}
