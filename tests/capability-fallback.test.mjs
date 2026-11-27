import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadClientFactory } from './host-packages.mjs';
const require = createRequire(import.meta.url);
const shelf = await loadClientFactory(new URL('../lib/client.js', import.meta.url), 'dsh-model-shelf', { react: require('react'), 'react-dom': require('react-dom') }, { document: { createElement: () => ({ dataset: {}, remove() {} }), head: { appendChild() {} } } });

test('optional services never retire the native fallback', async () => {
  const route = { provider: 'openai-codex', model: 'gpt-5.4' };
  const native = { name: 'conversation.input.model' }, entries = [native], selections = [], calls = [];
  let detach, current = { ...route, reasoningEffort: 'high' };
  const observable = value => ({ getSnapshot: () => value, subscribe: () => () => {} });
  const directory = { store: { subscribe() {}, getSnapshot: () => ({ current, status: 'ready', groups: [], routable: true, error: null }) },
    load() {}, resetConnected() {}, async select(value) { selections.push(value); current = value; } };
  shelf.apply({
    inject(keys, use) {
      if (keys.length === 1 && keys[0] === 'connection') use({ effect: setup => { detach = setup(); },
        connection: { state: observable('connected'), generation: observable({ id: 1 }), rpc: { call: (...args) => calls.push(args) } } });
      else use(this);
    },
    effect: setup => setup(), sessions: { subagentAddress() {} }, modelDirectories: { directoryFor: id => id === 'normal' ? directory : null },
    slots: { spec: () => ({ kind: 'single', scope: 'session' }), inject: (_, use) => use(),
      register(entry) { entries.push(entry); return () => entries.splice(entries.indexOf(entry), 1); } },
  });
  assert.equal(typeof detach, 'function', 'optional service was actually attached');
  detach();
  assert.equal(entries.length, 2);
  const entry = entries[1];
  assert.equal(entry.children, undefined, 'the native picker still owns its child slots');
  const props = entry.inject('normal');
  assert.equal(props.available, true);
  assert.equal((await props.select(route, true)).ok, true, 'the legacy directory confirmed the explicit unpin');
  assert.deepEqual(selections, [route]);
  entry.inject('no-directory'); // a missing required capability does retire just the shelf
  await Promise.resolve();
  assert.deepEqual(entries, [native]);
  assert.deepEqual(calls, []);
});

for (const missing of ['effect', 'inject', 'slots.inject', 'slots.register', 'slots.spec', 'modelDirectories.directoryFor', 'sessions.subagentAddress']) {
  test('missing ' + missing + ' leaves the native seat untouched', () => {
    let registered = 0;
    const ctx = { inject(_deps, fn) { fn(this); }, effect: fn => fn(), modelDirectories: { directoryFor() {} }, sessions: { subagentAddress() {} }, slots: { spec: () => ({ kind: 'single', scope: 'session' }), inject: (_, fn) => fn(), register: () => { registered++; return () => {}; } } };
    const [object, key] = missing.split('.');
    if (key) delete ctx[object][key]; else delete ctx[object];
    shelf.apply(ctx);
    assert.equal(registered, 0);
  });
}
