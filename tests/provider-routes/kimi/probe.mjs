// Child of contract.test.mjs. Inputs are synthetic; the packages make the model,
// choose the wire format and serialize it. Nothing here sends an HTTP request.
import assert from 'node:assert/strict';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { Socket } from 'node:net';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2];
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
