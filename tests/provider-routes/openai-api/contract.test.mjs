import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { Socket } from 'node:net';
import { promisify } from 'node:util';
import { archives, pins } from '../../provider-options/archives.mjs';
import { createIsolation } from '../../clean-profile-support.mjs';
import test from 'node:test';
import { createCodexOptions } from '../../../src/codex-options.js';

// Reproduce: node --test tests/provider-routes/openai-api/contract.test.mjs
// Uses only the verified cache from Task 2, not its Codex connector or credentials.
// One child with an isolated environment runs the actual pi-ai adapter and OpenAI SDK.
// This can establish the outgoing fields, not what an online model/gateway accepts.
if (process.argv[2] === '--wire-probe') await wireProbe(resolve(process.argv[3] ?? ''));
else registerContractTests();

function registerContractTests() {
  const variants = ['official-responses', 'official-chat-completions', 'custom-responses', 'custom-chat-completions'];
  const fields = ['outputVerbosity', 'reasoningSummary'];

  test('each API endpoint/protocol pair has its own two evidence decisions', async () => {
    const rows = JSON.parse(await readFile(new URL('evidence.json', import.meta.url), 'utf8'));
    assert.deepEqual(rows.map(r => [r.variant, r.field]).sort(), variants.flatMap(v => fields.map(f => [v, f])).sort());
    const book = new Map(pins.archives.map(([name, version]) => [name, version]));
    const packages = ['@deepseek-ai/dsh-llm-pi-ai', '@earendil-works/pi-ai', 'openai'];
    const packagePin = packages.map(name => name + '@' + book.get(name)).join('; ');
    for (const r of rows) {
      assert.equal(r.route, 'openai-api');
      assert.equal(r.packagePin, packagePin, 'reassess these decisions if any pin changes');
      const officialChatSummary = r.variant === 'official-chat-completions' && r.field === 'reasoningSummary';
      assert.equal(r.status, officialChatSummary ? 'unsupported' : 'gap');
      for (const k of ['source', 'ownerProof', 'writeSurface', 'requestProof', 'reason']) assert.ok(r[k].trim(), k);
      assert.match(r.source, /#L[0-9]+-L[0-9]+$/);
    }
  });

  test('a same-name API model never reads or patches subscription preferences', async () => {
    let calls = 0;
    const io = createCodexOptions({ call() { calls++; throw Error('subscription RPC must not run'); } });
    for (const provider of ['openai', 'openai-api', 'fixture.relay/one']) {
      const target = { sessionId: 'fixture', provider, model: 'gpt-5.4', epoch: 1, reasoningActive: true };
      assert.deepEqual(await io.read(target), []);
      for (const [id, set] of [['outputVerbosity', 'low'], ['reasoningSummary', 'detailed']]) {
        assert.equal(await io.write(target, { id }, { set }, undefined, () => true), 'refused');
      }
    }
    assert.equal(calls, 0);
  });

  // Cold start: node tests/provider-options/codex-roundtrip.mjs --prepare (archives only).
  // No implicit download, global packages, browser, plugin installation, or skipped assertions.
  test('pinned pi-ai owner and serialized API requests (offline)', async t => {
    const root = await mkdtemp(join(tmpdir(), 'shelf-openai-api-'));
    try {
      const { env, cwd } = await createIsolation(root, process.execPath, process.env);
      await archives({ into: root });
      const worker = fileURLToPath(import.meta.url);
      const { stdout } = await promisify(execFile)(process.execPath, [worker, '--wire-probe', root], {
        cwd, env: { ...env, SHELF_OFFLINE_KEY: 'fixture-only' }, timeout: 60000, windowsHide: true,
      });
      assert.match(stdout, /checked 15 serialized requests; no sockets or unexpected fetches/);
      t.diagnostic(stdout.trim());
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
  });
}

// Only the terminal SSE reply is synthetic. No request builder or payload hook is patched.
async function wireProbe(root) {
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
}
