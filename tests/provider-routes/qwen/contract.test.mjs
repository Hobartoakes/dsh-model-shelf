import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createIsolation } from '../../clean-profile-support.mjs';
import { archives } from '../../provider-options/archives.mjs';
import { nativeArchives } from './native-archives.mjs';

// These are evidence classes, NOT a runtime dispatch table. The two fields are
// deliberately separate: a native effort does not imply a token budget.
const expected = {
  'token-plan-cn-switchable': ['builtin', 'unsupported'],
  'token-plan-cn-no-off': ['unsupported', 'unsupported'],
  'same-id-relay': ['gap', 'gap'],
  'dashscope-native': ['gap', 'gap'],
  'dashscope-thinking-only-checkpoint': ['unsupported', 'gap'],
};

test('each Qwen route, model variant and field has a bounded evidence class', async () => {
  const file = new URL('evidence.json', import.meta.url);
  const rows = await readFile(file, 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return []; // Missing *rows* fail the contract below.
    throw error;
  });
  const wanted = Object.entries(expected).flatMap(([variant, statuses]) =>
    ['enableThinking', 'thinkingBudget'].map((field, i) => [variant, field, statuses[i]].join(':')));
  assert.deepEqual(rows.map(row => [row.variant, row.field, row.status].join(':')).sort(), wanted.sort(),
    'one classified row per variant and field; a second switch or unverified budget must not ship');
  for (const row of rows) {
    assert.equal(row.route, 'qwen');
    for (const key of ['packagePin','source','ownerProof','writeSurface','requestProof','reason']) {
      assert.ok(typeof row[key] === 'string' && row[key].trim(), row.variant + ': ' + key);
    }
    assert.match(row.source, /#L[0-9]+/);
    assert.ok(row.requestProof.includes('node --test tests/provider-routes/qwen/contract.test.mjs'));
  }
});

test('fixed connectors: Qwen route, model capability and serialized request', async t => {
  const root = await mkdtemp(join(tmpdir(), 'shelf-qwen-profile-'));
  try {
    const { env, cwd } = await createIsolation(root, process.execPath, process.env);
    // Reuse the verified host/SDK bytes, not a developer installation or profile.
    await archives({ into: root }); await nativeArchives({ into: root });
    const script = fileURLToPath(new URL('probe.mjs', import.meta.url));
    const { stdout } = await promisify(execFile)(process.execPath, [script, root], { env, cwd, timeout: 60000, windowsHide: true });
    const got = JSON.parse(stdout);
    await t.test('switchable CN model uses session effort, not a saved vendor switch', () => {
      assert.deepEqual(got.hybridLevels, ['off','minimal','low','medium','high']);
      assert.deepEqual(got.off, { enable_thinking: false });
      assert.deepEqual(got.high, { enable_thinking: true }); assert.deepEqual(got.high2, got.high);
    });
    await t.test('no-off CN model refuses explicit off; omitting effort is not an off selection', () => {
      assert.deepEqual(got.limitedLevels, ['low','medium','xhigh']);
      assert.deepEqual(got.low, { enable_thinking: true, reasoning_effort: 'low' }); assert.deepEqual(got.low2, got.low);
      assert.deepEqual(got.omitted, { enable_thinking: false });
    });
    await t.test('same-id relay must not inherit a switch or budget from Qwen', () => {
      assert.deepEqual(got.relay, { reasoning_effort: 'high' });
      assert.deepEqual(got.relayOptIn, { enable_thinking: true, thinking_budget: 2400 });
    });
    await t.test('native parameters serialize, but independent capabilities and effective owner are not implied', () => {
      assert.deepEqual(got.nativeDefault, {});
      assert.deepEqual(got.nativeRoute, { enable_thinking: true, thinking_budget: 1000 });
      assert.deepEqual(got.nativeModel, { enable_thinking: true, thinking_budget: 2000 });
      assert.deepEqual(got.nativeMasked, { enable_thinking: false, thinking_budget: 256 });
    });
    await t.test('fixed checkpoint: native serialization does not validate a model capability', () => {
      assert.deepEqual(got.nativeFixed, { enable_thinking: false });
      assert.deepEqual(got.nativeFixedBudget, { thinking_budget: 1800 });
    });
    assert.equal(got.posts, 14); assert.equal(got.forbidden, 0);
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
});
