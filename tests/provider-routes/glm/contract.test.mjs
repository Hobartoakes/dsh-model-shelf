import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createIsolation } from '../../clean-profile-support.mjs';
import { archives } from '../../provider-options/archives.mjs';
import test from 'node:test';

const fields = ['route', 'variant', 'field', 'status', 'packagePin', 'source', 'ownerProof', 'writeSurface', 'requestProof', 'reason'];

test('GLM coverage classifies on, off, omission and the independent setting separately', async () => {
  const rows = JSON.parse(await readFile(new URL('evidence.json', import.meta.url), 'utf8'));
  const actual = rows.map(row => [row.variant, row.field, row.status]);
  for (const [variant, field, status] of [
    ['zai/glm-5.2', 'thinking.enabled', 'builtin'],
    ['zai/glm-5.2', 'thinking.disabled', 'builtin'],
    ['zai/glm-5.2', 'thinking.omitted', 'unsupported'],
    ['zai-coding-cn/glm-4.6v', 'thinking.enabled', 'builtin'],
    ['zai-coding-cn/glm-4.6v', 'thinking.disabled', 'builtin'],
    ['zai-coding-cn/glm-4.6v', 'thinking.omitted', 'unsupported'],
    ['zai/glm-5.3', 'thinking.disabled', 'unsupported'],
    ['opencode-go/glm-5.2', 'thinkingMode', 'unsupported'],
    ['zai', 'thinkingMode', 'gap'],
    ['zai-coding-cn', 'thinkingMode', 'gap'],
    ['zai/glm-5.2 (reasoningEfforts=false)', 'thinkingMode', 'unsupported'],
    ['zhipuai (unbound API profile)', 'thinkingMode', 'gap'],
  ]) {
    assert.ok(actual.some(r => r[0] === variant && r[1] === field && r[2] === status),
      'missing or misclassified: ' + [variant, field, status].join(' / '));
  }
  assert.equal(new Set(rows.map(r => r.variant + ':' + r.field)).size, rows.length);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), [...fields].sort());
    assert.equal(row.route, 'glm');
    assert.ok(['builtin', 'gap', 'unsupported'].includes(row.status), 'no new shelf control is evidenced');
    for (const key of fields) assert.ok(typeof row[key] === 'string' && row[key].trim(), key);
    assert.match(row.packagePin, /@deepseek-ai\/dsh-llm-pi-ai@0\.2\.2-rc\.5/);
    assert.match(row.packagePin, /@earendil-works\/pi-ai@1\.3\.0/);
    assert.ok(row.requestProof.includes('node --test tests/provider-routes/glm/contract.test.mjs'));
  }
});

// With a cold cache first run: node tests/provider-options/codex-roundtrip.mjs --prepare
// Offline verification never downloads, skips, or imports an installed user connector.
test('pinned DSH and pi-ai serialize GLM and the same-model gateway differently', async t => {
  const root = await mkdtemp(join(tmpdir(), 'shelf-glm-'));
  try {
    const { env, cwd } = await createIsolation(root, process.execPath, process.env);
    env.GLM_CONTRACT_FIXTURE = 'synthetic-offline-only';
    await archives({ into: root });
    const worker = fileURLToPath(new URL('request-proof.mjs', import.meta.url));
    const { stdout } = await promisify(execFile)(process.execPath, [worker, root], { cwd, env, timeout: 60000, windowsHide: true });
    assert.match(stdout, /GLM fixture: 15 locally serialized POSTs; external connections: 0\./);
    t.diagnostic(stdout.trim());
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
});
