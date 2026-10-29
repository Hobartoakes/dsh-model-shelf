window.__ModuleLoader__.load({
  id: 'dsh-model-shelf',
  factory: (require) => {
const STORAGE_KEY = 'dsh-model-shelf.preferences.v1';
const LEGACY_STORAGE_KEY = 'dsh-model-organizer.preferences.v1';
const modelKey = (provider, model) => JSON.stringify([provider, model]);
const groupKey = (list, provider) => JSON.stringify([list, provider]);
const emptyPreferences = () => ({
  version: 1, uncommon: [], favorites: [], providerNotes: {}, collapsed: [],
  uncommonProviders: [], providerOrder: { main: [], uncommon: [] }, favoriteOrder: [], lastList: null
});
const stringKeys = (values) => [...new Set((Array.isArray(values) ? values : []).filter((key) => typeof key === 'string'))];
const normalizeNote = (value) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) : '';
const providerNote = (prefs, id) => Object.hasOwn(prefs.providerNotes ?? {}, id) ? normalizeNote(prefs.providerNotes[id]) : '';

function normalizePreferences(value) {
  if (!value || value.version !== 1) return emptyPreferences();
  const keys = (values) => [...new Set((Array.isArray(values) ? values : []).filter((key) => {
    if (typeof key !== 'string') return false;
    try { const tuple = JSON.parse(key); return Array.isArray(tuple) && tuple.length === 2 && tuple.every((x) => typeof x === 'string'); }
    catch { return false; }
  }))];
  const entries = value.providerNotes && typeof value.providerNotes === 'object' && !Array.isArray(value.providerNotes)
    ? Object.entries(value.providerNotes).map(([id, text]) => [id, normalizeNote(text)]).filter(([id, text]) => id && text) : [];
  return {
    version: 1, uncommon: keys(value.uncommon), favorites: keys(value.favorites), providerNotes: Object.fromEntries(entries), collapsed: keys(value.collapsed),
    uncommonProviders: stringKeys(value.uncommonProviders),
    providerOrder: { main: stringKeys(value.providerOrder?.main), uncommon: stringKeys(value.providerOrder?.uncommon) },
    favoriteOrder: keys(value.favoriteOrder),
    lastList: ['main', 'uncommon', 'favorites'].includes(value.lastList) ? value.lastList : null
  };
}

function toggleKey(values, key) {
  return values.includes(key) ? values.filter((value) => value !== key) : [...values, key];
}

// Visible projection only. To persist arrivals without losing offline identities, use
// orderedKeys(saved, [...saved, ...current]) before reordering the full result.
function orderedKeys(savedKeys, currentKeys) {
  const current = new Set(currentKeys);
  return [...new Set([...savedKeys.filter((key) => current.has(key)), ...currentKeys])];
}

function reorderKeys(keys, sourceKey, targetKey) {
  const result = [...keys];
  const source = keys.indexOf(sourceKey), target = keys.indexOf(targetKey);
  if (source < 0 || target < 0 || source === target) return result;
  result.splice(source, 1);
  result.splice(target, 0, sourceKey);
  return result;
}

function isUncommon(prefs, providerId, modelId) {
  return (prefs.uncommonProviders ?? []).includes(providerId) || (prefs.uncommon ?? []).includes(modelKey(providerId, modelId));
}

function setProviderUncommon(prefs, providerId, value) {
  const p = normalizePreferences(prefs);
  if (p.uncommonProviders.includes(providerId) === value) return p;
  const destination = value ? 'uncommon' : 'main';
  return {
    ...p,
    uncommonProviders: value ? [...p.uncommonProviders, providerId] : p.uncommonProviders.filter((id) => id !== providerId),
    providerOrder: { ...p.providerOrder, [destination]: [...p.providerOrder[destination].filter((id) => id !== providerId), providerId] }
  };
}

// Update membership and ordering together; re-adding a removed favorite goes last.
function setFavorite(prefs, providerId, modelId, value) {
  const p = normalizePreferences(prefs);
  const key = modelKey(providerId, modelId);
  const order = orderedKeys(p.favoriteOrder, [...p.favoriteOrder, ...p.favorites]);
  return {
    ...p,
    favorites: value ? [...new Set([...p.favorites, key])] : p.favorites.filter((id) => id !== key),
    favoriteOrder: value
      ? (p.favorites.includes(key) ? order : [...order.filter((id) => id !== key), key])
      : order.filter((id) => id !== key)
  };
}

// Classification is exclusively explicit: no usage telemetry or frequency inference.
function partitionModels(groups, prefs, list, query = '') {
  const favorites = new Set(prefs.favorites ?? []);
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const filtered = groups.map((group) => ({ ...group, models: group.models.filter((model) => {
    const key = modelKey(group.id, model.id);
    if (list === 'favorites' ? !favorites.has(key) : isUncommon(prefs, group.id, model.id) !== (list === 'uncommon')) return false;
    const identity = `${group.name ?? ''} ${group.id} ${providerNote(prefs, group.id)} ${model.name ?? ''} ${model.id}`.toLocaleLowerCase();
    return tokens.every((token) => identity.includes(token));
  }) })).filter((group) => group.models.length > 0);
  const byId = new Map(filtered.map((group) => [group.id, group]));
  return orderedKeys(prefs.providerOrder?.[list] ?? [], filtered.map((group) => group.id)).map((id) => byId.get(id));
}

function favoriteRows(groups, prefs, query = '') {
  const rows = partitionModels(groups, prefs, 'favorites', query)
    .flatMap((group) => group.models.map((model) => ({ group, model, key: modelKey(group.id, model.id) })));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return orderedKeys(prefs.favoriteOrder ?? [], rows.map((row) => row.key)).map((key) => byKey.get(key));
}

function createPreferenceStore(storage, events) {
  let snapshot = emptyPreferences();
  let error = null;
  const listeners = new Set();
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current !== null) snapshot = normalizePreferences(JSON.parse(current));
    else {
      // Import only the old local prototype's preferences; never overwrite a new key.
      const legacy = JSON.parse(storage.getItem(LEGACY_STORAGE_KEY) ?? 'null');
      if (legacy?.version === 1) {
        snapshot = normalizePreferences(legacy);
        try { storage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); }
        catch { error = '旧版偏好已读取，但保存新偏好失败；刷新后可能无法保留修改。'; }
      }
    }
  }
  catch { error = '无法读取本地偏好；本次修改仍可在当前页面使用。'; }
  const emit = () => { for (const listener of listeners) listener(); };
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try { snapshot = normalizePreferences(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')); error = null; }
    catch { error = '无法读取本地偏好。'; snapshot = { ...snapshot }; }
    emit();
  };
  events?.addEventListener('storage', onStorage);
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getSnapshot: () => snapshot,
    getError: () => error,
    update(change) {
      snapshot = normalizePreferences(change(snapshot));
      try { storage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); error = null; }
      catch { error = '偏好保存失败：当前页面仍有效，但刷新后可能丢失。'; }
      emit();
    },
    dispose() { events?.removeEventListener('storage', onStorage); listeners.clear(); }
  };
}

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
const WORKBUDDY_ROUTES = {
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
const STATUS_TTL_MS = 60_000;

/** The two validation verdicts the owning plugin treats as an answer. */
const VALIDATIONS = new Set(['validating', 'non-validating', 'unknown']);

/**
 * The route path for one provider, or `undefined` when this provider is not a
 * WorkBuddy route at all (in which case the caller must stay silent).
 *
 * @param providerId - the DSH provider id from the model directory.
 * @param kind - which of the pair to resolve.
 */
function workbuddyRoute(providerId, kind) {
  const entry = WORKBUDDY_ROUTES[providerId];
  return entry === undefined ? undefined : entry[kind];
}

/** Whether the provider is one this module knows how to talk to. */
function isWorkBuddyProvider(providerId) {
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
function normalizeProbeStatus(value) {
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
function probeStateFor(status, modelId) {
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
function contextWindowFor(status, modelId) {
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
function formatCapacity(value) {
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
function effortSourceFor(status, modelId) {
  const probe = probeStateFor(status, modelId);
  if (probe.kind === 'detected') return 'probe';
  if (probe.kind === 'elsewhere') return 'declared';
  return undefined;
}

/** One cached document per provider, so opening the picker is not a poll. */
const statusCache = new Map();

/** Forget cached documents; used after a detection changes the answer. */
function clearProbeStatusCache(providerId) {
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
async function loadProbeStatus(providerId, options = {}) {
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
async function requestProbe(providerId, status, modelId, options = {}) {
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
async function requestContextWindow(providerId, status, modelId, contextWindow, options = {}) {
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
function effortLabel(effort) {
  return typeof effort === 'string' && effort !== '' ? effort : '';
}


// React and ReactDOM come from the running DSH client, never a second React copy.
const React = require('react');
const { createPortal } = require('react-dom');
const { createElement: h, useState, useRef, useEffect, useLayoutEffect, useSyncExternalStore, useId } = React;
// Service method calls inherit the consumer's Cordis context; directoryFor creates
// a directory using remote.session, so declare the nested capability explicitly.
const inject = ['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session'];

// DSH 0.2.1 gives the model seat a child slot, `conversation.input.model.label`,
// that host badges (the built-in 1017 marker) register into. Rendering it needs
// the entry to *declare* that key, and a key may only be declared once — so
// declaring it here would make the host's own model-selection plugin throw
// `slot "…" is already declared` on every load. That is a real regression, not a
// cosmetic one, so this plugin deliberately does not declare it and renders
// plain model names: the host badge is simply absent inside the shelf.
// See README "兼容性" and docs/HOST-COMPATIBILITY.md.

// Record unsearched catalog arrivals, retaining offline identities and their slots.
// Returning the original snapshot when equal is essential: store updates notify React.
function withCatalogOrder(prefs, groups) {
  const merge = (saved, current) => orderedKeys(saved, [...saved, ...current]);
  const same = (a, b) => a.length === b.length && a.every((key, i) => key === b[i]);
  const main = merge(prefs.providerOrder.main, partitionModels(groups, prefs, 'main').map(g => g.id));
  const uncommon = merge(prefs.providerOrder.uncommon, partitionModels(groups, prefs, 'uncommon').map(g => g.id));
  const favorites = merge(prefs.favoriteOrder, favoriteRows(groups, prefs).map(row => row.key));
  if (same(main, prefs.providerOrder.main) && same(uncommon, prefs.providerOrder.uncommon) && same(favorites, prefs.favoriteOrder)) return prefs;
  return { ...prefs, providerOrder: { main, uncommon }, favoriteOrder: favorites };
}

function makeModelPicker(preferences) {
  return function ModelPicker({ locked, available, directory, load, select }) {
    const state = useSyncExternalStore(directory.subscribe.bind(directory), directory.getSnapshot.bind(directory));
    const prefs = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
    const [open, setOpen] = useState(false);
    const [list, setList] = useState('main');
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(null);
    const [orderStatus, setOrderStatus] = useState('');
    const drag = useRef(null);
    const [dropKey, setDropKey] = useState(null);
    const suppressClick = useRef(false);
    const cancelDrag = () => { drag.current = null; setDropKey(null); };
    const finishDrag = () => {
      cancelDrag();
      // Native dragend can be followed by a click; do not select or fold then.
      setTimeout(() => { suppressClick.current = false; }, 0);
    };
    const [position, setPosition] = useState(null);
    const [localError, setLocalError] = useState(null);
    const [probeStatus, setProbeStatus] = useState(undefined);
    const [probeBusy, setProbeBusy] = useState(false);
    const [contextBusy, setContextBusy] = useState(false);
    const [probeConfirm, setProbeConfirm] = useState(false);
    const [probeNote, setProbeNote] = useState(null);
    const [editingNote, setEditingNote] = useState(null);
    const noteInput = useRef(null);
    useEffect(() => { if (editingNote) noteInput.current?.focus(); }, [editingNote?.id]);
    const trigger = useRef(null);
    const panel = useRef(null);
    const search = useRef(null);
    const inFlight = useRef(false);
    const popupEpoch = useRef(0);
    const mounted = useRef(true);
    const popupId = useId();
    const groups = state.groups ?? [];
    const shown = partitionModels(groups, prefs, list, query);
    const allMain = partitionModels(groups, prefs, 'main').reduce((n, g) => n + g.models.length, 0);
    const allUncommon = partitionModels(groups, prefs, 'uncommon').reduce((n, g) => n + g.models.length, 0);
    const allFavorites = partitionModels(groups, prefs, 'favorites').reduce((n, g) => n + g.models.length, 0);
    const currentNote = state.current ? providerNote(prefs, state.current.provider) : '';
    const searching = query.trim().length > 0;
    const expanded = (id) => searching || !prefs.collapsed.includes(groupKey(list, id));
    const flatFavorites = favoriteRows(groups, prefs, query);
    const visible = list === 'favorites' ? flatFavorites : shown.flatMap((g) => expanded(g.id) ? g.models.map((m) => ({ group: g, model: m, key: modelKey(g.id, m.id) })) : []);
    useEffect(() => {
      // Discovery is not consent to replace unreadable storage or clear its warning.
      if (!preferences.getError() && withCatalogOrder(prefs, groups) !== prefs) preferences.update(p => withCatalogOrder(p, groups));
    }, [groups, prefs]);
    const orderKind = list === 'favorites' ? 'favorite' : 'provider';
    const orderKeys = (p = preferences.getSnapshot(), catalog = directory.getSnapshot().groups ?? []) => list === 'favorites'
      ? favoriteRows(catalog, p).map(row => row.key)
      : partitionModels(catalog, p, list).map(g => g.id);
    // Invalidate on every observed departure, not just at drop: switching back
    // or a disappearing source returning must never resurrect an old gesture.
    useLayoutEffect(() => {
      if (drag.current && (!open || searching || drag.current.list !== list || !orderKeys().includes(drag.current.key))) cancelDrag();
    }, [open, query, list, groups, prefs]);
    const validMove = (payload, target) => {
      const keys = orderKeys();
      return open && !searching && payload?.list === list && payload.kind === orderKind
        && keys.includes(payload.key) && keys.includes(target) && payload.key !== target;
    };
    const reorder = (payload, target) => {
      if (!validMove(payload, target)) return;
      preferences.update(p => {
        const seeded = withCatalogOrder(p, directory.getSnapshot().groups ?? []);
        const keys = payload.kind === 'favorite' ? seeded.favoriteOrder : seeded.providerOrder[list];
        const next = reorderKeys(keys, payload.key, target);
        return payload.kind === 'favorite' ? { ...seeded, favoriteOrder: next }
          : { ...seeded, providerOrder: { ...seeded.providerOrder, [list]: next } };
      });
      const keys = orderKeys();
      setOrderStatus(`${payload.key} 已移至第 ${keys.indexOf(payload.key) + 1} / ${keys.length} 项`);
    };
    const dropProps = (key) => ({
      'data-drop-target': dropKey === key || undefined,
      onDragOver: e => { if (validMove(drag.current, key)) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropKey(key); } },
      onDrop: e => { e.preventDefault(); e.stopPropagation(); reorder(drag.current, key); finishDrag(); },
      onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropKey(null); }
    });
    const renderedOrderKeys = orderKeys(prefs, groups);
    const orderControls = (key, label) => {
      const keys = renderedOrderKeys, index = keys.indexOf(key);
      const step = (direction, event) => {
        event.stopPropagation();
        const controls = event.currentTarget.parentElement;
        const current = orderKeys(), neighbor = current[current.indexOf(key) + direction];
        reorder({ list, kind: orderKind, key }, neighbor);
        // Keep the same action unless it has reached the boundary, then offer
        // the reverse action on the same identity rather than losing focus.
        queueMicrotask(() => {
          const preferred = controls.querySelector(direction < 0 ? '.dmo-order-up' : '.dmo-order-down');
          (preferred?.disabled ? controls.querySelector(direction < 0 ? '.dmo-order-down' : '.dmo-order-up') : preferred)?.focus();
        });
      };
      return h('div', { className: 'dmo-order', onClick: e => e.stopPropagation() },
      h('button', { type: 'button', className: 'dmo-drag', disabled: searching, draggable: !searching, 'aria-label': `拖动排序：${label}`, title: '拖动排序',
        onDragStart: e => { if (searching) { e.preventDefault(); return; } drag.current = { list, kind: orderKind, key }; suppressClick.current = true; e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); },
        onDragEnd: finishDrag }, '⠿'),
      h('button', { type: 'button', className: 'dmo-order-up', disabled: searching || index <= 0, 'aria-label': `上移：${label}`, onClick: e => step(-1, e) }, '↑'),
      h('button', { type: 'button', className: 'dmo-order-down', disabled: searching || index >= keys.length - 1, 'aria-label': `下移：${label}`, onClick: e => step(1, e) }, '↓'));
    };
    const currentGroup = groups.find((g) => g.id === state.current?.provider);
    const currentModel = currentGroup?.models.find((m) => m.id === state.current?.model);
    const reasoning = currentModel?.reasoning;
    const effort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
    const busy = locked || state.status === 'selecting';
    const activeRow = visible.find((item) => item.key === active) ?? visible[0];
    const error = localError ?? state.error ?? preferences.getError();
    // WorkBuddy detection state for the *current* model. The picker only ever
    // changes that model's reasoning effort, so it is the only model whose
    // detection state can change anything here.
    const probe = probeStateFor(probeStatus, state.current?.model);
    const effortSource = effortSourceFor(probeStatus, state.current?.model);
    // Per-model context window: only a CTXPATCH host reports capacities at all,
    // so an unpatched install simply never produces a row here.
    const contextRow = contextWindowFor(probeStatus, state.current?.model);
    const declaredEfforts = (reasoning?.efforts?.length ?? 0) > 0;
    const detection = state.current && !declaredEfforts && probe.kind === 'detectable' ? probe : null;
    // A verified verdict the directory has not published yet. Reporting it is the
    // honest option: the picker must not invent a level the adapter does not offer.
    const staleDetected = probe.kind === 'detected' && !declaredEfforts;

    useEffect(() => {
      mounted.current = true;
      return () => { mounted.current = false; };
    }, []);

    // Ask the owning plugin once per popup (and per model), never per render:
    // its status route also fetches live credit, and this plugin is a guest.
    useEffect(() => {
      if (!open) return;
      setProbeConfirm(false);
      setProbeNote(null);
      const providerId = state.current?.provider;
      if (!isWorkBuddyProvider(providerId)) { setProbeStatus(undefined); return; }
      let cancelled = false;
      setProbeStatus(undefined);
      loadProbeStatus(providerId)
        .then((status) => { if (!cancelled) setProbeStatus(status); })
        .catch(() => { if (!cancelled) setProbeStatus(undefined); });
      return () => { cancelled = true; };
    }, [open, state.current?.provider, state.current?.model]);

    const close = (restore = true) => {
      cancelDrag();
      const epoch = ++popupEpoch.current;
      setOpen(false);
      setEditingNote(null);
      if (restore) queueMicrotask(() => {
        if (mounted.current && popupEpoch.current === epoch) trigger.current?.focus();
      });
    };

    useEffect(() => {
      if (!open) return;
      const dismiss = (event) => {
        if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close(false);
      };
      const key = (event) => {
        if (event.key === 'Escape' && !event.isComposing && !event.target.closest?.('.dmo-note-editor')) { event.preventDefault(); close(); }
      };
      document.addEventListener('pointerdown', dismiss, true);
      document.addEventListener('keydown', key);
      return () => {
        document.removeEventListener('pointerdown', dismiss, true);
        document.removeEventListener('keydown', key);
      };
    }, [open]);

    useLayoutEffect(() => {
      if (!open) return;
      const place = () => {
        const anchor = trigger.current?.getBoundingClientRect();
        const card = panel.current;
        if (!anchor || !card) return;
        const vv = window.visualViewport;
        const x0 = vv?.offsetLeft ?? 0, y0 = vv?.offsetTop ?? 0;
        const vw = vv?.width ?? window.innerWidth, vh = vv?.height ?? window.innerHeight;
        // A tall picker may extend beyond the trigger; clamp it to the viewport.
        const width = Math.min(640, vw - 24), maxHeight = Math.min(720, vh - 32);
        card.style.width = `${width}px`;
        card.style.maxHeight = `${maxHeight}px`;
        const height = card.offsetHeight;
        const above = anchor.top - y0 - 12;
        const below = y0 + vh - anchor.bottom - 12;
        let top = above >= height || above >= below ? anchor.top - height - 8 : anchor.bottom + 8;
        top = Math.max(y0 + 12, Math.min(top, y0 + vh - height - 12));
        const left = Math.max(x0 + 12, Math.min(anchor.right - width, x0 + vw - width - 12));
        setPosition((p) => p?.left === left && p?.top === top ? p : { left, top });
      };
      place();
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
      if (panel.current) observer?.observe(panel.current);
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, true);
      window.visualViewport?.addEventListener('resize', place);
      window.visualViewport?.addEventListener('scroll', place);
      return () => {
        observer?.disconnect();
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
        window.visualViewport?.removeEventListener('resize', place);
        window.visualViewport?.removeEventListener('scroll', place);
      };
    }, [open, list, query, prefs, state]);

    const positioned = position !== null;
    useEffect(() => {
      if (open && positioned) search.current?.focus();
    }, [open, positioned]);

    useEffect(() => {
      if (!open || !activeRow) return;
      const row = [...(panel.current?.querySelectorAll('[data-model-key]') ?? [])].find((node) => node.dataset.modelKey === activeRow.key);
      row?.scrollIntoView({ block: 'nearest' });
    }, [active, query, list]);

    const choose = async (selection, keepOpen = false) => {
      if (busy || inFlight.current || !available) return;
      inFlight.current = true;
      const epoch = popupEpoch.current;
      setLocalError(null);
      try {
        // `resetEffort` is this plugin's own flag, never a value the directory
        // accepts: it selects the same model with no `reasoningEffort` at all,
        // which is exactly how the shared directory's own "Default" entry clears
        // a customised level. It must therefore bypass the retention below.
        const { resetEffort, ...pick } = selection;
        // Reselecting the current model must not reset a customized reasoning effort —
        // but only while the exact target model still publishes that effort. A route
        // that declares no effort levels must fall back to its own default instead of
        // inheriting a level its upstream rejects.
        const sameModel = state.current?.provider === pick.provider && state.current?.model === pick.model;
        const targetEfforts = (state.groups ?? []).find((g) => g.id === pick.provider)?.models.find((m) => m.id === pick.model)?.reasoning?.efforts ?? [];
        const retainedEffort = state.current?.reasoningEffort;
        const keepEffort = resetEffort !== true && sameModel && pick.reasoningEffort === undefined && retainedEffort !== undefined
          && targetEfforts.some((x) => x.id === retainedEffort);
        const request = keepEffort ? { ...pick, reasoningEffort: retainedEffort } : pick;
        const result = await select(request);
        if (!mounted.current || popupEpoch.current !== epoch) return;
        if (!result?.ok) {
          setLocalError(result?.error?.code === 'session/writer-held' ? '该会话正在其他窗口使用，请稍后重试。' : result?.error?.message ?? '模型切换未成功，请重试。');
        } else if (!keepOpen) close();
      } catch (e) {
        if (mounted.current && popupEpoch.current === epoch) setLocalError(e instanceof Error ? e.message : String(e));
      } finally { inFlight.current = false; }
    };

    const changeList = (next) => {
      cancelDrag();
      preferences.update(p => ({ ...p, lastList: next }));
      setList(next); setActive(null); setEditingNote(null); search.current?.focus();
    };
    const toggleFavorite = (provider, model) => {
      preferences.update(p => setFavorite(p, provider, model, !p.favorites.includes(modelKey(provider, model))));
      setActive(null); search.current?.focus();
    };
    const saveNote = () => {
      if (!editingNote) return;
      preferences.update((p) => ({ ...p, providerNotes: { ...p.providerNotes, [editingNote.id]: editingNote.draft } }));
      setEditingNote(null); search.current?.focus();
    };
    const toggleUncommon = (key) => {
      preferences.update((p) => ({ ...p, uncommon: toggleKey(p.uncommon, key) }));
      setActive(null);
      search.current?.focus();
    };
    const moveProvider = (provider, uncommon) => {
      // Seed the entire destination before moving, never just the searched subset.
      preferences.update(p => setProviderUncommon(withCatalogOrder(p, groups), provider, uncommon));
      setActive(null); search.current?.focus();
    };
    const setAllCollapsed = (collapse) => {
      const keys = shown.map((g) => groupKey(list, g.id));
      preferences.update((p) => ({ ...p, collapsed: collapse ? [...new Set([...p.collapsed, ...keys])] : p.collapsed.filter((k) => !keys.includes(k)) }));
    };
    const onKeyDown = (event) => {
      suppressClick.current = false;
      cancelDrag();
      if (event.nativeEvent?.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape' && event.target.closest?.('.dmo-note-editor')) {
        event.preventDefault(); event.stopPropagation(); setEditingNote(null); search.current?.focus(); return;
      }
      if (event.key === 'Tab') {
        const nodes = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter((n) => n.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.target !== search.current || visible.length === 0 || busy) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const index = visible.findIndex((item) => item.key === active);
        const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : visible.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length;
        setActive(visible[next].key);
      } else if (event.key === 'Enter' && activeRow) {
        event.preventDefault();
        choose({ provider: activeRow.group.id, model: activeRow.model.id });
      }
    };
    if (!available) return null;

    const identity = (g, m) => [
      providerNote(prefs, g.id) && h('span', { className: 'dmo-account', key: 'note' }, `账号备注：${providerNote(prefs, g.id)}`),
      h('span', { className: 'dmo-identity', key: 'provider' }, `服务商：${g.name || g.id}（${g.id}）`),
      h('span', { className: 'dmo-identity dmo-id', key: 'model' }, `模型 ID：${m.id}`)
    ];
    const title = currentModel?.name ?? state.current?.model ?? '选择模型';
    const currentText = state.current ? `${currentNote ? currentNote + ' · ' : ''}${currentGroup?.name || state.current.provider}（${state.current.provider}） / ${state.current.model}` : '尚未选择模型';
    const labelEffort = reasoning?.efforts?.find((x) => x.id === effort)?.name ?? state.retainedEffort ?? effort ?? '';
    const toggle = () => {
      if (open) { close(); return; }
      ++popupEpoch.current;
      setQuery(''); setActive(null); setPosition(null); setLocalError(null);
      // An explicit remembered tab wins even when empty; legacy users follow classification.
      setList(prefs.lastList ?? (state.current && isUncommon(prefs, state.current.provider, state.current.model) ? 'uncommon' : 'main'));
      setOpen(true);
      Promise.resolve().then(load).catch((e) => { if (mounted.current) setLocalError(String(e.message ?? e)); });
    };
    // Pin or clear this model's window. The owner keeps the choice; reloading the
    // directory is what makes the new size reach the next request.
    const applyContextWindow = async (contextWindow) => {
      const providerId = state.current?.provider;
      const modelId = state.current?.model;
      if (providerId === undefined || modelId === undefined) return;
      setContextBusy(true);
      setProbeNote(null);
      try {
        const result = await requestContextWindow(providerId, probeStatus, modelId, contextWindow);
        if (result.state !== 'ok') {
          if (mounted.current) setProbeNote({ tone: 'error', text: result.reason ?? '容量修改未生效。' });
          return;
        }
        try { await Promise.resolve(load()); } catch { /* a rejected reload keeps the old directory, which is still safe */ }
        const refreshed = await loadProbeStatus(providerId, { force: true });
        if (!mounted.current) return;
        setProbeStatus(refreshed);
        setProbeNote({ tone: 'ok', text: contextWindow === null ? '已恢复服务商默认容量。' : `上下文容量已设为 ${formatCapacity(contextWindow)}。` });
      } catch (error) {
        if (mounted.current) setProbeNote({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
      } finally {
        if (mounted.current) setContextBusy(false);
      }
    };
    const runDetection = async () => {
      const providerId = state.current?.provider;
      const modelId = state.current?.model;
      setProbeConfirm(false);
      setProbeNote(null);
      if (providerId === undefined || modelId === undefined) return;
      setProbeBusy(true);
      try {
        const result = await requestProbe(providerId, probeStatus, modelId);
        if (result.state !== 'ok') {
          if (mounted.current) setProbeNote({ tone: 'error', text: result.reason ?? '检测未完成。' });
          return;
        }
        // A successful detection makes the owning plugin invalidate its catalog;
        // reloading the directory is what turns the verdict into a dropdown.
        try { await Promise.resolve(load()); } catch { /* a rejected reload keeps the old directory, which is still safe */ }
        const refreshed = await loadProbeStatus(providerId, { force: true });
        if (!mounted.current) return;
        setProbeStatus(refreshed);
        setProbeNote(result.validation === 'validating' && result.efforts.length > 0
          ? { tone: 'ok', text: `已检测：${result.efforts.join(' / ')}` }
          : result.validation === 'non-validating'
            ? { tone: 'error', text: '上游接受任意档位取值，无法确认有效档位，因此不提供档位选择。' }
            : { tone: 'error', text: '检测未得到可用档位。' });
      } catch (error) {
        if (mounted.current) setProbeNote({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
      } finally {
        if (mounted.current) setProbeBusy(false);
      }
    };
    const probeBlock = !state.current ? null : probeBusy
      ? h('p', { className: 'dmo-probe', role: 'status' }, '正在检测思考强度…')
      : h(React.Fragment, null,
        probeNote !== null && !staleDetected && h('p', { className: `dmo-probe ${probeNote.tone === 'ok' ? 'dmo-probe-ok' : 'dmo-probe-error'}`, role: 'status' }, probeNote.text),
        detection !== null && (probeConfirm
          ? h('div', { className: 'dmo-probe-confirm' },
            h('span', null, `将请求 WorkBuddy 向上游发送探测请求，以确认「${currentModel?.name || state.current.model}」接受的思考强度档位。`),
            h('div', { className: 'dmo-note-buttons' },
              h('button', { type: 'button', className: 'dmo-tab', disabled: busy, onClick: runDetection }, '确认检测'),
              h('button', { type: 'button', className: 'dmo-tab', onClick: () => setProbeConfirm(false) }, '取消')))
          : h('p', { className: 'dmo-probe' },
            h('span', null, '该模型未声明思考强度，可由 WorkBuddy 检测。'),
            h('button', { type: 'button', className: 'dmo-effort-reset', disabled: busy, onClick: () => { setProbeNote(null); setProbeConfirm(true); } }, '检测思考强度'))),
        detection === null && probeNote === null && probe.kind === 'rejected' && h('p', { className: 'dmo-probe', role: 'status' }, '该模型已检测：上游接受任意档位取值，因此不提供档位选择。'),
        // A detected model whose levels have not reached the directory yet: the
        // verdict is known, the control is not. Offer the refresh, not a fake select.
        detection === null && staleDetected && h('p', { className: 'dmo-probe' },
          h('span', null, `已探测到档位：${probe.efforts.join(' / ')}（模型面板尚未更新）`),
          h('button', { type: 'button', className: 'dmo-effort-reset', disabled: busy, onClick: () => { setLocalError(null); Promise.resolve().then(load).catch((e) => setLocalError(String(e.message ?? e))); } }, '刷新档位')),
        detection === null && probeNote === null && probe.kind === 'signed-out' && !declaredEfforts && h('p', { className: 'dmo-probe', role: 'status' }, 'WorkBuddy 未登录，暂时无法检测思考强度。'));
    const noteAction = (g) => h('button', { type: 'button', className: 'dmo-note-action', 'aria-label': `编辑账号备注：${g.name || g.id} / ${g.id}`, onClick: (e) => { e.stopPropagation(); setEditingNote({ id: g.id, draft: providerNote(prefs, g.id) }); } }, '账号备注');
    const providerAction = (g) => {
      const archived = prefs.uncommonProviders.includes(g.id);
      return h('button', { type: 'button', className: 'dmo-provider-action', 'aria-label': `${archived ? '恢复服务商' : '整组移至不常用'}：${g.id}`, onClick: (e) => { e.stopPropagation(); moveProvider(g.id, !archived); } }, archived ? '恢复服务商' : '整组移至不常用');
    };
    const noteEditor = editingNote && h('div', { className: 'dmo-note-editor' },
      h('label', { className: 'dmo-note-label' }, '账号备注（仅本浏览器保存，勿填密钥）',
        h('input', { ref: noteInput, type: 'text', className: 'dmo-note-input', maxLength: 120, 'aria-label': `账号备注：${editingNote.id}`, placeholder: '例如：个人账号 / 工作账号 / 备用账号', value: editingNote.draft,
          onChange: (e) => setEditingNote({ id: editingNote.id, draft: e.target.value }), onKeyDown: (e) => {
            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveNote(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditingNote(null); search.current?.focus(); }
          } })),
      h('div', { className: 'dmo-note-buttons' },
        h('button', { type: 'button', className: 'dmo-tab', onClick: saveNote }, '保存备注'),
        h('button', { type: 'button', className: 'dmo-tab', onClick: () => { setEditingNote(null); search.current?.focus(); } }, '取消')));
    const renderRow = (g, m) => {
      const key = modelKey(g.id, m.id);
      const archived = prefs.uncommonProviders.includes(g.id);
      const selected = state.current?.provider === g.id && state.current?.model === m.id;
      const accountSuffix = providerNote(prefs, g.id) ? `，账号备注 ${providerNote(prefs, g.id)}，服务商 ID ${g.id}` : '';
      return h('div', { className: 'dmo-row', key, 'data-model-key': key, 'data-provider-id': g.id, 'data-highlighted': activeRow?.key === key, ...(list === 'favorites' ? dropProps(key) : {}) },
        list === 'favorites' && orderControls(key, `${g.id} / ${m.id}`),
        h('div', { role: 'button', tabIndex: 0, className: 'dmo-select', 'aria-disabled': busy, 'aria-label': `选择 ${g.name || g.id} 的 ${m.name || m.id}，模型 ID ${m.id}${providerNote(prefs, g.id) ? '，账号备注 ' + providerNote(prefs, g.id) : ''}`, 'aria-pressed': selected, onClick: () => { if (!busy) choose({ provider: g.id, model: m.id }); }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) choose({ provider: g.id, model: m.id }); } } },
          h('span', { className: 'dmo-check', 'aria-hidden': true }, selected ? '✓' : ''),
          h('span', { className: 'dmo-copy' }, h('span', { className: 'dmo-name' }, m.name || m.id), ...identity(g, m))),
        h('div', { className: 'dmo-row-actions' },
          h('button', { type: 'button', className: 'dmo-favorite', 'aria-pressed': prefs.favorites.includes(key), 'aria-label': `${prefs.favorites.includes(key) ? '取消收藏' : '收藏'}：${g.name || g.id} / ${m.id}${accountSuffix}`, onClick: () => toggleFavorite(g.id, m.id) }, prefs.favorites.includes(key) ? '★ 已收藏' : '☆ 收藏'),
          h('button', { type: 'button', className: 'dmo-move', disabled: archived, title: archived ? '先恢复服务商，再调整单模型分类' : undefined, 'aria-label': `${archived ? '先恢复服务商' : prefs.uncommon.includes(key) ? '移回主列表' : '移至不常用'}：${g.name || g.id} / ${m.id}${accountSuffix}`, onClick: () => toggleUncommon(key) }, archived ? '先恢复服务商' : prefs.uncommon.includes(key) ? '移回主列表' : '移至不常用'),
          list === 'favorites' && noteAction(g),
          list === 'favorites' && archived && providerAction(g)));
    };

    const popup = open && h('div', {
      className: 'dmo-panel', id: popupId, ref: panel, role: 'dialog', 'aria-label': '模型选择器', 'aria-modal': true,
      style: position ?? { visibility: 'hidden', left: 0, top: 0 }, onKeyDown,
      onPointerDownCapture: () => { suppressClick.current = false; cancelDrag(); },
      onClickCapture: e => { if (suppressClick.current && e.target.closest('.dmo-select, .dmo-group-heading')) { e.preventDefault(); e.stopPropagation(); } }
    },
      h('div', { className: 'dmo-head' }, h('span', { className: 'dmo-title' }, '模型书架 · Model Shelf'), h('button', { type: 'button', className: 'dmo-close', 'aria-label': '关闭模型选择器', onClick: () => close() }, '×')),
      h('p', { className: 'dmo-hint' }, '由你手动整理：移至“不常用”不会删除模型或 API 配置，可随时移回。'),
      h('input', { ref: search, type: 'search', className: 'dmo-search', placeholder: '搜索模型、ID、服务商或账号备注…', 'aria-label': '搜索模型、ID、服务商或账号备注', value: query, onChange: (e) => { cancelDrag(); setQuery(e.target.value); setActive(null); } }),
      h('div', { className: 'dmo-tabs', role: 'tablist', 'aria-label': '模型列表分类' },
        h('button', { type: 'button', id: `${popupId}-main`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'main', 'aria-controls': `${popupId}-list`, onClick: () => changeList('main') }, `主列表 (${allMain})`),
        h('button', { type: 'button', id: `${popupId}-uncommon`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'uncommon', 'aria-controls': `${popupId}-list`, onClick: () => changeList('uncommon') }, `不常用 (${allUncommon})`),
        h('button', { type: 'button', id: `${popupId}-favorites`, className: 'dmo-tab', role: 'tab', 'aria-selected': list === 'favorites', 'aria-controls': `${popupId}-list`, onClick: () => changeList('favorites') }, `收藏 (${allFavorites})`)),
      list !== 'favorites' && h('div', { className: 'dmo-tools' },
        h('button', { type: 'button', disabled: searching || shown.length === 0, onClick: () => setAllCollapsed(false) }, '全部展开'),
        h('button', { type: 'button', disabled: searching || shown.length === 0, onClick: () => setAllCollapsed(true) }, '全部折叠'),
        h('span', null, searching ? '搜索时自动展开匹配分组' : '按服务商分组')),
      error && h('p', { className: 'dmo-error', role: 'alert' }, String(error)),
      (state.failures ?? []).map((failure) => h('p', { className: 'dmo-error', key: failure.id, role: 'status' }, `服务商 ${failure.name ?? failure.id} 加载失败：${failure.message ?? ''}`)),
      h('div', { className: 'dmo-order-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, orderStatus),
      noteEditor,
      h('div', { className: 'dmo-list', id: `${popupId}-list`, role: 'tabpanel', 'aria-labelledby': `${popupId}-${list}`, 'aria-busy': state.status === 'loading' || busy },
        state.status === 'loading' && h('p', { className: 'dmo-empty', role: 'status' }, '正在加载模型…'),
        list === 'favorites' ? flatFavorites.map(({ group, model }) => renderRow(group, model)) : shown.map((g) => h('section', { className: 'dmo-group', key: g.id, 'data-provider-id': g.id, ...dropProps(g.id) },
          h('div', { className: 'dmo-group-top' }, orderControls(g.id, g.id), h('div', { role: 'button', tabIndex: 0, className: 'dmo-group-heading', 'aria-expanded': expanded(g.id), 'aria-disabled': searching, onClick: () => {
            if (!searching) preferences.update((p) => ({ ...p, collapsed: toggleKey(p.collapsed, groupKey(list, g.id)) }));
          }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!searching) preferences.update((p) => ({ ...p, collapsed: toggleKey(p.collapsed, groupKey(list, g.id)) })); } } },
            h('span', { 'aria-hidden': true }, expanded(g.id) ? '▾' : '▸'),
            h('span', { className: 'dmo-group-title' }, g.name || g.id,
              providerNote(prefs, g.id) && h('span', { className: 'dmo-account' }, `账号备注：${providerNote(prefs, g.id)}`),
              h('span', { className: 'dmo-identity' }, `服务商 ID：${g.id}`)),
            h('span', { className: 'dmo-count' }, `${g.models.length} 款`)),
            h('div', { className: 'dmo-provider-actions' }, noteAction(g), providerAction(g))),
          expanded(g.id) && g.models.map(m => renderRow(g, m)))),
        state.status !== 'loading' && shown.length === 0 && h('p', { className: 'dmo-empty', role: 'status' }, searching ? '该列表中没有匹配模型。可切换另一个列表继续搜索。' : list === 'favorites' ? '暂无收藏。请在任一列表点击模型旁的“☆ 收藏”。收藏不会改变主列表 / 不常用分类。' : list === 'uncommon' ? '暂无不常用模型。请在主列表点击模型旁的“移至不常用”。' : '主列表暂无模型；已移出的模型可在“不常用”列表中找回。')),
      h('div', { className: 'dmo-current' },
        h('div', null, '当前模型：', currentText),
        !reasoning && labelEffort && h('div', { className: 'dmo-identity' }, `已保留思考强度：${labelEffort}`),
        state.current && state.routable === false && h('div', { className: 'dmo-error', role: 'status' }, '当前模型暂不可用，原选择和思考强度已保留。'),
        reasoning?.efforts?.length > 0 && h('label', { className: 'dmo-effort-label' }, '思考强度', h('select', { className: 'dmo-effort', 'aria-label': '思考强度', value: effort ?? '', disabled: busy,
          // The empty value is the directory's own "provider default", expressed by
          // sending no `reasoningEffort` at all.
          onChange: (e) => { const next = e.target.value; choose(next === '' ? { provider: state.current.provider, model: state.current.model, resetEffort: true } : { provider: state.current.provider, model: state.current.model, reasoningEffort: next }, true); } },
          effort === undefined && h('option', { value: '' }, '服务商默认'),
          effort !== undefined && !reasoning.efforts.some((x) => x.id === effort) && h('option', { value: effort }, `${effort}（当前值）`),
          reasoning.efforts.map((x) => h('option', { key: x.id, value: x.id }, x.name || x.id))),
          // Only the *pinned* level is a choice; when nothing is pinned the level
          // shown is the adapter's own default, which the directory already reports.
          effortSource === 'probe' && h('span', { className: 'dmo-effort-source' }, '已探测')),
        // An explicit unpin, because the select can only express one while the model
        // still publishes levels — a model that publishes none has no select at all,
        // yet can still be holding a level pinned before the switch.
        state.current && state.current.reasoningEffort !== undefined && h('button', { type: 'button', className: 'dmo-effort-reset', disabled: busy, onClick: () => choose({ provider: state.current.provider, model: state.current.model, resetEffort: true }, true) }, '恢复服务商默认'),
        // Only a model the host actually offers a choice for: one declared
        // capacity with nothing pinned leaves nothing to decide.
        contextRow !== undefined && (contextRow.declared.length > 1 || contextRow.override !== undefined) && h('label', { className: 'dmo-effort-label' }, '上下文容量',
          h('select', { className: 'dmo-effort', 'aria-label': '上下文容量', disabled: busy || contextBusy, value: contextRow.override === undefined ? '' : String(contextRow.override),
            onChange: (e) => { const next = e.target.value; applyContextWindow(next === '' ? null : Number(next)); } },
          h('option', { value: '' }, '服务商默认'),
          contextRow.override !== undefined && !contextRow.declared.includes(contextRow.override) && h('option', { value: String(contextRow.override) }, `${formatCapacity(contextRow.override)}（当前值）`),
          contextRow.declared.map((size) => h('option', { key: size, value: String(size) }, formatCapacity(size)))),
          contextRow.effective !== undefined && h('span', { className: 'dmo-effort-source dmo-context-note' }, `当前生效 ${formatCapacity(contextRow.effective)}`)),
        probeBlock,
        h('div', { className: 'dmo-identity' }, '分类、收藏、备注及折叠偏好保存在当前浏览器；不会自动分类。'),
        (localError || state.status === 'error' || state.failures?.length > 0) && h('button', { type: 'button', className: 'dmo-tab', onClick: () => { setLocalError(null); Promise.resolve().then(load).catch((e) => setLocalError(String(e.message ?? e))); } }, '重新加载')));
    return h(React.Fragment, null,
      h('div', { ref: trigger, role: 'button', tabIndex: 0, className: 'dmo-trigger', 'aria-label': `${title} · ${currentText}${labelEffort ? ` · ${labelEffort}` : ''}`, 'aria-disabled': locked, 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? popupId : undefined, title: `${currentText}${labelEffort ? ` · ${labelEffort}` : ''}`, onClick: () => { if (!locked) toggle(); }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!locked) toggle(); } } },
        h('svg', { className: 'dmo-trigger-icon', width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' },
          h('path', { d: 'M3 3v13h14M6 4h3v9H6zM12 3l3-1 3 10-3 1z' })),
        h('span', { className: 'dmo-trigger-copy' }, `${currentNote ? currentNote + ' · ' : ''}${title}${labelEffort ? ` · ${labelEffort}` : ''}`), h('span', { 'aria-hidden': true }, busy ? '…' : open ? '▴' : '▾')),
      popup && createPortal(popup, document.body));
  };
}

function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-model-shelf';
    style.textContent = ".dmo-trigger{display:flex;align-items:center;gap:6px;max-width:min(480px,55cqw);min-width:0;height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font:inherit;font-size:13px;cursor:pointer}.dmo-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dmo-trigger[aria-disabled=true]{opacity:.5;cursor:default}.dmo-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-trigger-copy{display:var(--dsh-composer-model-text-display,block);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:text;-webkit-user-select:text}.dmo-trigger:focus-visible,.dmo-panel button:focus-visible,.dmo-search:focus-visible,.dmo-effort:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-trigger:disabled,.dmo-panel button:disabled{opacity:.5;cursor:default}.dmo-panel{position:fixed;z-index:1200;box-sizing:border-box;width:min(640px,calc(100vw - 24px));max-height:min(720px,calc(100dvh - 32px));display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:14px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#222);box-shadow:0 8px 36px #0003;font-family:inherit;font-size:13px}.dmo-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 8px}.dmo-title{font-weight:600;font-size:15px}.dmo-panel button{font:inherit;color:inherit}.dmo-close{border:0;border-radius:6px;background:transparent;width:28px;height:28px;cursor:pointer}.dmo-hint{margin:0;padding:0 16px 10px;color:var(--dsw-alias-label-tertiary,#777);font-size:12px;line-height:1.5}.dmo-search{box-sizing:border-box;width:calc(100% - 32px);margin:0 16px 10px;padding:9px 11px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit}.dmo-tabs{display:flex;gap:6px;padding:0 16px 10px}\r\n.dmo-trigger-icon{display:var(--dsh-composer-model-icon-display,none);flex:none}\r\n.dmo-tabs{flex-wrap:wrap}\r\n.dmo-order{display:flex;flex:none;flex-direction:column;justify-content:center;gap:3px;padding:6px 2px}\r\n.dmo-order button{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:5px;background:transparent;padding:3px 5px;min-width:26px}\r\n.dmo-drag{cursor:grab;user-select:none;-webkit-user-select:none}\r\n.dmo-drag:active{cursor:grabbing}\r\n.dmo-order-status{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}\r\n.dmo-list [data-drop-target=true]{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:-2px}\r\n.dmo-group-top{display:flex;align-items:stretch;gap:8px}\r\n.dmo-group-top .dmo-group-heading{flex:1;min-width:0;width:auto}\r\n.dmo-group-top{padding-right:8px}\r\n.dmo-provider-actions{display:flex;flex:none;flex-direction:column;justify-content:center;align-items:stretch;gap:5px;padding:6px 0;max-width:110px}\r\n.dmo-provider-action{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:6px 8px;cursor:pointer;font-size:11px!important;overflow-wrap:anywhere}\r\n.dmo-provider-actions .dmo-note-action,.dmo-row-actions .dmo-note-action{align-self:stretch}\r\n.dmo-list>.dmo-row{margin:6px 0;padding:6px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:10px}\r\n.dmo-panel>.dmo-note-editor{flex:none;margin:4px 16px 8px}\r\n.dmo-note-action{flex:none;align-self:center;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:6px 9px;cursor:pointer;font-size:11px!important}\r\n.dmo-account{display:block;color:var(--dsw-alias-state-business-primary,#4d6bfe);font-size:12px;font-weight:500;line-height:1.5;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}\r\n.dmo-row-actions{display:flex;flex:none;flex-direction:column;gap:5px;align-items:stretch;max-width:105px;margin-right:5px}\r\n.dmo-row-actions .dmo-move{margin-right:0;align-self:stretch}\r\n.dmo-favorite{padding:6px 8px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;font-size:11px!important;cursor:pointer}\r\n.dmo-favorite[aria-pressed=true]{color:var(--dsw-alias-state-business-primary,#4d6bfe);background:var(--dsw-alias-interactive-bg-hover,#eef1ff)}\r\n.dmo-note-editor{padding:10px;margin:4px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px}\r\n.dmo-note-label{display:block;font-size:12px;color:var(--dsw-alias-label-secondary,#666)}\r\n.dmo-note-input{display:block;box-sizing:border-box;width:100%;margin:6px 0 8px;padding:8px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:6px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit}\r\n.dmo-note-input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}\r\n.dmo-note-buttons{display:flex;gap:6px}\r\n.dmo-tab{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px;background:transparent;padding:7px 12px;cursor:pointer}.dmo-tab[aria-selected=true]{background:var(--dsw-alias-interactive-bg-hover,#eef1ff);color:var(--dsw-alias-state-business-primary,#4d6bfe);border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}.dmo-tools{display:flex;gap:6px;padding:0 16px 8px;color:var(--dsw-alias-label-tertiary,#777);font-size:12px;align-items:center}.dmo-tools button{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:5px 9px;cursor:pointer;font-size:12px!important;color:inherit}.dmo-tools span{margin-left:auto}.dmo-list{padding:6px 8px 10px;overflow:auto;flex:1;min-height:0}.dmo-group{margin:6px 0;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:10px;overflow:hidden}.dmo-group-heading{display:flex;align-items:center;gap:8px;padding:9px 10px;width:100%;border:0;border-radius:0;background:transparent;text-align:left;cursor:pointer;user-select:text;-webkit-user-select:text}.dmo-group-heading[aria-disabled=true]{cursor:default;color:var(--dsw-alias-label-tertiary,#777)}.dmo-group-heading:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-group-title{display:flex;flex-direction:column;flex:1;min-width:0;user-select:text;-webkit-user-select:text}.dmo-count{flex:none;color:var(--dsw-alias-label-tertiary,#777);font-size:12px}.dmo-row{display:flex;align-items:stretch;gap:6px;padding:0 6px;border-top:1px solid var(--dsw-alias-border-l1,#ddd)}.dmo-row:hover,.dmo-row[data-highlighted=true]{background:var(--dsw-alias-interactive-bg-hover,#f2f4ff)}.dmo-select{flex:1;min-width:0;display:flex;align-items:center;gap:8px;text-align:left;padding:10px 8px;border:0;border-radius:8px;background:transparent;cursor:pointer;user-select:text;-webkit-user-select:text}.dmo-select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-select[aria-disabled=true]{opacity:.5;cursor:default}.dmo-check{width:16px;flex:none;color:var(--dsw-alias-state-business-primary,#4d6bfe)}.dmo-copy{min-width:0;display:flex;flex-direction:column;gap:4px;user-select:text;-webkit-user-select:text}.dmo-name{font-weight:500;line-height:1.5;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}.dmo-identity{display:block;color:var(--dsw-alias-label-tertiary,#777);font-size:11px;line-height:1.5;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}.dmo-id{font-family:ui-monospace,Consolas,monospace}.dmo-move{flex:none;align-self:center;padding:6px 8px;max-width:105px;margin-right:5px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;font-size:11px!important;cursor:pointer}\r\n.dmo-empty{padding:24px 10px;text-align:center;line-height:1.6;color:var(--dsw-alias-label-tertiary,#777)}.dmo-error{padding:8px 16px;margin:0;color:var(--dsw-alias-state-error-primary,#c33);font-size:12px;overflow-wrap:anywhere}.dmo-current{padding:10px 16px;border-top:1px solid var(--dsw-alias-border-l1,#ddd);font-size:12px;line-height:1.6;flex:none;overflow-wrap:anywhere}.dmo-effort-label{display:flex;align-items:center;gap:8px;margin-top:6px}.dmo-effort{padding:5px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:6px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit;max-width:75%}\r\n@media(max-width:480px){.dmo-head{padding:12px}\r\n.dmo-move{max-width:76px}\r\n.dmo-trigger{max-width:48cqw}\r\n}\r\n.dmo-effort-source{flex:none;color:var(--dsw-alias-label-tertiary,#777);font-size:11px}\r\n.dmo-effort-reset{margin-top:6px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:5px 9px;cursor:pointer;font-size:12px!important;color:inherit}\r\n.dmo-effort-reset:disabled{opacity:.5;cursor:default}\r\n.dmo-probe{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:6px 0 0;color:var(--dsw-alias-label-secondary,#666);font-size:12px;line-height:1.6}\r\n.dmo-probe .dmo-effort-reset{margin-top:0}\r\n.dmo-probe-ok{color:var(--dsw-alias-state-business-primary,#4d6bfe)}\r\n.dmo-probe-error{color:var(--dsw-alias-state-error-primary,#c33)}\r\n.dmo-probe-confirm{margin:6px 0 0;padding:8px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px;font-size:12px;line-height:1.6}\r\n";
    document.head.appendChild(style);
    return () => style.remove();
  });
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('storage unavailable'); }, setItem() { throw new Error('storage unavailable'); } }; }
  const preferences = createPreferenceStore(storage, window);
  ctx.effect(() => () => preferences.dispose());
  const ModelPicker = makeModelPicker(preferences);
  ctx.slots.inject('conversation.input.model', () => ctx.slots.register({
    name: 'conversation.input.model', priority: -100,
    inject: (sessionId) => {
      const directory = ctx.modelDirectories.directoryFor(sessionId);
      const available = ctx.sessions.subagentAddress(sessionId) === undefined;
      return {
        available, directory: directory.store,
        load: () => available ? directory.load() : undefined,
        select: async (selection) => {
          if (!available) return undefined;
          try { return await directory.select(selection); }
          catch (error) {
            // Native select can leave its shared directory in 'selecting' on RPC rejection.
            // Its connection-reset method clears pending selection and invalidates stale replies.
            directory.resetConnected();
            throw error;
          }
        }
      };
    }
  }, ModelPicker));
}

return { apply, inject, makeModelPicker };
  }
});
