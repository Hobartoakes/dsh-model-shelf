import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadRuntime, localTransport } from './transport.mjs';

const root = process.argv[2];
assert.equal(process.env.DSH_HOME, join(root, 'dsh-home'));
assert.equal(process.cwd(), join(root, 'cwd'));
const wire = localTransport(); // deny sockets before importing provider code
const { Context, Loader, LlmRuntime, SettingsForms, pi } = await loadRuntime(root);
const ns = 'gemini-fixture', routes = ['google', 'google-vertex'];
const budgetModel = 'gemini-2.5-flash', levelModel = 'gemini-3.1-pro-preview';
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
  process.send({ observed, requests: wire.count, forbidden: wire.forbidden });
} finally {
  await alternate.fiber.dispose();
  await ctx.fiber.dispose();
}
