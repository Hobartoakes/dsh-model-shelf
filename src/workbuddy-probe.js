/**
 * Client-side bridge to `dsh-workbuddy-connect`'s reasoning-effort detection.
 *
 * WorkBuddy is the only route on this machine whose reasoning-effort levels are
 * *learned* rather than declared: its catalog rows for `deepseek-v4.1-*` carry
 * no `supportedEfforts`, so the DSH directory publishes no effort levels and
 * the picker shows no control at all. The owning plugin detects them by probing
 * the upstream, and only it may spend that request.
 *
 * This module reuses that capability over the two same-origin routes the owning
 * plugin already mounts for its own browser half:
 *
 * - `GET  .../status`  — read-only document carrying `probe.candidates`,
 *   `probe.results` and the per-process `probeKey`.
 * - `POST .../probe`   — the state-changing control route; it requires
 *   `X-WorkBuddy-Probe-Key`, and the host invalidates the model directory when
 *   a detection succeeds, which is what makes the picker's dropdown appear.
 *
 * Two consequences shape every function here:
 *
 * 1. **Nothing is guaranteed.** The plugin may be absent, disabled, signed out,
 *    or a future version may move the routes. Every reader returns an explicit
 *    `unavailable`/`signed-out` state instead of throwing, and the caller shows
 *    nothing rather than a broken control.
 * 2. **The wire is untrusted.** Both documents are validated field by field
 *    before any of it reaches React state.
 *
 * @module dsh-model-shelf/workbuddy-probe
 */

/** The DSH provider ids WorkBuddy Connect registers, and their route pairs. */
export const WORKBUDDY_ROUTES = {
  workbuddy: {
    status: '/plugins/dsh-workbuddy-connect/status',
    probe: '/plugins/dsh-workbuddy-connect/probe'
  },
  'workbuddy-ai': {
    status: '/plugins/dsh-workbuddy-connect/ai/status',
    probe: '/plugins/dsh-workbuddy-connect/ai/probe'
  }
};

/** How long one status document is reused before the route is asked again. */
export const STATUS_TTL_MS = 60_000;

/** The two validation verdicts the owning plugin treats as an answer. */
const VALIDATIONS = new Set(['validating', 'non-validating', 'unknown']);

/**
 * The route path for one provider, or `undefined` when this provider is not a
 * WorkBuddy route at all (in which case the caller must stay silent).
 *
 * @param providerId - the DSH provider id from the model directory.
 * @param kind - which of the pair to resolve.
 */
export function workbuddyRoute(providerId, kind) {
  const entry = WORKBUDDY_ROUTES[providerId];
  return entry === undefined ? undefined : entry[kind];
}

/** Whether the provider is one this module knows how to talk to. */
export function isWorkBuddyProvider(providerId) {
  return WORKBUDDY_ROUTES[providerId] !== undefined;
}

/**
 * Validate a status document into the small shape this plugin reads.
 *
 * The owning plugin's document is much larger (credits, catalog provenance,
 * per-model billing). Only the probe section and its key are read here, and
 * every field is re-validated: a 200 is not a promise about the body, and a
 * malformed document must degrade to `unreadable` rather than reach React.
 *
 * @param value - the parsed response body, of unknown shape.
 * @returns `{ state, probeKey?, candidates, results }`, or `undefined` when the
 *   body is not a status document at all.
 */
export function normalizeProbeStatus(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const state = value.status;
  if (state !== 'signed-in' && state !== 'signed-out' && state !== 'error') return undefined;
  if (state !== 'signed-in') return { state, candidates: [], results: [] };
  const probe = value.probe;
  const usable = typeof probe === 'object' && probe !== null && !Array.isArray(probe);
  const candidates = usable ? (probe.candidates ?? []).filter((id) => typeof id === 'string' && id !== '') : [];
  const rawResults = usable ? (probe.results ?? []) : [];
  const results = Array.isArray(rawResults) ? rawResults.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
    if (typeof entry.id !== 'string' || entry.id === '') return [];
    const validation = VALIDATIONS.has(entry.validation) ? entry.validation : 'unknown';
    const efforts = Array.isArray(entry.efforts)
      ? entry.efforts.filter((effort) => typeof effort === 'string' && effort !== '')
      : [];
    return [{ id: entry.id, validation, efforts, probedAt: typeof entry.probedAt === 'number' ? entry.probedAt : undefined }];
  }) : [];
  return {
    state,
    probeKey: typeof value.probeKey === 'string' && value.probeKey !== '' ? value.probeKey : undefined,
    candidates,
    results,
    ...contextFields(value)
  };
}

/**
 * Read the CTXPATCH context-window fields out of a document.
 *
 * Absent on an unpatched host, in which case `patch` is `undefined` and every
 * context-window affordance stays hidden. Only rows with a usable declared or
 * effective window are kept, so a model the host says nothing about cannot
 * produce an empty dropdown.
 */
function contextFields(value) {
  const patch = typeof value.contextWindowPatch === 'string' && value.contextWindowPatch !== '' ? value.contextWindowPatch : undefined;
  const rawOverrides = value.contextWindowOverrides;
  const overrides = typeof rawOverrides === 'object' && rawOverrides !== null && !Array.isArray(rawOverrides) ? rawOverrides : {};
  const contextWindows = new Map();
  const rows = Array.isArray(value.models) ? value.models : [];
  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    if (typeof entry.id !== 'string' || entry.id === '') continue;
    const declared = Array.isArray(entry.supportedContextWindows)
      ? [...new Set(entry.supportedContextWindows.filter((size) => Number.isInteger(size) && size > 0))].sort((a, b) => a - b)
      : [];
    const effective = Number.isInteger(entry.contextWindow) && entry.contextWindow > 0 ? entry.contextWindow : undefined;
    const override = Number.isInteger(overrides[entry.id]) && overrides[entry.id] > 0 ? overrides[entry.id] : undefined;
    if (effective === undefined && override === undefined && declared.length === 0) continue;
    contextWindows.set(entry.id, { effective, declared, override });
  }
  return { patch, contextWindows };
}

/**
 * What this plugin can say about one model's effort detection.
 *
 * - `unavailable` — no readable WorkBuddy document (absent plugin, proxy page,
 *   network failure). The caller keeps its previous behaviour.
 * - `signed-out` — the route answers but there is no WorkBuddy credential, so a
 *   detection could not run.
 * - `detectable` — WorkBuddy itself lists the model as needing detection and has
 *   no answer for it yet: this is the only state that offers the action.
 * - `detected` — a verified answer exists; `efforts` are the accepted spellings.
 * - `rejected` — the model was probed and the upstream accepts arbitrary values,
 *   so per-level acceptance cannot be inferred and no control should be shown.
 * - `elsewhere` — the model is neither a candidate nor recorded; its effort
 *   levels, if any, are the directory's own declaration.
 *
 * @param status - a normalized document, or `undefined`.
 * @param modelId - the provider-owned model id.
 */
export function probeStateFor(status, modelId) {
  if (status === undefined || status === null) return { kind: 'unavailable', efforts: [] };
  if (status.state !== 'signed-in') return { kind: status.state === 'signed-out' ? 'signed-out' : 'unavailable', efforts: [] };
  if (typeof modelId !== 'string' || modelId === '') return { kind: 'elsewhere', efforts: [] };
  const record = status.results.find((entry) => entry.id === modelId);
  if (record !== undefined) {
    if (record.validation === 'validating' && record.efforts.length > 0) {
      return { kind: 'detected', efforts: record.efforts, probedAt: record.probedAt };
    }
    if (record.validation === 'non-validating') return { kind: 'rejected', efforts: [], probedAt: record.probedAt };
  }
  if (status.candidates.includes(modelId)) return { kind: 'detectable', efforts: [] };
  return { kind: 'elsewhere', efforts: [] };
}

/**
 * One model's context-window facts, or `undefined` when this host cannot say.
 *
 * The owning plugin learned this from CTXPATCH, a local patch that adds a
 * per-model override on top of its variant-wide "maximum window" switch. That
 * patch stamps `contextWindowPatch` into the document; without it the model's
 * window is not this plugin's business and the picker stays silent.
 *
 * @param status - a normalized document.
 * @param modelId - the provider-owned model id.
 * @returns `{ effective, declared, override }` — the window in force, every
 *   capacity the model declares, and the pinned choice if there is one.
 */
export function contextWindowFor(status, modelId) {
  if (status === undefined || status === null || status.patch === undefined) return undefined;
  if (!(status.contextWindows instanceof Map)) return undefined;
  if (typeof modelId !== 'string' || modelId === '') return undefined;
  return status.contextWindows.get(modelId);
}

/**
 * A window in the shortest form a human reads at a glance.
 *
 * Only exact thousands collapse: `300000` is `300K`, but `2048` stays `2,048`
 * rather than pretending to be `2K`.
 */
export function formatCapacity(value) {
  if (!Number.isInteger(value) || value <= 0) return '';
  if (value % 1000000 === 0) return `${value / 1000000}M`;
  if (value % 1000 === 0) return `${value / 1000}K`;
  return value.toLocaleString('en-US');
}

/**
 * Where a model's currently offered levels came from.
 *
 * A model WorkBuddy lists as a detection candidate has no declared set, so any
 * level the directory publishes for it can only have come from an observation.
 *
 * @returns `'probe'`, `'declared'`, or `undefined` when it cannot be told.
 */
export function effortSourceFor(status, modelId) {
  const probe = probeStateFor(status, modelId);
  if (probe.kind === 'detected') return 'probe';
  if (probe.kind === 'elsewhere') return 'declared';
  return undefined;
}

/** One cached document per provider, so opening the picker is not a poll. */
const statusCache = new Map();

/** Forget cached documents; used after a detection changes the answer. */
export function clearProbeStatusCache(providerId) {
  if (providerId === undefined) statusCache.clear();
  else statusCache.delete(providerId);
}

/**
 * Read (or reuse) one provider's status document.
 *
 * The owning plugin's status route also fetches live credit information, so it
 * is deliberately cached for {@link STATUS_TTL_MS} instead of being called on
 * every render: this plugin needs the probe section and must not turn opening
 * the picker into a billing poll.
 *
 * @param providerId - the DSH provider id.
 * @param options - `{ force }` bypasses the cache; `fetchImpl` is for tests.
 * @returns the normalized document, or `undefined` when unreadable.
 */
export async function loadProbeStatus(providerId, options = {}) {
  const path = workbuddyRoute(providerId, 'status');
  if (path === undefined) return undefined;
  const now = options.now?.() ?? Date.now();
  const cached = statusCache.get(providerId);
  if (!options.force && cached !== undefined && now - cached.at < STATUS_TTL_MS) return cached.value;
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') return undefined;
  let value;
  try {
    const response = await doFetch(path, { method: 'GET', headers: { accept: 'application/json' }, credentials: 'same-origin' });
    if (!response?.ok) {
      statusCache.set(providerId, { at: now, value: undefined });
      return undefined;
    }
    value = normalizeProbeStatus(await response.json());
  } catch {
    value = undefined;
  }
  statusCache.set(providerId, { at: now, value });
  return value;
}

/**
 * POST one control action and hand back either its body or a failure.
 *
 * Both control actions share every guard: the route, the key the owning plugin
 * minted for this process, and the same-origin credential mode. Nothing else
 * is sent — the model id and, for a window, the size.
 */
async function postAction(providerId, status, payload, options) {
  const path = workbuddyRoute(providerId, 'probe');
  if (path === undefined || status === undefined || status.probeKey === undefined) {
    return { ok: false, state: 'unavailable', reason: 'WorkBuddy 未登录或未运行，无法发起操作。' };
  }
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') return { ok: false, state: 'unavailable', reason: '当前环境不支持发起操作。' };
  try {
    const response = await doFetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-workbuddy-probe-key': status.probeKey },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    if (!response?.ok) {
      return { ok: false, state: 'failed', reason: response === undefined ? '操作请求未送达。' : `操作被拒绝（HTTP ${response.status}）。` };
    }
    const body = await response.json();
    clearProbeStatusCache(providerId);
    return { ok: true, body };
  } catch (error) {
    return { ok: false, state: 'failed', reason: `操作请求失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Start one detection through the owning plugin's control route.
 *
 * The request is intentionally minimal: the model id is the only thing this
 * plugin contributes, and the owning plugin assembles the actual upstream
 * request host-side. A missing key, a non-loopback answer or a transport
 * failure all come back as a `failed` result rather than an exception.
 *
 * @param providerId - the DSH provider id.
 * @param status - the normalized document carrying `probeKey`.
 * @param modelId - the model to detect.
 * @param options - `{ fetchImpl }` is for tests.
 * @returns `{ state: 'ok' | 'unavailable' | 'failed', efforts?, validation?, reason? }`.
 */
export async function requestProbe(providerId, status, modelId, options = {}) {
  if (typeof modelId !== 'string' || modelId === '') return { state: 'unavailable', reason: '当前模型不可识别。' };
  const result = await postAction(providerId, status, { action: 'probe', model: modelId }, options);
  if (!result.ok) return { state: result.state, reason: result.reason };
  const body = result.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { state: 'failed', reason: '检测返回了无法解析的结果。' };
  if (body.state !== 'ok') {
    return { state: 'unavailable', reason: typeof body.reason === 'string' && body.reason !== '' ? body.reason : '检测未完成。' };
  }
  const validation = VALIDATIONS.has(body.validation) ? body.validation : 'unknown';
  const efforts = Array.isArray(body.efforts) ? body.efforts.filter((effort) => typeof effort === 'string' && effort !== '') : [];
  return { state: 'ok', validation, efforts };
}

/**
 * Pin one model's context window, or clear the pin with `null`.
 *
 * Only meaningful against a CTXPATCH host: the stock plugin has a single
 * variant-wide window switch and no per-model choice at all, so this returns
 * `unavailable` there rather than pretending anything was saved.
 *
 * @param contextWindow - a positive integer, or `null` to follow the catalog.
 * @returns `{ state: 'ok' | 'unavailable' | 'failed', reason? }`.
 */
export async function requestContextWindow(providerId, status, modelId, contextWindow, options = {}) {
  if (typeof modelId !== 'string' || modelId === '') return { state: 'unavailable', reason: '当前模型不可识别。' };
  if (contextWindow !== null && (!Number.isInteger(contextWindow) || contextWindow <= 0)) {
    return { state: 'unavailable', reason: '上下文容量必须是正整数。' };
  }
  if (status === undefined || status.patch === undefined) {
    return { state: 'unavailable', reason: '当前安装的 WorkBuddy 插件不支持逐模型容量。' };
  }
  const result = await postAction(providerId, status, { action: 'set-model-context-window', model: modelId, contextWindow }, options);
  if (!result.ok) return { state: result.state, reason: result.reason };
  const body = result.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { state: 'failed', reason: '容量修改返回了无法解析的结果。' };
  if (body.state !== 'updated') {
    return { state: 'failed', reason: typeof body.reason === 'string' && body.reason !== '' ? body.reason : '容量修改未生效。' };
  }
  return { state: 'ok' };
}

/** The locale-independent default label for one effort id. */
export function effortLabel(effort) {
  return typeof effort === 'string' && effort !== '' ? effort : '';
}
