// Offline, from the repository root (tested on Node 24.21.0):
//   node --test tests/provider-routes/gemini/contract.test.mjs
// Cold cache, as a separate network-permitted preparation step only:
//   node tests/provider-options/codex-roundtrip.mjs --prepare
// Preparation checks registry archives against tests/provider-options/pins.json; no install,
// lifecycle scripts or model calls. Missing or corrupt archives fail the test; it never skips.
// Scope: two unmodified catalog models on native Google and Vertex (API key) only.
// Not an online, ADC, gateway, arbitrary model/tier, or new shelf UI save/readback test.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const protocols = ['google-generative-ai', 'google-vertex'];
const budgetModel = 'gemini-2.5-flash';
const levelModel = 'gemini-3.1-pro-preview';

if (process.argv[2] === '--gemini-worker') {
  process.send(await exercise(process.argv[3]));
} else {
  test('each Gemini protocol classifies a numeric budget separately from a wire level and session effort', async () => {
    const rows = JSON.parse(await readFile(new URL('evidence.json', import.meta.url), 'utf8'));
    const expected = new Map();
    for (const api of protocols) {
      const add = (model, field, status) => expected.set([api, model, field].join('/'), status);
      add(budgetModel, 'thinkingBudget', 'gap');
      add(budgetModel, 'thinkingLevel', 'unsupported');
      add(budgetModel, 'reasoningEffort', 'builtin');
      add(levelModel, 'thinkingBudget', 'unsupported');
      add(levelModel, 'thinkingLevel', 'builtin');
    }
    for (const row of rows) {
      const key = row.variant + '/' + row.field;
      assert.equal(row.route, 'gemini');
      assert.ok(expected.has(key), 'duplicate or unexpected evidence: ' + key);
      assert.equal(row.status, expected.get(key), key);
      expected.delete(key);
      for (const fact of ['packagePin', 'source', 'ownerProof', 'writeSurface', 'requestProof', 'reason']) {
        assert.ok(typeof row[fact] === 'string' && row[fact].trim(), key + ': missing ' + fact);
      }
    }
    assert.deepEqual([...expected.keys()], [], 'unclassified Gemini fields');
  });

  test('published Gemini connectors: budget, catalog effort and active owner', async t => {
    const { observed, requests, forbidden } = await runFixture();
    assert.equal(requests, 14);
    assert.equal(forbidden, 0);
    assert.deepEqual(Object.keys(observed).sort(), ['google', 'google-vertex']);
    for (const [provider, seen] of Object.entries(observed)) {
      await t.test(provider + ': 2.5 Flash maps catalog effort to a token budget, not a wire level', () => {
        for (const level of ['low','medium']) assert.ok(seen.efforts[budgetModel].includes(level));
        assert.deepEqual(seen.defaultLow, { includeThoughts: true, thinkingBudget: 2048 });
        assert.deepEqual(seen.customLow, { includeThoughts: true, thinkingBudget: 4096 });
        assert.deepEqual(seen.otherTier, { includeThoughts: true, thinkingBudget: 8192 });
      });
      await t.test(provider + ': 3.1 Pro Preview sends its catalog level instead of the configured budget', () => {
        assert.deepEqual(seen.efforts[levelModel], ['low', 'medium', 'high']);
        assert.deepEqual(seen.levelLow, { includeThoughts: true, thinkingLevel: 'LOW' });
        assert.deepEqual(seen.levelHigh, { includeThoughts: true, thinkingLevel: 'HIGH' });
      });
      await t.test(provider + ': a unique writable form can change without changing the active adapter', () => {
        assert.equal(seen.formAfter, 6144);
        assert.deepEqual(seen.beforeMismatch, { includeThoughts: true, thinkingBudget: 3072 });
        assert.deepEqual(seen.afterMismatch, seen.beforeMismatch);
      });
    }
  });
}

async function runFixture() {
  // Parent-only workspace helpers. The worker imports only builtins before denying sockets.
  const { createIsolation } = await import('../../clean-profile-support.mjs');
  const { archives } = await import('../../provider-options/archives.mjs');
  const root = await mkdtemp(join(tmpdir(), 'shelf-gemini-offline-'));
  try {
    const { cwd, env } = await createIsolation(root, process.execPath, process.env);
    await archives({ into: root }); // offline only; no fallback or lifecycle scripts
    return await new Promise((resolve, reject) => {
      const child = fork(new URL(import.meta.url), ['--gemini-worker', root], { cwd, env, execArgv: [], timeout: 60000 });
      let facts;
      child.once('message', value => { facts = value; });
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0 && facts) resolve(facts);
        else reject(Error('Gemini offline worker did not complete: ' + (signal ?? code)));
      });
    });
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
}

async function loadRuntime(root) {
  const require = createRequire(join(root, 'fixture.cjs'));
  const modules = pathToFileURL(join(root, 'node_modules') + sep).href;
  registerHooks({ resolve(specifier, context, next) {
    const resolved = next(specifier, context);
    if (context.parentURL?.startsWith(modules) && !isBuiltin(resolved.url)) {
      assert.ok(resolved.url.startsWith(modules), 'unverified dependency: ' + specifier);
    }
    return resolved;
  } });
  async function fromPin(name) {
    const url = pathToFileURL(require.resolve(name)).href;
    assert.ok(url.startsWith(modules), 'unverified root module: ' + name);
    return import(url);
  }
  const [{ Context }, { Loader }, { LlmRuntime }, { SettingsForms }, pi] = await Promise.all([
    '@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-settings', '@deepseek-ai/dsh-llm-pi-ai',
  ].map(fromPin));
  return { Context, Loader, LlmRuntime, SettingsForms, pi };
}

function localTransport() {
  // Nothing above Fetch, including the Google SDK request serializer, is patched.
  // No listener/port, default network fallback, auth service, or real credentials.
  const origins = { google: 'https://generativelanguage.googleapis.com', 'google-vertex': 'https://aiplatform.googleapis.com' };
  const wire = [];
  let expected, forbidden = 0;
  Socket.prototype.connect = function () { forbidden++; throw Error('socket forbidden in Gemini worker'); };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    if (!expected || request.method !== 'POST' || url.origin !== origins[expected.provider] ||
        !url.pathname.endsWith('/models/' + expected.model + ':streamGenerateContent')) {
      forbidden++; throw Error('unexpected Gemini transport call');
    }
    const body = await request.json();
    wire.push(body.generationConfig?.thinkingConfig ?? null); // discard the rest
    const reply = { candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] };
    return new Response('data: ' + JSON.stringify(reply) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
  };
  return {
    async request(llm, provider, model, reasoningEffort) {
      expected = { provider, model };
      const before = wire.length;
      try {
        for await (const _ of llm.stream({ provider, model, reasoningEffort, messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }], signal: AbortSignal.timeout(8000) })) { /* consume the actual connector */ }
      } finally { expected = undefined; }
      assert.equal(wire.length, before + 1, 'expected exactly one serialized request');
      return wire.at(-1);
    },
    get count() { return wire.length; },
    get forbidden() { return forbidden; },
  };
}

async function exercise(root) {
  assert.equal(process.env.DSH_HOME, join(root, 'dsh-home'));
  assert.equal(process.cwd(), join(root, 'cwd'));
  const wire = localTransport(); // deny sockets before importing provider code
  const { Context, Loader, LlmRuntime, SettingsForms, pi } = await loadRuntime(root);
  const ns = 'gemini-fixture', routes = ['google', 'google-vertex'];
  process.env.SHELF_FIXTURE_KEY = 'local-test-placeholder';
  const config = (low) => ({ providers: Object.fromEntries(routes.map(route => [route, {
    apiKeyEnv: 'SHELF_FIXTURE_KEY', ...(low === undefined ? {} : { thinkingBudgets: { low } }),
  }])) }); // no model, endpoint, wire protocol or reasoning capability overrides

  async function mount(ctx, plugin, config) {
    const fiber = ctx.plugin(plugin, config);
    await fiber.await();
    assert.equal(fiber.state, 2, 'inactive fixture plugin: ' + plugin.name);
  }

  const ctx = new Context(), alternate = new Context();
  try {
    await mount(ctx, Loader, { baseUrl: pathToFileURL(join(root, 'fixture.cjs')).href });
    await mount(ctx, LlmRuntime);
    const loader = ctx.get('loader'), llm = ctx.get('llm');
    loader.builtins['gemini-test-pi'] = pi;
    ctx.reflect.provide('profileContext', { home: process.env.DSH_HOME, name: ns });
    // In-memory profile persistence only. The schema, path mutation, revision and
    // volatile update/adapter registration all belong to the published packages.
    ctx.reflect.provide('configEditor', {
      entries: () => [...loader.entries()],
      configuration: () => [...loader.entries()].map(entry => ({ entry, inherited: {}, override: entry.options.config ?? {} })),
      async edit(entry, transform) {
        assert.equal(entry.options.id, ns);
        const next = await transform(structuredClone(entry.options.config), {});
        await loader.update(ns, { config: next });
      },
    });
    await mount(ctx, SettingsForms);
    await loader.root.update([{ id: ns, name: 'cordis:gemini-test-pi', config: config() }]);
    await loader.await();
    assert.equal(loader.resolve(ns).fiber?.state, 2, 'real pi-ai plugin must start');
    const settings = ctx.get('settings');
    function form() {
      const matches = settings.describe({ redactSecrets: true }).filter(s => s.ns === ns);
      assert.equal(matches.length, 1, 'unique active fixture settings form');
      return matches[0];
    }
    async function setLow(provider, value) {
      await settings.mutate(ns, [{ op: 'set', path: ['providers', provider, 'thinkingBudgets', 'low'], value }], form().revision);
      assert.equal(form().value.providers[provider].thinkingBudgets.low, value, 'independent form readback');
    }
    async function identities(provider) {
      const dirs = llm.listConfigurableProviders().filter(d => d.provider === provider);
      assert.equal(dirs.length, 1);
      assert.equal(dirs[0].settingsNs, ns);
      assert.deepEqual(dirs[0].settingsPath, ['providers', provider]);
      const active = llm.listProviders().filter(p => p.id === provider);
      assert.equal(active.length, 1);
      const efforts = {};
      for (const model of [budgetModel, levelModel]) {
        assert.ok((await llm.listModels(provider)).some(m => m.id === model), 'absent from actual catalog: ' + model);
        efforts[model] = (await llm.resolveModelInfo(provider, model)).reasoning.efforts.map(e => e.id);
      }
      return { directory: dirs[0], active: active[0], efforts };
    }
    const observed = {}, before = {};
    for (const provider of routes) {
      before[provider] = await identities(provider);
      const seen = observed[provider] = { efforts: before[provider].efforts };
      seen.defaultLow = await wire.request(llm, provider, budgetModel, 'low');
      await setLow(provider, 4096);
      seen.customLow = await wire.request(llm, provider, budgetModel, 'low');
      seen.otherTier = await wire.request(llm, provider, budgetModel, 'medium');
      seen.levelLow = await wire.request(llm, provider, levelModel, 'low');
      seen.levelHigh = await wire.request(llm, provider, levelModel, 'high');
    }

    // The configurable directory survives release of all active Gemini routes.
    // Register a different inference owner using a *real*, independently configured
    // PiAiAdapter. The small registration sink only obtains that instance from its
    // plugin; the identity, collisions and dispatch under test use real LlmRuntime.
    await loader.update(ns, { config: { providers: {} } });
    assert.equal(llm.listProviders().length, 0);
    let other;
    alternate.reflect.provide('llm', {
      registerConfigurableProviders() { return () => {}; }, registerModelDiscovery() {},
      registerAdapter(ids, adapter) { assert.deepEqual(ids, routes); other = adapter; return () => {}; },
    });
    await mount(alternate, pi, config(3072));
    assert.ok(other instanceof pi.PiAiAdapter);
    llm.registerAdapter(routes, other);
    // Re-add the routes to the form: its provider entries can be live and declared
    // even though a concurrent adapter already holds dispatch for those route IDs.
    await loader.update(ns, { config: config(4096) });
    for (const provider of routes) {
      assert.deepEqual(await identities(provider), before[provider], 'same visible identities and model capabilities');
      const seen = observed[provider];
      seen.beforeMismatch = await wire.request(llm, provider, budgetModel, 'low');
      await setLow(provider, 6144);
      seen.formAfter = form().value.providers[provider].thinkingBudgets.low;
      seen.afterMismatch = await wire.request(llm, provider, budgetModel, 'low');
    }
    assert.equal(wire.forbidden, 0, 'unexpected network attempted');
    return { observed, requests: wire.count, forbidden: wire.forbidden };
  } finally {
    await alternate.fiber.dispose();
    await ctx.fiber.dispose();
  }
}
