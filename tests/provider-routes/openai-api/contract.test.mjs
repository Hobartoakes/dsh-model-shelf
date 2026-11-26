import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { archives, pins } from '../../provider-options/archives.mjs';
import { createIsolation } from '../../clean-profile-support.mjs';
import test from 'node:test';
import { createCodexOptions } from '../../../src/codex-options.js';

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
    const worker = fileURLToPath(new URL('wire-probe.mjs', import.meta.url));
    const { stdout } = await promisify(execFile)(process.execPath, [worker, root], {
      cwd, env: { ...env, SHELF_OFFLINE_KEY: 'fixture-only' }, timeout: 60000, windowsHide: true,
    });
    assert.match(stdout, /checked 15 serialized requests; no sockets or unexpected fetches/);
    t.diagnostic(stdout.trim());
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
});
