import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

if (process.argv[2] === '--messages-probe') await runMessagesProbe();
else await registerContract();

async function registerContract() {
  const [{ default: test }, { archives, pins }, { createIsolation }] = await Promise.all([
    import('node:test'), import('../../provider-options/archives.mjs'), import('../../clean-profile-support.mjs'),
  ]);
  const fixed = 'anthropic-messages/claude-sonnet-4-5';
  const adaptive = 'anthropic-messages/claude-sonnet-4-6';
  const limited = fixed + '/no-long-ttl';
  const levels = ['minimal', 'low', 'medium', 'high'];

  // Prerequisite on a cold checkout: node tests/provider-options/codex-roundtrip.mjs --prepare
  // This test is offline: an absent archive or failed request is a hard failure.
  test('pinned Messages wire effects and distinct active/configurable owners', async t => {
    const root = await mkdtemp(join(tmpdir(), 'shelf-claude-'));
    try {
      const expectedPins = { '@deepseek-ai/dsh-llm-pi-ai': '0.2.2-rc.5', '@earendil-works/pi-ai': '1.3.0', '@anthropic-ai/sdk': '0.129.0' };
      for (const [name, version] of Object.entries(expectedPins)) {
        assert.equal(pins.archives.find(([id]) => id === name)?.[1], version, name);
      }
      await archives({ into: root });
      const { env, cwd } = await createIsolation(root, process.execPath, process.env);
      env.CLAUDE_TEST_KEY = 'fixture-only';
      const worker = fileURLToPath(import.meta.url);
      const child = spawnSync(process.execPath, [worker, '--messages-probe'], { cwd, env, encoding: 'utf8', timeout: 60000 });
      if (child.error) throw child.error;
      assert.equal(child.status, 0, child.stderr || 'offline worker failed');
      const result = JSON.parse(child.stdout.trim().split('\n').at(-1));
      assert.equal(result.fixed, true); assert.equal(result.adaptive, true); assert.equal(result.cache, true);
      assert.equal(result.separateOwner, true); assert.equal(result.blocked, 0);
      t.diagnostic(result.requests + ' actual serialized Messages requests captured in memory; no provider connections');
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
  });

  test('Claude evidence separates wire capability, active owner and existing session effort', async () => {
    const rows = JSON.parse(await readFile(new URL('evidence.json', import.meta.url), 'utf8'));
    const expected = [
      [fixed, 'cacheRetention', 'gap'], [adaptive, 'cacheRetention', 'gap'],
      ...levels.map(level => [fixed, 'thinkingBudgets.' + level, 'gap']),
      [adaptive, 'thinkingBudgets', 'unsupported'], [limited, 'cacheRetention.long', 'unsupported'],
      [fixed, 'reasoningEffort', 'builtin'], [adaptive, 'reasoningEffort', 'builtin'],
    ];
    assert.deepEqual(rows.map(r => [r.variant, r.field, r.status]).sort(), expected.sort(),
      'every investigated model/field needs a decision; wire support alone cannot authorize a shelf write');
    const keys = ['route','variant','field','status','packagePin','source','ownerProof','writeSurface','requestProof','reason'];
    for (const r of rows) {
      assert.equal(r.route, 'claude');
      for (const key of keys) assert.ok(typeof r[key] === 'string' && r[key].trim(), key);
      assert.ok(r.packagePin.includes('@deepseek-ai/dsh-llm-pi-ai@0.2.2-rc.5'));
      assert.ok(r.packagePin.includes('@earendil-works/pi-ai@1.3.0'));
      assert.ok(r.packagePin.includes('@anthropic-ai/sdk@0.129.0'));
      assert.match(r.source, /:[0-9]+|#L[0-9]+/);
      assert.ok(r.requestProof.includes('node --test tests/provider-routes/claude/contract.test.mjs'));
    }
  });
}

// Child entry: only built-ins and temp-root, digest-pinned packages are loaded.
async function runMessagesProbe() {
  const root = dirname(process.cwd());
  assert.equal(process.cwd(), join(root, 'cwd'));
  assert.equal(process.env.DSH_HOME, join(root, 'dsh-home'));
  assert.equal(process.env.HOME, join(root, 'user'));
  const pinned = pathToFileURL(join(root, 'node_modules') + sep).href;
  const require = createRequire(join(root, 'fixture.cjs'));
  registerHooks({ resolve(spec, ctx, next) {
    const result = next(spec, ctx);
    if (ctx.parentURL?.startsWith(pinned) && !isBuiltin(result.url)) assert.ok(result.url.startsWith(pinned), 'non-pinned dependency');
    return result;
  } });
  function fromPin(name) {
    const url = pathToFileURL(require.resolve(name));
    assert.ok(url.href.startsWith(pinned));
    return import(url);
  }
  const fixed = 'claude-sonnet-4-5', adaptive = 'claude-sonnet-4-6';
  const provider = 'anthropic', ns = 'fixture-pi';
  const budgets = { minimal: 1536, low: 3072, medium: 6144, high: 12288 };
  const profile = { apiKeyEnv: 'CLAUDE_TEST_KEY', models: [{ id: fixed }, { id: adaptive }], cacheRetention: 'short', thinkingBudgets: budgets };

  let blocked = 0, requests = 0, last;
  Socket.prototype.connect = function () { blocked++; throw Error('unexpected socket in offline worker'); };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    if (req.method !== 'POST' || url.origin !== 'https://api.anthropic.com' || url.pathname !== '/v1/messages') {
      blocked++; throw Error('unexpected fetch in offline worker');
    }
    const body = await req.json(); // Actual serialized SDK body; do not retain it, prompts, headers or addresses.
    const controls = [...(body.system ?? []), ...body.messages.flatMap(m => Array.isArray(m.content) ? m.content : [])]
      .filter(b => b.cache_control).map(b => b.cache_control);
    last = { model: body.model, controls, type: body.thinking?.type, budget: body.thinking?.budget_tokens, effort: body.output_config?.effort };
    requests++;
    const events = [
      { type: 'message_start', message: { id: 'msg_fixture', type: 'message', role: 'assistant', model: body.model, content: [], usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }, { type: 'message_stop' },
    ];
    return new Response(events.map(e => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join(''), { headers: { 'content-type': 'text/event-stream' } });
  };
  const [{ Context }, { Loader }, { LlmRuntime, LlmAdapter }, pi, { SettingsForms }] = await Promise.all([
    '@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-llm-pi-ai', '@deepseek-ai/dsh-settings',
  ].map(fromPin));

  async function boot(initial) {
    const ctx = new Context();
    async function mount(plugin, config) {
      const fiber = ctx.plugin(plugin, config); await fiber.await(); assert.equal(fiber.state, 2, 'active host fixture service');
    }
    await mount(LlmRuntime);
    await mount(Loader, { baseUrl: pathToFileURL(join(root, 'fixture.cjs')).href });
    const loader = ctx.get('loader'); loader.builtins['fixture-pi'] = pi;
    // Only the config document storage is in memory. The loader, descriptor,
    // namespace revision, narrow path mutation, and adapter are the real ones.
    ctx.reflect.provide('configEditor', {
      entries: () => [...loader.entries()],
      configuration: () => [...loader.entries()].map(entry => ({ entry, inherited: {}, override: entry.options.config ?? {} })),
      async edit(entry, transform) {
        assert.equal(entry.options.id, ns);
        await loader.update(ns, { config: await transform(structuredClone(entry.options.config ?? {}), {}) });
      },
    });
    ctx.reflect.provide('profileContext', { home: process.env.DSH_HOME, name: 'claude-wire-fixture' });
    await mount(SettingsForms);
    await loader.root.update([{ id: ns, name: 'cordis:fixture-pi', config: { providers: initial ? { [provider]: initial } : {} } }]);
    await loader.await();
    assert.equal(loader.resolve(ns).fiber?.state, 2, 'pi plugin must be active');
    const llm = ctx.get('llm'), settings = ctx.get('settings');
    const descriptor = () => settings.describe({ redactSecrets: true }).find(row => row.ns === ns);
    return { ctx, llm,
      async set(path, value) {
        const revision = descriptor().revision;
        await settings.mutate(ns, [{ op: 'set', path: ['providers', provider, ...path], value }], revision);
        const after = descriptor(); assert.notEqual(after.revision, revision);
        const at = layer => path.reduce((v, k) => v[k], layer.providers[provider]);
        assert.deepEqual(at(after.user), value, 'independent override readback');
        // Effective model/profile objects contain schema defaults. Check every
        // submitted part, including exact scalar values for all option writes.
        assert.partialDeepStrictEqual(at(after.value), value, 'independent effective readback');
      },
      async facts() {
        const form = descriptor(); const p = form.value.providers[provider];
        const rows = llm.listConfigurableProviders().filter(r => r.provider === provider);
        assert.equal(rows.length, 1); assert.equal(rows[0].settingsNs, ns); assert.deepEqual(rows[0].settingsPath, ['providers', provider]);
        // Compare public routing data and the redacted effective profile only
        // in memory. A form revision identifies its own document, not dispatch.
        return { live: llm.listProviders(), configurable: rows[0], profile: p,
          models: await llm.listModels(provider), resolved: await Promise.all([fixed, adaptive].map(id => llm.resolveModelInfo(provider, id))) };
      },
      async next(model, reasoningEffort) {
        const before = requests;
        const opts = { provider, model, reasoningEffort, messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }], signal: AbortSignal.timeout(8000) };
        let finish; for await (const chunk of llm.stream(opts)) if (chunk.type === 'finish') finish = chunk.reason;
        assert.deepEqual(finish, { kind: 'stop' }, 'fixture must finish normally');
        assert.equal(requests, before + 1); assert.equal(last.model, model); return last;
      },
    };
  }
  function cache(wire, kind) {
    if (kind === 'none') return assert.deepEqual(wire.controls, []);
    assert.ok(wire.controls.length > 0, 'applicable cache breakpoint');
    for (const control of wire.controls) assert.deepEqual(control, kind === 'long' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' });
  }

  const owned = await boot(profile);
  try {
    const observations = {};
    for (const model of [fixed, adaptive]) {
      const ids = (await owned.llm.resolveModelInfo(provider, model)).reasoning.efforts.map(e => e.id);
      assert.ok(['off', ...Object.keys(budgets)].every(id => ids.includes(id)));
    }
    for (const [level, value] of Object.entries(budgets)) {
      const before = await owned.next(fixed, level);
      assert.equal(before.type, 'enabled'); assert.equal(before.budget, value);
      await owned.set(['thinkingBudgets', level], value + 128);
      assert.equal((await owned.next(fixed, level)).budget, value + 128);
    }
    assert.equal((await owned.next(fixed, 'off')).budget, undefined);
    observations.fixed = true;

    const a = await owned.next(adaptive, 'low');
    assert.equal(a.type, 'adaptive'); assert.equal(a.effort, 'low'); assert.equal(a.budget, undefined);
    await owned.set(['thinkingBudgets', 'low'], 3584);
    const b = await owned.next(adaptive, 'low');
    assert.equal(b.type, 'adaptive'); assert.equal(b.effort, 'low'); assert.equal(b.budget, undefined);
    assert.equal((await owned.next(adaptive, 'high')).effort, 'high');
    observations.adaptive = true;

    for (const retention of ['short','long','none']) {
      if (retention !== 'short') await owned.set(['cacheRetention'], retention);
      for (const model of [fixed, adaptive]) cache(await owned.next(model, 'low'), retention);
    }
    await owned.set(['cacheRetention'], 'long');
    // Real model override, not a mutated SDK model or a home-made request.
    await owned.set(['models'], [{ id: fixed, compat: { supportsLongCacheRetention: false } }, { id: adaptive }]);
    cache(await owned.next(fixed, 'low'), 'short'); cache(await owned.next(adaptive, 'low'), 'long');
    // Restore the catalog capability before testing ownership: the later short
    // TTL must not be caused by the no-long-ttl override above.
    await owned.set(['models'], profile.models);
    cache(await owned.next(fixed, 'low'), 'long');
    await owned.set(['cacheRetention'], 'short');
    const wanted = await owned.facts();
    observations.cache = true;

    // Public directory and active dispatch are separate registrations. This
    // second legal adapter delegates to the real first host's Messages adapter;
    // it publishes no settings directory and doesn't fabricate any wire result.
    const split = await boot(null);
    try {
      class SeparateAdapter extends LlmAdapter {
        providerInfo() { return owned.llm.listProviders()[0]; }
        listModels(p) { return owned.llm.listModels(p); }
        resolveModel(p, model) { return owned.llm.resolveModelInfo(p, model); }
        stream(opts) { return owned.llm.stream(opts); }
      }
      split.llm.registerAdapter([provider], new SeparateAdapter());
      // A valid volatile profile arrives after the route already exists. The
      // real pi plugin keeps its directory, and the runtime keeps dispatching
      // to SeparateAdapter. Prove this with independent reads and request data.
      await split.set([], { ...profile, thinkingBudgets: { ...wanted.profile.thinkingBudgets } });
      assert.ok(isDeepStrictEqual(await split.facts(), wanted), 'same visible route, directory, models and effective profile');
      const baseline = await split.next(fixed, 'low');
      assert.equal(baseline.budget, 3584); cache(baseline, 'short');

      await split.set(['thinkingBudgets', 'low'], 4608);
      await split.set(['cacheRetention'], 'long');
      const saved = (await split.facts()).profile;
      assert.equal(saved.thinkingBudgets.low, 4608); assert.equal(saved.cacheRetention, 'long');
      const mismatch = await split.next(fixed, 'low');
      assert.equal(mismatch.budget, 3584); cache(mismatch, 'short');
      cache(await split.next(adaptive, 'low'), 'short');

      // Same call, same models: only changing the dispatch owner's settings
      // makes the serialized request follow the two saved values.
      await owned.set(['thinkingBudgets', 'low'], 4608);
      await owned.set(['cacheRetention'], 'long');
      const matches = await split.next(fixed, 'low');
      assert.equal(matches.budget, 4608); cache(matches, 'long');
      cache(await split.next(adaptive, 'low'), 'long');
      observations.separateOwner = true;
    } finally { await split.ctx.fiber.dispose(); }
    assert.equal(blocked, 0);
    console.log(JSON.stringify({ ...observations, requests, blocked }));
  } finally { await owned.ctx.fiber.dispose(); }
}
