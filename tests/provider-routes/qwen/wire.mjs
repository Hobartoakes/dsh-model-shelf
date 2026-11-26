// Run only in the isolated child, before importing either connector or SDK.
// No provider callback is replaced: retain a projection of the serialized POST,
// then return a local terminal SSE event so success requires a completed stream.
import assert from 'node:assert/strict';
import { Socket } from 'node:net';

const routes = new Map([
  ['https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions', 'cn'],
  ['https://relay.invalid/v1/chat/completions', 'relay'],
  ['https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', 'native'],
  ['https://dashscope.invalid/api/v1/services/aigc/text-generation/generation', 'native'],
]);
const fields = ['enable_thinking','reasoning_effort','thinking_budget','thinking_budget_tokens','thinking_token_budget','chat_template_kwargs','thinking'];
const project = obj => Object.fromEntries(fields.filter(k => Object.hasOwn(obj, k)).map(k => [k, obj[k]]));

export function localWire() {
  let forbidden = 0;
  const captured = [];
  const deny = () => { forbidden++; throw Error('unapproved network operation in Qwen fixture'); };
  Socket.prototype.connect = deny;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), route = routes.get(req.url);
    if (!route || req.method !== 'POST') return deny();
    const body = await req.json();
    captured.push({ route, model: body.model, top: project(body), nested: project(body.parameters ?? {}) });
    const event = route === 'native'
      ? { output: { choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] } }
      : { id: 'fixture', object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] };
    return new Response('data: ' + JSON.stringify(event) + '\n\n' + (route === 'native' ? '' : 'data: [DONE]\n\n'),
      { headers: { 'content-type': 'text/event-stream' } });
  };
  async function consume(adapter, provider, model, reasoningEffort) {
    const stream = adapter.stream({ provider, model, ...(reasoningEffort ? { reasoningEffort } : {}),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }] }], signal: AbortSignal.timeout(10000) });
    let finished = false;
    for await (const chunk of stream) if (chunk.type === 'finish') finished = true;
    assert.ok(finished, 'real adapter must consume the terminal SSE event');
  }
  return {
    get count() { return captured.length; }, get forbidden() { return forbidden; }, consume,
    async next(route, adapter, provider, model, effort) {
      const before = captured.length;
      await consume(adapter, provider, model, effort);
      assert.equal(captured.length, before + 1, 'exactly one serialized model POST');
      const hit = captured.at(-1);
      assert.equal(hit.route, route); assert.equal(hit.model, model);
      assert.deepEqual(route === 'native' ? hit.top : hit.nested, {}, 'no controls at the wrong protocol depth');
      return route === 'native' ? hit.nested : hit.top;
    },
  };
}
