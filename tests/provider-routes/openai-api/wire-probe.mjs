// Internal worker. No endpoint, method, payload or option below is injected into the
// serializer. Only Fetch's terminal response is synthetic; sockets are prohibited.
import assert from 'node:assert/strict';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { Socket } from 'node:net';
import { basename, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? '');
assert.match(basename(root), /^shelf-openai-api-[a-zA-Z0-9]+$/);
assert.equal(process.cwd(), join(root, 'cwd'));
for (const [key, sub] of Object.entries({ DSH_HOME: 'dsh-home', HOME: 'user', USERPROFILE: 'user', TEMP: 'tmp' })) {
  assert.equal(process.env[key], join(root, sub), 'run via the isolated contract test');
}
const prefix = pathToFileURL(join(root, 'node_modules') + sep).href;
const require = createRequire(join(root, 'fixture.cjs'));
registerHooks({ resolve(specifier, context, next) {
  const result = next(specifier, context);
  if (context.parentURL?.startsWith(prefix) && !isBuiltin(result.url)) assert.ok(result.url.startsWith(prefix), 'dependency outside pinned tree: ' + specifier);
  return result;
} });
async function fromPin(name) {
  const url = pathToFileURL(require.resolve(name));
  assert.ok(url.href.startsWith(prefix));
  return import(url);
}

const official = 'https://api.openai.com/v1', relay = 'https://relay.fixture.invalid/v1';
const active = 'gpt-5.4', plain = 'gpt-4.1';
let expected, sent = 0, forbidden = 0;
Socket.prototype.connect = function () { forbidden++; throw Error('offline socket'); };
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  if (!expected || request.url !== expected.url || request.method !== 'POST') {
    forbidden++; throw Error('unexpected request in offline fixture');
  }
  const body = await request.json();
  assert.equal(body.model, expected.model);
  assert.equal(body.stream, true);
  assert.equal(Object.hasOwn(body, 'verbosity'), false);
  assert.equal(Object.hasOwn(body.text ?? {}, 'verbosity'), false);
  assert.equal(Object.hasOwn(body, 'reasoning_summary'), false);
  const { responses, effort } = expected;
  if (responses) {
    assert.equal(Object.hasOwn(body, 'reasoning_effort'), false);
    if (effort) assert.deepEqual(body.reasoning, { effort, summary: 'auto' });
    else assert.equal(Object.hasOwn(body, 'reasoning'), false);
  } else {
    assert.equal(Object.hasOwn(body, 'reasoning'), false);
    if (effort) assert.equal(body.reasoning_effort, effort);
    else assert.equal(Object.hasOwn(body, 'reasoning_effort'), false);
  }
  sent++;
  const event = responses
    ? { type: 'response.completed', response: { id: 'fixture', status: 'completed', output: [], usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 } } }
    : { id: 'fixture', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
  return new Response('data: ' + JSON.stringify(event) + '\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
};

const [{ Context }, connector] = await Promise.all(['@deepseek-ai/cordis', '@deepseek-ai/dsh-llm-pi-ai'].map(fromPin));
// Inspect declarations, not a profile or a credentials service. The positive
// controls distinguish a missing preference from a missing or misread schema.
const routeSchema = connector.Config.dict.providers.inner.dict;
assert.ok(routeSchema.reasoning && routeSchema.thinkingBudgets);
const modelSchema = routeSchema.models.inner.dict, overrides = routeSchema.modelOverrides.inner.dict;
assert.ok(modelSchema.reasoningEfforts && overrides.reasoningEfforts && routeSchema.compat.dict.supportsReasoningEffort);
for (const schema of [routeSchema, modelSchema, overrides, routeSchema.compat.dict]) {
  for (const key of ['outputVerbosity', 'textVerbosity', 'verbosity', 'text', 'reasoningSummary', 'summary']) {
    assert.equal(Object.hasOwn(schema, key), false, 'check new owner field: ' + key);
  }
}

async function exercise({ provider, responses, endpoint }) {
  const customId = provider !== 'openai';
  const profile = { apiKeyEnv: 'SHELF_OFFLINE_KEY',
    ...(!responses || customId ? { api: responses ? 'openai-responses' : 'openai-completions' } : {}),
    ...(endpoint === relay ? { baseURL: relay } : {}),
    models: customId ? [{ id: active, reasoningEfforts: { low: 'low', high: 'high' } }, { id: plain, reasoningEfforts: false }] : [{ id: active }, { id: plain }],
  };
  const ctx = new Context();
  let adapter, owner;
  // Registration observers only: the actual plugin handles catalog resolution,
  // model capability selection, routing, argument assembly and serialization.
  ctx.reflect.provide('llm', {
    registerAdapter(ids, instance) { assert.deepEqual(ids, [provider]); assert.ok(!adapter); adapter = instance; return {}; },
    registerConfigurableProviders(entries) {
      const matches = entries.filter(row => row.provider === provider);
      assert.equal(matches.length, 1); owner = matches[0]; return {};
    },
    registerModelDiscovery() {},
  });
  try {
    const fiber = ctx.plugin(connector, { providers: { [provider]: profile } });
    await fiber.await(); assert.equal(fiber.state, 2, 'real pi-ai connector must mount');
    assert.ok(adapter instanceof connector.PiAiAdapter);
    assert.equal(owner.error, undefined);
    assert.equal(owner.settingsNs, 'llm-pi-ai'); // simple mount: no loader entry id
    assert.deepEqual(owner.settingsPath, ['providers', provider]);
    assert.equal(owner.declared, customId);
    const capable = await adapter.resolveModel(provider, active), nonreasoning = await adapter.resolveModel(provider, plain);
    const levels = capable.reasoning.efforts.map(level => level.id);
    assert.ok(levels.includes('low') && levels.includes('high'));
    assert.equal(nonreasoning.reasoning, undefined);
    for (const [model, effort] of [[active, 'low'], [active, 'high'], [plain, undefined]]) {
      const before = sent;
      expected = { url: endpoint + (responses ? '/responses' : '/chat/completions'), model, responses, effort };
      const options = { provider, model, ...(effort ? { reasoningEffort: effort } : {}),
        messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }], signal: AbortSignal.timeout(10000) };
      for await (const _ of adapter.stream(options)) { /* consume the real request and local terminal reply */ }
      assert.equal(sent, before + 1, 'exactly one checked, serialized request per stream');
      expected = undefined;
    }
  } finally { await ctx.fiber.dispose(); }
}
for (const responses of [true, false]) {
  await exercise({ provider: 'openai', responses, endpoint: official });
  await exercise({ provider: 'fixture.relay/one', responses, endpoint: relay });
}
// Even the exact *same* provider/model pair can be repointed to a gateway.
await exercise({ provider: 'openai', responses: true, endpoint: relay });
assert.equal(forbidden, 0);
assert.equal(sent, 15);
console.log('checked 15 serialized requests; no sockets or unexpected fetches');
