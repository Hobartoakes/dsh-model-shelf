import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { archives, pins } from '../../provider-options/archives.mjs';
import { createIsolation } from '../../clean-profile-support.mjs';

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
    const worker = fileURLToPath(new URL('messages-probe.mjs', import.meta.url));
    const child = spawnSync(process.execPath, [worker], { cwd, env, encoding: 'utf8', timeout: 60000 });
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
