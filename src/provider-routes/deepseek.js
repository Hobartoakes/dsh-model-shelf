// Not registered by this module. The panel owns the ordinary-session, permission,
// connection-generation and epoch guards. Never ask the connector to discover models.
const deepSeekProviders = ['deepseek-official', 'deepseek-account'];
const deepSeekModels = ['deepseek-flash', 'deepseek-v4-pro'];
const deepSeekEditor = Object.freeze({ min: 1, max: Number.MAX_SAFE_INTEGER, unit: 'token' });
const deepSeekCount = n => Number.isSafeInteger(n) && n >= 1;
const deepSeekRecord = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function deepSeekOnly(rows, match) {
  if (!Array.isArray(rows)) return;
  const hits = rows.filter(match);
  return hits.length === 1 ? hits[0] : undefined;
}
function deepSeekSelected(target, state) {
  if (typeof target?.sessionId !== 'string' || !target.sessionId.trim() || !deepSeekCount(target.epoch) ||
      !deepSeekProviders.includes(target.provider) || !deepSeekModels.includes(target.model)) return false;
  if (state?.status !== 'ready' || state.routable !== true || state.current?.provider !== target.provider || state.current?.model !== target.model) return false;
  const group = deepSeekOnly(state.groups, row => row?.id === target.provider);
  return !!deepSeekOnly(group?.models, row => row?.id === target.model);
}
function deepSeekNamespace(rows, provider) {
  const entry = deepSeekOnly(rows, row => row?.provider === provider);
  if (typeof entry?.settingsNs !== 'string' || !entry.settingsNs.trim() || entry.error !== undefined || !Array.isArray(entry.settingsPath) || entry.settingsPath.length) return;
  if (deepSeekOnly(rows, row => row?.settingsNs === entry.settingsNs)) return entry.settingsNs;
}
function deepSeekOption(target, owner, descriptor) {
  if (descriptor?.writable !== true) return;
  const row = deepSeekOnly(descriptor.namespaces, r => r?.ns === owner);
  if (row?.applies !== 'live' || !Number.isSafeInteger(row.revision) || row.revision < 0) return;
  // Follow only this literal key in the host's serialized Schemastery projection.
  const root = row.schema?.refs?.[row.schema.uid];
  const field = row.schema?.refs?.[root?.dict?.maxTokens];
  if (root?.type !== 'object' || field?.type !== 'number' || field.meta?.step !== 1 || field.meta.min !== 1 || field.meta.max !== deepSeekEditor.max) return;
  const value = row.value?.maxTokens, base = row.base?.maxTokens;
  if (!deepSeekCount(value) || !deepSeekCount(base) || !deepSeekRecord(row.user)) return;
  const overridden = Object.hasOwn(row.user, 'maxTokens');
  if ((overridden ? row.user.maxTokens : base) !== value) return;
  // Configured per-model caps win outright; a listed cap can still tighten the default.
  if (target.provider === 'deepseek-official') {
    const model = deepSeekOnly(row.value.models, m => m?.id === target.model);
    if (!model || model.maxTokens !== undefined || row.value.modelOverrides !== undefined) return;
  } else {
    const overrides = row.value.modelOverrides;
    if (!deepSeekRecord(overrides) || row.value.models !== undefined || (Object.hasOwn(overrides, target.model) &&
      (!deepSeekRecord(overrides[target.model]) || overrides[target.model].maxTokens !== undefined))) return;
  }
  return Object.freeze({id: 'maxTokens', label: '默认最大输出 token 数', value, owner, revision: row.revision,
    editor: deepSeekEditor, ...(overridden ? {reset: base} : {}),
    scope: '影响使用此 DeepSeek 线路的其他会话；这是输出上限，不是上下文窗口。模型目录可进一步限制上限，单次请求显式指定的值优先' });
}

// llm/settings are the host's optional Remote namespaces. directory is the
// current session's already-loaded model directory, not an upstream catalog API.
export function createDeepSeekOptions({ llm, settings, directory } = {}) {
  const origins = new WeakMap();
  const same = (a, b) => a && b && a.sessionId === b.sessionId && a.epoch === b.epoch && a.provider === b.provider && a.model === b.model;
  async function read(target, signal) {
    try {
      const {sessionId, epoch, provider, model} = target;
      const origin = {sessionId, epoch, provider, model};
      const active = () => !signal?.aborted && same(target, origin) && deepSeekSelected(target, directory?.getSnapshot());
      if (!active() || typeof settings?.describe !== 'function' || typeof settings.mutate !== 'function' || typeof llm?.listConfigurableProviders !== 'function') return [];
      const owner = deepSeekNamespace(await llm.listConfigurableProviders(), target.provider);
      if (!owner || !active()) return [];
      const option = deepSeekOption(target, owner, await settings.describe());
      if (!option || !active()) return [];
      origins.set(option, origin);
      return [option];
    } catch { return []; }
  }
  async function write(target, expected, change, signal, isCurrent) {
    const origin = origins.get(expected);
    if (!same(target, origin) || !deepSeekRecord(change) || Reflect.ownKeys(change).length !== 1) return 'refused';
    const reset = Object.hasOwn(change, 'reset') && change.reset === true && expected.reset !== undefined;
    const next = reset ? expected.reset : Object.hasOwn(change, 'set') ? change.set : undefined;
    if (!deepSeekCount(next) || (!reset && next === expected.value)) return 'refused';
    const active = () => {
      try { return !signal?.aborted && same(target, origin) && isCurrent() === true && deepSeekSelected(target, directory?.getSnapshot()); }
      catch { return false; }
    };
    if (!active()) return 'stale';
    const [before] = await read(target, signal);
    if (!active()) return 'stale';
    if (!before || before.owner !== expected.owner) return 'refused';
    if (before.revision !== expected.revision || before.value !== expected.value || before.reset !== expected.reset) return 'conflict';
    const op = reset ? {op: 'unset', path: ['maxTokens']} : {op: 'set', path: ['maxTokens'], value: next};
    const matches = option => option?.owner === before.owner && option.value === next &&
      (reset ? option.reset === undefined : option.reset !== undefined);
    let revision;
    try {
      const receipt = await settings.mutate(before.owner, [op], before.revision);
      const saved = deepSeekOption(target, before.owner, {writable:true, namespaces:[receipt]});
      if (matches(saved) && saved.revision > before.revision) revision = saved.revision;
    } catch (e) {
      // Only the host's CAS failure is known to precede persistence. Other
      // errors can follow a committed patch (including a failed reconciliation).
      if (e?.code === 'settings/conflict') return active() ? 'conflict' : 'stale';
    }
    if (!active()) return 'stale';
    const [after] = await read(target, signal);
    if (!active()) return 'stale';
    return revision !== undefined && matches(after) && after.revision === revision ? 'applied' : 'unconfirmed';
  }
  return {read, write};
}
