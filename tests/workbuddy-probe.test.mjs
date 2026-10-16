import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKBUDDY_ROUTES, STATUS_TTL_MS, workbuddyRoute, isWorkBuddyProvider, normalizeProbeStatus,
  probeStateFor, effortSourceFor, loadProbeStatus, requestProbe, clearProbeStatusCache,
  contextWindowFor, formatCapacity, requestContextWindow
} from '../src/workbuddy-probe.js';

/** A response stub good enough for both routes this module reads. */
const respond = (body, init = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: async () => {
    if (init.throwOnJson) throw new Error('not json');
    return body;
  }
});

/** A fetch stub recording every call, answering from a queue of responses. */
const recorder = (...responses) => {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, impl };
};

const signedIn = (extra = {}) => ({
  status: 'signed-in',
  probeKey: 'key-abc',
  probe: { consent: true, running: false, candidates: ['wb-model'], results: [] },
  ...extra
});

test.beforeEach(() => clearProbeStatusCache());

test('workbuddy routes are literal per variant and undefined elsewhere', () => {
  assert.equal(workbuddyRoute('workbuddy', 'status'), WORKBUDDY_ROUTES.workbuddy.status);
  assert.equal(workbuddyRoute('workbuddy', 'probe'), WORKBUDDY_ROUTES.workbuddy.probe);
  assert.equal(workbuddyRoute('workbuddy-ai', 'status'), '/plugins/dsh-workbuddy-connect/ai/status');
  assert.equal(workbuddyRoute('workbuddy-ai', 'probe'), '/plugins/dsh-workbuddy-connect/ai/probe');
  assert.equal(workbuddyRoute('deepseek', 'status'), undefined);
  assert.equal(workbuddyRoute(undefined, 'status'), undefined);
  assert.equal(isWorkBuddyProvider('workbuddy'), true);
  assert.equal(isWorkBuddyProvider('workbuddy-ai'), true);
  assert.equal(isWorkBuddyProvider('openai-codex'), false);
});

test('a non-status document is rejected rather than half-read', () => {
  for (const value of [undefined, null, 'null', 7, [], { status: 'weird' }, { status: 'ready' }]) {
    assert.equal(normalizeProbeStatus(value), undefined);
  }
});

test('signed-out documents carry no probe section and invent none', () => {
  const normalized = normalizeProbeStatus({ status: 'signed-out', reason: 'no-credential', probeKey: 'leak' });
  assert.deepEqual(normalized, { state: 'signed-out', candidates: [], results: [] });
});

test('candidates and results are validated field by field', () => {
  const normalized = normalizeProbeStatus(signedIn({
    probeKey: '',
    probe: {
      running: false,
      candidates: ['good', '', 42, null, 'also-good'],
      results: [
        { id: 'ok-1', validation: 'validating', efforts: ['low', 'high'], probedAt: 5 },
        { id: 'ok-2', validation: 'non-validating', efforts: [] },
        { id: 'odd-validation', validation: 'yes', efforts: ['low'] },
        { id: 'bad-efforts', validation: 'validating', efforts: ['low', 3, ''] },
        { id: '', validation: 'validating', efforts: ['low'] },
        { validation: 'validating', efforts: ['low'] },
        null,
        'nope',
        { id: 'no-efforts', validation: 'validating' }
      ]
    }
  }));
  assert.equal(normalized.state, 'signed-in');
  assert.equal(normalized.probeKey, undefined, 'an empty key must not become a credential');
  assert.deepEqual(normalized.candidates, ['good', 'also-good']);
  assert.deepEqual(normalized.results, [
    { id: 'ok-1', validation: 'validating', efforts: ['low', 'high'], probedAt: 5 },
    { id: 'ok-2', validation: 'non-validating', efforts: [], probedAt: undefined },
    { id: 'odd-validation', validation: 'unknown', efforts: ['low'], probedAt: undefined },
    { id: 'bad-efforts', validation: 'validating', efforts: ['low'], probedAt: undefined },
    { id: 'no-efforts', validation: 'validating', efforts: [], probedAt: undefined }
  ]);
});

test('a signed-in document without a probe section is readable but empty', () => {
  const normalized = normalizeProbeStatus({ status: 'signed-in', probeKey: 'k' });
  assert.deepEqual(normalized, { state: 'signed-in', probeKey: 'k', candidates: [], results: [], patch: undefined, contextWindows: new Map() });
});

test('detection state follows candidate/record precedence', () => {
  assert.equal(probeStateFor(undefined, 'wb-model').kind, 'unavailable');
  assert.equal(probeStateFor(normalizeProbeStatus({ status: 'signed-out' }), 'wb-model').kind, 'signed-out');
  assert.equal(probeStateFor(normalizeProbeStatus({ status: 'error', message: 'x' }), 'wb-model').kind, 'unavailable');

  const detectable = normalizeProbeStatus(signedIn());
  assert.equal(probeStateFor(detectable, 'wb-model').kind, 'detectable');
  assert.equal(probeStateFor(detectable, 'other-model').kind, 'elsewhere');
  assert.equal(probeStateFor(detectable, undefined).kind, 'elsewhere');

  const detected = normalizeProbeStatus(signedIn({
    probe: { candidates: ['wb-model'], results: [{ id: 'wb-model', validation: 'validating', efforts: ['low', 'max'], probedAt: 9 }] }
  }));
  const state = probeStateFor(detected, 'wb-model');
  assert.equal(state.kind, 'detected');
  assert.deepEqual(state.efforts, ['low', 'max']);
  assert.equal(state.probedAt, 9);
  // A record answers before the candidate list does: recorded models stay candidates.
  assert.equal(probeStateFor(detected, 'wb-model').kind, 'detected');

  const rejected = normalizeProbeStatus(signedIn({
    probe: { candidates: ['wb-model'], results: [{ id: 'wb-model', validation: 'non-validating', efforts: [] }] }
  }));
  assert.equal(probeStateFor(rejected, 'wb-model').kind, 'rejected');

  // An empty or unknown verdict is not an answer: the model stays offerable.
  const unknown = normalizeProbeStatus(signedIn({
    probe: { candidates: ['wb-model'], results: [{ id: 'wb-model', validation: 'unknown', efforts: [] }] }
  }));
  assert.equal(probeStateFor(unknown, 'wb-model').kind, 'detectable');
  const emptyValidating = normalizeProbeStatus(signedIn({
    probe: { candidates: ['wb-model'], results: [{ id: 'wb-model', validation: 'validating', efforts: [] }] }
  }));
  assert.equal(probeStateFor(emptyValidating, 'wb-model').kind, 'detectable');
});

test('effort provenance is only claimed when it is known', () => {
  const detected = normalizeProbeStatus(signedIn({
    probe: { candidates: ['wb-model'], results: [{ id: 'wb-model', validation: 'validating', efforts: ['high'] }] }
  }));
  assert.equal(effortSourceFor(detected, 'wb-model'), 'probe');
  assert.equal(effortSourceFor(detected, 'declared-model'), 'declared');
  assert.equal(effortSourceFor(undefined, 'wb-model'), undefined);
  assert.equal(effortSourceFor(normalizeProbeStatus({ status: 'signed-out' }), 'wb-model'), undefined);
});

test('the status document is fetched once per TTL and forced on demand', async () => {
  const { calls, impl } = recorder(respond(signedIn()));
  let now = 1_000;
  const clock = () => now;
  const first = await loadProbeStatus('workbuddy-ai', { fetchImpl: impl, now: clock });
  assert.equal(first.state, 'signed-in');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/plugins/dsh-workbuddy-connect/ai/status');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.credentials, 'same-origin');

  now += STATUS_TTL_MS - 1;
  await loadProbeStatus('workbuddy-ai', { fetchImpl: impl, now: clock });
  assert.equal(calls.length, 1, 'inside the TTL the route is not asked again');

  now += 2;
  await loadProbeStatus('workbuddy-ai', { fetchImpl: impl, now: clock });
  assert.equal(calls.length, 2, 'past the TTL it is');

  await loadProbeStatus('workbuddy-ai', { fetchImpl: impl, now: clock, force: true });
  assert.equal(calls.length, 3);
});

test('an unreadable status document degrades to undefined and stays cached', async () => {
  const failing = recorder(respond(null, { ok: false, status: 503 }));
  assert.equal(await loadProbeStatus('workbuddy', { fetchImpl: failing.impl }), undefined);
  assert.equal(await loadProbeStatus('workbuddy', { fetchImpl: failing.impl }), undefined);
  assert.equal(failing.calls.length, 1, 'a failed read is still cached, so the picker does not poll');

  const thrown = recorder(new Error('offline'));
  assert.equal(await loadProbeStatus('workbuddy', { fetchImpl: thrown.impl }), undefined);

  const notJson = recorder(respond(null, { throwOnJson: true }));
  assert.equal(await loadProbeStatus('workbuddy', { fetchImpl: notJson.impl }), undefined);

  const nonsense = recorder(respond([1, 2, 3]));
  assert.equal(await loadProbeStatus('workbuddy', { fetchImpl: nonsense.impl }), undefined);
});

test('providers this plugin does not own are never fetched', async () => {
  const { calls, impl } = recorder(respond(signedIn()));
  assert.equal(await loadProbeStatus('deepseek', { fetchImpl: impl }), undefined);
  assert.equal(calls.length, 0);
});

test('a detection is posted with the owner-issued key and the model id only', async () => {
  const { calls, impl } = recorder(respond({ state: 'ok', validation: 'validating', efforts: ['low', 'max'], requests: 3 }));
  const status = normalizeProbeStatus(signedIn());
  const result = await requestProbe('workbuddy-ai', status, 'wb-model', { fetchImpl: impl });
  assert.deepEqual(result, { state: 'ok', validation: 'validating', efforts: ['low', 'max'] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/plugins/dsh-workbuddy-connect/ai/probe');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['x-workbuddy-probe-key'], 'key-abc');
  assert.deepEqual(JSON.parse(calls[0].options.body), { action: 'probe', model: 'wb-model' });
});

test('a detection never runs without a key, a route or a model id', async () => {
  const { calls, impl } = recorder(respond({ state: 'ok', validation: 'validating', efforts: ['low'] }));
  const noKey = await requestProbe('workbuddy', normalizeProbeStatus(signedIn({ probeKey: '' })), 'wb-model', { fetchImpl: impl });
  assert.equal(noKey.state, 'unavailable');
  assert.match(noKey.reason, /未登录/);
  assert.equal((await requestProbe('deepseek', normalizeProbeStatus(signedIn()), 'wb-model', { fetchImpl: impl })).state, 'unavailable');
  assert.equal((await requestProbe('workbuddy-ai', undefined, 'wb-model', { fetchImpl: impl })).state, 'unavailable');
  assert.equal((await requestProbe('workbuddy-ai', normalizeProbeStatus(signedIn()), '', { fetchImpl: impl })).state, 'unavailable');
  assert.equal(calls.length, 0);
});

test('detection failures are reported, never thrown', async () => {
  const status = normalizeProbeStatus(signedIn());
  const refused = await requestProbe('workbuddy', status, 'wb-model', { fetchImpl: recorder(respond(null, { ok: false, status: 403 })).impl });
  assert.equal(refused.state, 'failed');
  assert.match(refused.reason, /403/);

  const thrown = await requestProbe('workbuddy', status, 'wb-model', { fetchImpl: recorder(new Error('socket closed')).impl });
  assert.equal(thrown.state, 'failed');
  assert.match(thrown.reason, /socket closed/);

  const notJson = await requestProbe('workbuddy', status, 'wb-model', { fetchImpl: recorder(respond(null, { throwOnJson: true })).impl });
  assert.equal(notJson.state, 'failed');

  const unavailable = await requestProbe('workbuddy', status, 'wb-model', { fetchImpl: recorder(respond({ state: 'unavailable', reason: 'probing is not authorized' })).impl });
  assert.equal(unavailable.state, 'unavailable');
  assert.equal(unavailable.reason, 'probing is not authorized');

  const nonsense = await requestProbe('workbuddy', status, 'wb-model', { fetchImpl: recorder(respond('ok')).impl });
  assert.equal(nonsense.state, 'failed');
});

test('a finished detection invalidates the cached document', async () => {
  const { calls, impl } = recorder(
    respond({ state: 'ok', validation: 'validating', efforts: ['high'] }),
    respond(signedIn({ probe: { candidates: [], results: [{ id: 'wb-model', validation: 'validating', efforts: ['high'] }] } }))
  );
  await loadProbeStatus('workbuddy-ai', { fetchImpl: impl });
  assert.equal(calls.length, 1);
  await requestProbe('workbuddy-ai', normalizeProbeStatus(signedIn()), 'wb-model', { fetchImpl: impl });
  const refreshed = await loadProbeStatus('workbuddy-ai', { fetchImpl: impl });
  assert.equal(calls.length, 3, 'the post-detection read must not reuse the pre-detection document');
  assert.equal(probeStateFor(refreshed, 'wb-model').kind, 'detected');
});

// --- context windows (CTXPATCH) -------------------------------------------

/** A wire document from a CTXPATCH host: per-model capacities plus one pinned window. */
const patchedWire = (extra = {}) => ({
  status: 'signed-in',
  probeKey: 'key-abc',
  contextWindowPatch: '0.7.1-ctxpatch.1',
  contextWindowOverrides: { small: 300000 },
  models: [
    { id: 'small', contextWindow: 300000, supportedContextWindows: [300000, 1000000] },
    { id: 'big', contextWindow: 1000000, supportedContextWindows: [1000000, 300000, 300000] },
    { id: 'plain', contextWindow: 128000 },
    { id: '', contextWindow: 1000, supportedContextWindows: [1000] },
    { id: 'junk', contextWindow: 'lots', supportedContextWindows: [0, -1, 1.5, 'x', 4096] },
    null,
    'nope'
  ],
  ...extra
});

/** The same document, already validated — what the picker actually holds. */
const patched = (extra = {}) => normalizeProbeStatus(patchedWire(extra));

test('a stock host is never offered a per-model window control', () => {
  const stock = normalizeProbeStatus({ status: 'signed-in', probeKey: 'k', models: [{ id: 'm', contextWindow: 300000, supportedContextWindows: [300000, 1000000] }] });
  assert.equal(stock.patch, undefined);
  assert.equal(contextWindowFor(stock, 'm'), undefined, 'without the patch stamp the window is not ours to change');
  assert.equal(contextWindowFor(undefined, 'm'), undefined);
  assert.equal(contextWindowFor(normalizeProbeStatus({ status: 'signed-out' }), 'm'), undefined);
});

test('the patch is detected and its rows are validated', () => {
  const document = patched();
  assert.equal(document.patch, '0.7.1-ctxpatch.1');
  assert.deepEqual(contextWindowFor(document, 'small'), { effective: 300000, declared: [300000, 1000000], override: 300000 });
  assert.deepEqual(contextWindowFor(document, 'big'), { effective: 1000000, declared: [300000, 1000000], override: undefined });
  assert.deepEqual(contextWindowFor(document, 'plain'), { effective: 128000, declared: [], override: undefined });
  assert.equal(contextWindowFor(document, 'absent'), undefined);
  assert.equal(contextWindowFor(document, ''), undefined);
  // A row with nothing usable, and non-object rows, never become a control.
  assert.deepEqual(contextWindowFor(document, 'junk'), { effective: undefined, declared: [4096], override: undefined });
  assert.equal(document.contextWindows.has(''), false);
});

test('an override survives a document that forgets the row', () => {
  const document = patched({ models: [{ id: 'small', contextWindow: 1000000 }], contextWindowOverrides: { small: 300000, ghost: 5 } });
  assert.deepEqual(contextWindowFor(document, 'small'), { effective: 1000000, declared: [], override: 300000 });
  assert.equal(document.contextWindows.has('ghost'), false, 'an override for a model the host does not list is ignored');
});

test('capacities collapse only when the collapse is exact', () => {
  assert.equal(formatCapacity(300000), '300K');
  assert.equal(formatCapacity(1000000), '1M');
  assert.equal(formatCapacity(1500000), '1500K');
  assert.equal(formatCapacity(2048), '2,048');
  assert.equal(formatCapacity(1_000_000_000), '1000M');
  assert.equal(formatCapacity(0), '');
  assert.equal(formatCapacity(-1), '');
  assert.equal(formatCapacity(1.5), '');
  assert.equal(formatCapacity(undefined), '');
});

test('a window is pinned through the owner-issued key, and cleared with null', async () => {
  const document = patched();
  const { calls, impl } = recorder(respond({ state: 'updated', model: 'small', contextWindow: 1000000 }));
  const pinned = await requestContextWindow('workbuddy-ai', document, 'small', 1000000, { fetchImpl: impl });
  assert.deepEqual(pinned, { state: 'ok' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/plugins/dsh-workbuddy-connect/ai/probe');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['x-workbuddy-probe-key'], 'key-abc');
  assert.deepEqual(JSON.parse(calls[0].options.body), { action: 'set-model-context-window', model: 'small', contextWindow: 1000000 });

  const cleared = await requestContextWindow('workbuddy-ai', document, 'small', null, { fetchImpl: impl });
  assert.deepEqual(cleared, { state: 'ok' });
  assert.deepEqual(JSON.parse(calls[1].options.body), { action: 'set-model-context-window', model: 'small', contextWindow: null });
});

test('a window is never sent to a host that cannot keep it', async () => {
  const { calls, impl } = recorder(respond({ state: 'updated' }));
  const stock = normalizeProbeStatus({ status: 'signed-in', probeKey: 'k' });
  const refused = await requestContextWindow('workbuddy-ai', stock, 'm', 1000000, { fetchImpl: impl });
  assert.equal(refused.state, 'unavailable');
  assert.match(refused.reason, /不支持/);
  assert.equal((await requestContextWindow('workbuddy-ai', patched(), '', 1000, { fetchImpl: impl })).state, 'unavailable');
  for (const value of [0, -1, 1.5, '1000', undefined, true]) {
    assert.equal((await requestContextWindow('workbuddy-ai', patched(), 'm', value, { fetchImpl: impl })).state, 'unavailable', `should refuse ${String(value)}`);
  }
  assert.equal(calls.length, 0);
});

test('a refused or broken window change is reported, never thrown', async () => {
  const document = patched();
  const refused = await requestContextWindow('workbuddy-ai', document, 'm', 1000, { fetchImpl: recorder(respond(null, { ok: false, status: 403 })).impl });
  assert.equal(refused.state, 'failed');
  assert.match(refused.reason, /403/);

  const thrown = await requestContextWindow('workbuddy-ai', document, 'm', 1000, { fetchImpl: recorder(new Error('socket closed')).impl });
  assert.equal(thrown.state, 'failed');
  assert.match(thrown.reason, /socket closed/);

  const rejected = await requestContextWindow('workbuddy-ai', document, 'm', 1000, { fetchImpl: recorder(respond({ state: 'failed', reason: 'not one of the declared capacities' })).impl });
  assert.equal(rejected.state, 'failed');
  assert.equal(rejected.reason, 'not one of the declared capacities');

  const nonsense = await requestContextWindow('workbuddy-ai', document, 'm', 1000, { fetchImpl: recorder(respond('ok')).impl });
  assert.equal(nonsense.state, 'failed');

  const noKey = await requestContextWindow('workbuddy-ai', patched({ probeKey: '' }), 'm', 1000, { fetchImpl: recorder(respond({ state: 'updated' })).impl });
  assert.equal(noKey.state, 'unavailable');
  assert.match(noKey.reason, /未登录/);
});

test('a saved window invalidates the cached document', async () => {
  const { calls, impl } = recorder(
    respond(patchedWire()),
    respond({ state: 'updated', model: 'm', contextWindow: 1000000 }),
    respond(patchedWire())
  );
  await loadProbeStatus('workbuddy-ai', { fetchImpl: impl });
  assert.equal(calls.length, 1);
  await requestContextWindow('workbuddy-ai', patched(), 'm', 1000000, { fetchImpl: impl });
  const refreshed = await loadProbeStatus('workbuddy-ai', { fetchImpl: impl });
  assert.equal(calls.length, 3);
  assert.equal(contextWindowFor(refreshed, 'small').override, 300000);
});

