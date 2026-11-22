import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadClientFactory } from './host-packages.mjs';

const require = createRequire(import.meta.url);
const shelf = await loadClientFactory(new URL('../lib/client.js', import.meta.url), 'dsh-model-shelf',
  { react: require('react'), 'react-dom': require('react-dom') },
  { document: { createElement: () => ({ dataset: {}, remove() {} }), head: { appendChild() {} } } });
const initial = { provider: 'first', model: 'vendor/shared', reasoningEffort: 'high' };
const target = { provider: 'second', model: 'vendor/shared' };
const pinned = { ...target, reasoningEffort: 'low' };
const ready = current => ({ current, status: 'ready', error: null, routable: true, groups: [] });

// Inject through the shipped entry. The directory is a controllable boundary,
// not source-string matching; even the negative cases count every wire action.
function selectionFixture({ before = ready(initial), after, reply, thrown, child }) {
  let state = before, entry;
  const requests = [], resets = [];
  const directory = { store: { subscribe() {}, getSnapshot: () => state },
    load() { assert.fail('selection must not probe or reload the catalog'); },
    async select(selection) { requests.push(selection); if (after) state = after; if (thrown) throw thrown; return reply; },
    resetConnected() { resets.push(state.status); },
  };
  const ctx = { inject(_keys, use) { use(this); }, effect(setup) { setup(); }, sessions: { subagentAddress: () => child },
    modelDirectories: { directoryFor: () => directory },
    slots: { spec: () => ({ kind: 'single', scope: 'session' }), inject(_seat, use) { use(); }, register(options) { entry = options; return () => {}; } } };
  shelf.apply(ctx);
  assert.ok(entry, 'usable directory must register the shelf');
  return { props: entry.inject('session'), requests, resets };
}

for (const [label, request, config, success, resetEffort] of [
  ['confirmed crossing providers without an effort pin', target, { after: ready(target) }, true],
  ['confirmed requested effort', pinned, { after: ready(pinned) }, true],
  ['implicit effort may resolve to a host default', target, { after: ready(pinned) }, true],
  ['confirmed explicit reset clears the previous pin', target, { before: ready(pinned), after: ready(target) }, true, true],
  ['reset that still reports a pin', target, { before: ready(pinned), after: ready(pinned) }, false, true],
  ['old provider with the same model ID', pinned, { after: ready({ ...pinned, provider: initial.provider }) }, false],
  ['old model on the same provider', pinned, { after: ready({ ...pinned, model: 'other' }) }, false],
  ['old effort on the new route', pinned, { after: ready({ ...pinned, reasoningEffort: 'high' }) }, false],
  ['missing effort on a pinned route', pinned, { after: ready(target) }, false],
  ['unchanged ready snapshot, even on reselect', pinned, { before: ready(pinned) }, false],
  ['no changed snapshot', target, {}, false],
  ['no projected route', target, { after: ready(null) }, false],
  ['not ready', pinned, { after: { ...ready(pinned), status: 'selecting' } }, false],
  ['not routable', pinned, { after: { ...ready(pinned), routable: false } }, false],
  ['reported error', pinned, { after: { ...ready(pinned), error: 'offline' } }, false],
  ['pending intent is not a confirmation', pinned, { after: { ...ready(pinned), pending: pinned } }, false],
  ['null is not the old void contract', pinned, { after: ready(pinned), reply: null }, false],
  ['unstructured true is not an acknowledgement', pinned, { after: ready(pinned), reply: true }, false],
  ['explicit rejection wins even when the directory now matches', pinned, { after: ready(pinned), reply: { ok: false, error: { code: 'session/writer-held' } } }, false],
  ['modern acknowledgement does not wait for a projection', pinned, { reply: { ok: true } }, true],
]) {
  test('select: ' + label, async () => {
    const f = selectionFixture(config);
    const result = await f.props.select(request, resetEffort);
    assert.equal(result?.ok === true, success);
    if (config.reply?.ok === false) assert.equal(result, config.reply);
    assert.deepEqual(f.requests, [request]); assert.deepEqual(f.resets, []);
  });
}

test('thrown refusal/transport error are not success, even with a matching route', async () => {
  for (const status of ['error', 'selecting']) {
    const error = Error(status === 'error' ? 'writer held' : 'transport disconnected');
    const f = selectionFixture({ after: { ...ready(pinned), status }, thrown: error });
    await assert.rejects(f.props.select(pinned), e => e === error);
    assert.deepEqual(f.requests, [pinned]); assert.deepEqual(f.resets, status === 'selecting' ? ['selecting'] : []);
  }
});

test('addressed subagent never calls directory load or select', async () => {
  const f = selectionFixture({ child: { name: 'child' }, after: ready(pinned) });
  assert.equal(f.props.available, false); await f.props.load();
  assert.equal(await f.props.select(pinned), undefined); assert.deepEqual(f.requests, []); assert.deepEqual(f.resets, []);
});

// Three real Cordis releases, with minimal service faces to isolate activation.
// Nothing pre-warms a directory: the first consumer must have legitimate access
// to the services the installed resolver uses, not just find a cached directory.
for (const alias of ['cordis-rc', 'cordis-alpha', 'cordis-current']) {
  const { Context, Service } = await import(alias);
  for (const wire of ['connection', 'remote.session']) for (const order of ['shelf-first', 'resolver-first']) {
    test([alias, wire, order].join(' / '), async t => {
      const ctx = new Context(); t.after(() => ctx.fiber.dispose());
      const mount = async plugin => { const fiber = ctx.plugin(plugin); await fiber.await(); return fiber; };
      let entry, reads = 0;
      const directory = { store: { subscribe() {}, getSnapshot: () => ready(initial) }, load() {}, select() {}, resetConnected() {} };
      await mount(class extends Service {
        constructor(scope) { super(scope, 'slots'); }
        spec() { return { kind: 'single', scope: 'session' }; }
        inject(_seat, use) { this.ctx.effect(use); }
        register(options) { assert.equal(entry, undefined); entry = options; return () => { entry = undefined; }; }
      });
      async function services() {
        return mount(scope => {
          scope.provide('sessions', { subagentAddress: () => undefined });
          scope.provide('remote', { session: directory });
          if (wire === 'connection') scope.provide('connection', { api: { sessions: directory } });
          else scope.provide('remote.session', directory);
          scope.plugin(class extends Service {
            static inject = ['sessions', 'remote', wire];
            constructor(s) { super(s, 'modelDirectories'); }
            directoryFor() {
              reads++;
              if (wire === 'connection') return this.ctx.connection.api.sessions;
              assert.ok(this.ctx['remote.session']); return this.ctx.remote.session;
            }
          });
        });
      }
      let provider, plugin;
      if (order === 'shelf-first') {
        plugin = await mount(shelf);
        assert.equal(plugin.state, ctx.fiber.state, 'enabled entry must settle active without providers');
        assert.equal(entry, undefined);
        provider = await services();
      } else { provider = await services(); plugin = await mount(shelf); }
      assert.equal(plugin.state, ctx.fiber.state); assert.ok(entry, 'shelf must activate after both load orders');
      assert.equal(reads, 0, 'activation must not probe a fabricated session');
      assert.equal(entry.inject('only-session').directory, directory.store); assert.equal(reads, 1);
      await provider.dispose(); assert.equal(entry, undefined, 'provider removal withdraws only the shelf');
      assert.equal(plugin.state, ctx.fiber.state, 'root stays active after provider removal');
      await plugin.dispose(); await services(); assert.equal(entry, undefined, 'disposed shelf is not resurrected');
    });
  }
}
