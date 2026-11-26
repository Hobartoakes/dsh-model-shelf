import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createIsolation } from '../../clean-profile-support.mjs';
import { archives, pins } from '../../provider-options/archives.mjs';
import { unpackSubscription } from './fixture.mjs';
import test from 'node:test';

test('pinned Kimi providers serialize native selections but do not furnish a new shelf setting', async t => {
  const root = await mkdtemp(join(tmpdir(), 'shelf-kimi-'));
  try {
    const { cwd, env } = await createIsolation(root, process.execPath, process.env);
    const versions = new Map(pins.archives.map(([name, version]) => [name, version]));
    for (const [name, version] of [['@deepseek-ai/dsh-llm-pi-ai', '0.2.2-rc.5'], ['@earendil-works/pi-ai', '1.3.0'], ['openai', '7.19.0']]) {
      assert.equal(versions.get(name), version, 'Reinvestigate Kimi evidence after a dependency change: ' + name);
    }
    await unpackSubscription(root);
    await archives({ into: root }); // SHA-512 pinned public artifacts, no cold fetch
    const probe = fileURLToPath(new URL('probe.mjs', import.meta.url));
    const { stdout } = await promisify(execFile)(process.execPath, [probe, root], { cwd, env, windowsHide: true, timeout: 60000 });
    assert.deepEqual(JSON.parse(stdout), { serialized: 17, forbidden: 0 });
    t.diagnostic('17 POST bodies captured in memory; no unexpected fetch or socket');
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('Kimi mode evidence separates session toggles, fixed models and same-ID relays', async () => {
  let rows;
  try { rows = JSON.parse(await readFile(new URL('evidence.json', import.meta.url), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; rows = []; }

  const expected = [
    ['moonshotai/kimi-k2.6', 'thinkingMode', 'builtin'],
    ['moonshotai-cn/kimi-k2.6', 'thinkingMode', 'builtin'],
    ['moonshotai/kimi-k2.7-code', 'thinkingMode', 'unsupported'],
    ['moonshotai-cn/kimi-k2.7-code', 'thinkingMode', 'unsupported'],
    ['opencode/kimi-k2.6', 'officialThinkingPreference', 'gap'],
    ['moonshotai/kimi-k2.6', 'connectorThinkingDefault', 'gap'],
    ['kimi-subscription/kimi-for-coding', 'thinkingMode', 'unsupported'],
    ['kimi-subscription/kimi-for-coding-highspeed', 'thinkingMode', 'unsupported'],
  ];
  for (const [variant, field, status] of expected) {
    const matches = rows.filter(row => row.route === 'kimi' && row.variant === variant && row.field === field);
    assert.equal(matches.length, 1, 'missing or ambiguous evidence: ' + variant + ' ' + field);
    assert.equal(matches[0].status, status, variant + ' ' + field);
  }
  for (const row of rows) {
    assert.equal(row.route, 'kimi');
    assert.ok(['builtin', 'gap', 'unsupported'].includes(row.status), 'no proven new shelf write');
    for (const key of ['source', 'packagePin', 'ownerProof', 'writeSurface', 'requestProof', 'reason']) {
      assert.ok(row[key]?.length, row.variant + ' lacks ' + key);
    }
  }
});
