import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelKey, groupKey, toggleKey, partitionModels, normalizePreferences, emptyPreferences, createPreferenceStore, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/preferences.js';
import * as preferences from '../src/preferences.js';
const groups = [
  { id: 'one', name: '服务商甲', models: [{ id: 'same', name: 'GPT 展示名' }, { id: 'other', name: '另一款' }] },
  { id: 'two', name: '服务商乙', models: [{ id: 'same', name: 'GPT 展示名' }] }
];

test('provider override keeps favorites and original model classification', () => {
  assert.equal(typeof preferences.setProviderUncommon, 'function');
  const original = { ...emptyPreferences(), uncommon: [modelKey('one', 'other')], favorites: [modelKey('one', 'same')], providerOrder: { main: ['one', 'offline', 'two'], uncommon: ['one', 'offline', 'two'] } };
  const archived = preferences.setProviderUncommon(original, 'one', true);
  assert.deepEqual(partitionModels(groups, archived, 'main').map((g) => g.id), ['two']);
  assert.deepEqual(partitionModels(groups, archived, 'favorites').map((g) => [g.id, g.models.map((m) => m.id)]), [['one', ['same']]]);
  assert.deepEqual(archived.uncommon, ['["one","other"]']);
  assert.deepEqual(archived.providerOrder, { main: ['one', 'offline', 'two'], uncommon: ['offline', 'two', 'one'] });
  assert.deepEqual(preferences.setProviderUncommon(archived, 'one', true), archived);
  const arrivals = groups.map((g) => g.id === 'one' ? { ...g, models: [...g.models, { id: 'new' }] } : g);
  assert.equal(preferences.isUncommon(archived, 'one', 'new'), true);
  assert.deepEqual(partitionModels(arrivals, archived, 'uncommon')[0].models.map((m) => m.id), ['same', 'other', 'new']);
  const restored = preferences.setProviderUncommon(archived, 'one', false);
  assert.equal(preferences.isUncommon(restored, 'one', 'same'), false);
  assert.equal(preferences.isUncommon(restored, 'one', 'other'), true);
  assert.deepEqual(restored.providerOrder, { main: ['offline', 'two', 'one'], uncommon: ['offline', 'two', 'one'] });
  assert.deepEqual(original.providerOrder.uncommon, ['one', 'offline', 'two']);
  assert.deepEqual(original.uncommonProviders, []);
});

test('ordering normalizes old data and keeps offline identity', () => {
  const old = { version: 1, uncommon: ['["one","other"]'], favorites: ['["one","same"]'], providerNotes: { one: 'account' }, collapsed: ['["main","one"]'] };
  const defaults = { uncommonProviders: [], providerOrder: { main: [], uncommon: [] }, favoriteOrder: [], lastList: null };
  assert.deepEqual(normalizePreferences(old), { ...old, ...defaults });
  const p = normalizePreferences({ ...old, uncommonProviders: ['one', 2, 'one'], providerOrder: { main: ['two', 'offline', 'one', 'two', null], uncommon: false }, favoriteOrder: ['["one","same"]', 'bad', 1, '["one","same"]', '["offline","m"]'], lastList: 'bogus' });
  assert.deepEqual(p.uncommonProviders, ['one']);
  assert.deepEqual(p.providerOrder, { main: ['two', 'offline', 'one'], uncommon: [] });
  assert.deepEqual(p.favoriteOrder, ['["one","same"]', '["offline","m"]']);
  assert.equal(p.lastList, null);
  const current = Object.freeze(['one', 'two', 'new']);
  Object.freeze(p.providerOrder.main);
  assert.deepEqual(preferences.orderedKeys(p.providerOrder.main, current), ['two', 'one', 'new']);
  assert.deepEqual(p.providerOrder.main, ['two', 'offline', 'one']);
  for (const providerOrder of [null, [], 'broken', 42]) {
    assert.deepEqual(normalizePreferences({ version: 1, providerOrder, uncommonProviders: {}, favoriteOrder: {} }).providerOrder, { main: [], uncommon: [] });
  }
});

test('reorderKeys moves by original target index without mutating or dropping offline keys', () => {
  assert.equal(typeof preferences.reorderKeys, 'function');
  const keys = Object.freeze(['one', 'offline', 'two', 'three']);
  assert.deepEqual(preferences.reorderKeys(keys, 'one', 'two'), ['offline', 'two', 'one', 'three']);
  assert.deepEqual(preferences.reorderKeys(keys, 'three', 'offline'), ['one', 'three', 'offline', 'two']);
  assert.deepEqual(preferences.reorderKeys(keys, 'missing', 'one'), keys);
  assert.deepEqual(preferences.reorderKeys(keys, 'one', 'missing'), keys);
  assert.deepEqual(preferences.reorderKeys(keys, 'one', 'one'), keys);
});

test('ordering is independent and refresh durable', () => {
  assert.equal(typeof preferences.setFavorite, 'function');
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const store = createPreferenceStore(storage);
  store.update((p) => ({ ...p, providerOrder: { main: ['one', 'offline', 'two'], uncommon: ['two', 'one'] }, lastList: 'favorites' }));
  store.update((p) => ({ ...p, providerOrder: { ...p.providerOrder, main: preferences.reorderKeys(p.providerOrder.main, 'two', 'one') } }));
  assert.deepEqual(store.getSnapshot().providerOrder, { main: ['two', 'one', 'offline'], uncommon: ['two', 'one'] });
  for (const [provider, model] of [['two', 'same'], ['offline', 'm'], ['one', 'same']]) store.update((p) => preferences.setFavorite(p, provider, model, true));
  assert.deepEqual(preferences.favoriteRows(groups, store.getSnapshot()).map((r) => r.key), ['["two","same"]', '["one","same"]']);
  store.update((p) => preferences.setFavorite(p, 'two', 'same', false));
  assert.deepEqual(store.getSnapshot().favoriteOrder, ['["offline","m"]', '["one","same"]']);
  store.update((p) => preferences.setFavorite(p, 'two', 'same', true));
  store.update((p) => preferences.setFavorite(p, 'one', 'same', true));
  assert.deepEqual(store.getSnapshot().favoriteOrder, ['["offline","m"]', '["one","same"]', '["two","same"]']);
  assert.deepEqual(createPreferenceStore(storage).getSnapshot(), store.getSnapshot());
  assert.equal(createPreferenceStore(storage).getSnapshot().lastList, 'favorites');
  assert.deepEqual(partitionModels(groups, store.getSnapshot(), 'main').map((g) => g.id), ['two', 'one']);
  const split = { ...store.getSnapshot(), uncommon: ['["one","other"]', '["two","same"]'], providerOrder: { main: ['one', 'two'], uncommon: ['two', 'one'] } };
  assert.deepEqual(partitionModels(groups, split, 'uncommon').map((g) => g.id), ['two', 'one']);
  assert.deepEqual(preferences.favoriteRows([...groups].reverse(), store.getSnapshot()).map((r) => r.key), ['["one","same"]', '["two","same"]']);
  assert.deepEqual(preferences.favoriteRows([...groups, { id: 'offline', models: [{ id: 'm' }] }], store.getSnapshot()).map((r) => r.key), ['["offline","m"]', '["one","same"]', '["two","same"]']);
  const arrivals = [...groups, { id: 'new', models: [{ id: 'm' }] }];
  assert.deepEqual(partitionModels(arrivals, store.getSnapshot(), 'main').map((g) => g.id), ['two', 'one', 'new']);
  // Persist full identity order, not the visible-only projection.
  store.update((p) => ({ ...p, providerOrder: { ...p.providerOrder, main: preferences.orderedKeys(p.providerOrder.main, [...p.providerOrder.main, ...arrivals.map((g) => g.id)]) } }));
  assert.deepEqual(createPreferenceStore(storage).getSnapshot().providerOrder.main, ['two', 'one', 'offline', 'new']);
  assert.deepEqual(partitionModels([...arrivals, { id: 'offline', models: [{ id: 'm' }] }], store.getSnapshot(), 'main').map((g) => g.id), ['two', 'one', 'offline', 'new']);
});

test('favoriteRows searches identities and notes, keeps same-name providers separate, and appends legacy favorites', () => {
  assert.equal(typeof preferences.favoriteRows, 'function');
  const p = { ...emptyPreferences(), favorites: ['["one","same"]', '["two","same"]'], favoriteOrder: ['["two","same"]', '["offline","m"]'], providerNotes: { two: 'personal' }, uncommonProviders: ['two'] };
  const rows = preferences.favoriteRows(groups, p);
  assert.deepEqual(rows.map((r) => [r.group.id, r.model.id, r.key]), [['two', 'same', '["two","same"]'], ['one', 'same', '["one","same"]']]);
  assert.deepEqual(preferences.favoriteRows(groups, p, 'PERSONAL same').map((r) => r.key), ['["two","same"]']);
  assert.deepEqual(preferences.favoriteRows(groups, p, 'other'), []);
  const added = preferences.setFavorite(p, 'one', 'other', true);
  assert.deepEqual(added.favoriteOrder, ['["two","same"]', '["offline","m"]', '["one","same"]', '["one","other"]']);
  assert.deepEqual(p.favoriteOrder, ['["two","same"]', '["offline","m"]']);
  const interleaved = { ...added, favoriteOrder: ['["one","other"]', '["two","same"]', '["one","same"]'] };
  assert.deepEqual(preferences.favoriteRows(groups, interleaved).map((r) => r.key), ['["one","other"]', '["two","same"]', '["one","same"]']);
});

test('organization fields sync across windows and retain local edits on storage failure', () => {
  const data = new Map(); let handler; let blocked = false; let notified = 0;
  const storage = { getItem: (k) => data.get(k) ?? null, setItem(k, v) { if (blocked) throw Error('blocked'); data.set(k, v); } };
  const store = createPreferenceStore(storage, { addEventListener(_, fn) { handler = fn; }, removeEventListener() {} });
  store.subscribe(() => notified++);
  const incoming = { ...emptyPreferences(), uncommonProviders: ['one'], providerOrder: { main: ['offline', 'two'], uncommon: ['one'] }, favoriteOrder: ['["one","same"]'], favorites: ['["one","same"]'], lastList: 'uncommon' };
  data.set(STORAGE_KEY, JSON.stringify(incoming)); handler({ key: 'unrelated' });
  assert.equal(notified, 0);
  handler({ key: STORAGE_KEY });
  assert.deepEqual(store.getSnapshot(), incoming); assert.equal(notified, 1);
  blocked = true;
  store.update((p) => ({ ...p, lastList: 'main' }));
  assert.equal(store.getSnapshot().lastList, 'main'); assert.ok(store.getError()); assert.equal(notified, 2);
  data.set(STORAGE_KEY, '{bad'); handler({ key: STORAGE_KEY });
  assert.equal(store.getSnapshot().lastList, 'main'); assert.ok(store.getError()); assert.equal(notified, 3);
  data.set(STORAGE_KEY, JSON.stringify({ version: 1, lastList: 'favorites', providerOrder: { main: ['two', false, 'two'] } }));
  handler({ key: STORAGE_KEY });
  assert.equal(store.getError(), null); assert.equal(store.getSnapshot().lastList, 'favorites');
  assert.deepEqual(store.getSnapshot().providerOrder, { main: ['two'], uncommon: [] });
  data.delete(STORAGE_KEY); handler({ key: null });
  assert.equal(store.getSnapshot().lastList, null);
});

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
