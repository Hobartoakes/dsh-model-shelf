import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelKey, groupKey, toggleKey, partitionModels, normalizePreferences, emptyPreferences, createPreferenceStore, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/preferences.js';
const groups = [
  { id: 'one', name: '服务商甲', models: [{ id: 'same', name: 'GPT 展示名' }, { id: 'other', name: '另一款' }] },
  { id: 'two', name: '服务商乙', models: [{ id: 'same', name: 'GPT 展示名' }] }
];

test('all models start in main; uncommon list is strictly manual', () => {
  const p = emptyPreferences();
  assert.equal(partitionModels(groups, p, 'main').flatMap((g) => g.models).length, 3);
  assert.deepEqual(partitionModels(groups, p, 'uncommon'), []);
});
test('same model id from different providers is classified separately and reversible', () => {
  const key = modelKey('one', 'same');
  const p = { ...emptyPreferences(), uncommon: [key] };
  assert.equal(partitionModels(groups, p, 'main').flatMap((g) => g.models).length, 2);
  assert.equal(partitionModels(groups, p, 'uncommon')[0].id, 'one');
  p.uncommon = toggleKey(p.uncommon, key);
  assert.equal(partitionModels(groups, p, 'main').flatMap((g) => g.models).length, 3);
});
test('identity keys cannot collide on provider/model punctuation', () => {
  assert.notEqual(modelKey('a/b', 'c'), modelKey('a', 'b/c'));
  assert.notEqual(groupKey('main', 'one'), groupKey('uncommon', 'one'));
});
test('search matches display name, model id and provider source; respects list boundary', () => {
  assert.equal(partitionModels(groups, emptyPreferences(), 'main', '服务商乙 same')[0].id, 'two');
  assert.equal(partitionModels(groups, emptyPreferences(), 'main', 'gpt').length, 2);
  assert.deepEqual(partitionModels(groups, emptyPreferences(), 'uncommon', 'gpt'), []);
});
test('malformed persisted values are sanitized', () => {
  assert.deepEqual(normalizePreferences({ version: 2 }), emptyPreferences());
  const k = modelKey('one', 'same');
  assert.deepEqual(normalizePreferences({ version: 1, uncommon: [k, k, 'invalid', '{}', '[[1],2]', 0], collapsed: null }), { ...emptyPreferences(), uncommon: [k] });
});
test('preferences survive refresh, retain temporarily absent models and notify subscribers', () => {
  const data = new Map(); const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const store = createPreferenceStore(storage); let notified = 0; store.subscribe(() => notified++);
  const key = modelKey('temporarily-offline-provider', 'same');
  store.update((p) => ({ ...p, uncommon: [key], collapsed: [groupKey('main', 'one')] }));
  assert.equal(notified, 1);
  assert.deepEqual(createPreferenceStore(storage).getSnapshot(), store.getSnapshot());
  assert.ok(data.has(STORAGE_KEY));
});
test('corrupt or unavailable storage does not crash; reports nonpersistent mode', () => {
  const store = createPreferenceStore({ getItem() { return '{bad'; }, setItem() { throw Error('blocked'); } });
  assert.ok(store.getError());
  store.update((p) => ({ ...p, uncommon: [modelKey('one', 'same')] }));
  assert.equal(store.getSnapshot().uncommon.length, 1);
  assert.ok(store.getError());
});
test('favorites are a manual overlay independent of main/uncommon and provider identities', () => {
  const k = modelKey('one', 'same');
  const p = { ...emptyPreferences(), favorites: [k], uncommon: [k] };
  assert.equal(partitionModels(groups, p, 'favorites').length, 1);
  assert.equal(partitionModels(groups, p, 'favorites')[0].id, 'one');
  assert.equal(partitionModels(groups, p, 'main').flatMap((g) => g.models).length, 2);
  assert.equal(partitionModels(groups, p, 'uncommon')[0].models.length, 1);
  p.favorites = toggleKey(p.favorites, k);
  assert.deepEqual(partitionModels(groups, p, 'favorites'), []);
  assert.deepEqual(p.uncommon, [k]);
});
test('old v1 data keeps classification and folds while new fields default empty', () => {
  const old = { version: 1, uncommon: [modelKey('one', 'same')], collapsed: [groupKey('main', 'one')] };
  assert.deepEqual(normalizePreferences(old), { ...emptyPreferences(), uncommon: old.uncommon, collapsed: old.collapsed });
});
test('account notes distinguish same-platform providers and participate in search', () => {
  const samePlatform = groups.map((g) => ({ ...g, name: '同一平台' }));
  const p = normalizePreferences({ ...emptyPreferences(), providerNotes: { one: '  工作账号  ', two: '个人账号' } });
  assert.equal(p.providerNotes.one, '工作账号');
  assert.equal(partitionModels(samePlatform, p, 'main', '工作账号 same')[0].id, 'one');
  assert.equal(partitionModels(samePlatform, p, 'main', '个人账号 same')[0].id, 'two');
  const sanitized = normalizePreferences({ ...p, favorites: ['bad', modelKey('one', 'same')], providerNotes: { one: '', two: 123, long: 'x'.repeat(200), html: '<img src=x onerror=alert(1)>' } });
  assert.equal(sanitized.providerNotes.one, undefined);
  assert.equal(sanitized.providerNotes.two, undefined);
  assert.equal(sanitized.providerNotes.long.length, 120);
  assert.equal(sanitized.providerNotes.html, '<img src=x onerror=alert(1)>');
  assert.equal(sanitized.favorites.length, 1);
});
test('favorites and account notes survive reload, retain missing providers, and sync by storage event', () => {
  const data = new Map(); let handler;
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const store = createPreferenceStore(storage, { addEventListener: (_, fn) => handler = fn, removeEventListener() {} });
  store.update((p) => ({ ...p, favorites: [modelKey('absent', 'model')], providerNotes: { absent: '备用账号' } }));
  assert.deepEqual(createPreferenceStore(storage).getSnapshot(), store.getSnapshot());
  data.set(STORAGE_KEY, JSON.stringify({ ...emptyPreferences(), providerNotes: { two: '个人账号' } }));
  handler({ key: STORAGE_KEY });
  assert.equal(store.getSnapshot().providerNotes.two, '个人账号');
});
test('renamed plugin imports old prototype preferences once without deleting legacy data', () => {
  const legacy = { ...emptyPreferences(), uncommon: [modelKey('one', 'same')] };
  const data = new Map([[LEGACY_STORAGE_KEY, JSON.stringify(legacy)]]);
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.deepEqual(createPreferenceStore(storage).getSnapshot(), legacy);
  assert.ok(data.has(STORAGE_KEY)); assert.ok(data.has(LEGACY_STORAGE_KEY));
  data.set(STORAGE_KEY, JSON.stringify(emptyPreferences()));
  assert.deepEqual(createPreferenceStore(storage).getSnapshot(), emptyPreferences());
});
test('storage events sync other windows and disposal unsubscribes', () => {
  const data = new Map(); let handler; let removed;
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const events = { addEventListener: (_, fn) => handler = fn, removeEventListener: (_, fn) => removed = fn };
  const store = createPreferenceStore(storage, events);
  data.set(STORAGE_KEY, JSON.stringify({ ...emptyPreferences(), uncommon: [modelKey('two', 'same')] }));
  handler({ key: STORAGE_KEY }); assert.equal(store.getSnapshot().uncommon.length, 1);
  data.delete(STORAGE_KEY); handler({ key: null }); assert.deepEqual(store.getSnapshot(), emptyPreferences());
  store.dispose(); assert.equal(removed, handler);
});
test('storage read failures publish a new snapshot so error messages rerender', () => {
  let blocked = false, handler;
  const store = createPreferenceStore({ getItem() { if (blocked) throw Error('blocked'); return null; }, setItem() {} }, { addEventListener(_, fn) { handler = fn; }, removeEventListener() {} });
  const previous = store.getSnapshot(); blocked = true;
  handler({ key: STORAGE_KEY });
  assert.notEqual(store.getSnapshot(), previous);
  assert.ok(store.getError());
});
