import test from 'node:test';
import assert from 'node:assert/strict';
import { createCodexOptions } from '../src/codex-options.js';

const STATUS = 'codex-subscription/preferences/status';
const UPDATE = 'codex-subscription/preferences/update';
const target = Object.freeze({ sessionId: 'session-a', provider: 'openai-codex', model: 'model-a', epoch: 1, reasoningActive: true });
const current = () => true;
const scope = '修改此 Codex 连接器的默认值，其他使用它的会话也会受到影响';
const ok = value => ({ ok: true, value });
// Wire shape: Codex 3.2.28 preferences.status(), not its optimistic React snapshot.
const status = (overrides = {}) => ok({
  writable: true, composerModelPicker: 'auto', availableModels: [{ id: 'model-a', name: 'Display only' }],
  disabledModels: [], verbosityModels: ['model-a'], outputVerbosity: 'default', reasoningSummary: 'auto',
  customInstructions: 'private fixture instruction', speedMode: 'fast', ...overrides
});

function transport(...responses) {
  const calls = [];
  const io = createCodexOptions({ async call(...args) {
    calls.push(args);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return typeof response === 'function' ? response() : response;
  } });
  return { io, calls };
}

test('codex exposes only owner-declared fields', async () => {
  const { io, calls } = transport(status());
  const { signal } = new AbortController();
  const fields = await io.read(target, signal);
  assert.deepEqual(calls, [['/api', STATUS, {}, signal]]);
  assert.deepEqual(fields.map(f => [f.id, f.label, f.value, f.reset, f.editor]), [
    ['outputVerbosity', '回答详略', 'default', 'default', { choices: ['default', 'low', 'medium', 'high'] }],
    ['reasoningSummary', '推理摘要', 'auto', 'auto', { choices: ['auto', 'concise', 'detailed', 'none'] }]
  ]);
  for (const field of fields) {
    assert.equal(field.owner, 'dsh-codex-subscription');
    assert.equal(field.scope, scope);
    assert.ok(Object.keys(field).every(k => ['id', 'label', 'value', 'editor', 'scope', 'owner', 'reset', 'notice'].includes(k)));
  }
  assert.doesNotMatch(JSON.stringify(fields), /private fixture|customInstructions|Display only|speedMode/);
});

const speedStatus = (patch = {}) => status({
  catalogStatus: { source: 'online', refresh: 'ok' }, fastModels: [target.model], ultrafastModels: [target.model], speedMode: 'standard', ...patch
});
const speedRow = async (io, t = target) => (await io.read(t)).find(f => f.id === 'speedMode');

test('speed tiers come independently from the refreshed account catalog, with use notices', async () => {
  for (const [fast, ultra] of [[true, true], [true, false], [false, true], [false, false]]) {
    const { io, calls } = transport(speedStatus({ fastModels: fast ? [target.model] : ['other'], ultrafastModels: ultra ? [target.model] : [], ultraModels: [target.model] }));
    const field = await speedRow(io);
    if (fast || ultra) {
      assert.ok(field, 'expected a declared acceleration tier');
      assert.equal(field.owner, 'dsh-codex-subscription'); assert.equal(field.scope, scope);
      assert.deepEqual([field.value, field.reset], ['standard', 'standard']);
      assert.deepEqual(field.editor.choices, ['standard', ...(fast ? ['fast'] : []), ...(ultra ? ['ultrafast'] : [])]);
      assert.equal(/快速[^。]*更多 Credits/.test(field.notice), fast);
      assert.equal(/极速[^。]*订阅额度[^。]*Credits/.test(field.notice), ultra);
      assert.ok(Object.isFrozen(field.editor.choices));
    } else assert.equal(field, undefined, 'Ultra reasoning is not a speed tier');
    assert.deepEqual(calls.map(c => c[1]), [STATUS]);
  }
});

test('model name fallbacks, unavailable owners and opaque stored speeds cannot authorize a row', async () => {
  const t = { ...target, model: 'gpt-5.4' };
  for (const patch of [
    { catalogStatus: undefined }, { catalogStatus: { source: 'cache', refresh: 'ok' } },
    { catalogStatus: { source: 'online', refresh: 'failed' } }, { speedMode: 'turbo' },
    { writable: false }, { disabledModels: [t.model] }, { composerModelPicker: 'dsh' },
    { availableModels: [{ id: t.model }, { id: t.model }] }, { fastModels: t.model }, { ultrafastModels: undefined },
  ]) {
    const { io, calls } = transport(speedStatus({ availableModels: [{ id: t.model }], fastModels: [t.model], ultrafastModels: [], ...patch }));
    assert.equal(await speedRow(io, t), undefined); assert.deepEqual(calls.map(c => c[1]), [STATUS]);
  }
});

test('a recognized but inapplicable shared speed remains the baseline, not a writable tier', async () => {
  const { io, calls } = transport(speedStatus({ speedMode: 'ultrafast', ultrafastModels: [] }));
  const field = await speedRow(io);
  assert.equal(field?.value, 'ultrafast'); assert.deepEqual(field.editor.choices, ['standard', 'fast']);
  assert.equal(await io.write(target, field, { set: 'ultrafast' }, undefined, current), 'refused');
  assert.deepEqual(calls.map(c => c[1]), [STATUS]);
});

test('speed preflight refuses a revoked tier or permission and does not overwrite another writer', async () => {
  for (const [patch, result] of [[{ ultrafastModels: [] }, 'refused'], [{ writable: false }, 'refused'],
    [{ catalogStatus: { source: 'cache', refresh: 'failed' } }, 'refused'], [{ speedMode: 'fast' }, 'conflict']]) {
    const { io, calls } = transport(speedStatus(), speedStatus(patch));
    const field = await speedRow(io); assert.ok(field);
    assert.equal(await io.write(target, field, { set: 'ultrafast' }, undefined, current), result);
    assert.deepEqual(calls.map(c => c[1]), [STATUS, STATUS]);
  }
});

test('speed uses one exact patch and an independent, still-eligible readback', async () => {
  for (const [receipt, observed, result] of [
    [ok({}), { speedMode: 'ultrafast' }, 'applied'], [ok({}), { speedMode: 'ultrafast', ultrafastModels: [] }, 'unconfirmed'],
    [ok({}), {}, 'unconfirmed'], [{ ok: false, error: {} }, { speedMode: 'ultrafast' }, 'unconfirmed'],
  ]) {
    const { io, calls } = transport(speedStatus(), speedStatus(), receipt, speedStatus(observed));
    const field = await speedRow(io); assert.ok(field);
    assert.equal(await io.write(target, field, { set: 'ultrafast' }, undefined, current), result);
    assert.deepEqual(calls.map(c => [c[1], c[2]]), [[STATUS, {}], [STATUS, {}], [UPDATE, { speedMode: 'ultrafast' }], [STATUS, {}]]);
  }
});

test('non-Codex and incomplete targets never make an RPC', async () => {
  const { io, calls } = transport(status());
  for (const t of [null, ...['openai', 'openai-codex-proxy', 'OpenAI-Codex'].map(provider => ({ ...target, provider })),
    { ...target, model: '' }, { ...target, sessionId: '' }, { ...target, epoch: undefined }]) {
    assert.deepEqual(await io.read(t), []);
  }
  assert.deepEqual(await io.read(target, AbortSignal.abort()), []);
  assert.deepEqual(calls, []);
});

test('only a writable owner, enabled inline mode and one exact model ID qualify', async () => {
  for (const [why, patch] of [
    ['read-only', { writable: false }], ['not explicitly writable', { writable: 1 }],
    ['inline disabled', { composerModelPicker: 'dsh' }], ['unknown inline mode', { composerModelPicker: 'new' }],
    ['missing catalog', { availableModels: undefined }], ['only a display name matches', { availableModels: [{ id: 'b', name: 'model-a' }] }],
    ['ambiguous catalog', { availableModels: [{ id: 'model-a' }, { id: 'model-a' }] }], ['disabled model', { disabledModels: ['model-a'] }]
  ]) {
    const { io, calls } = transport(status(patch));
    assert.deepEqual(await io.read(target), [], why);
    assert.deepEqual(calls.map(c => c[1]), [STATUS], why);
  }
  assert.equal((await transport(status({ composerModelPicker: 'legacy' })).io.read(target)).length, 2);
});

test('verbosity and summary require separate, positive evidence for this model and mode', async () => {
  const ids = async (patch, reasoningActive) => (await transport(status(patch)).io.read({ ...target, reasoningActive })).map(f => f.id);
  assert.deepEqual(await ids({ verbosityModels: ['model-b'] }, true), ['reasoningSummary']);
  assert.deepEqual(await ids({ verbosityModels: 'model-a' }, false), []);
  for (const reasoning of [false, 'high', undefined]) assert.deepEqual(await ids({}, reasoning), ['outputVerbosity']);
  assert.deepEqual(await ids({ outputVerbosity: 'auto' }, true), ['reasoningSummary']);
  assert.deepEqual(await ids({ reasoningSummary: 'default' }, true), ['outputVerbosity']);
  assert.deepEqual(await ids({ outputVerbosity: null, reasoningSummary: undefined }, true), []);
});

test('an absent service or failed status has no fallback and leaks no error', async () => {
  assert.deepEqual(await createCodexOptions().read(target), []);
  for (const unavailable of [new Error('private fixture error'), { ok: false, error: { message: 'private fixture' }, value: status().value },
    { value: status().value }, { ok: 'true', value: status().value }, ok(null)]) {
    const { io, calls } = transport(unavailable);
    assert.deepEqual(await io.read(target), []);
    assert.deepEqual(calls.map(c => c[1]), [STATUS]);
  }
});

test('save verifies an independent readback', async () => {
  const { io, calls } = transport(status(), status(), status({ outputVerbosity: 'low' }), status());
  const { signal } = new AbortController();
  const [expected] = await io.read(target, signal);
  const result = await io.write(target, expected, { set: 'low' }, signal, current);
  assert.deepEqual(calls, [
    ['/api', STATUS, {}, signal], ['/api', STATUS, {}, signal],
    ['/api', UPDATE, { outputVerbosity: 'low' }, signal], ['/api', STATUS, {}, signal]
  ]);
  assert.equal(result, 'unconfirmed', 'update echoed low, but status still reports default');
});

test('sets and resets patch exactly one field, ignoring unrelated changes', async () => {
  for (const [id, initial, change, value] of [
    ['outputVerbosity', 'default', { set: 'high' }, 'high'], ['outputVerbosity', 'high', { reset: true }, 'default'],
    ['reasoningSummary', 'auto', { set: 'none' }, 'none'], ['reasoningSummary', 'none', { reset: true }, 'auto']
  ]) {
    const before = status({ [id]: initial });
    const preflight = status({ [id]: initial, speedMode: 'standard' });
    const { io, calls } = transport(before, preflight, status({ [id]: value }), status({ [id]: value }));
    const expected = (await io.read(target)).find(f => f.id === id);
    assert.equal(await io.write(target, expected, change, undefined, current), 'applied');
    assert.deepEqual(calls.map(c => c.slice(0, 3)), [
      ['/api', STATUS, {}], ['/api', STATUS, {}], ['/api', UPDATE, { [id]: value }], ['/api', STATUS, {}]
    ]);
  }
});

test('malformed changes, cross-field values, a foreign owner or another connection cannot write', async () => {
  const { io, calls } = transport(status());
  const [verbosity, summary] = await io.read(target);
  for (const change of [null, {}, { reset: false }, { set: 1 }, { set: 'auto' }, { set: 'low', reset: true },
    { set: 'low', customInstructions: 'overbroad' }, Object.create({ set: 'low' })]) {
    assert.equal(await io.write(target, verbosity, change, undefined, current), 'refused');
  }
  assert.equal(await io.write(target, summary, { set: 'high' }, undefined, current), 'refused');
  for (const fake of [{ ...verbosity, owner: 'api-connector' }, { ...verbosity, id: 'speedMode' }]) {
    assert.equal(await io.write(target, fake, { set: 'low' }, undefined, current), 'refused');
  }
  const other = transport(status());
  assert.equal(await other.io.write(target, verbosity, { set: 'low' }, undefined, current), 'refused');
  assert.deepEqual(other.calls, []);
  assert.deepEqual(calls.map(c => c[1]), [STATUS]);
});

test('wrong routes and old model, session, mode or generation cannot reuse a draft', async () => {
  const { io, calls } = transport(status());
  const [expected] = await io.read(target);
  assert.equal(await io.write({ ...target, provider: 'openai' }, expected, { set: 'low' }, undefined, current), 'refused');
  for (const delta of [{ sessionId: 'b' }, { model: 'model-b' }, { reasoningActive: false }, { epoch: 2 }]) {
    assert.equal(await io.write({ ...target, ...delta }, expected, { set: 'low' }, undefined, current), 'stale');
  }
  assert.equal(await io.write(target, expected, { set: 'low' }, undefined, () => false), 'stale');
  assert.equal(await io.write(target, expected, { set: 'low' }, AbortSignal.abort(), current), 'stale');
  assert.deepEqual(calls.map(c => c[1]), [STATUS]);
});

test('preflight separates concurrent edits from loss of write authority', async () => {
  for (const [fresh, outcome] of [
    [status({ outputVerbosity: 'medium' }), 'conflict'], [status({ outputVerbosity: 'low' }), 'conflict'],
    [status({ writable: false }), 'refused'], [status({ composerModelPicker: 'dsh' }), 'refused'],
    [status({ availableModels: [] }), 'refused'], [status({ verbosityModels: [] }), 'refused'],
    [status({ outputVerbosity: 'unknown' }), 'refused'], [new Error('read interrupted'), 'refused']
  ]) {
    const { io, calls } = transport(status(), fresh);
    const [expected] = await io.read(target);
    assert.equal(await io.write(target, expected, { set: 'low' }, undefined, current), outcome);
    assert.deepEqual(calls.map(c => c[1]), [STATUS, STATUS]);
  }
});

test('saved-not-live requires independent confirmation, never just the echoed patch', async () => {
  const saved = status({ outputVerbosity: 'low' });
  const notLive = status({ outputVerbosity: 'low', liveSynced: false });
  for (const [receipt, readback, outcome] of [
    [notLive, saved, 'saved-not-live'], [notLive, status(), 'unconfirmed'], [notLive, new Error('read failed'), 'unconfirmed'],
    [saved, new Error('read failed'), 'unconfirmed'], [saved, { ok: false, value: saved.value }, 'unconfirmed'],
    [saved, status({ writable: false, outputVerbosity: 'low' }), 'unconfirmed'],
    [saved, status({ availableModels: [], outputVerbosity: 'low' }), 'unconfirmed']
  ]) {
    const { io, calls } = transport(status(), status(), receipt, readback);
    const [expected] = await io.read(target);
    assert.equal(await io.write(target, expected, { set: 'low' }, undefined, current), outcome);
    assert.deepEqual(calls.map(c => c[1]), [STATUS, STATUS, UPDATE, STATUS]);
  }
});

function statefulOwner(onPatch) {
  const stored = { outputVerbosity: 'default', reasoningSummary: 'auto' };
  const calls = [];
  const io = createCodexOptions({ call(path, method, payload, signal) {
    calls.push([path, method, payload, signal]);
    if (method === STATUS) return status({ ...stored });
    if (method === UPDATE) return onPatch(stored, payload);
    throw new Error('unexpected endpoint');
  } });
  return { io, calls, stored };
}

for (const [name, receipt] of [
  ['missing code', { ok: false, error: {} }],
  ['unknown code with a familiar message', { ok: false, error: { code: 'new-error', message: 'Invalid output verbosity preference' } }],
  ['other endpoint’s error code', { ok: false, error: { code: 'invalid-input', message: 'denied' } }],
  ['generic internal failure', { ok: false, error: { code: 'internal', message: 'Could not update preferences' } }],
  ['other field’s validation error', { ok: false, error: { code: 'internal', message: 'Invalid reasoning summary preference' } }],
  ['contradictory result', { ok: true, error: {}, value: { outputVerbosity: 'low' } }],
  ['lost response', new Error('connection reset')], ['empty value', ok(null)], ['missing response', undefined],
  ['invalid sync flag', status({ liveSynced: 'false' })]
]) {
  test('a persisted patch with ' + name + ' is read back once but remains unconfirmed', async () => {
    const { io, calls, stored } = statefulOwner((state, patch) => {
      Object.assign(state, patch); // Persistence precedes the failed/ambiguous acknowledgement.
      if (receipt instanceof Error) throw receipt;
      return receipt;
    });
    const { signal } = new AbortController();
    const [expected] = await io.read(target, signal);
    const result = await io.write(target, expected, { set: 'low' }, signal, current);
    assert.equal(stored.outputVerbosity, 'low');
    assert.deepEqual({ result, calls }, { result: 'unconfirmed', calls: [
      ['/api', STATUS, {}, signal], ['/api', STATUS, {}, signal],
      ['/api', UPDATE, { outputVerbosity: 'low' }, signal], ['/api', STATUS, {}, signal]
    ] });
  });
}

test('a field validation failure before preferences.update is a definitive refusal', async () => {
  for (const [id, original, value, message] of [
    ['outputVerbosity', 'default', 'low', 'Invalid output verbosity preference'],
    ['reasoningSummary', 'auto', 'none', 'Invalid reasoning summary preference']
  ]) {
    const { io, calls, stored } = statefulOwner(() => ({ ok: false, error: { code: 'internal', message, details: { issues: [] } } }));
    const { signal } = new AbortController();
    const expected = (await io.read(target, signal)).find(option => option.id === id);
    assert.equal(await io.write(target, expected, { set: value }, signal, current), 'refused');
    assert.equal(stored[id], original);
    assert.deepEqual(calls, [['/api', STATUS, {}, signal], ['/api', STATUS, {}, signal], ['/api', UPDATE, { [id]: value }, signal]]);
  }
});

test('revoke after preflight, dispatch or readback: no further calls and no late success', async () => {
  for (const [phase, expectedMethods] of [
    ['preflight', [STATUS, STATUS]], ['dispatch', [STATUS, STATUS, UPDATE]], ['readback', [STATUS, STATUS, UPDATE, STATUS]]
  ]) {
    let allowed = true;
    const at = (step, result) => () => { if (step === phase) allowed = false; return result; };
    const low = status({ outputVerbosity: 'low' });
    const { io, calls } = transport(status(), at('preflight', status()), at('dispatch', low), at('readback', low));
    const [expected] = await io.read(target);
    assert.equal(await io.write(target, expected, { set: 'low' }, undefined, () => allowed), 'stale', phase);
    assert.deepEqual(calls.map(c => c[1]), expectedMethods, phase);
  }
});

test('a late read cannot issue an option to a changed target', async () => {
  const changed = { ...target };
  const { io } = transport(() => { changed.sessionId = 'b'; return status(); });
  assert.deepEqual(await io.read(changed), []);
});

test('overlapping saves cannot dispatch or queue a second patch', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const low = status({ outputVerbosity: 'low' });
  const { io, calls } = transport(status(), pending, low, low);
  const [expected] = await io.read(target);
  const a = io.write(target, expected, { set: 'low' }, undefined, current);
  const b = io.write(target, expected, { set: 'medium' }, undefined, current);
  release(status());
  assert.deepEqual(await Promise.all([a, b]), ['applied', 'refused']);
  assert.deepEqual(calls.map(c => c[1]), [STATUS, STATUS, UPDATE, STATUS]);
});
