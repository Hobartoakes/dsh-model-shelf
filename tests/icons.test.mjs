import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { providerIcon, modelIcon } from '../src/icons.js';

test('icon attribution research is included in package files', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.files.includes('docs/research/2026-11-01-brand-icon-permissions.md'));
  assert.ok(pkg.files.includes('docs/research/2026-11-01-icon-performance.md'));
});

test('provider icon keys use exact normalized provider identities', () => {
  assert.equal(providerIcon('deepseek-official'), 'deepseek');
  assert.equal(providerIcon('OPENAI-CODEX'), 'openai');
  assert.equal(providerIcon('workbuddy'), 'workbuddy');
  assert.equal(providerIcon('workbuddy-ai'), 'workbuddy');
  assert.equal(providerIcon('workbuddy-fake'), 'default');
  assert.equal(providerIcon('unrelated-deepseek-official'), 'default');
  assert.equal(providerIcon(''), 'default');
});

test('model icon keys recognize anchored model families without substring guesses', () => {
  assert.equal(modelIcon('deepseek-v4.1-flash'), 'deepseek');
  assert.equal(modelIcon('deepseek-flash'), 'deepseek');
  assert.equal(modelIcon('deepseek-v4-flash-vision'), 'deepseek');
  assert.equal(modelIcon('gpt-6.1-terra'), 'openai');
  assert.equal(modelIcon('claude-sonnet-4-5'), 'claude');
  assert.equal(modelIcon('gpt-4o'), 'openai');
  assert.equal(modelIcon('claude-3-5-sonnet'), 'claude');
  assert.equal(modelIcon('DEEPSEEK-V3'), 'deepseek');
  assert.equal(modelIcon('deepseek-v3.2'), 'deepseek');
  assert.equal(modelIcon('gpt-5.1-mini'), 'openai');
  assert.equal(modelIcon('gpt-4o-mini'), 'openai');
  assert.equal(modelIcon('gpt-5-codex'), 'openai');
  assert.equal(modelIcon('gpt-999'), 'default');
  assert.equal(modelIcon('claude-opus-999'), 'default');
  assert.equal(modelIcon('deepseek-v999'), 'default');
  assert.equal(modelIcon('claude-opus-4-6'), 'claude');
  assert.equal(modelIcon('gpt-5.1-fake'), 'default');
  assert.equal(modelIcon('claude-opus-4-6-fake'), 'default');
  assert.equal(modelIcon('deepseek-v4-impostor'), 'default');
  assert.equal(modelIcon('deepseek-chat-malicious'), 'default');
  assert.equal(modelIcon('fake-gpt-6'), 'default');
  assert.equal(modelIcon('gpt-impostor'), 'default');
  assert.equal(modelIcon(''), 'default');
});

test('no unverified brand images are embedded in the build', async () => {
  const built = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.doesNotMatch(built, /data:image\/svg\+xml;base64,/);
});
