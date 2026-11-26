// Test boundary: public packages are loaded only from the freshly unpacked, checked tree.
import assert from 'node:assert/strict';
import { createRequire, isBuiltin, registerHooks } from 'node:module';
import { Socket } from 'node:net';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadRuntime(root) {
  const require = createRequire(join(root, 'fixture.cjs'));
  const modules = pathToFileURL(join(root, 'node_modules') + sep).href;
  registerHooks({ resolve(specifier, context, next) {
    const resolved = next(specifier, context);
    if (context.parentURL?.startsWith(modules) && !isBuiltin(resolved.url)) {
      assert.ok(resolved.url.startsWith(modules), 'unverified dependency: ' + specifier);
    }
    return resolved;
  } });
  async function fromPin(name) {
    const url = pathToFileURL(require.resolve(name)).href;
    assert.ok(url.startsWith(modules), 'unverified root module: ' + name);
    return import(url);
  }
  const [{ Context }, { Loader }, { LlmRuntime }, { SettingsForms }, pi] = await Promise.all([
    '@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-settings', '@deepseek-ai/dsh-llm-pi-ai',
  ].map(fromPin));
  return { Context, Loader, LlmRuntime, SettingsForms, pi };
}

export function localTransport() {
  // Nothing above Fetch, including the Google SDK request serializer, is patched.
  // No listener/port, default network fallback, auth service, or real credentials.
  const origins = { google: 'https://generativelanguage.googleapis.com', 'google-vertex': 'https://aiplatform.googleapis.com' };
  const wire = [];
  let expected, forbidden = 0;
  Socket.prototype.connect = function () { forbidden++; throw Error('socket forbidden in Gemini worker'); };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    if (!expected || request.method !== 'POST' || url.origin !== origins[expected.provider] ||
        !url.pathname.endsWith('/models/' + expected.model + ':streamGenerateContent')) {
      forbidden++; throw Error('unexpected Gemini transport call');
    }
    const body = await request.json();
    wire.push(body.generationConfig?.thinkingConfig ?? null); // discard the rest
    const reply = { candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] };
    return new Response('data: ' + JSON.stringify(reply) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
  };
  return {
    async request(llm, provider, model, reasoningEffort) {
      expected = { provider, model };
      const before = wire.length;
      try {
        for await (const _ of llm.stream({ provider, model, reasoningEffort, messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }], signal: AbortSignal.timeout(8000) })) { /* consume the actual connector */ }
      } finally { expected = undefined; }
      assert.equal(wire.length, before + 1, 'expected exactly one serialized request');
      return wire.at(-1);
    },
    get count() { return wire.length; },
    get forbidden() { return forbidden; },
  };
}
