import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { catalogRows } from './host.mjs';

// The connector receives an ordinary Fetch implementation. Nothing above
// fetch (pi-ai, onPayload, serialization, retries, RPC handlers) is patched.
export function isolateNetwork() {
  let forbidden = 0, catalogs = 0;
  const wire = [], originalFetch = globalThis.fetch, originalConnect = Socket.prototype.connect;
  Socket.prototype.connect = function () { forbidden++; throw Error('offline worker cannot initiate a socket'); };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    if (url.origin === 'https://chatgpt.com' && url.pathname === '/backend-api/codex/models' && req.method === 'GET') {
      catalogs++; return Response.json({ models: catalogRows });
    }
    if (url.origin === 'https://chatgpt.com' && url.pathname === '/backend-api/codex/responses' && req.method === 'POST') {
      const body = await req.json(); wire.push({ model: body.model, text: body.text, reasoning: body.reasoning });
      const done = { type: 'response.completed', response: { id: 'fixture-response', status: 'completed', output: [], usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 } } };
      return new Response('data: ' + JSON.stringify(done) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
    }
    forbidden++; throw Error('unexpected offline fetch');
  };
  return { get catalogs() { return catalogs; }, get forbidden() { return forbidden; }, async next(host, model, effort) {
    const count = wire.length; await host.request(model, effort); assert.equal(wire.length, count + 1, 'expected exactly one serialized model request'); const result = wire.at(-1); assert.equal(result.model, model); return result;
  }, dispose() { globalThis.fetch = originalFetch; Socket.prototype.connect = originalConnect; } };
}
