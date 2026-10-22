export const STORAGE_KEY = 'dsh-model-shelf.preferences.v1';
export const LEGACY_STORAGE_KEY = 'dsh-model-organizer.preferences.v1';
export const modelKey = (provider, model) => JSON.stringify([provider, model]);
export const groupKey = (list, provider) => JSON.stringify([list, provider]);
export const emptyPreferences = () => ({
  version: 1, uncommon: [], favorites: [], providerNotes: {}, collapsed: [],
  uncommonProviders: [], providerOrder: { main: [], uncommon: [] }, favoriteOrder: [], lastList: null
});
const stringKeys = (values) => [...new Set((Array.isArray(values) ? values : []).filter((key) => typeof key === 'string'))];
export const normalizeNote = (value) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) : '';
export const providerNote = (prefs, id) => Object.hasOwn(prefs.providerNotes ?? {}, id) ? normalizeNote(prefs.providerNotes[id]) : '';

export function normalizePreferences(value) {
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

export function toggleKey(values, key) {
  return values.includes(key) ? values.filter((value) => value !== key) : [...values, key];
}

// Visible projection only. To persist arrivals without losing offline identities, use
// orderedKeys(saved, [...saved, ...current]) before reordering the full result.
export function orderedKeys(savedKeys, currentKeys) {
  const current = new Set(currentKeys);
  return [...new Set([...savedKeys.filter((key) => current.has(key)), ...currentKeys])];
}

export function reorderKeys(keys, sourceKey, targetKey) {
  const result = [...keys];
  const source = keys.indexOf(sourceKey), target = keys.indexOf(targetKey);
  if (source < 0 || target < 0 || source === target) return result;
  result.splice(source, 1);
  result.splice(target, 0, sourceKey);
  return result;
}

export function isUncommon(prefs, providerId, modelId) {
  return (prefs.uncommonProviders ?? []).includes(providerId) || (prefs.uncommon ?? []).includes(modelKey(providerId, modelId));
}

export function setProviderUncommon(prefs, providerId, value) {
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
export function setFavorite(prefs, providerId, modelId, value) {
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
export function partitionModels(groups, prefs, list, query = '') {
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

export function favoriteRows(groups, prefs, query = '') {
  const rows = partitionModels(groups, prefs, 'favorites', query)
    .flatMap((group) => group.models.map((model) => ({ group, model, key: modelKey(group.id, model.id) })));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return orderedKeys(prefs.favoriteOrder ?? [], rows.map((row) => row.key)).map((key) => byKey.get(key));
}

export function createPreferenceStore(storage, events) {
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
