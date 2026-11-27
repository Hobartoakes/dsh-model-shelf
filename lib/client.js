window.__ModuleLoader__.load({
  id: 'dsh-model-shelf',
  factory: (require) => {
const STORAGE_KEY = 'dsh-model-shelf.preferences.v1';
const LEGACY_STORAGE_KEY = 'dsh-model-organizer.preferences.v1';
const modelKey = (provider, model) => JSON.stringify([provider, model]);
const groupKey = (list, provider) => JSON.stringify([list, provider]);
const emptyPreferences = () => ({
  version: 1, uncommon: [], favorites: [], providerNotes: {}, collapsed: [],
  uncommonProviders: [], providerOrder: { main: [], uncommon: [] }, favoriteOrder: [], lastList: null, iconNetwork: false
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
    lastList: ['main', 'uncommon', 'favorites'].includes(value.lastList) ? value.lastList : null,
    iconNetwork: value.iconNetwork === true
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

// Snapshot of public Cline model IDs; these labels do not verify the actual upstream.
const catalogModelIcons = Object.freeze(["deepseek/deepseek-chat","deepseek/deepseek-chat-v3-0324","deepseek/deepseek-chat-v3.1","deepseek/deepseek-r1-0528","deepseek/deepseek-v3.1-terminus","deepseek/deepseek-v3.2","deepseek/deepseek-v3.2-exp","deepseek/deepseek-v4-flash","deepseek/deepseek-v4-flash-0731","deepseek/deepseek-v4-flash-vision-exp","deepseek/deepseek-v4-pro","deepseek/deepseek-v4-pro-0813","deepseek/deepseek-v4.1-flash","deepseek/deepseek-v4.1-flash-1017","deepseek/deepseek-v4.1-flash:batch","openai/gpt-3.5-turbo-0613","openai/gpt-3.5-turbo-16k","openai/gpt-4","openai/gpt-4.1","openai/gpt-4.1-mini","openai/gpt-4.1-nano","openai/gpt-4o","openai/gpt-4o-2024-05-13","openai/gpt-4o-2024-08-06","openai/gpt-4o-2024-11-20","openai/gpt-4o-mini","openai/gpt-4o-mini-2024-07-18","openai/gpt-5","openai/gpt-5-image","openai/gpt-5-image-mini","openai/gpt-5-mini","openai/gpt-5-nano","openai/gpt-5-nano:batch","openai/gpt-5-pro","openai/gpt-5.1","openai/gpt-5.1-codex","openai/gpt-5.1-codex-max","openai/gpt-5.1-codex-mini","openai/gpt-5.2","openai/gpt-5.2-codex","openai/gpt-5.2-pro","openai/gpt-5.3-codex","openai/gpt-5.4","openai/gpt-5.4-image-2","openai/gpt-5.4-mini","openai/gpt-5.4-nano","openai/gpt-5.4-pro","openai/gpt-5.5","openai/gpt-5.5-pro","openai/gpt-5.6-luna","openai/gpt-5.6-luna-pro","openai/gpt-5.6-luna-pro:batch","openai/gpt-5.6-luna:batch","openai/gpt-5.6-sol","openai/gpt-5.6-sol-pro","openai/gpt-5.6-sol-pro:batch","openai/gpt-5.6-sol:batch","openai/gpt-5.6-terra","openai/gpt-5.6-terra-pro","openai/gpt-5.6-terra-pro:batch","openai/gpt-5.6-terra:batch","openai/gpt-6-astra","openai/gpt-6-astra-pro","openai/gpt-6-astra-pro:batch","openai/gpt-6-astra:batch","openai/gpt-6-luna","openai/gpt-6-luna-pro","openai/gpt-6-luna-pro:batch","openai/gpt-6-luna:batch","openai/gpt-6-sol","openai/gpt-6-sol-pro","openai/gpt-6-sol-pro:batch","openai/gpt-6-sol:batch","openai/gpt-6.1-sol","openai/gpt-6.1-sol-pro","openai/gpt-6.1-sol-pro:batch","openai/gpt-6.1-sol:batch","openai/gpt-6.1-terra","openai/gpt-6.1-terra-pro","openai/gpt-6.1-terra-pro:batch","openai/gpt-6.1-terra:batch","openai/gpt-audio","openai/gpt-audio-mini","openai/gpt-chat-latest","openai/gpt-oss-120b","openai/gpt-oss-120b:batch","openai/gpt-oss-20b","openai/gpt-oss-20b:batch","openai/gpt-oss-safeguard-20b","openai/o3","openai/o3-pro"]);
const qwenCatalogIds = Object.freeze(["qwen/qwen-2.5-72b-instruct","qwen/qwen-2.5-7b-instruct","qwen/qwen-2.5-coder-32b-instruct","qwen/qwen-plus","qwen/qwen2.5-vl-72b-instruct","qwen/qwen3-14b","qwen/qwen3-235b-a22b-2507","qwen/qwen3-235b-a22b-thinking-2507","qwen/qwen3-30b-a3b","qwen/qwen3-30b-a3b-instruct-2507","qwen/qwen3-32b","qwen/qwen3-coder","qwen/qwen3-coder-30b-a3b-instruct","qwen/qwen3-coder-flash","qwen/qwen3-coder-next","qwen/qwen3-next-80b-a3b-instruct","qwen/qwen3-vl-235b-a22b-instruct","qwen/qwen3-vl-30b-a3b-instruct","qwen/qwen3-vl-30b-a3b-thinking","qwen/qwen3-vl-8b-instruct","qwen/qwen3.5-122b-a10b","qwen/qwen3.5-27b","qwen/qwen3.5-35b-a3b","qwen/qwen3.5-397b-a17b","qwen/qwen3.5-9b","qwen/qwen3.5-flash-02-23","qwen/qwen3.5-plus-02-15","qwen/qwen3.5-plus-20260420","qwen/qwen3.6-27b","qwen/qwen3.6-35b-a3b","qwen/qwen3.6-flash","qwen/qwen3.6-plus","qwen/qwen3.7-flash","qwen/qwen3.7-max","qwen/qwen3.7-plus","qwen/qwen3.7-plus:batch","qwen/qwen3.8-2.4t-a95b","qwen/qwen3.8-27b","qwen/qwen3.8-flash","qwen/qwen3.8-max-0902","qwen/qwen3.8-max-prime","qwen/qwen3.8-omni-flash"]);

// Icon keys describe catalog labels, not verified upstream identity.
const knownCatalogModels = new Set(catalogModelIcons);
const knownQwenModels = new Set(qwenCatalogIds);
const providers = Object.freeze({ 'deepseek-official': 'deepseek', 'deepseek-account': 'deepseek', 'openai-codex': 'openai', 'cline': 'cline', 'qoder': 'qoder', 'qodercn': 'qoder', 'trae': 'trae', 'workbuddy': 'workbuddy', 'workbuddy-ai': 'workbuddy', 'openrouter': 'openrouter', 'huggingface': 'huggingface' });

// Only reviewed, fixed filenames may be fetched; unknown labels never form URLs.
const DOWNLOADABLE_ICONS = Object.freeze({ openrouter: 'openrouter.png', huggingface: 'huggingface-color.png' });

function providerIcon(providerId) {
  if (typeof providerId !== 'string') return 'default';
  return Object.hasOwn(providers, providerId.toLowerCase()) ? providers[providerId.toLowerCase()] : 'default';
}

function modelIcon(modelId, providerId) {
  if (typeof modelId !== 'string') return 'default';
  const id = modelId.toLowerCase();
  const provider = typeof providerId === 'string' ? providerId.toLowerCase() : '';
  if (provider === 'qoder' || provider === 'qodercn') {
    if (/^(?:qmodel|qmodel_latest|qmodel_38max|qfmodel|q37fmodel)$/.test(id)) return 'qwen';
    if (/^(?:dmodel|dfmodel)$/.test(id)) return 'deepseek';
  }
  if (knownCatalogModels.has(id)) return id.startsWith('openai/') ? 'openai' : 'deepseek';
  if (knownQwenModels.has(id)) return 'qwen';
  if (/^~openai\/gpt-(?:astra|luna|mini|sol|terra)-latest$/.test(id)) return 'openai';
  if (/^~deepseek\/deepseek-(?:flash|pro|v4-flash)-latest$/.test(id)) return 'deepseek';
  if (/^(?:cline-pass\/)?qwen3\.[5678]-(?:max|plus|flash|27b)(?:-2026-04-20)?$/.test(id)) return 'qwen';
  if (/^qwen-3\.[568](?:-(?:max|plus))?$/.test(id)) return 'qwen';
  if (/^gpt-[56](?:\.\d{1,2})?-(?:sol|terra|astra|luna)$/.test(id)) return 'openai';
  if (/^(?:deepseek-ai\/)?deepseek-v4\.1-flash(?:-(?:free|sg))?$/.test(id) || id === 'deepseek-v4-pro-official') return 'deepseek';
  if (/^(?:openai|codex)\/gpt-[56](?:\.\d{1,2})?-(?:sol|terra|astra|luna)(?:-pro)?(?::batch)?$/.test(id)) return 'openai';
  if (/^openai\/gpt-[3456](?:\.\d{1,2})?o?(?:-(?:mini|nano|pro|codex))?$/.test(id)) return 'openai';
  if (/^opencode-zen-free\/deepseek-v4(?:\.\d{1,2})?-flash-free$/.test(id)) return 'deepseek';
  if (/^(?:(?:deepseek|cline-pass)\/)?deepseek-v4(?:\.\d{1,2})?-(?:flash|pro)(?:-\d{4})?$/.test(id)) return 'deepseek';
  const models = { 'deepseek-v4.1-flash': 'deepseek', 'deepseek-v3': 'deepseek', 'deepseek-flash': 'deepseek', 'deepseek-v4-flash-vision': 'deepseek', 'deepseek-chat': 'deepseek', 'deepseek-reasoner': 'deepseek', 'gpt-4o': 'openai', 'gpt-6.1-terra': 'openai', 'gpt-6.1-sol': 'openai', 'gpt-6-astra': 'openai', 'claude-3-5-sonnet': 'claude', 'claude-sonnet-4-5': 'claude' };
  if (Object.hasOwn(models, id)) return models[id];
  if (/^deepseek-v[234](?:\.\d{1,2})?(?:-(?:flash|pro|lite))?$/.test(id)) return 'deepseek';
  if (/^gpt-[3456](?:\.\d{1,2})?o?(?:-(?:mini|nano|pro|codex))?$/.test(id)) return 'openai';
  if (/^claude-(?:(?:opus|sonnet|haiku)-[345](?:[.-]\d{1,2})*|[345](?:[.-]\d{1,2})*-(?:opus|sonnet|haiku))$/.test(id)) return 'claude';
  return 'default';
}

// Catalog labels never become URLs: only keys present in the fixed registry do.
const ICON_CACHE_KEY = 'dsh-model-shelf.icons.v1';
const ICON_BASE = 'https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/';
const MAX_BYTES = 128 * 1024;
const MAX_ITEMS = 32;
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const isPNG = bytes => {
  if (bytes.length < 24 || !signature.every((v, i) => bytes[i] === v) || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  return width > 0 && height > 0 && width <= 2048 && height <= 2048;
};
const toDataURL = bytes => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return 'data:image/png;base64,' + btoa(binary);
};
const cachedPNG = value => {
  if (typeof value !== 'string' || !value.startsWith('data:image/png;base64,') || value.length > MAX_BYTES * 1.4 + 32) return false;
  try { const raw = atob(value.slice(22)); return isPNG(Uint8Array.from(raw, c => c.charCodeAt(0))); } catch { return false; }
};
async function limitedBody(response) {
  const len = Number(response.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw Error('icon too large');
  const reader = response.body?.getReader();
  if (!reader) throw Error('stream unavailable');
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw Error('icon too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (!isPNG(bytes)) throw Error('invalid PNG');
  return bytes;
}

function createIconStore({ storage, bundled = {}, registry = {}, fetcher = globalThis.fetch }) {
  let cache = {}, revision = 0, enabled = false;
  const listeners = new Set(), inFlight = new Map(), attempted = new Set(), controllers = new Set();
  try {
    const data = JSON.parse(storage.getItem(ICON_CACHE_KEY) || '{}');
    if (data && typeof data === 'object' && !Array.isArray(data))
      for (const [key, value] of Object.entries(data).slice(-MAX_ITEMS)) if (Object.hasOwn(registry, key) && cachedPNG(value)) cache[key] = value;
  } catch { /* Storage is optional. */ }
  const emit = () => { revision++; for (const listener of listeners) listener(); };
  function setEnabled(value) {
    enabled = value === true;
    if (!enabled) { for (const controller of controllers) controller.abort(); inFlight.clear(); attempted.clear(); }
  }
  async function load(key, allow = enabled) {
    if (!allow || Object.hasOwn(bundled, key) || cache[key] || !Object.hasOwn(registry, key) || attempted.has(key)) return;
    if (inFlight.has(key)) return inFlight.get(key);
    const filename = registry[key];
    if (typeof filename !== 'string' || !/^[a-z0-9-]+\.png$/.test(filename)) return;
    attempted.add(key);
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12000);
    const promise = (async () => {
      try {
        const response = await fetcher(ICON_BASE + filename, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal });
        if (!response.ok || !/^image\/png(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) return;
        const bytes = await limitedBody(response);
        if (controller.signal.aborted) return;
        const dataURL = toDataURL(bytes);
        if (typeof Image !== 'undefined') {
          const image = new Image(); image.src = dataURL;
          await image.decode();
          if (!image.naturalWidth || !image.naturalHeight || controller.signal.aborted) return;
        }
        cache[key] = dataURL;
        const keys = Object.keys(cache); while (keys.length > MAX_ITEMS) delete cache[keys.shift()];
        try { storage.setItem(ICON_CACHE_KEY, JSON.stringify(cache)); } catch { /* In-memory still works. */ }
        emit();
      } catch { /* Offline, blocked, invalid or aborted: use default. */ }
      finally { clearTimeout(timeout); controllers.delete(controller); if (inFlight.get(key) === promise) inFlight.delete(key); }
    })();
    inFlight.set(key, promise); return promise;
  }
  function discard(key) {
    if (!Object.hasOwn(cache, key)) return;
    delete cache[key];
    try { storage.setItem(ICON_CACHE_KEY, JSON.stringify(cache)); } catch { /* Optional storage. */ }
    emit();
  }
  return { get: key => bundled[key] ?? cache[key] ?? null, load, setEnabled, discard, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => revision, dispose() { setEnabled(false); listeners.clear(); } };
}

// Codex 3.2.28 registers openai-codex and these exact, DSH-authorized RPCs.
// The caller supplies the connection for the current host lifecycle, not an agent tool.
const codexStatusMethod = 'codex-subscription/preferences/status';
const codexUpdateMethod = 'codex-subscription/preferences/update';
const codexOwner = 'dsh-codex-subscription';
const codexScope = '修改此 Codex 连接器的默认值，其他使用它的会话也会受到影响';
function codexField(id, label, choices, supported) {
  const editor = Object.freeze({ choices: Object.freeze(choices) });
  return { id, label, editor, reset: choices[0], supported };
}
const codexFields = [
  codexField('outputVerbosity', '回答详略', ['default', 'low', 'medium', 'high'],
    (status, target) => Array.isArray(status.verbosityModels) && status.verbosityModels.includes(target.model)),
  // The caller sets reasoningActive only for an effective directory effort whose payload was verified.
  codexField('reasoningSummary', '推理摘要', ['auto', 'concise', 'detailed', 'none'],
    (_, target) => target.reasoningActive === true)
];

function validCodexTarget(target) {
  return target?.provider === 'openai-codex' && typeof target.model === 'string' && target.model.trim() !== '' &&
    typeof target.sessionId === 'string' && target.sessionId.trim() !== '' && target.epoch != null;
}

// In 3.2.28 an online/ok availableModels entry came from a parsed account
// row with explicit supportsFast/supportsUltrafast booleans. Outside that
// catalog fastModels alone can be a model-name fallback, not account evidence.
function codexSpeedOption(status, model) {
  const { catalogStatus, fastModels, ultrafastModels, speedMode } = status;
  if (catalogStatus?.source !== 'online' || catalogStatus.refresh !== 'ok' ||
      !Array.isArray(status.disabledModels) || !Array.isArray(fastModels) || !Array.isArray(ultrafastModels) ||
      !['standard', 'fast', 'ultrafast'].includes(speedMode)) return;
  const fast = fastModels.includes(model), ultra = ultrafastModels.includes(model);
  if (!fast && !ultra) return;
  const choices = Object.freeze(['standard', ...(fast ? ['fast'] : []), ...(ultra ? ['ultrafast'] : [])]);
  const notice = (fast ? '快速模式会消耗更多 Credits。' : '') +
    (ultra ? '极速模式（Beta）会更快消耗订阅额度和 Credits。' : '');
  // The saved value belongs to the connector, not to this model. Keep it as
  // the conflict baseline even if it is no longer among the writable choices.
  const editor = Object.freeze({ choices, ...(choices.includes(speedMode) ? {} : { unavailableText: '当前模型按标准速度处理' }) });
  return Object.freeze({ id: 'speedMode', label: '响应速度', value: speedMode, reset: 'standard', editor,
    owner: codexOwner, scope: codexScope, notice });
}

function codexOptionsFromStatus(status, target) {
  if (status?.writable !== true || !['auto', 'legacy'].includes(status.composerModelPicker) ||
      !Array.isArray(status.availableModels) || status.availableModels.filter(m => m?.id === target.model).length !== 1 ||
      (status.disabledModels !== undefined && (!Array.isArray(status.disabledModels) || status.disabledModels.includes(target.model)))) return [];

  const fields = codexFields.filter(f => f.supported(status, target) && f.editor.choices.includes(status[f.id]))
    .map(({ id, label, reset, editor }) => Object.freeze({ id, label, reset, value: status[id], editor, scope: codexScope, owner: codexOwner }));
  const speed = codexSpeedOption(status, target.model);
  if (speed) fields.push(speed);
  return fields;
}

function codexTargetSnapshot({ sessionId, provider, model, epoch, reasoningActive }) {
  return { sessionId, provider, model, epoch, reasoningActive };
}

function sameCodexTarget(target, snapshot) {
  return Object.keys(snapshot).every(key => target[key] === snapshot[key]);
}

function codexChangeValue(field, change) {
  if (!change || typeof change !== 'object') return;
  const keys = Reflect.ownKeys(change);
  if (keys.length !== 1) return;
  if (keys[0] === 'reset' && change.reset === true) return field.reset;
  if (keys[0] === 'set' && field.editor.choices.includes(change.set)) return change.set;
}

// In Codex 3.2.28 subscription-rpc.js these preference-fields.js errors return
// before preferences.update(). The same 'internal' code can also occur AFTER persistence.
const codexValidationError = {
  outputVerbosity: 'Invalid output verbosity preference',
  reasoningSummary: 'Invalid reasoning summary preference',
  speedMode: 'Invalid speed mode preference'
};
function codexWriteReceipt(response, field) {
  if (response?.ok === false) {
    return !Object.hasOwn(response, 'value') && response.error?.code === 'internal' && response.error.message === codexValidationError[field]
      ? 'refused' : 'unconfirmed';
  }
  if (response?.ok !== true || Object.hasOwn(response, 'error') || !response.value || typeof response.value !== 'object' || Array.isArray(response.value)) return 'unconfirmed';
  const synced = response.value.liveSynced;
  if (synced === false) return 'saved-not-live';
  return synced === undefined || synced === true ? 'applied' : 'unconfirmed';
}

function createCodexOptions(rpc) {
  // Keep the returned Option itself as the draft baseline. A copy or an Option from
  // an earlier connection cannot authorize a write. No raw status is cached here.
  const origins = new WeakMap();
  let saving = false;

  async function read(target, signal) {
    if (!validCodexTarget(target) || signal?.aborted || typeof rpc?.call !== 'function') return [];
    const origin = codexTargetSnapshot(target);
    try {
      const response = await rpc.call('/api', codexStatusMethod, {}, signal);
      if (response?.ok !== true || signal?.aborted || !sameCodexTarget(target, origin)) return [];
      const fields = codexOptionsFromStatus(response.value, origin);
      for (const field of fields) origins.set(field, origin);
      return fields;
    } catch {
      // Optional service: do not expose raw status or transport diagnostics to the picker.
      return [];
    }
  }

  async function write(target, expected, change, signal, isCurrent) {
    const origin = origins.get(expected);
    if (!validCodexTarget(target) || !origin || typeof isCurrent !== 'function') return 'refused';
    const active = () => {
      try { return !signal?.aborted && sameCodexTarget(target, origin) && isCurrent() === true; }
      catch { return false; }
    };
    if (!active()) return 'stale';
    const value = codexChangeValue(expected, change);
    if (value === undefined || saving) return 'refused';
    saving = true;
    try {
      const sameField = f => f.id === expected.id && f.owner === expected.owner;
      const fresh = (await read(target, signal)).find(sameField);
      if (!active()) return 'stale';
      if (!fresh || !fresh.editor.choices.includes(value)) return 'refused';
      if (fresh.value !== expected.value) return 'conflict';

      // No owner CAS exists: another client can still win between this check and dispatch.
      let receipt = 'unconfirmed';
      try { receipt = codexWriteReceipt(await rpc.call('/api', codexUpdateMethod, { [fresh.id]: value }, signal), fresh.id); }
      catch { /* The patch may have landed. Do not resend it. */ }
      if (!active()) return 'stale';
      if (receipt === 'refused') return receipt;
      const confirmed = (await read(target, signal)).find(sameField);
      if (!active()) return 'stale';
      return confirmed?.value === value && confirmed.editor.choices.includes(value) ? receipt : 'unconfirmed';
    } finally {
      saving = false;
    }
  }
  return { read, write };
}


// An optional Cordis child owns this binding, never the model seat itself.
// Without both observables (old hosts), there is no safe lifetime for writes.
function createProviderConnection() {
  const listeners = new Set();
  let current = null, owner;
  const emit = value => { if (current !== value) { current = value; for (const fn of listeners) fn(); } };
  return {
    getSnapshot: () => current,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    attach(connection) {
      const lease = {}; owner = lease; emit(null);
      const { state, generation, rpc } = connection ?? {};
      if (!rpc || typeof rpc.call !== 'function' || ![state,generation].every(s => typeof s?.subscribe === 'function' && typeof s.getSnapshot === 'function')) return;
      let last, live = true;
      const io = createCodexOptions(rpc), stops = [];
      const update = () => {
        if (!live || lease !== owner) return;
        let next;
        try { if (state.getSnapshot() === 'connected') next = generation.getSnapshot()?.id; } catch { /* unavailable */ }
        if (!Number.isSafeInteger(next) || next < 1) next = undefined;
        if (next !== last || next === undefined) { last = next; emit(next === undefined ? null : { io }); }
      };
      const detach = () => {
        live = false;
        if (lease === owner) { owner = undefined; emit(null); }
        for (const stop of stops) stop();
      };
      try {
        for (const s of [state,generation]) {
          const stop = s.subscribe(update);
          if (typeof stop !== 'function') { detach(); return; }
          stops.push(stop);
        }
        update(); return detach;
      } catch { detach(); }
    }
  };
}

// This is a closed evidence list, not a vendor/model-name heuristic. The
// pinned adapter produced a reasoning object at these levels (and its declared
// medium default). Other catalog models can still offer declared verbosity.
function verifiedCodexReasoning(model, effort, implicit) {
  if (implicit && effort !== 'medium') return false;
  return model.id === 'gpt-5.4' && ['low','medium','high'].includes(effort) &&
    Array.isArray(model.reasoning?.efforts) && model.reasoning.efforts.some(e => e?.id === effort);
}

function observeProviderTarget(directory, connection, sessionId) {
  let epoch = 0, previous, snapshot = null;
  const getSnapshot = () => {
    const link = connection.getSnapshot(), state = directory.getSnapshot();
    let keys;
    if (link && state.status === 'ready' && state.routable === true && state.current?.provider === 'openai-codex') {
      const groups = Array.isArray(state.groups) ? state.groups.filter(g => g?.id === state.current.provider) : [];
      const models = groups.length === 1 && Array.isArray(groups[0].models) && groups[0].models.filter(m => m?.id === state.current.model);
      if (models?.length === 1) {
        const model = models[0], effort = state.current.reasoningEffort === undefined ? model.reasoning?.defaultEffort : state.current.reasoningEffort;
        keys = [link, groups[0], model, effort, verifiedCodexReasoning(model, effort, state.current.reasoningEffort === undefined)];
      }
    }
    if (!keys) { previous = undefined; snapshot = null; }
    else if (!previous || keys.some((value,i) => value !== previous[i])) {
      previous = keys;
      snapshot = { io: link.io, target: { sessionId, provider: state.current.provider, model: state.current.model, epoch: ++epoch, reasoningActive: keys[4] } };
    }
    return snapshot;
  };
  // Observe each transition synchronously, even when React batches A → B → A.
  const subscribe = notify => {
    const changed = () => { getSnapshot(); notify(); };
    const offDirectory = directory.subscribe(changed), offConnection = connection.subscribe(changed);
    return () => { offDirectory(); offConnection(); };
  };
  return { getSnapshot, subscribe };
}

// One mounted opening owns one baseline per field. Never manufacture a fresh
// Option from a receipt. After submitting, reread explicitly before editing
// that field again; ambiguous receipts must not trigger more reads or writes.
function openProviderDrafts(io, target, isCurrent, publish) {
  const controller = new AbortController(), signal = controller.signal;
  let rows = [], busy = false;
  const current = () => !signal.aborted && isCurrent();
  const emit = () => publish({ rows, busy });
  const replace = (old, patch) => { rows = rows.map(r => r === old ? { ...r, ...patch } : r); emit(); };
  const editable = id => !busy && current() && rows.find(r => r.option.id === id && !r.result);
  return {
    async load() {
      if (!current() || busy) return;
      busy = true; rows = []; emit();
      let options;
      try { options = await io.read(target, signal); } catch { options = []; }
      if (!current()) return;
      busy = false; rows = options.map(option => ({ option, value: option.value })); emit();
    },
    edit(id, change) {
      const row = editable(id);
      if (!row) return;
      const value = change.reset === true ? row.option.reset : change.set;
      if (!row.option.editor.choices.includes(value)) return;
      replace(row, { value, change: value === row.option.value ? undefined : change });
    },
    cancel(id) { const row = editable(id); if (row) replace(row, { value: row.option.value, change: undefined }); },
    async save(id) {
      const row = editable(id);
      if (!row?.change) return;
      busy = true; emit(); // synchronous guard before the first await
      let result;
      try { result = await io.write(target, row.option, row.change, signal, current); }
      catch { result = 'unconfirmed'; }
      if (!current()) return;
      busy = false; replace(row, { result, change: undefined });
    },
    close() { controller.abort(); }
  };
}

const providerSaveText = { applied: '已保存', 'saved-not-live': '已保存，当前实例尚未同步', conflict: '设置已变更，请重新读取',
  refused: '未保存：目标不可写或连接器已拒绝', unconfirmed: '未确认，请重新读取；不会自动重试', stale: '目标已变化，请重新读取' };
const providerChoiceText = { default:'模型默认', low:'低', medium:'中', high:'高', auto:'自动（保留默认摘要）', concise:'简明', detailed:'详细', none:'无摘要（不关闭推理）',
  standard:'标准', fast:'快速', ultrafast:'极速（Beta）' };

function makeProviderOptionPanel(React) {
  const { createElement: h, useState, useRef, useLayoutEffect } = React;
  return function ProviderOptionPanel({ io, target, canEdit, isCurrent }) {
    const [view, setView] = useState({ rows: [] });
    const active = useRef(null), guard = useRef(isCurrent);
    guard.current = isCurrent;
    useLayoutEffect(() => {
      if (!canEdit) return;
      const drafts = openProviderDrafts(io, target, () => guard.current(), setView);
      active.current = drafts; void drafts.load();
      return () => { drafts.close(); active.current = null; };
    }, [io, target, canEdit]);
    if (!canEdit || !view.rows.length) return null;
    const scopes = [...new Set(view.rows.map(row => row.option.scope))];
    return h('section', { className: 'dmo-provider-options', 'aria-label': '服务商选项' },
      h('strong', null, '服务商选项'), scopes.map(scope => h('p', { key: scope },scope + '。')),
      view.rows.map(({option, value, change, result}) => {
        const disabled = view.busy || !!result, { id, label } = option;
        const confirmed = result === 'applied' || result === 'saved-not-live';
        const unavailable = !confirmed && option.editor.unavailableText;
        return h('div', { key: id, className: 'dmo-provider-field', 'data-provider-option': id },
          h('label', null, label, h('select', { value, disabled, 'aria-label': label, 'aria-description': option.notice, onChange: e => active.current?.edit(id, { set: e.target.value }) },
            unavailable && h('option', { value:option.value, disabled:true }, providerChoiceText[option.value] + '（此模型不支持）'),
            option.editor.choices.map(v => h('option', { key:v, value:v },providerChoiceText[v] ?? v)))),
          h('small', null, (confirmed ? '已读回：' : '编辑前：') + providerChoiceText[confirmed ? value : option.value] + (unavailable ? '；' + unavailable : '')),
          option.notice && h('p', null, option.notice),
          option.reset !== undefined && h('button', { type:'button', disabled, onClick: () => active.current?.edit(id,{reset:true}) }, '恢复默认'),
          h('button', { type:'button', disabled: disabled || !change, onClick: () => active.current?.cancel(id) }, '取消'),
          h('button', { type:'button', disabled: disabled || !change, onClick: () => void active.current?.save(id) }, '保存'),
          result && h('span', { role:'status' }, providerSaveText[result] ?? providerSaveText.unconfirmed));
      }),
      view.rows.some(r => r.result) && view.rows.some(r => r.change) && h('small', null, '重新读取会丢弃其他未保存的草稿。'),
      view.rows.some(r => r.result) && h('button', { type:'button', disabled:view.busy, onClick: () => void active.current?.load() }, '重新读取服务商选项'));
  };
}

const ICON_DATA = {"deepseek":"data:image/png;base64,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","openai":"data:image/png;base64,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","cline":"data:image/png;base64,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","qwen":"data:image/png;base64,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","qoder":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAKACAMAAAA7EzkRAAAAaVBMVEVMaXEHJRACCgQILBIAAAACDAUp2lwq21wZijkp21sIKxIAAAAAAAADEAYAAAAAAAAp21sp21sKOxgp21sp2lsp21sp2lsp2lsQVyQOSh8OUCIis0sitE0AAAAq21wYfjQQVyQdnEEmylWOuBptAAAAHXRSTlMAG/IyZvxFOQxd9YO+SNuf4vTSr5R3IslkrY3+YD7IHLEAAAAJcEhZcwAACxMAAAsTAQCanBgAABR/SURBVHja7d3bltpIEoVhARKIs7A4tF0j1eH9H7Kp8mHsdlUhQModmfHH1dzNavtbGRk7UjjLHNRovc7z5Xa7Wm0243HRvNZ4PN5sVqvtdpnn61FGUf1XOTmzW22+i/u8Nqvtcj0p+TOj+qG3zperTXN1bVZLjkPq3mNvewO932q8Wk74c6RuuuxtV0XTRxXno5CGTF2Hb9P0WsUqpx1T3a58y57x/Sy6MXWpJsue2u5HgwkGqQ/7br4dN8PXhl5Mvdd3V02oKlZr/sSp3/puPmzffbcVcwxS34++7aZRVLHlNsitL8yt78OpGILOB95GXVwG3Z59y01joiDo8d6Xrxo7tfmHvxFXtZbe+96rBQQdXfw2jcFa0Ih9RC6rxmp9YSJOf+4YN5YLgmnf/FaN+frCdiTZsXfTxFDFV96tJslv3MRSEOTqJyfI31lS/Iomthp/4+8tldRv20RZJNNpnH6R8oMgzZflCOWbH8l03MFLZJMvyXRalafB7zWTgWCEo++qSahIphl9IUh5u/yRTMdZ602TZi0gSPclmaaczL4QZPYlmaauGz6KxkNBkOGD5Qj13+Nv2ziq4isEjd3+No2vIpk2VcvGX0GQ44/lCPWa/RWN12I5YmD1sWo8F8m0OnwZN84LgkwfJNO0XwhStF+WI7Rft0UsGLhK2i8ECZ+NESQW5PrHcoTrH7EgxdMrCKab/nH94zeNuP6RTHP9o0imgxfXP57tkz6TTPP4gIIg4y/JNNs3imf7xC8k0x78FUiCoK5yFJFMEz9DEH8UyxH88Q8+4I8imcYfBDOeH1AsR/DHcgR/FMk0/iCIP4pkmvkXgvijWI7w/oDlCP4okulbag0NftOI96csR5zWhPf3xIIZ379BEH9UuEyG3zTK+P0DkmkWcBBkAUKRTBNAk0wTQFMQJAD0mEx/JYCheLYfvghgSKYZgCmvBBmAiQUZQCivBEsGEJ7tM4BQXpcjDCAk02xAKK8ERwwgPNvnAkh5XY5wASSZ5gJIeSXIBZBkmgsg5ZYgF0CWI1wAKa//GjYrYJLpjI8wqRt+06ikAVMNyxESGJYjJDAUyTSP8J0SXNOAKZJpGjAEacAUyxEaMMk0DZiCIA3YJUEaMNWwHGEHTDLNDpiCII+wWI7wCpoimf67JvxTcLEOuudavNXr/4o2mSYCjArd4unp8fH5+eGl/ateHh6eHx+fFouoftOICSSSu9zT47vq3q2Xh7PDIo5kmgkkCnrtDfXG0DpBdiCmG+7Z3kt7X50VFnaTaXYghg++u+39hdDes312IMnj+4XwzaCxZHrC37XBtts/vl8H4cIYQSIYayHL40M7aL2cDdpJpolgjPXdNkSde7EVgkQwDvrue/X8ZCKZJoIxcvQN3XffbcX63zTiFYy/o++PY1D9gzK8gjGgr1XWwz8lGbTjxvvSyuv0Pw5A9GkJTlUHIM8AdZ33oTVU9ZElHPc+dwRZwjlvvX/U7lByANJ6lVUFvgqO4MDhp+zDHICh+T231mt3YAROtZ5e2hjqNOMATPHq9xgHv4CHIAcg/D46BI8sQdKaPNrIajdnC5zQ6ddGWHXJAQg/aSY48CxScgDCT9mGeQjN6HGp9nwJEnONv8bN73UaLvkULtrajqZt9FUd+RY4zlqdf5I0AYDtbso7rBi7b/76h5wCwLads4WLbvZYfr86pQGwPbCFi6z7/vzBgUQADjEME0IP3H2TAtjWZDARzb5ZegB7F0gGM1Bt/vjnONIB2PdmmAxmmFr++deUEMB+BfIpyLDDR4oAe+3CjCCDZC9//TknBbBPgYwgA9z+3vmxx7QA9pfGMIIMfvtLEmBviTQjyLDDb7IAexLICNJ79vfBhJgcwHbKCGJ69ZE8wN2MEcRc+PLxjyynB7CP94E8xBp++kgXYA9vpHmIFaT9pgrw/jiQDjxs+Jc6wHtHYULA4afftAG2Mzqwjd1bfunPOlGA1V3XQD5HD9N+EwZ41zWQDtxX+tLhGEgV4D3XQDpwT9e/Ln/YyQK8PY/mB2ECXf/SBnj7NZAOHOj6lzjAm59m0YH78Nf1XzhNGOCNzxLowAHSPx8Ab2vCdOAelr/d/7hTBnhbE6YDh/SXNsCbFiLsge+tPAPgz3cxvMQKXuN1BsA74mjeQt/pb5IB8Lc4+sjXSCbjPy8Ar94J8zVSmPjPDcBrw0B+F78Z+PWBN4AnQhjL/tIHeOXP97IGCevPAcCr9iGEMAO/vnII8KoohitgYH8eAO5KroBm/XkAeM1KmCtgYH8uAHZPo7kChvbnAmD3I5ArYGh/PgB2vgVyBQztzwfAzoMwV8DQ/pwA7HgEcgUM7s8JwI5HIFfAUPsPdwArroA2/XkB2G0jzGv8Zvj3V04BdnkUU+IpuD83ALt8n8QHmc3A7+89A6z5HKT3KtYZAHtMYvgcJLw/PwA7JDHMIM1w3/8CsGIGaWS/fwDADmMIM0jABYhHgHv2IIYCaIcAL40hDMHXBIB9/ev0jgBe2oYwBF8RAI4yAPYdBfIWK2wA4w/g5z2YH+UIHMD4A/h5D2YIDhzAOARYMwRbGoD9Afy0BzMEBx9A3AH8tAczBHccQCYZAIfowWyCgw8g/gDuPvmTgFbIDZxTgJ/sg0lhwm5AnALck8Kon0D7BngihbF0AfQHsD2Swhi6ADoEOOebYEMXQIcA98SAhi6ADgFWxIA31zoD4HCXQB5jhXyC4BjgnC+SDDxBcAxwTw5t5wLoEeCJnwY0kgA6BdiWLEJsJIBeAU5ZhCh+BQuA7ac/0QHA8AmMU4A1mzg7DdgjwIpNnIUVnF+A708hAJQ0YJcAp6yCLaxA/AI8ANBMA3YJcM9bBDMN2CXAEwCNTMBOAe4AeM0OuARgiBdZAAy8A/YMcArAzrXKABjkSSDvUd+tYgTAMGMwAMNHgG4B1gA0EQG6BfheDlOgLXgE6Bbgjp8mMhEBugX43nMEtA39S5QA/DQIhFv4CNAvwCkAbUwgXgHOAWhjAvEK8ABAAzsQxwD3ALxcEwCGTKIBJ4hgAAhA3RL4R81bViEAVCyBPQOsACh+huoc4A6AFjJovwBbAF7IoIP5yw4ty2AAajJoxwCPADSQQb/VHoAAFB6ATgHOAGjkAAQgAKUHYFa3vMcCoO4AzE4ABKDwAMwqAAJQeABmu5YXqQDUHYBZC0AACg/AEoAAVB6ARwACULQFfqsZAAGoeQbj+EE0ABv9O0DXbxEA2KgfQvvexAHQygHodBMHQCsHoNNNHAAb7adw3jdxAGyk3wK7z6EB2Ch/DIEcGoAWtnCOY0AAWtjC+f0oE4AmtnCOY0AA2shg3MaAALSRwbhNYQBoIoPxm8IA0MYI4vUxFgCNjCBuh2AA2hhB3A7BAPy7FCOI2yEYgBa2II6HYACaGEH8DsEA/G+NJQfgFIAAFI4gXj8IAaCFh1iuZxAAmhhB/M4gAGy0XwN7n0EAaCEEdDyDANBEBz4AEIDCDux4BgGghQ7seAYBoIUOfGwBCEBhB54DEICN6i2+57dYADTRgT1fAQFooAN7vgIC0MAMPAcgAJUdeA9AAOpeYvm+AgJQ/hLL9xUQgI32c0zvV0AANtIfRHC+CAZgo/4a6fwWcAdAAL6uQcqMt4AAJIQBICEMIQwACWEA2PBBOq/xAZj6FfAEQAAKr4BlC0AACq+AcwACUHkFrAEIQOEV0PkaBIDqK6D7DgxA7RWwBiAA3xbBzMAAdHgFpAMDUPoW8ARAADa6DzKP+AOgcgY54A+AyhmEDgxA5Qwygx8AlTH0Hn4AFM4grOEAKJ1BCAEB+LNKRhAANs5+E4EQEIDSPQgjCAClQ3AFPgA2uh/lYAQBoHQIZgQBoHIRxwgCQOkQzAgCQOUmmC0IAKVDMA+xACjdBJPBAFCZwpDBAFCawpDBAFD5FIGXqABslD8Lw+foAFTGgITQAJTGgITQAFQ+xjoSQgNQmUNzAAJQmUOzhQOgNIdmCwdAJUAOwEsACxYhHIAADFijoAcgzxAuARyzieMABGCT5oN8boAAlG7iyAAvA9wAkCUIANNcBXMAAlC5CuYZTBeAKwDyDhCAKQLkIXQngFsAcgACMMHXWFO0dQK4BCCfwgEwPYB8C9wRYA5AXiEoAa55EE0GDcDUAJJBdwY4AiARjBJgCUAmECVAb++xciYQYwA3AGQCUQJcAZAJJFhNM++7uJwdiLJmmfdVSM4EYgxgDkDe4SsBrgFIBKgEOAIgDVgJ0NlvI+REgNYAbgBIBKgEuAUgz6CVAJcApAErAa4BSANWAhwBkAasBOhrDM5pwOYArgBIA1YC3AKQBqwEmAOwjx0wDfhWgBMAsgNWAnT1Kj/n16DtAVwBkAugEuASgCQwSoBrAHIBVAIcAZALoBKgpxdZOb+FahDgFoBcAJUA1wDkAqgEOAIgF0AlQEeXwN4BzvgMsweASwByAVQCXAOQC6ASoJ91cM4bQJMAtwDkM3QlwByADCBKgCMA8gZVCdDNk6weAZb8EGCPAHMAMgArAY4AyACsBOilB+cMwEYB5gDkDb4S4KgAIAGMEKCTHpwTwFgFuAYgLxCUAH3sg3MCQLMAlwAkAFQCnACQAFAJ0MUYkuPPLsAcgHwCogTo4dOQnAWIYYBLAOJPCdDBNiRnAWcYoIOX+XcBnLKAGxjgBID4UwJMP4nJ8Wca4ASA+FMCTP4IzJl/bQNcAxB/SoCpH4E5/owDXAMQf0qAiR+BOf6sA5wAkPcHSoBpr0Ny3l+ZB5j0RvhqgCXvn0MDTPoIzPn+wz7AcgxAvr8UAkz5aXSOvwgAJhzF5Kx/YwA4AeBr/Ic/FcB055Cc+C8KgOXGO0DiFynAZFfCXQEeiV+0AFNtwh0Bzhh/1QBHY8cAGT/0ABMNA3O2v7EATLMJ52zfogGY5CR8GeCU658RgNmkcAiQ9M8OwBR/KyYn/YsIYII74Zz2GxPA0cYVQNqvNYDpXQNzlh9RAUwuDcwJn+MCmFoa+BHAkvDZKMDEBpGc6SM2gGkNIjnHX2wAs8k4cYA8fbENMFsXKQMsCV+sA0zpdWrO8RchwITCmJzbX4wA09kK/wlwzvEXCcBkBP4O8MjLg3gApiIw/234YPURE8BEBOZ031gBprGU+wFwxsOD+AAmcQa+ATwy+0YJMIU0JufyFzHALC/iB8jlL2KA2Tr2vfA3Ln9RA4z+ZcIjCOIGmE02AKSEALNyC0BKCDDuOAaACQCMeRQBYAoAI74IAjAJgFm5BCAlBBhtGwZgKgCz0QqAlBDgeRouAEgJAcZ4CAIwJYDn1wljAFJCgNloC0BKCPA8Dm8ASAkBZmVMfRiA6QE89+ElACkhwPNubhEJwCcQJAkwy/5ZAJASAoyEIADTBZhl38YApIQAzwStb+cWIEgaYFZ+LQBI6QBaJ1iAIHWA51jwCwApIcBzLGiXIAg8ADRM8AUFLgCeHynYjAUfUOAEoNFk+hkFbgCaJMhrBE8ADS5HAOgLYFYaW46wi3MG0FoyDUB3AM/JtCGC7OIcArS0HGEV4hKgoWSaJNonQDMESaK9AjQSC5JE+wVogiBBoGeABgiSw/gGKF+OkMN4B6hejsDAO0DxcoQxGIDSZJoxGIDSWJAxGIBSgozBAPz1bP8L22AAuosF2QYDUEqQKQSA0mSaKQSAUoLsQgAoXY4whQBQuxxhFwJA6XKESyAApck0UTQApQS5BAJQuxzhEghAaTLNJRCAUoJcAgEoTaa5BAJQm0yzDgagNJmmBwNQSpB1MAC1yxGCGABKk2mCGABKCdKDAaiNBXmXD0ApQXowAKUE6cEA1C5H6MEAlC5H6MEAlCbT7IMBqE2myaIBKCXIPhiA0mS6YAwBoPTZPmMIAKWxIFEgALUEGUMAKE2mGUMAqCXIGAJA6XKEMQSA0uUI2xAAapNpjkAASpNpkhgAagnygTAApcsRjkAAapNpjkAASglyBAJQm0xzBAJQmkxzBAJQm0yTBQJQSpB1CAC1yxGOQABKk2ne5gNQS5B3gQDUxoI8jQaglCBRDAC1BJlDAChdjjCHAFC7HGEOAaA2mWYlDEBpMk0TBqCWIE04QB0zv3UxmaYJA3DYWi9owuIqM9/1eSxIEx66dpn7+pQgcfTAVQHw82SanfCwVcPvjeCHseCCa+CgtQffhWSaa+CgNcfeJYJcA8mhtck0aSBDsDSZJg0crk6g60CQQWSwOkCuy28a8TyaRZw2mWYUJobWEmQUpgNrlyMIpANrn+0TxjADS5PpIvGtcDWvg/9/TlF2BcG0Be7P7/KO+x0jiOHlSMICqx9nUXnYsQe2m0ynKnB3+P+z5HJecQCaJZimwPo/s+j8xAFo9suR5wSHj7//g2c1I7DVZPo5weHjnQowj/AQ6zaCSSXSp48VDE2QJcity5HHpLvv7ynUYcB55FQi6tZY8Cm92fejGmwe2bGEu4NgEu8D624EpjUTsK1kukgijqm7jwBDjMR8C3fncqSIexg+XbeE7X0e4WPg+5PpJzf8+p9HGED6IBjrRbC68frV3zyCv35iwSgvgtUdt/+e5hH89UYwujZ8unP47GMeqfHXWzK9WDwkfvfrfx5h/u13OfKYYvAy4DzCAq7vZPopikNwt+9x81DePI9UPEAYgKD9Q7A69H3vmp56fHlD3ZlMf7V9CNaDfPpz/TxS8QnSYLHgN7OZYLUfbOt/3Tyy4/Y3KMHA35N1PfyG3fl3n0d2B7rvwHWs7d38hn/y1G0eqeAXoma1qdYbauCcXTj8dzV3P28Ed/uwf+fTffWhvjmHnzOC1V5x4hzn+9OfCnen/Zxnz4K/Cek4otH360Y4m84PrzWfzrCn+2s4VJrGWx/4W6fu21Xd/tBgP+WyRWk6cVVz2aJEx+DudGDBT310DB5O9F0qTYP0XapzL95X4KPEB2Fd9YWPsIXSIDzb485H3deOp4f6tLth1t1jj+rvLHxlWHVxWJ3q816LnksNtjrd1/XpVFW77xx3u6qqTqd6v/e7T/0XA4QAqU3YXgcAAAAASUVORK5CYII=","trae":"data:image/png;base64,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"};
const SHELF_CSS = ".dmo-trigger{display:flex;align-items:center;gap:6px;max-width:min(480px,55cqw);min-width:0;height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);font:inherit;font-size:13px;cursor:pointer}.dmo-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dmo-trigger[aria-disabled=true]{opacity:.5;cursor:default}.dmo-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-trigger-copy{display:var(--dsh-composer-model-text-display,block);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:text;-webkit-user-select:text}.dmo-trigger:focus-visible,.dmo-panel button:focus-visible,.dmo-search:focus-visible,.dmo-effort:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-trigger:disabled,.dmo-panel button:disabled{opacity:.5;cursor:default}.dmo-panel{position:fixed;z-index:1200;box-sizing:border-box;width:min(640px,calc(100vw - 24px));max-height:min(720px,calc(100dvh - 32px));display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:14px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#222);box-shadow:0 8px 36px #0003;font-family:inherit;font-size:13px}.dmo-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 8px}.dmo-title{font-weight:600;font-size:15px}.dmo-panel button{font:inherit;color:inherit}.dmo-close{border:0;border-radius:6px;background:transparent;width:28px;height:28px;cursor:pointer}.dmo-hint{margin:0;padding:0 16px 10px;color:var(--dsw-alias-label-tertiary,#777);font-size:12px;line-height:1.5}.dmo-search{box-sizing:border-box;width:calc(100% - 32px);margin:0 16px 10px;padding:9px 11px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit}.dmo-tabs{display:flex;gap:6px;padding:0 16px 10px}\n.dmo-trigger-icon{display:var(--dsh-composer-model-icon-display,none);flex:none}\n.dmo-tabs{flex-wrap:wrap}\n.dmo-order{display:flex;flex:none;flex-direction:column;justify-content:center;gap:3px;padding:6px 2px}\n.dmo-order button{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:5px;background:transparent;padding:3px 5px;min-width:26px}\n.dmo-drag{cursor:grab;user-select:none;-webkit-user-select:none}\n.dmo-drag:active{cursor:grabbing}\n.dmo-order-status{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}\n.dmo-list [data-drop-target=true]{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:-2px}\n.dmo-group-top{display:flex;align-items:stretch;gap:8px}\n.dmo-group-top .dmo-group-heading{flex:1;min-width:0;width:auto}\n.dmo-group-top{padding-right:8px}\n.dmo-provider-actions{display:flex;flex:none;flex-direction:column;justify-content:center;align-items:stretch;gap:5px;padding:6px 0;max-width:110px}\n.dmo-provider-action{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:6px 8px;cursor:pointer;font-size:11px!important;overflow-wrap:anywhere}\n.dmo-provider-actions .dmo-note-action,.dmo-row-actions .dmo-note-action{align-self:stretch}\n.dmo-icon{width:24px;height:24px;flex:none;object-fit:contain;box-sizing:border-box}\nimg.dmo-icon[data-icon=openai]{background:#fff;border-radius:50%;padding:3px}\nimg.dmo-icon[data-icon=cline]{background:#fff;border-radius:6px;padding:3px}\nimg.dmo-icon[data-icon=qoder]{background:#fff;border-radius:6px;padding:3px}\nspan.dmo-icon{display:inline-flex;align-items:center;justify-content:center;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover,#eef1ff);color:var(--dsw-alias-label-secondary,#666);font-size:15px}\n.dmo-icon-wrap{position:relative;display:inline-flex;flex:none}\n.dmo-icon-setting{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--dsw-alias-label-secondary,#666);cursor:pointer}\n.dmo-icon-selected{position:absolute;right:-3px;bottom:-3px;color:var(--dsw-alias-state-business-primary,#4d6bfe);background:var(--dsw-alias-bg-layer-3,#fff);border-radius:50%;font-size:10px;line-height:1}\n.dmo-group-top[data-collapsed=true]{align-items:center;gap:4px}\n.dmo-group-top[data-collapsed=true]>.dmo-order{flex-direction:row;align-items:center;padding:6px 2px}\n.dmo-group-top[data-collapsed=true] .dmo-group-heading{padding:7px 4px;gap:5px}\n.dmo-group-top[data-collapsed=true] .dmo-group-name,.dmo-group-top[data-collapsed=true] .dmo-group-details{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.dmo-group-top[data-collapsed=true] .dmo-group-heading:focus .dmo-group-name,.dmo-group-top[data-collapsed=true] .dmo-group-heading:focus .dmo-group-details{overflow:visible;white-space:normal;overflow-wrap:anywhere}\n.dmo-group-top[data-collapsed=true]>.dmo-provider-actions{flex-direction:row;align-items:center;max-width:none;gap:4px}\n@media(max-width:520px){.dmo-group-top[data-collapsed=true]{flex-wrap:wrap}.dmo-group-top[data-collapsed=true] .dmo-group-heading{min-width:120px}.dmo-group-top[data-collapsed=true]>.dmo-provider-actions{margin-left:auto;padding-top:0}}\n.dmo-group>.dmo-row>.dmo-select{padding-left:2px;padding-right:14px}\n.dmo-list>.dmo-row{margin:6px 0;padding:6px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:10px}\n.dmo-panel>.dmo-note-editor{flex:none;margin:4px 16px 8px}\n.dmo-note-action{flex:none;align-self:center;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:6px 9px;cursor:pointer;font-size:11px!important}\n.dmo-account{display:block;color:var(--dsw-alias-state-business-primary,#4d6bfe);font-size:12px;font-weight:500;line-height:1.5;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}\n.dmo-row-actions{display:flex;flex:none;flex-direction:column;gap:5px;align-items:stretch;max-width:105px;margin-right:5px}\n.dmo-row-actions .dmo-move{margin-right:0;align-self:stretch}\n.dmo-favorite{padding:6px 8px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;font-size:11px!important;cursor:pointer}\n.dmo-favorite[aria-pressed=true]{color:var(--dsw-alias-state-business-primary,#4d6bfe);background:var(--dsw-alias-interactive-bg-hover,#eef1ff)}\n.dmo-note-editor{padding:10px;margin:4px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px}\n.dmo-note-label{display:block;font-size:12px;color:var(--dsw-alias-label-secondary,#666)}\n.dmo-note-input{display:block;box-sizing:border-box;width:100%;margin:6px 0 8px;padding:8px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:6px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit}\n.dmo-note-input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}\n.dmo-note-buttons{display:flex;gap:6px}\n.dmo-tab{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px;background:transparent;padding:7px 12px;cursor:pointer}.dmo-tab[aria-selected=true]{background:var(--dsw-alias-interactive-bg-hover,#eef1ff);color:var(--dsw-alias-state-business-primary,#4d6bfe);border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}.dmo-tools{display:flex;gap:6px;padding:0 16px 8px;color:var(--dsw-alias-label-tertiary,#777);font-size:12px;align-items:center}.dmo-tools button{border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:5px 9px;cursor:pointer;font-size:12px!important;color:inherit}.dmo-tools span{margin-left:auto}.dmo-list{padding:6px 8px 10px;overflow:auto;flex:1;min-height:0}.dmo-group{margin:6px 0;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:10px;overflow:hidden}.dmo-group-heading{display:flex;align-items:center;gap:8px;padding:9px 10px;width:100%;border:0;border-radius:0;background:transparent;text-align:left;cursor:pointer;user-select:text;-webkit-user-select:text}.dmo-group-heading[aria-disabled=true]{cursor:default;color:var(--dsw-alias-label-tertiary,#777)}.dmo-group-heading:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-group-title{display:flex;flex-direction:column;flex:1;min-width:0;user-select:text;-webkit-user-select:text}.dmo-count{flex:none;color:var(--dsw-alias-label-tertiary,#777);font-size:12px}.dmo-row{display:flex;align-items:stretch;gap:6px;padding:0 6px;border-top:1px solid var(--dsw-alias-border-l1,#ddd)}.dmo-row:hover,.dmo-row[data-highlighted=true]{background:var(--dsw-alias-interactive-bg-hover,#f2f4ff)}.dmo-select{flex:1;min-width:0;display:flex;align-items:center;gap:8px;text-align:left;padding:10px 8px;border:0;border-radius:8px;background:transparent;cursor:pointer;user-select:text;-webkit-user-select:text}.dmo-select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}.dmo-select[aria-disabled=true]{opacity:.5;cursor:default}.dmo-check{width:16px;flex:none;color:var(--dsw-alias-state-business-primary,#4d6bfe)}.dmo-copy{min-width:0;display:flex;flex-direction:column;gap:4px;user-select:text;-webkit-user-select:text}.dmo-name{font-weight:500;line-height:1.5;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}.dmo-identity{display:block;color:var(--dsw-alias-label-tertiary,#777);font-size:11px;line-height:1.5;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}.dmo-id{font-family:ui-monospace,Consolas,monospace}.dmo-move{flex:none;align-self:center;padding:6px 8px;max-width:105px;margin-right:5px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;font-size:11px!important;cursor:pointer}\n.dmo-empty{padding:24px 10px;text-align:center;line-height:1.6;color:var(--dsw-alias-label-tertiary,#777)}.dmo-error{padding:8px 16px;margin:0;color:var(--dsw-alias-state-error-primary,#c33);font-size:12px;overflow-wrap:anywhere}.dmo-current{padding:10px 16px;border-top:1px solid var(--dsw-alias-border-l1,#ddd);font-size:12px;line-height:1.6;flex:none;overflow-wrap:anywhere}.dmo-effort-label{display:flex;align-items:center;gap:8px;margin-top:6px}.dmo-effort{padding:5px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:6px;background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit;max-width:75%}\n@media(max-width:480px){.dmo-head{padding:12px}\n.dmo-move{max-width:76px}\n.dmo-trigger{max-width:48cqw}\n}\n.dmo-effort-source{flex:none;color:var(--dsw-alias-label-tertiary,#777);font-size:11px}\n.dmo-effort-reset{margin-top:6px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;background:transparent;padding:5px 9px;cursor:pointer;font-size:12px!important;color:inherit}\n.dmo-effort-reset:disabled{opacity:.5;cursor:default}\n.dmo-probe{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:6px 0 0;color:var(--dsw-alias-label-secondary,#666);font-size:12px;line-height:1.6}\n.dmo-probe .dmo-effort-reset{margin-top:0}\n.dmo-probe-ok{color:var(--dsw-alias-state-business-primary,#4d6bfe)}\n.dmo-probe-error{color:var(--dsw-alias-state-error-primary,#c33)}\n.dmo-provider-options{margin:8px 0;padding:8px 0;border-block:1px solid var(--dsw-alias-border-l1,#ddd);font-size:12px;line-height:1.5}\n.dmo-provider-options p{margin:2px 0 6px;color:var(--dsw-alias-label-secondary,#666)}\n.dmo-provider-field,.dmo-provider-field label{display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.dmo-provider-field+.dmo-provider-field{margin-top:6px}\n.dmo-provider-options button,.dmo-provider-options select{padding:3px 6px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:5px;color:inherit;background:var(--dsw-alias-bg-layer-2,#fff);font:inherit;cursor:pointer}\n.dmo-provider-options :disabled{opacity:.55;cursor:default}\n.dmo-probe-confirm{margin:6px 0 0;padding:8px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px;font-size:12px;line-height:1.6}\n";

// React and ReactDOM come from the running DSH client, never a second React copy.
const React = require('react');
const { createPortal } = require('react-dom');
const { createElement: h, useState, useRef, useEffect, useLayoutEffect, useSyncExternalStore, useId } = React;
// The Web loader requires every enabled entry to settle ACTIVE, even if no
// model picker exists. Only an owned child waits for picker capabilities.
const inject = [];

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

const ProviderOptionPanel = makeProviderOptionPanel(React);
function CurrentProviderOptions({ directory, connection, sessionId, editable }) {
  const source = React.useMemo(() => observeProviderTarget(directory, connection, sessionId), [directory, connection, sessionId]);
  const item = useSyncExternalStore(source.subscribe, source.getSnapshot);
  return item && h(ProviderOptionPanel, { key: item.target.epoch, ...item, canEdit: true,
    isCurrent: () => source.getSnapshot() === item && editable() });
}

function makeModelPicker(preferences, iconStore, providerConnection) {
  return function ModelPicker({ locked, available, directory, load, select, sessionId, isPrimarySession }) {
    const state = useSyncExternalStore(directory.subscribe.bind(directory), directory.getSnapshot.bind(directory));
    const prefs = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
    useSyncExternalStore(iconStore.subscribe, iconStore.getSnapshot);
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
    const opening = popupEpoch.current;
    const editable = () => mounted.current && opening === popupEpoch.current && !inFlight.current && !locked && available && isPrimarySession();
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
    const neededIcons = [...new Set([...shown.map(g => providerIcon(g.id)), ...visible.map(row => modelIcon(row.model.id, row.group.id))])].sort().join(',');
    useEffect(() => {
      iconStore.setEnabled(open && prefs.iconNetwork);
      if (open && prefs.iconNetwork) for (const key of neededIcons.split(',')) void iconStore.load(key);
      return () => iconStore.setEnabled(false);
    }, [open, prefs.iconNetwork, neededIcons]);
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
        const result = await select(request, resetEffort === true);
        if (!mounted.current || popupEpoch.current !== epoch) return;
        if (result?.ok !== true) {
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
    // Icons reflect catalog labels, not verification of the actual route.
    const icon = (kind, key) => {
      const source = iconStore.get(key);
      const selected = source ? key : 'default';
      const props = { className: `dmo-${kind}-icon dmo-icon`, 'data-icon': selected, 'aria-hidden': true };
      return selected !== 'default'
        ? h('img', { ...props, src: source, alt: '', draggable: false, onError: () => iconStore.discard(key) })
        : h('span', { ...props }, '◈');
    };
    const renderRow = (g, m) => {
      const key = modelKey(g.id, m.id);
      const archived = prefs.uncommonProviders.includes(g.id);
      const selected = state.current?.provider === g.id && state.current?.model === m.id;
      const accountSuffix = providerNote(prefs, g.id) ? `，账号备注 ${providerNote(prefs, g.id)}，服务商 ID ${g.id}` : '';
      return h('div', { className: 'dmo-row', key, 'data-model-key': key, 'data-provider-id': g.id, 'data-highlighted': activeRow?.key === key, ...(list === 'favorites' ? dropProps(key) : {}) },
        list === 'favorites' && orderControls(key, `${g.id} / ${m.id}`),
        h('div', { role: 'button', tabIndex: 0, className: 'dmo-select', 'aria-disabled': busy, 'aria-label': `选择 ${g.name || g.id} 的 ${m.name || m.id}，模型 ID ${m.id}${providerNote(prefs, g.id) ? '，账号备注 ' + providerNote(prefs, g.id) : ''}`, 'aria-pressed': selected, onClick: () => { if (!busy) choose({ provider: g.id, model: m.id }); }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) choose({ provider: g.id, model: m.id }); } } },
          h('span', { className: 'dmo-icon-wrap' }, icon('model', modelIcon(m.id, g.id)), selected && h('span', { className: 'dmo-icon-selected', 'aria-hidden': true }, '✓')),
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
          h('div', { className: 'dmo-group-top', 'data-collapsed': !expanded(g.id) }, orderControls(g.id, g.id), h('div', { role: 'button', tabIndex: 0, className: 'dmo-group-heading', 'aria-expanded': expanded(g.id), 'aria-disabled': searching, onClick: () => {
            if (!searching) preferences.update((p) => ({ ...p, collapsed: toggleKey(p.collapsed, groupKey(list, g.id)) }));
          }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!searching) preferences.update((p) => ({ ...p, collapsed: toggleKey(p.collapsed, groupKey(list, g.id)) })); } } },
            h('span', { 'aria-hidden': true }, expanded(g.id) ? '▾' : '▸'),
            icon('provider', providerIcon(g.id)),
            h('span', { className: 'dmo-group-title', title: `${g.name || g.id} · 服务商 ID：${g.id}${providerNote(prefs, g.id) ? ` · 账号备注：${providerNote(prefs, g.id)}` : ''}` },
              expanded(g.id) ? g.name || g.id : h('span', { className: 'dmo-group-name' }, g.name || g.id),
              expanded(g.id)
                ? [providerNote(prefs, g.id) && h('span', { className: 'dmo-account', key: 'note' }, `账号备注：${providerNote(prefs, g.id)}`), h('span', { className: 'dmo-identity', key: 'id' }, `服务商 ID：${g.id}`)]
                : h('span', { className: 'dmo-identity dmo-group-details' }, `服务商 ID：${g.id}${providerNote(prefs, g.id) ? ` · 账号备注：${providerNote(prefs, g.id)}` : ''}`)),
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
        available && !busy && sessionId && providerConnection && state.current?.provider === 'openai-codex' &&
          h(CurrentProviderOptions, { key: sessionId, directory, connection: providerConnection, sessionId, editable }),
        h('div', { className: 'dmo-identity' }, '分类、收藏、备注及折叠偏好保存在当前浏览器；不会自动分类。'),
        h('label', { className: 'dmo-icon-setting' }, h('input', { type: 'checkbox', checked: prefs.iconNetwork, onChange: e => preferences.update(p => ({ ...p, iconNetwork: e.target.checked })) }), '联网下载缺失图标（仅请求图标名称，下载后保存在本地）'),
        h('div', { className: 'dmo-identity' }, '图标依据目录标识，不验证实际上游。'),
        (localError || state.status === 'error' || state.failures?.length > 0) && h('button', { type: 'button', className: 'dmo-tab', onClick: () => { setLocalError(null); Promise.resolve().then(load).catch((e) => setLocalError(String(e.message ?? e))); } }, '重新加载')));
    return h(React.Fragment, null,
      h('div', { ref: trigger, role: 'button', tabIndex: 0, className: 'dmo-trigger', 'aria-label': `${title} · ${currentText}${labelEffort ? ` · ${labelEffort}` : ''}`, 'aria-disabled': locked, 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? popupId : undefined, title: `${currentText}${labelEffort ? ` · ${labelEffort}` : ''}`, onClick: () => { if (!locked) toggle(); }, onKeyDown: (e) => { if (e.nativeEvent?.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!locked) toggle(); } } },
        h('svg', { className: 'dmo-trigger-icon', width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' },
          h('path', { d: 'M3 3v13h14M6 4h3v9H6zM12 3l3-1 3 10-3 1z' })),
        h('span', { className: 'dmo-trigger-copy' }, `${currentNote ? currentNote + ' · ' : ''}${title}${labelEffort ? ` · ${labelEffort}` : ''}`), h('span', { 'aria-hidden': true }, busy ? '…' : open ? '▴' : '▾')),
      popup && createPortal(popup, document.body));
  };
}

const modelSeat = 'conversation.input.model';
const hasMethods = (object, ...names) => names.every(name => typeof object?.[name] === 'function');

// Older directories resolve void on both a committed selection and a superseded
// operation. Only a fresh, ready snapshot from this session can confirm it.
function confirmsLegacySelection(before, after, requested, resetEffort) {
  const current = after?.current;
  if (!current || before === after || after.status !== 'ready' || after.error !== null || after.pending != null || after.routable !== true) return false;
  if (!requested.provider || !requested.model || current.provider !== requested.provider || current.model !== requested.model) return false;
  if (resetEffort) return current.reasoningEffort === undefined;
  return requested.reasoningEffort === undefined || current.reasoningEffort === requested.reasoningEffort;
}

function pickerProps(ctx, sessionId) {
  // The real directory is session-owned. Never probe with a fabricated ID or RPC.
  const available = ctx.sessions.subagentAddress(sessionId) === undefined;
  const directory = ctx.modelDirectories.directoryFor(sessionId);
  if (!hasMethods(directory, 'load', 'select', 'resetConnected') || !hasMethods(directory.store, 'subscribe', 'getSnapshot')) return;
  const state = directory.store.getSnapshot();
  if (!Array.isArray(state?.groups) || typeof state.status !== 'string') return;
  return {
    available, directory: directory.store, sessionId,
    isPrimarySession: () => { try { return ctx.sessions.subagentAddress(sessionId) === undefined; } catch { return false; } },
    load: () => available ? directory.load() : undefined,
    select: async (selection, resetEffort = false) => {
      if (!available) return undefined;
      const before = directory.store.getSnapshot();
      let result;
      try { result = await directory.select(selection); }
      catch (error) {
        // Do not erase an authoritative refusal or reset a settled newer route.
        if (directory.store.getSnapshot().status === 'selecting') directory.resetConnected();
        throw error;
      }
      if (result !== undefined) return result;
      return { ok: confirmsLegacySelection(before, directory.store.getSnapshot(), selection, resetEffort) };
    },
  };
}

function apply(ctx) {
  if (!hasMethods(ctx, 'effect', 'inject') || typeof useSyncExternalStore !== 'function'
      || typeof useId !== 'function' || typeof createPortal !== 'function') return;
  ctx.inject(['slots', 'modelDirectories', 'sessions'], scope => {
    if (!hasMethods(scope.slots, 'inject', 'register', 'spec') || !hasMethods(scope.modelDirectories, 'directoryFor')
        || !hasMethods(scope.sessions, 'subagentAddress')) return;
    // directoryFor() inherits the consumer's Cordis bindings on a cold session.
    // Follow the native resolver's declared wire; never require both generations,
    // call the wire directly, or look up services through an unchecked root.
    const declared = scope.modelDirectories.constructor?.inject ?? [];
    const names = Array.isArray(declared) ? declared : Object.keys(declared);
    const wire = ['connection', 'remote', 'remote.session'].filter(key => names.includes(key));
    if (wire.length) scope.inject(wire, watchModelSeat);
    else watchModelSeat(scope);
  });
}

function watchModelSeat(ctx) {
  ctx.slots.inject(modelSeat, () => {
    const spec = ctx.slots.spec(modelSeat);
    if (spec?.kind !== 'single' || spec.scope !== 'session') return;
    return installShelf(ctx);
  });
}

function installShelf(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-model-shelf';
    style.textContent = SHELF_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  });
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('storage unavailable'); }, setItem() { throw new Error('storage unavailable'); } }; }
  const preferences = createPreferenceStore(storage, window);
  const iconStore = createIconStore({ storage, bundled: ICON_DATA, registry: DOWNLOADABLE_ICONS, fetcher: (...args) => window.fetch(...args) });
  ctx.effect(() => () => { preferences.dispose(); iconStore.dispose(); });
  const providerConnection = createProviderConnection();
  // A separate child: losing the optional RPC service never retires the seat.
  try {
    ctx.inject(['connection'], scope => scope.effect(() => {
      try { return providerConnection.attach(scope.connection); } catch { /* optional capability */ }
    }));
  } catch { /* An older host can reject the optional injection itself. */ }
  const ModelPicker = makeModelPicker(preferences, iconStore, providerConnection);
  let retired = false;
  const unregister = ctx.slots.register({ name: modelSeat, priority: -100,
    inject: sessionId => {
      if (!retired) {
        try {
          const props = pickerProps(ctx, sessionId);
          if (props) return props;
        } catch { /* Incompatible session scope or service getter. */ }
        retired = true;
        // Slot injection is evaluated during render. Changing the registry there
        // is unsafe; remove only this registration after the render stack unwinds.
        queueMicrotask(() => unregister());
      }
      return {};
    },
  }, props => props.directory ? h(ModelPicker, props) : null);
  return unregister;
}

return { apply, inject, makeModelPicker };
  }
});
