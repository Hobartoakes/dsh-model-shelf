import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadClientFactory } from './host-packages.mjs';
const require = createRequire(import.meta.url);
const shelf = await loadClientFactory(new URL('../lib/client.js', import.meta.url), 'dsh-model-shelf', { react: require('react'), 'react-dom': require('react-dom') }, { document: { createElement: () => ({ dataset: {}, remove() {} }), head: { appendChild() {} } } });

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
