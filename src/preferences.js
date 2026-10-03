export const STORAGE_KEY = 'dsh-model-shelf.preferences.v1';
export const LEGACY_STORAGE_KEY = 'dsh-model-organizer.preferences.v1';
export const modelKey = (provider, model) => JSON.stringify([provider, model]);
export const groupKey = (list, provider) => JSON.stringify([list, provider]);
export const emptyPreferences = () => ({ version: 1, uncommon: [], collapsed: [] });

export function normalizePreferences(value) {
  if (!value || value.version !== 1) return emptyPreferences();
  const keys = (values) => [...new Set((Array.isArray(values) ? values : []).filter((key) => {
    if (typeof key !== 'string') return false;
    try { const tuple = JSON.parse(key); return Array.isArray(tuple) && tuple.length === 2 && tuple.every((x) => typeof x === 'string'); }
    catch { return false; }
  }))];
  return { version: 1, uncommon: keys(value.uncommon), collapsed: keys(value.collapsed) };
}

export function toggleKey(values, key) {
  return values.includes(key) ? values.filter((value) => value !== key) : [...values, key];
}

// Classification is exclusively explicit: no usage telemetry or frequency inference.
export function partitionModels(groups, prefs, list, query = '') {
  const uncommon = new Set(prefs.uncommon);
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return groups.map((group) => ({ ...group, models: group.models.filter((model) => {
    if (uncommon.has(modelKey(group.id, model.id)) !== (list === 'uncommon')) return false;
    const identity = `${group.name ?? ''} ${group.id} ${model.name ?? ''} ${model.id}`.toLocaleLowerCase();
    return tokens.every((token) => identity.includes(token));
  }) })).filter((group) => group.models.length > 0);
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
