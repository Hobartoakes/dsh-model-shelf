// Test worker only: no settings editor, live account, browser, or upstream transport.
import assert from 'node:assert/strict';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { Socket } from 'node:net';
import { basename, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? '');
assert.match(basename(root), /^shelf-glm-[a-zA-Z0-9]{6}$/);
for (const [key, dir] of Object.entries({ HOME: 'user', USERPROFILE: 'user', DSH_HOME: 'dsh-home', TEMP: 'tmp' })) {
  assert.equal(process.env[key], join(root, dir), 'isolated worker required');
}
assert.equal(process.cwd(), join(root, 'cwd'));
const require = createRequire(join(root, 'worker.cjs'));
const modules = join(root, 'node_modules');
const prefix = pathToFileURL(modules + sep).href;
registerHooks({ resolve(id, context, next) {
  const result = next(id, context);
  if (context.parentURL?.startsWith(prefix) && !isBuiltin(result.url)) {
    assert.ok(result.url.startsWith(prefix), 'dependency outside verified archives: ' + id);
  }
  return result;
} });
for (const [name, expected] of [['@deepseek-ai/dsh-llm-pi-ai', '0.2.2-rc.5'], ['@deepseek-ai/dsh-llm', '0.2.2-rc.5'], ['@earendil-works/pi-ai', '1.3.0'], ['openai', '7.19.0']]) {
  const pkg = JSON.parse(await readFile(join(modules, name, 'package.json'), 'utf8'));
  assert.equal(pkg.name, name); assert.equal(pkg.version, expected);
}
const fromPin = id => {
  const entry = pathToFileURL(require.resolve(id));
  assert.ok(entry.href.startsWith(prefix));
  return import(entry);
};

// Block sockets before importing the host or SDK. Inspect only a small projection
// of the serialized POST at fetch; never retain headers, messages or complete bodies.
const destinations = new Map([
  ['https://api.z.ai/api/coding/paas/v4/chat/completions', 'zai'],
  ['https://open.bigmodel.cn/api/coding/paas/v4/chat/completions', 'zai-coding-cn'],
  ['https://opencode.ai/inference/go/v1/chat/completions', 'opencode-go'],
]);
let forbidden = 0, posts = 0, last;
Socket.prototype.connect = function () { forbidden++; throw Error('offline worker cannot open a socket'); };
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init), route = destinations.get(req.url);
  if (!route || req.method !== 'POST') { forbidden++; throw Error('unexpected offline fetch'); }
  const body = await req.json();
  const keys = ['thinking', 'reasoning_effort', 'enable_thinking', 'chat_template_kwargs', 'reasoning'];
  last = { route, model: body.model, fields: Object.fromEntries(keys.filter(k => Object.hasOwn(body, k)).map(k => [k, body[k]])) };
  posts++;
  const frame = { choices: [{ index: 0, delta: { role: 'assistant', content: 'fixture' }, finish_reason: 'stop' }] };
  return new Response('data: ' + JSON.stringify(frame) + '\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
};
const [{ Context }, { Loader }, { LlmRuntime }, pi] = await Promise.all([
  '@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-llm-pi-ai',
].map(fromPin));
// Inspect the published schema, not field names guessed from a request body.
const profileFields = pi.Config.dict.providers.inner.dict;
assert.equal(profileFields.reasoning.type, 'union');
assert.ok(profileFields.compat.dict.thinkingFormat);
assert.ok(profileFields.modelOverrides.inner.dict.reasoningEfforts);
for (const fields of [profileFields, profileFields.models.inner.dict, profileFields.modelOverrides.inner.dict, profileFields.compat.dict]) {
  for (const key of ['thinking', 'thinkingMode', 'enable_thinking', 'clear_thinking']) {
    assert.equal(Object.hasOwn(fields, key), false, key + ' is not an independent preference here');
  }
}
const ctx = new Context();
const mount = async (plugin, config) => { const f = ctx.plugin(plugin, config); await f.await(); assert.equal(f.state, 2, 'fixture host must be active'); };
try {
  await mount(LlmRuntime); await mount(Loader, { baseUrl: pathToFileURL(join(root, 'worker.cjs')).href });
  const llm = ctx.get('llm'), loader = ctx.get('loader'), owner = 'glm-contract-owner';
  loader.builtins['@deepseek-ai/dsh-llm-pi-ai'] = pi;
  // A synthetic launch-environment value, not the daily credential service.
  const profiles = Object.fromEntries([...destinations.values()].map(id => [id, { apiKeyEnv: 'GLM_CONTRACT_FIXTURE' }]));
  await loader.root.update([{ id: owner, name: 'cordis:@deepseek-ai/dsh-llm-pi-ai', config: { providers: profiles } }]);
  await loader.await(); const fiber = loader.resolve(owner).fiber; await fiber.await(); assert.equal(fiber.state, 2);
  assert.equal(llm.listConfigurableProviders().some(p => p.provider === 'zhipuai'), false, 'no such catalog route in this fixture');
  for (const route of destinations.values()) {
    assert.equal(llm.listProviders().filter(p => p.id === route).length, 1, 'active adapter for route');
    const owners = llm.listConfigurableProviders().filter(p => p.provider === route);
    assert.equal(owners.length, 1); assert.equal(owners[0].settingsNs, owner);
    assert.deepEqual(owners[0].settingsPath, ['providers', route]); assert.equal(owners[0].declared, false);
  }
  async function call(provider, model, effort) {
    const signal = AbortSignal.timeout(10000);
    const prepared = await llm.prepareCall({ provider, model, ...(effort === undefined ? {} : { reasoningEffort: effort }) }, signal);
    let finish;
    for await (const event of prepared.stream({ ...prepared.config, messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }], signal })) {
      if (event.type === 'finish') finish = event.reason;
    }
    return finish;
  }
  async function wire(provider, model, effort) {
    const count = posts;
    const finish = await call(provider, model, effort);
    assert.equal(finish?.kind, 'stop', 'fixture stream did not finish normally: ' + (finish?.failure?.code ?? 'unknown'));
    assert.equal(posts, count + 1); assert.equal(last.route, provider); assert.equal(last.model, model);
    return last.fields;
  }
  async function rejectsEffort(provider, model) {
    const count = posts;
    await assert.rejects(llm.prepareCall({ provider, model, reasoningEffort: 'off' }), { code: 'UNSUPPORTED_REASONING_EFFORT' });
    assert.equal(posts, count, 'refused before transport');
  }
  const enabled = { type: 'enabled', clear_thinking: false }, disabled = { type: 'disabled' };
  for (const [route, model, levels, extra] of [
    ['zai', 'glm-5.2', ['off', 'high', 'max'], { reasoning_effort: 'high' }],
    ['zai-coding-cn', 'glm-4.6v', ['off', 'minimal', 'low', 'medium', 'high'], {}],
  ]) {
    const info = await llm.resolveModelInfo(route, model);
    assert.deepEqual(info.reasoning.efforts.map(e => e.id), levels); assert.equal(info.reasoning.defaultEffort, undefined);
    assert.deepEqual(await wire(route, model, 'high'), { thinking: enabled, ...extra });
    assert.deepEqual(await wire(route, model, 'off'), { thinking: disabled });
    assert.deepEqual(await wire(route, model), { thinking: disabled }); // absent effort != absent thinking
  }
  const levels = async (p, m) => (await llm.resolveModelInfo(p, m)).reasoning.efforts.map(e => e.id);
  assert.deepEqual(await levels('zai', 'glm-5.3'), ['low', 'high', 'max']);
  await rejectsEffort('zai', 'glm-5.3');
  assert.deepEqual(await wire('zai', 'glm-5.3', 'low'), { thinking: enabled, reasoning_effort: 'low' });
  // This model declares no off; an unpinned request still serializes disabled.
  // That is not evidence the remote model accepts or obeys it.
  assert.deepEqual(await wire('zai', 'glm-5.3'), { thinking: disabled });
  assert.deepEqual(await levels('opencode-go', 'glm-5.2'), ['high', 'max']);
  await rejectsEffort('opencode-go', 'glm-5.2');
  assert.deepEqual(await wire('opencode-go', 'glm-5.2', 'high'), { reasoning_effort: 'high' });
  assert.deepEqual(await wire('opencode-go', 'glm-5.2'), {}); // same model, different gateway

  // Set an isolated composition default, not a model-specific preference. An
  // explicit session choice overrides it and the other route remains unchanged.
  const configured = { ...profiles, zai: { ...profiles.zai, reasoning: 'high' } };
  await loader.update(owner, { config: { providers: configured } });
  assert.equal((await llm.resolveModelInfo('zai', 'glm-5.2')).reasoning.defaultEffort, 'high');
  assert.deepEqual(await wire('zai', 'glm-5.2'), { thinking: enabled, reasoning_effort: 'high' });
  assert.deepEqual(await wire('zai', 'glm-5.2', 'off'), { thinking: disabled });
  assert.deepEqual(await wire('zai-coding-cn', 'glm-4.6v'), { thinking: disabled });
  // Route-wide off would work for 5.2 but would break a different model on
  // this very route. It is not a safe implementation of a per-model toggle.
  const deploy = zai => loader.update(owner, { config: { providers: { ...profiles, zai: { ...profiles.zai, ...zai } } } });
  await deploy({ reasoning: 'off' });
  assert.deepEqual(await wire('zai', 'glm-5.2'), { thinking: disabled });
  const count = posts, rejected = await call('zai', 'glm-5.3');
  assert.equal(rejected?.kind, 'error'); assert.equal(rejected.failure.code, 'UNSUPPORTED_REASONING_EFFORT');
  assert.equal(posts, count);

  // Explicit synthetic deployment mask: even the same route+model can have
  // no declared capability. The unchanged connector then omits thinking.
  await deploy({ modelOverrides: { 'glm-5.2': { reasoningEfforts: false } } });
  assert.equal((await llm.resolveModelInfo('zai', 'glm-5.2')).reasoning, undefined);
  assert.deepEqual(await wire('zai', 'glm-5.2'), {});
  await rejectsEffort('zai', 'glm-5.2');
  assert.equal(forbidden, 0);
  console.log('GLM fixture: ' + posts + ' locally serialized POSTs; external connections: 0.');
} finally { await ctx.fiber.dispose(); }
