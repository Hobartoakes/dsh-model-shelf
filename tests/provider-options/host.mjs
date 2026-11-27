// Small real DSH graph, not a running desktop. DSH owns BrowserAuth, /api,
// volatile form validation and Loader updates; Codex registers both its own
// endpoints and the LLM adapter. Only the profile file, account, upstream
// catalog, session projection and unrelated services are fixture inputs.
import assert from 'node:assert/strict';
import { createRequire, registerHooks, isBuiltin } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const route = 'openai-codex';
export const activeModel = 'gpt-5.4', plainModel = 'shelf-fixture-no-reasoning';
export const fastOnly = 'shelf-fixture-fast', ultraOnly = 'shelf-fixture-ultrafast', unknownTier = 'gpt-5.5-fixture';
export const catalogRows = [
  { slug: activeModel, service_tiers: [{ id: 'priority' }, { id: 'ultrafast' }], default_verbosity: 'high', default_reasoning_level: 'medium', supported_reasoning_levels: ['low','medium','high'].map(effort => ({ effort })) },
  { slug: plainModel, default_verbosity: 'low', supported_reasoning_levels: [] },
  { slug: fastOnly, additional_speed_tiers: ['fast'] },
  { slug: ultraOnly, additional_speed_tiers: ['ultrafast'] },
  // Would match the owner's model-name fallback without account metadata.
  { slug: unknownTier, service_tiers: [{ id: 'turbo' }] },
].map(row => ({ ...row, visibility: 'list', support_verbosity: true, context_window: 120000, display_name: row.slug }));

function syntheticCredentials() {
  const records = new Map();
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const access = b64({ alg: 'none' }) + '.' + b64({ 'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account' } }) + '.fixture';
  const values = new Map([['OPENAI_CODEX_SUBSCRIPTION_OAUTH', JSON.stringify({ type: 'oauth', access, refresh: 'fixture-only', accountId: 'fixture-account', expires: Date.now() + 86400000 })]]);
  return { resolve: key => values.has(key) ? { value: values.get(key), source: 'fixture' } : undefined,
    set: (key, v) => values.set(key, v), unset: key => values.delete(key),
    readRecord: key => records.get(key), async modifyRecord(key, fn) { const value = await fn(records.get(key)); records.set(key, value); return value; } };
}

export async function bootHost(root) {
  const require = createRequire(join(root, 'fixture.cjs'));
  const pinned = pathToFileURL(join(root, 'node_modules') + sep).href;
  // No resolution from the developer's dependency tree or global packages,
  // even for transitive imports. Delegate unchanged inside the verified tree.
  const audit = registerHooks({ resolve(specifier, context, next) {
    const result = next(specifier, context);
    if (context.parentURL?.startsWith(pinned) && !isBuiltin(result.url)) assert.ok(result.url.startsWith(pinned), 'dependency outside verified archives: '+specifier);
    return result;
  } });
  const fromPin = name => { const p = require.resolve(name); assert.ok(p.startsWith(join(root, 'node_modules') + sep)); return import(pathToFileURL(p)); };
  const [{ Context }, { Loader }, { SettingsForms }, connection, codex] = await Promise.all([
    '@deepseek-ai/cordis','@deepseek-ai/cordis-plugin-loader','@deepseek-ai/dsh-settings','@deepseek-ai/dsh-client-connection','dsh-codex-subscription'
  ].map(fromPin));
  const ctx = new Context(), routes = new Map(), writes = [];
  const provide = (key, svc) => ctx.reflect.provide(key, svc);
  const mount = async (plugin, config) => { const f = ctx.plugin(plugin, config); await f.await(); assert.equal(f.state, 2 /* FiberState.ACTIVE */, 'host plugin ' + (plugin.name ?? 'anonymous')); };
  const noop = () => () => {};
  provide('credentials', syntheticCredentials());
  provide('webServer', { host: '127.0.0.1', protocol: 'http:', register(r) { assert.ok(!routes.has(r.path)); routes.set(r.path, r); return () => routes.delete(r.path); } });
  let adapter;
  provide('llm', { registerAdapter(ids, a) { assert.deepEqual(ids, [route]); adapter = a; return noop(); }, emitAdaptersUpdated() {} });
  provide('attachments', { imageLimits: { maxMessageImageBytes: 1024 } });
  provide('web', { searchProviders: new Map(), fetchProviders: new Map(), registerSearchProvider: noop, registerFetchProvider: noop });
  provide('tools', { register: noop });
  const profile = process.env.DSH_HOME, configPath = join(profile, 'fixture-config.json');
  await writeFile(configPath, '{}', { flag: 'wx' });
  const readConfig = async () => JSON.parse(await readFile(configPath));
  provide('profileContext', { home: profile, name: 'offline-fixture' });
  await mount(Loader, { baseUrl: pathToFileURL(join(root, 'fixture.cjs')).href });
  const loader = ctx.get('loader'), id = 'fixture-codex';
  loader.builtins['dsh-codex-subscription'] = codex;
  provide('configEditor', {
    entries: () => [...loader.entries()], configuration: () => [...loader.entries()].map(entry => ({ entry, inherited: {}, override: entry.options.config ?? {} })),
    async edit(entry, transform) {
      assert.equal(entry.options.id, id);
      const before = await readConfig(), next = await transform(before, {});
      const changed = [...new Set([...Object.keys(before), ...Object.keys(next)])].filter(k => JSON.stringify(before[k]) !== JSON.stringify(next[k]));
      assert.equal(changed.length, 1); assert.ok(['outputVerbosity', 'reasoningSummary', 'speedMode'].includes(changed[0])); writes.push(changed[0]);
      await writeFile(configPath, JSON.stringify(next)); await loader.update(id, { config: await readConfig() });
    }
  });
  await mount(SettingsForms); await mount(connection);
  await loader.root.update([{ id, name: 'cordis:dsh-codex-subscription', config: {} }]); await loader.await();
  const entry = loader.resolve(id); await entry.fiber?.await();
  assert.equal(entry.fiber?.state,2,'connector entry must be ACTIVE');
  assert.ok(adapter, 'Codex must register the real PiAiAdapter');
  const models = await adapter.listModels(route);
  const selected = await Promise.all(catalogRows.map(async ({ slug: id }) => {
    assert.ok(models.some(model => model.id === id), 'synthetic catalog must reach the real adapter: ' + id);
    const { name, reasoning } = await adapter.resolveModel(route, id);
    return { id, name, reasoning };
  }));
  return { routes, connection: ctx.get('connection'), models: selected, writes, readConfig, dispose: async () => { try { await ctx.fiber.dispose(); } finally { audit.deregister(); } },
    async request(model, effort) {
      for await (const chunk of adapter.stream({ provider: route, model, ...(effort ? { reasoningEffort: effort } : {}), messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }], signal: AbortSignal.timeout(10000) })) { /* consume the actual builder/serializer */ }
    }
  };
}
