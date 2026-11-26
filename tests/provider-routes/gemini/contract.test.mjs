import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archives } from '../../provider-options/archives.mjs';
import { createIsolation } from '../../clean-profile-support.mjs';
import test from 'node:test';

const protocols = ['google-generative-ai', 'google-vertex'];
const budgetModel = 'gemini-2.5-flash';
const levelModel = 'gemini-3.1-pro-preview';

test('each Gemini protocol classifies a numeric budget separately from a wire level and session effort', async () => {
  const rows = JSON.parse(await readFile(new URL('evidence.json', import.meta.url), 'utf8'));
  const expected = new Map();
  for (const api of protocols) {
    const add = (model, field, status) => expected.set([api, model, field].join('/'), status);
    add(budgetModel, 'thinkingBudget', 'gap');
    add(budgetModel, 'thinkingLevel', 'unsupported');
    add(budgetModel, 'reasoningEffort', 'builtin');
    add(levelModel, 'thinkingBudget', 'unsupported');
    add(levelModel, 'thinkingLevel', 'builtin');
  }
  for (const row of rows) {
    const key = row.variant + '/' + row.field;
    assert.equal(row.route, 'gemini');
    assert.ok(expected.has(key), 'duplicate or unexpected evidence: ' + key);
    assert.equal(row.status, expected.get(key), key);
    expected.delete(key);
    for (const fact of ['packagePin', 'source', 'ownerProof', 'writeSurface', 'requestProof', 'reason']) {
      assert.ok(typeof row[fact] === 'string' && row[fact].trim(), key + ': missing ' + fact);
    }
  }
  assert.deepEqual([...expected.keys()], [], 'unclassified Gemini fields');
});

async function runFixture() {
  const root = await mkdtemp(join(tmpdir(), 'shelf-gemini-offline-'));
  try {
    const { cwd, env } = await createIsolation(root, process.execPath, process.env);
    await archives({ into: root }); // offline only; no fallback or lifecycle scripts
    return await new Promise((resolve, reject) => {
      const child = fork(new URL('exercise.mjs', import.meta.url), [root], { cwd, env, execArgv: [], timeout: 60000 });
      let facts;
      child.once('message', value => { facts = value; });
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0 && facts) resolve(facts);
        else reject(Error('Gemini offline worker did not complete: ' + (signal ?? code)));
      });
    });
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
}

test('published Gemini connectors: budget, catalog effort and active owner', async t => {
  const { observed, requests, forbidden } = await runFixture();
  assert.equal(requests, 14);
  assert.equal(forbidden, 0);
  assert.deepEqual(Object.keys(observed).sort(), ['google', 'google-vertex']);
  for (const [provider, seen] of Object.entries(observed)) {
    await t.test(provider + ': 2.5 Flash maps catalog effort to a token budget, not a wire level', () => {
      for (const level of ['low','medium']) assert.ok(seen.efforts[budgetModel].includes(level));
      assert.deepEqual(seen.defaultLow, { includeThoughts: true, thinkingBudget: 2048 });
      assert.deepEqual(seen.customLow, { includeThoughts: true, thinkingBudget: 4096 });
      assert.deepEqual(seen.otherTier, { includeThoughts: true, thinkingBudget: 8192 });
    });
    await t.test(provider + ': 3.1 Pro Preview sends its catalog level instead of the configured budget', () => {
      assert.deepEqual(seen.efforts[levelModel], ['low', 'medium', 'high']);
      assert.deepEqual(seen.levelLow, { includeThoughts: true, thinkingLevel: 'LOW' });
      assert.deepEqual(seen.levelHigh, { includeThoughts: true, thinkingLevel: 'HIGH' });
    });
    await t.test(provider + ': a unique writable form can change without changing the active adapter', () => {
      assert.equal(seen.formAfter, 6144);
      assert.deepEqual(seen.beforeMismatch, { includeThoughts: true, thinkingBudget: 3072 });
      assert.deepEqual(seen.afterMismatch, seen.beforeMismatch);
    });
  }
});
