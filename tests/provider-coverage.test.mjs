import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const rows = readJson('./provider-options/coverage.json');
const key = ({ route, variant, field }) => [route, variant, field].join(' | ');
const gap = 'gap', builtin = 'builtin', unsupported = 'unsupported';

// Investigation keys, not provider/model allow-lists. Each class is the reviewed
// conclusion for this combination, not a default for the connector or vendor.
const expected = {
  codex: {
    'openai-codex': { outputVerbosity: 'verified', reasoningSummary: 'verified', speedMode: 'candidate' },
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

test('Codex distinguishes the two Task 2 round trips from the speed source investigation', () => {
  const codex = byKey(rows.filter(r => r.route === 'codex'));
  for (const [field, wire] of [['outputVerbosity', 'text.verbosity'], ['reasoningSummary', 'reasoning.summary']]) {
    const row = codex.get(key({ route: 'codex', variant: 'openai-codex', field }));
    assert.equal(row?.status, 'verified', field);
    assert.ok([].concat(row.source).some(s => s.includes('61aed96623bc15fec46eaca9060296aa1f9195cf') && s.includes('exercise.mjs')), field);
    assert.ok(row.requestProof.includes('node tests/provider-options/codex-roundtrip.mjs --offline') && row.requestProof.includes(wire), field);
  }
  const speed = codex.get(key({ route: 'codex', variant: 'openai-codex', field: 'speedMode' }));
  assert.equal(speed?.status, 'candidate', 'a catalog or request-builder branch is not a shelf round trip');
  assert.ok([].concat(speed.source).some(s => s.includes('05690e4045030bf8d4a85dbd5049d866ea6cd014') && s.includes('pi-ai-runtime.js')));
});
