import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createProviderConnection, observeProviderTarget } from '../src/provider-option-panel.js';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const rows = readJson('./provider-options/coverage.json');
const key = ({ route, variant, field }) => [route, variant, field].join(' | ');
const gap = 'gap', builtin = 'builtin', unsupported = 'unsupported';

// Investigation keys, not provider/model allow-lists. Each class is the reviewed
// conclusion for this combination, not a default for the connector or vendor.
const expected = {
  codex: {
    'openai-codex': { outputVerbosity: 'verified', reasoningSummary: 'verified', speedMode: 'verified' },
  },
  'openai-api': {
    'official-responses': { outputVerbosity: gap, reasoningSummary: gap },
    'official-chat-completions': { outputVerbosity: gap, reasoningSummary: unsupported },
    'custom-responses': { outputVerbosity: gap, reasoningSummary: gap },
    'custom-chat-completions': { outputVerbosity: gap, reasoningSummary: gap },
  },
  claude: {
    'anthropic-messages/claude-sonnet-4-5': {
      cacheRetention: gap, 'thinkingBudgets.minimal': gap, 'thinkingBudgets.low': gap,
      'thinkingBudgets.medium': gap, 'thinkingBudgets.high': gap, reasoningEffort: builtin,
    },
    'anthropic-messages/claude-sonnet-4-6': { cacheRetention: gap, thinkingBudgets: unsupported, reasoningEffort: builtin },
    'anthropic-messages/claude-sonnet-4-5/no-long-ttl': { 'cacheRetention.long': unsupported },
  },
  gemini: {
    'google-generative-ai/gemini-2.5-flash': { thinkingBudget: gap, thinkingLevel: unsupported, reasoningEffort: builtin },
    'google-vertex/gemini-2.5-flash': { thinkingBudget: gap, thinkingLevel: unsupported, reasoningEffort: builtin },
    'google-generative-ai/gemini-3.1-pro-preview': { thinkingBudget: unsupported, thinkingLevel: builtin },
    'google-vertex/gemini-3.1-pro-preview': { thinkingBudget: unsupported, thinkingLevel: builtin },
  },
  deepseek: {
    'deepseek-official': { maxTokens: gap, reasoningEffort: builtin },
    'deepseek-account': { maxTokens: gap, reasoningEffort: builtin },
  },
  qwen: {
    'token-plan-cn-switchable': { enableThinking: builtin, thinkingBudget: unsupported },
    'token-plan-cn-no-off': { enableThinking: unsupported, thinkingBudget: unsupported },
    'same-id-relay': { enableThinking: gap, thinkingBudget: gap },
    'dashscope-native': { enableThinking: gap, thinkingBudget: gap },
    'dashscope-thinking-only-checkpoint': { enableThinking: unsupported, thinkingBudget: gap },
  },
  kimi: {
    'moonshotai/kimi-k2.6': { thinkingMode: builtin, connectorThinkingDefault: gap },
    'moonshotai/kimi-k2.7-code': { thinkingMode: unsupported },
    'moonshotai-cn/kimi-k2.6': { thinkingMode: builtin },
    'moonshotai-cn/kimi-k2.7-code': { thinkingMode: unsupported },
    'opencode/kimi-k2.6': { officialThinkingPreference: gap },
    'kimi-subscription/kimi-for-coding': { thinkingMode: unsupported },
    'kimi-subscription/kimi-for-coding-highspeed': { thinkingMode: unsupported },
  },
  glm: {
    'zai/glm-5.2': { 'thinking.enabled': builtin, 'thinking.disabled': builtin, 'thinking.omitted': unsupported },
    'zai-coding-cn/glm-4.6v': { 'thinking.enabled': builtin, 'thinking.disabled': builtin, 'thinking.omitted': unsupported },
    'zai/glm-5.3': { 'thinking.disabled': unsupported },
    'opencode-go/glm-5.2': { thinkingMode: unsupported },
    zai: { thinkingMode: gap },
    'zai-coding-cn': { thinkingMode: gap },
    'zai/glm-5.2 (reasoningEfforts=false)': { thinkingMode: unsupported },
    'zhipuai (unbound API profile)': { thinkingMode: gap },
  },
};

test('the dry-run package contains the runnable provider contracts, not their private fixtures', () => {
  const pkg = readJson('../package.json');
  assert.ok(pkg.files.includes('docs/PROVIDER-OPTIONS.md'));
  const [pack] = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts --offline', {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', windowsHide: true,
  }));
  const members = new Set(pack.files.map(file => file.path));
  const options = ['README.md', 'coverage.json', 'pins.json', 'archives.mjs', 'codex-roundtrip.mjs', 'exercise.mjs',
    'host.mjs', 'local-transport.mjs', 'mount-shelf.mjs', 'races.mjs', 'shelf-browser.mjs', 'host-fallback.mjs'];
  const routeFiles = Object.keys(expected).filter(route => route !== 'codex')
    .flatMap(route => ['contract.test.mjs', 'evidence.json'].map(name => 'tests/provider-routes/' + route + '/' + name));
  const host = ['matrix.json', 'early-pins.json', 'run-contracts.mjs', 'seat-fixture.mjs', 'web-fixture.mjs', 'boot-settlement.mjs'];
  assert.deepEqual(pack.bundled, []);
  for (const path of ['lib/client.js', 'docs/PROVIDER-OPTIONS.md', 'tests/host-packages.mjs', 'tests/clean-profile-support.mjs',
    'tests/provider-coverage.test.mjs', ...host.map(name => 'tests/host-inventory/' + name),
    ...options.map(name => 'tests/provider-options/' + name), ...routeFiles]) assert.ok(members.has(path), 'missing package member: ' + path);
  assert.deepEqual([...members].filter(path => /(^|\/)(node_modules|artifacts|vendor|\.cache|\.dsh)(\/|$)|\.tgz$/i.test(path)), []);
});

function byKey(list) {
  const indexed = new Map();
  for (const row of list) {
    const id = key(row);
    assert.ok(!indexed.has(id), 'duplicate: ' + id);
    indexed.set(id, row);
  }
  return indexed;
}

test('every investigated route and variant has an evidence class', () => {
  const groups = new Set(rows.map(r => r.route));
  assert.equal(groups.size, 8, 'eight investigation groups; WorkBuddy is a separate regression');
  assert.deepEqual(groups, new Set(Object.keys(expected)));
  const remaining = byKey(rows);
  for (const [route, variants] of Object.entries(expected)) {
    for (const [variant, fields] of Object.entries(variants)) {
      for (const [field, status] of Object.entries(fields)) {
        const id = key({ route, variant, field });
        assert.equal(remaining.get(id)?.status, status, id);
        remaining.delete(id);
      }
    }
  }
  assert.deepEqual([...remaining.keys()], [], 'unreviewed combinations');
});

test('the inventory preserves every proof in the seven independently reviewed matrices', () => {
  for (const route of Object.keys(expected).filter(route => route !== 'codex')) {
    const reviewed = readJson('./provider-routes/' + route + '/evidence.json');
    const actual = byKey(rows.filter(row => row.route === route));
    assert.equal(actual.size, reviewed.length, route + ': reviewed row count');
    for (const [id, original] of byKey(reviewed)) {
      assert.deepEqual(actual.get(id), original, id + ': evidence differs from the route matrix');
    }
  }
});

test('each row cites pinned sources, ownership, a write path or limit, and reproducible evidence', () => {
  const columns = ['route', 'variant', 'field', 'status', 'packagePin', 'source', 'ownerProof', 'writeSurface', 'requestProof', 'reason'];
  for (const row of rows) {
    const id = key(row);
    assert.deepEqual(Object.keys(row).sort(), [...columns].sort(), id);
    for (const name of columns) {
      const values = name === 'source' && Array.isArray(row.source) ? row.source : [row[name]];
      assert.ok(values.length && values.every(v => typeof v === 'string' && v.trim()), id + ': ' + name);
    }
    assert.match(row.packagePin, /\d+\.\d+\.\d+/, id + ': version');
    if (row.route !== 'codex') {
      assert.ok(row.requestProof.includes('node --test tests/provider-routes/' + row.route + '/contract.test.mjs'), id);
    }
  }
});

test('each verified Codex field cites a local request round trip', () => {
  const codex = byKey(rows.filter(r => r.route === 'codex'));
  for (const [field, wire] of [['outputVerbosity', 'text.verbosity'], ['reasoningSummary', 'reasoning.summary'], ['speedMode', 'service_tier']]) {
    const row = codex.get(key({ route: 'codex', variant: 'openai-codex', field }));
    assert.equal(row?.status, 'verified', field);
    if (field === 'speedMode') {
      assert.ok(row.source.some(ref => ref.includes('05690e4045030bf8d4a85dbd5049d866ea6cd014') && ref.includes('pi-ai-runtime.js')));
      assert.ok(row.source.some(ref => ref.includes('exercise.mjs') && ref.includes('verifySpeed')));
    } else assert.ok(row.source.some(ref => ref.includes('61aed96623bc15fec46eaca9060296aa1f9195cf') && ref.includes('exercise.mjs')), field);
    assert.ok(row.requestProof.includes('node tests/provider-options/codex-roundtrip.mjs --offline') && row.requestProof.includes(wire), field);
  }
});

test('the shelf exposes exactly the verified options, with no unresolved candidates', async () => {
  assert.equal(rows.filter(r => r.status === 'candidate').length, 0);
  const published = rows.filter(r => r.status === 'verified').map(key).sort();
  // Exercise the same connection + target dispatch the mounted picker uses.
  // A fake owner here tests reachability; the pinned offline fixture proves adoption.
  const store = value => ({ getSnapshot: () => value, subscribe: () => () => {} });
  const link = createProviderConnection(), calls = [], visible = [];
  const model = { id:'gpt-5.4', reasoning: { defaultEffort:'medium', efforts:[{id:'medium'}] } };
  const detach = link.attach({ state:store('connected'), generation:store({id:1}), rpc:{ async call(...args) {
    calls.push(args.slice(0,3));
    return { ok:true, value:{ writable:true, composerModelPicker:'auto', availableModels:[model], disabledModels:[],
      catalogStatus:{source:'online',refresh:'ok'}, fastModels:[model.id], ultrafastModels:[model.id], verbosityModels:[model.id],
      speedMode:'standard', outputVerbosity:'default', reasoningSummary:'auto', customInstructions:'not a shelf field' } };
  } } });
  try {
    for (const provider of ['openai-codex', 'openai','openai-api','fixture.relay/one','anthropic','google','google-vertex',
      'deepseek-official','deepseek-account','modelstudio','dashscope','moonshotai','moonshotai-cn','kimi-subscription','opencode','zai','zai-coding-cn','opencode-go','zhipuai']) {
      const dir = store({ status:'ready', routable:true, current:{provider,model:model.id}, groups:[{id:provider,models:[model]}] });
      const binding = observeProviderTarget(dir,link,'same-id-control').getSnapshot();
      if (provider !== 'openai-codex') { assert.equal(binding,null,provider); continue; }
      assert.ok(binding);
      const fields = await binding.io.read(binding.target);
      visible.push(...fields.map(f => key({route:'codex', variant:binding.target.provider, field:f.id})));
    }
    assert.deepEqual(visible.sort(),published);
    assert.deepEqual(calls,[['/api','codex-subscription/preferences/status',{}]]);
  } finally { detach(); }
});
