// Qwen evidence only. No shelf control is enabled by this file.
// With Node 24 and the project's test dependencies, cold-cache preparation:
//   node tests/provider-options/codex-roundtrip.mjs --prepare  (shared host/SDK bytes)
//   node tests/provider-routes/qwen/contract.test.mjs --prepare  (3 native archives)
// Offline contract (no network fallback, no install scripts, no daily profile):
//   node --test tests/provider-routes/qwen/contract.test.mjs
// Inputs: fixture profile, registration services, credentials, per-call policy,
// and terminal SSE. The adapters, catalog, serializer and outgoing POST are real.
// This does not check a real account, provider acceptance or shelf save/readback.
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

const cache = join(tmpdir(), 'dsh-model-shelf-qwen-archives');
const version = '0.7.5';
const digests = {
  core: 'Kg1ngkpPcAWWlMIliF8RBVqsZheifkC1xfuAkYObwgaCA/LeKU32CmJpHEYtCegFmIqTJAUgOdjOPi2fozeBUg==',
  runtime: 'Cb5tIp77kh8cxJbaJsFZdEgly1h7QYy31FNU0cvFIIVQFvf9fqheiKd3p2ExzB+YElXO9SmZNVHMDgYgJqIOiA==',
  dashscope: '5n3QF4V+Tl6oQtPGWLQxoXkh41XnKOAr6JLgpmO9mdXJIgf/5OwYKMUtfl/ydWrK4HVTXSOj1KGIemckjI/dcw==',
};

async function nativeArchives({ prepare = false, into } = {}) {
  const { x: untar } = await import('tar');
  if (prepare) await mkdir(cache, { recursive: true });
  const hint = 'Run node tests/provider-routes/qwen/contract.test.mjs --prepare first';
  assert.ok((await lstat(cache).catch(() => undefined))?.isDirectory(), hint);
  for (const [leaf, hash] of Object.entries(digests)) {
    const name = '@dsh-ai-providers/' + leaf, filename = leaf + '-' + version + '.tgz';
    const path = join(cache, filename);
    let bytes, cold = false;
    try { assert.ok((await lstat(path)).isFile(), filename); bytes = await readFile(path); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (!prepare) throw Error(hint + ': ' + filename);
      const response = await fetch('https://registry.npmjs.org/' + name + '/-/' + filename,
        { redirect: 'error', signal: AbortSignal.timeout(60000) });
      assert.equal(response.status, 200, name); bytes = Buffer.from(await response.arrayBuffer()); cold = true;
    }
    assert.equal(createHash('sha512').update(bytes).digest('base64'), hash, filename);
    if (cold) await writeFile(path, bytes, { flag: 'wx' });
    if (!into) continue;
    const cwd = join(into, 'node_modules', name);
    await mkdir(cwd, { recursive: true });
    await pipeline(Readable.from([bytes]), untar({ cwd, strip: 1, strict: true,
      filter: (p, e) => p.startsWith('package/') && !p.includes('\\') && !p.split('/').some(s => s === '..' || s === 'node_modules') && ['File','Directory'].includes(e.type) }));
    const manifest = JSON.parse(await readFile(join(cwd, 'package.json')));
    assert.equal(manifest.name, name); assert.equal(manifest.version, version);
  }
}

// Capture the serialized POST and respond locally, without replacing any builder.
const routes = new Map([
  ['https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions', 'cn'],
  ['https://relay.invalid/v1/chat/completions', 'relay'],
  ['https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', 'native'],
  ['https://dashscope.invalid/api/v1/services/aigc/text-generation/generation', 'native'],
]);
const fields = ['enable_thinking','reasoning_effort','thinking_budget','thinking_budget_tokens','thinking_token_budget','chat_template_kwargs','thinking'];
const project = obj => Object.fromEntries(fields.filter(k => Object.hasOwn(obj, k)).map(k => [k, obj[k]]));

function localWire() {
  let forbidden = 0;
  const captured = [];
  const deny = () => { forbidden++; throw Error('unapproved network operation in Qwen fixture'); };
  Socket.prototype.connect = deny;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), route = routes.get(req.url);
    if (!route || req.method !== 'POST') return deny();
    const body = await req.json();
    captured.push({ route, model: body.model, top: project(body), nested: project(body.parameters ?? {}) });
    const event = route === 'native'
      ? { output: { choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] } }
      : { id: 'fixture', object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] };
    return new Response('data: ' + JSON.stringify(event) + '\n\n' + (route === 'native' ? '' : 'data: [DONE]\n\n'),
      { headers: { 'content-type': 'text/event-stream' } });
  };
  async function consume(adapter, provider, model, reasoningEffort) {
    const stream = adapter.stream({ provider, model, ...(reasoningEffort ? { reasoningEffort } : {}),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }], signal: AbortSignal.timeout(10000) });
    let finished = false;
    for await (const chunk of stream) if (chunk.type === 'finish') finished = true;
    assert.ok(finished, 'real adapter must consume the terminal SSE event');
  }
  return {
    get count() { return captured.length; }, get forbidden() { return forbidden; }, consume,
    async next(route, adapter, provider, model, effort) {
      const before = captured.length;
      await consume(adapter, provider, model, effort);
      assert.equal(captured.length, before + 1, 'exactly one serialized model POST');
      const hit = captured.at(-1);
      assert.equal(hit.route, route); assert.equal(hit.model, model);
      assert.deepEqual(route === 'native' ? hit.top : hit.nested, {}, 'no controls at the wrong protocol depth');
      return route === 'native' ? hit.nested : hit.top;
    },
  };
}

// Import connectors only after the child network guard is in place.
async function runProbe(root) {
  assert.equal(process.env.DSH_HOME, join(root, 'dsh-home'));
  const wire = localWire();
  const require = createRequire(join(root, 'fixture.cjs'));
  const pinned = pathToFileURL(join(root, 'node_modules') + sep).href;
  const audit = registerHooks({ resolve(name, ctx, next) {
    const result = next(name, ctx);
    if (ctx.parentURL?.startsWith(pinned) && !isBuiltin(result.url)) assert.ok(result.url.startsWith(pinned), 'unverified dependency: ' + name);
    return result;
  } });
  async function load(name) {
    const url = pathToFileURL(require.resolve(name)).href;
    assert.ok(url.startsWith(pinned)); return import(url);
  }
  const [{ Context }, pi, native, { AiLlmAdapter }] = await Promise.all([
    '@deepseek-ai/cordis', '@deepseek-ai/dsh-llm-pi-ai', '@dsh-ai-providers/dashscope', '@dsh-ai-providers/runtime',
  ].map(load));
  const cn = 'qwen-token-plan-cn', relay = 'fixture-relay';
  const hybrid = 'qwen3.6-flash', limited = 'qwen3.8-max', fixed = 'Qwen/Qwen3-235B-A22B-Thinking-2507';
  const noop = () => {};
  async function mount(ctx, plugin, config) {
    const fiber = ctx.plugin(plugin, config); await fiber.await(); assert.equal(fiber.state, 2, plugin.name + ' must be ACTIVE');
  }

  async function piSamples(budget, relayCompat, run) {
    const ctx = new Context();
    let adapter, directory;
    ctx.reflect.provide('credentials', { resolve: ref => { assert.equal(ref, 'FIXTURE_KEY'); return { value: 'fixture-only' }; } });
    ctx.reflect.provide('llm', {
      registerAdapter(ids, real) { assert.deepEqual([...ids].sort(), [relay, cn]); assert.ok(!adapter); adapter = real; return noop; },
      registerConfigurableProviders(rows) { directory = rows; return { replace: noop }; }, registerModelDiscovery: noop,
    });
    try {
      const common = { apiKeyEnv: 'FIXTURE_KEY', thinkingBudgets: { low: budget, high: budget } };
      await mount(ctx, pi, { providers: {
        [cn]: common, // leave the shipped endpoint, protocol and model capabilities untouched
        [relay]: { ...common, api: 'openai-completions', baseURL: 'https://relay.invalid/v1',
          models: [{ id: hybrid, reasoningEfforts: { off: null, high: 'high' } }], compat: relayCompat },
      } });
      assert.ok(adapter instanceof pi.PiAiAdapter);
      for (const id of [cn, relay]) {
        const [row, ...rest] = directory.filter(r => r.provider === id);
        assert.equal(rest.length, 0); assert.equal(row.settingsNs, 'llm-pi-ai');
        assert.deepEqual(row.settingsPath, ['providers', id]); assert.equal(row.declared, id === relay);
      }
      const ids = (await adapter.listModels(cn)).map(m => m.id);
      assert.ok(ids.includes(hybrid) && ids.includes(limited));
      return await run(adapter);
    } finally { await ctx.fiber.dispose(); }
  }

  // Native runtime merges model/route/policy defaults before DashScope constructs
  // parameters. Do not call wireBody directly or synthesize the resolved sampling.
  async function nativeSample(model, routeSampling, modelSampling, policy) {
    const ctx = new Context(), route = 'fixture-native';
    let provider;
    ctx.reflect.provide('aiProviders', { register(d) { assert.ok(!provider); provider = d; return noop; } });
    try {
      await mount(ctx, native, {
        connections: [{ id: 'endpoint', name: 'Fixture', baseUrl: model === fixed ? 'https://dashscope.invalid/api/v1' : 'https://dashscope.aliyuncs.com/api/v1', apiKeyRef: '' }],
        llmRoutes: [{ id: route, name: 'Fixture', connection: 'endpoint', sampling: routeSampling,
          models: [{ id: model, name: model, sampling: modelSampling }] }],
      });
      assert.equal(provider.id, 'dashscope'); assert.equal(provider.configEntryId, 'ai-dashscope');
      const adapter = new AiLlmAdapter({ llmProviders: () => [provider], policies: () => policy ? [() => policy] : [] });
      assert.equal(adapter.owners().filter(owner => owner.route.id === route).length, 1);
      assert.equal(adapter.ownerOf(route).provider, provider);
      const resolved = await adapter.resolveModel(route, model);
      assert.equal(resolved.id, model); assert.equal(resolved.reasoning, undefined, 'no per-model thinking capability declared');
      return await wire.next('native', adapter, route, model);
    } finally { await ctx.fiber.dispose(); }
  }

  try {
    const sample = {};
    await piSamples(1200, { thinkingFormat: 'openai', supportsReasoningEffort: true }, async adapter => {
      const efforts = async model => (await adapter.resolveModel(cn, model)).reasoning.efforts.map(e => e.id);
      sample.hybridLevels = await efforts(hybrid); sample.limitedLevels = await efforts(limited);
      sample.off = await wire.next('cn', adapter, cn, hybrid, 'off');
      sample.high = await wire.next('cn', adapter, cn, hybrid, 'high');
      sample.low = await wire.next('cn', adapter, cn, limited, 'low');
      sample.omitted = await wire.next('cn', adapter, cn, limited);
      const before = wire.count;
      await assert.rejects(wire.consume(adapter, cn, limited, 'off'), { code: 'UNSUPPORTED_REASONING_EFFORT' });
      assert.equal(wire.count, before, 'disallowed effort must not dispatch');
      sample.relay = await wire.next('relay', adapter, relay, hybrid, 'high');
    });
    // A positive transport control: an operator can change an arbitrary relay's
    // protocol. This does NOT establish that the relay implements it.
    await piSamples(2400, { thinkingFormat: 'qwen', thinkingTokenBudgetField: 'thinking_budget', supportsReasoningEffort: false }, async adapter => {
      sample.high2 = await wire.next('cn', adapter, cn, hybrid, 'high');
      sample.low2 = await wire.next('cn', adapter, cn, limited, 'low');
      sample.relayOptIn = await wire.next('relay', adapter, relay, hybrid, 'high');
    });
    sample.nativeDefault = await nativeSample('qwen-plus');
    sample.nativeRoute = await nativeSample('qwen-plus', { enableThinking: true, thinkingBudget: 1000 });
    sample.nativeModel = await nativeSample('qwen-plus', { enableThinking: false, thinkingBudget: 500 }, { enableThinking: true, thinkingBudget: 2000 });
    sample.nativeMasked = await nativeSample('qwen-plus', { enableThinking: true, thinkingBudget: 1000 }, undefined, { enableThinking: false, thinkingBudget: 256 });
    // A request builder can serialize a contradictory preference even for a
    // checkpoint whose publisher explicitly documents thinking-only behavior.
    sample.nativeFixed = await nativeSample(fixed, { enableThinking: false });
    sample.nativeFixedBudget = await nativeSample(fixed, { thinkingBudget: 1800 });
    assert.equal(wire.forbidden, 0);
    console.log(JSON.stringify({ ...sample, posts: wire.count, forbidden: wire.forbidden }));
  } finally { audit.deregister(); }
}

// These are evidence classes, NOT a runtime dispatch table. The two fields are
// deliberately separate: a native effort does not imply a token budget.
const expected = {
  'token-plan-cn-switchable': ['builtin', 'unsupported'],
  'token-plan-cn-no-off': ['unsupported', 'unsupported'],
  'same-id-relay': ['gap', 'gap'],
  'dashscope-native': ['gap', 'gap'],
  'dashscope-thinking-only-checkpoint': ['unsupported', 'gap'],
};

function registerContractTests() {
  test('each Qwen route, model variant and field has a bounded evidence class', async () => {
    const file = new URL('evidence.json', import.meta.url);
    const rows = await readFile(file, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return []; // Missing *rows* fail the contract below.
      throw error;
    });
    const wanted = Object.entries(expected).flatMap(([variant, statuses]) =>
      ['enableThinking', 'thinkingBudget'].map((field, i) => [variant, field, statuses[i]].join(':')));
    assert.deepEqual(rows.map(row => [row.variant, row.field, row.status].join(':')).sort(), wanted.sort(),
      'one classified row per variant and field; a second switch or unverified budget must not ship');
    for (const row of rows) {
      assert.equal(row.route, 'qwen');
      for (const key of ['packagePin','source','ownerProof','writeSurface','requestProof','reason']) {
        assert.ok(typeof row[key] === 'string' && row[key].trim(), row.variant + ': ' + key);
      }
      assert.match(row.source, /#L[0-9]+/);
      assert.ok(row.requestProof.includes('node --test tests/provider-routes/qwen/contract.test.mjs'));
    }
  });

  test('fixed connectors: Qwen route, model capability and serialized request', async t => {
    const root = await mkdtemp(join(tmpdir(), 'shelf-qwen-profile-'));
    try {
      const { createIsolation } = await import('../../clean-profile-support.mjs');
      const { archives } = await import('../../provider-options/archives.mjs');
      const { env, cwd } = await createIsolation(root, process.execPath, process.env);
      // Reuse the verified host/SDK bytes, not a developer installation or profile.
      await archives({ into: root }); await nativeArchives({ into: root });
      const script = fileURLToPath(import.meta.url);
      const { stdout } = await promisify(execFile)(process.execPath, [script, '--probe', root], { env, cwd, timeout: 60000, windowsHide: true });
      const got = JSON.parse(stdout);
      await t.test('switchable CN model uses session effort, not a saved vendor switch', () => {
        assert.deepEqual(got.hybridLevels, ['off','minimal','low','medium','high']);
        assert.deepEqual(got.off, { enable_thinking: false });
        assert.deepEqual(got.high, { enable_thinking: true }); assert.deepEqual(got.high2, got.high);
      });
      await t.test('no-off CN model refuses explicit off; omitting effort is not an off selection', () => {
        assert.deepEqual(got.limitedLevels, ['low','medium','xhigh']);
        assert.deepEqual(got.low, { enable_thinking: true, reasoning_effort: 'low' }); assert.deepEqual(got.low2, got.low);
        assert.deepEqual(got.omitted, { enable_thinking: false });
      });
      await t.test('same-id relay must not inherit a switch or budget from Qwen', () => {
        assert.deepEqual(got.relay, { reasoning_effort: 'high' });
        assert.deepEqual(got.relayOptIn, { enable_thinking: true, thinking_budget: 2400 });
      });
      await t.test('native parameters serialize, but independent capabilities and effective owner are not implied', () => {
        assert.deepEqual(got.nativeDefault, {});
        assert.deepEqual(got.nativeRoute, { enable_thinking: true, thinking_budget: 1000 });
        assert.deepEqual(got.nativeModel, { enable_thinking: true, thinking_budget: 2000 });
        assert.deepEqual(got.nativeMasked, { enable_thinking: false, thinking_budget: 256 });
      });
      await t.test('fixed checkpoint: native serialization does not validate a model capability', () => {
        assert.deepEqual(got.nativeFixed, { enable_thinking: false });
        assert.deepEqual(got.nativeFixedBudget, { thinking_budget: 1800 });
      });
      assert.equal(got.posts, 14); assert.equal(got.forbidden, 0);
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
  });
}

const args = process.argv.slice(2);
if (args[0] === '--prepare') {
  assert.equal(args.length, 1);
  await nativeArchives({ prepare: true });
  console.log('Verified public Qwen fixture archives:', Object.keys(digests).length);
} else if (args[0] === '--probe') {
  assert.equal(args.length, 2);
  await runProbe(args[1]);
} else {
  assert.equal(args.length, 0);
  registerContractTests();
}
