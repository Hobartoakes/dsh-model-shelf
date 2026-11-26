// Isolated child: real plugin registration, model resolution and serialization.
// Only the registries, profiles, credential and response are fixture inputs.
import assert from 'node:assert/strict';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localWire } from './wire.mjs';

const root = process.argv[2];
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
