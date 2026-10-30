import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import semver from 'semver';
import { loadHostPackages, loadClientFactory } from './host-packages.mjs';

test('host loader rejects any version outside the tested matrix', async () => {
  for (const version of ['latest', '^0.2.1', '0.2.1-rc.3', '0.2.1-rc.6', '0.2.2-alpha.3', '../escape', '__proto__', null, ['0.2.1-rc.2']]) {
    await assert.rejects(loadHostPackages(version), /unsupported host version/);
  }
});

const vendorRoot = fileURLToPath(new URL('./vendor/', import.meta.url));
async function scratchCache(t) {
  await mkdir(vendorRoot, { recursive: true });
  const directory = await mkdtemp(join(vendorRoot, 'loader-test-'));
  t.after(async () => {
    // Only the generated child returned by mkdtemp is eligible for removal.
    assert.ok(resolve(directory).startsWith(resolve(vendorRoot) + sep + 'loader-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('host loader fails loudly on a cold-cache network failure', async t => {
  const cacheDirectory = await scratchCache(t);
  await assert.rejects(loadHostPackages('0.2.1-rc.2', { cacheDirectory,
    fetch: async () => { throw new Error('fixture network unavailable'); },
  }), /fixture network unavailable/);
});

test('host loader refuses corrupted cached archives before executing any factory', async t => {
  const cacheDirectory = await scratchCache(t);
  const directory = join(cacheDirectory, '0.2.1-rc.2', 'dsh-client-ui-model-selection');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'package.tgz'), 'not a verified npm archive');
  await assert.rejects(loadHostPackages('0.2.1-rc.2', { cacheDirectory,
    fetch: async () => { throw new Error('a corrupt cache must fail, not silently refetch'); },
  }), /host fixture integrity mismatch/);
});

const metadata = {
  name: '@deepseek-ai/dsh-client-ui-model-selection', version: '0.2.1-rc.2',
  dist: {
    tarball: 'https://registry.npmjs.org/@deepseek-ai/dsh-client-ui-model-selection/-/dsh-client-ui-model-selection-0.2.1-rc.2.tgz',
    integrity: 'sha512-vQ/MfeWbhR8kEjKDxWnJ9Wf5RgltngVnq+8TAnfx5cA/4PDlUD/Fm4K3/KWAgUMz7pS+x4yno4ri3SHSsksb5g==',
  },
};

test('host loader rejects HTTP errors, changed registry identity and changed published integrity', async t => {
  const cacheDirectory = await scratchCache(t);
  await assert.rejects(loadHostPackages('0.2.1-rc.2', { cacheDirectory,
    fetch: async () => new Response('', { status: 503 }),
  }), /host fixture download failed: 503/);
  for (const value of [
    { ...metadata, name: '@untrusted/model-selection' },
    { ...metadata, version: '0.2.1-rc.5' },
    { ...metadata, dist: { ...metadata.dist, tarball: 'https://untrusted.invalid/package.tgz' } },
    { ...metadata, dist: { ...metadata.dist, integrity: 'sha512-changed' } },
  ]) {
    await assert.rejects(loadHostPackages('0.2.1-rc.2', { cacheDirectory,
      fetch: async () => Response.json(value),
    }), /published host fixture metadata does not match pin/);
  }
});

test('host loader validates downloaded bytes rather than trusting metadata alone', async t => {
  const cacheDirectory = await scratchCache(t);
  await assert.rejects(loadHostPackages('0.2.1-rc.2', { cacheDirectory,
    fetch: async (url, options) => {
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      if (url.endsWith('.tgz')) return new Response('tampered response');
      assert.equal(url, 'https://registry.npmjs.org/%40deepseek-ai%2Fdsh-client-ui-model-selection/0.2.1-rc.2');
      return Response.json(metadata);
    },
  }), /host fixture integrity mismatch/);
});

test('host loader restores loose code from verified cache without network', async t => {
  const original = await hostFor('0.2.1-rc.2');
  const cacheDirectory = await scratchCache(t);
  for (const { root, receipt } of Object.values(original.packages)) {
    const directory = join(cacheDirectory, receipt.version, receipt.name.split('/')[1]);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.tgz'), await readFile(join(dirname(root), 'package.tgz')));
  }
  const loose = join(cacheDirectory, '0.2.1-rc.2', 'dsh-client-ui-slots', 'package', 'lib', 'index.js');
  await mkdir(dirname(loose), { recursive: true });
  await writeFile(loose, 'throw new Error("unverified loose code executed");');
  const restored = await loadHostPackages('0.2.1-rc.2', { cacheDirectory,
    fetch: async () => { throw new Error('verified cache must work offline'); },
  });
  assert.deepEqual(new restored.slots.SlotCore().spec('root'), { kind: 'single', scope: 'root' });
  assert.equal(await readFile(loose, 'utf8'), await readFile(join(original.packages.slots.root, 'lib/index.js'), 'utf8'));
});

test('host loader cannot redirect its cache outside tests/vendor', async () => {
  await assert.rejects(loadHostPackages('0.2.1-rc.2', { cacheDirectory: resolve(vendorRoot, '..') }), /cache must stay inside tests\/vendor/);
});

test('host loader creates an ordinary missing cache after link preflight', async t => {
  const original = await hostFor('0.2.1-rc.2');
  const cacheDirectory = join(await scratchCache(t), 'fresh', 'cache');
  const responses = new Map();
  for (const { root, receipt } of Object.values(original.packages)) {
    responses.set(`https://registry.npmjs.org/${encodeURIComponent(receipt.name)}/${receipt.version}`, () => Response.json({
      name: receipt.name, version: receipt.version, dist: { tarball: receipt.url, integrity: receipt.integrity },
    }));
    const archive = await readFile(join(dirname(root), 'package.tgz'));
    responses.set(receipt.url, () => new Response(archive));
  }
  const host = await loadHostPackages('0.2.1-rc.2', { cacheDirectory,
    fetch: async url => { assert.ok(responses.has(url)); return responses.get(url)(); },
  });
  assert.deepEqual(new host.slots.SlotCore().spec('root'), { kind: 'single', scope: 'root' });
  assert.deepEqual(await readdir(cacheDirectory), ['0.2.1-rc.2']);
});

// Real Windows junctions (directory symlinks elsewhere), not mocked path APIs.
// The external target is our own empty temporary directory plus a sentinel.
for (const [label, segments, missingChild = false] of [
  ['vendor boundary', null],
  ['cache root', []],
  ['cache ancestor', [], true],
  ['version directory', ['0.2.1-rc.2']],
  ['later package directory', ['0.2.1-rc.2', 'dsh-client-store']],
  ['unpacked package directory', ['0.2.1-rc.2', 'dsh-client-ui-model-selection', 'package']],
  ['unpacked library directory', ['0.2.1-rc.2', 'dsh-client-ui-model-selection', 'package', 'lib']],
  ['cached archive path', ['0.2.1-rc.2', 'dsh-client-ui-model-selection', 'package.tgz']],
]) {
  test(`host loader rejects an escaping link at ${label} before fetch or output`, async t => {
    const scratch = await scratchCache(t);
    const external = await mkdtemp(join(tmpdir(), 'shelf-containment-'));
    const sentinel = join(external, 'sentinel.txt');
    await writeFile(sentinel, 'outside cache: preserve me');
    let loader = loadHostPackages;
    let cacheDirectory = join(scratch, 'cache');
    let link;
    let linked = false;
    try {
      if (segments === null) {
        // Test the fixed vendor boundary itself without renaming the real cache.
        const copy = join(scratch, 'host-packages.mjs');
        await writeFile(copy, await readFile(new URL('./host-packages.mjs', import.meta.url)));
        loader = (await import(pathToFileURL(copy).href)).loadHostPackages;
        link = join(scratch, 'vendor');
        cacheDirectory = join(link, 'hosts');
      } else {
        link = join(cacheDirectory, ...segments);
        if (missingChild) cacheDirectory = join(cacheDirectory, 'not-created');
      }
      await mkdir(dirname(link), { recursive: true });
      await symlink(external, link, process.platform === 'win32' ? 'junction' : 'dir');
      linked = true;
      const before = (await readdir(scratch, { recursive: true })).sort();
      let fetches = 0;
      const error = await loader('0.2.1-rc.2', { cacheDirectory,
        fetch: async () => { fetches++; throw new Error('unexpected fetch through escaped cache'); },
      }).then(() => undefined, error => error);
      assert.equal(fetches, 0, 'containment rejection must precede all fetches');
      assert.match(error?.message ?? '', /host fixture cache contains a symbolic link or junction/);
      assert.deepEqual((await readdir(scratch, { recursive: true })).sort(), before, 'rejection must not create cache output');
      assert.deepEqual(await readdir(external), ['sentinel.txt']);
      assert.equal(await readFile(sentinel, 'utf8'), 'outside cache: preserve me');
    } finally {
      if (linked) {
        assert.ok((await lstat(link)).isSymbolicLink());
        assert.equal(await realpath(link), await realpath(external));
        await unlink(link); // Remove the link itself, never recursively follow it.
      }
      assert.ok(resolve(external).startsWith(resolve(tmpdir()) + sep + 'shelf-containment-'));
      assert.deepEqual(await readdir(external), ['sentinel.txt'], 'do not delete unexpected external output');
      assert.equal(await readFile(sentinel, 'utf8'), 'outside cache: preserve me');
      await unlink(sentinel); // Only the fixture-owned sentinel and now-empty dir.
      await rmdir(external);
    }
  });
}

const modelSeat = 'conversation.input.model';
const labelSeat = 'conversation.input.model.label';
const initial = { provider: 'provider-a', model: 'vendor/shared-model', reasoningEffort: 'high' };
const target = { provider: 'provider-b', model: 'vendor/shared-model', reasoningEffort: 'low' };
const catalogValue = {
  default: initial, routableProviders: ['provider-a', 'provider-b'], failures: [],
  groups: ['provider-a', 'provider-b'].map(id => ({ id, name: 'Same display name', models: [{
    id: 'vendor/shared-model', name: 'Shared display name',
    reasoning: { defaultEffort: 'medium', efforts: [{ id: 'low', name: 'Low' }, { id: 'medium', name: 'Medium' }, { id: 'high', name: 'High' }] },
  }] })),
};
const loaded = new Map();
async function hostFor(version) {
  if (!loaded.has(version)) loaded.set(version, loadHostPackages(version));
  return loaded.get(version);
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Only the wire RPCs and durable Session projection are synthetic. Real Cordis
// owns all contexts/effects; published Resolver/catalog/store and SlotRegistry /
// SlotCore own all directory and registration behavior. The three placeholder
// components below stand in for unrendered native UI, never for those services.
async function fixture(t, version, { order = 'native-first', declared = true } = {}) {
  const host = await hostFor(version);
  const ctx = new host.cordis.Context();
  t.after(() => ctx.fiber.dispose());
  const mount = async plugin => { const fiber = ctx.plugin(plugin); await fiber.await(); return fiber; };
  const projections = new Map();
  const bindings = new Map();
  const scopes = new Map();
  for (const id of ['session-a', 'session-b', 'child-session']) {
    const scope = await mount(() => {});
    const projected = host.store.createSnapshotStore({ next: initial });
    projections.set(id, projected);
    scopes.set(id, scope);
    bindings.set(id, { session: {
      projections: { faceOf(name) { assert.equal(name, 'modelSelection'); return projected; } },
      getSnapshot: () => ({ blank: false }),
    } });
  }
  const requests = [];
  let catalogCalls = 0;
  let catalog = catalogValue;
  let selectResponse = async request => {
    const { sessionId, ...selected } = request;
    return { ok: true, value: { selected } };
  };
  const wire = {
    async modelCatalog() { catalogCalls++; return { ok: true, value: catalog }; },
    async selectModel(request) { requests.push(structuredClone(request)); return selectResponse(request); },
  };
  const events = new Map();
  ctx.provide('remote', { session: wire, $on(name, callback) {
    if (!events.has(name)) events.set(name, new Set());
    events.get(name).add(callback);
    return () => events.get(name).delete(callback);
  } });
  ctx.provide('remote.session', wire);
  ctx.provide('sessions', {
    scope: id => scopes.get(id)?.ctx,
    binding: id => bindings.get(id),
    subagentAddress: id => id === 'child-session' ? { parentId: 'session-a', name: 'child' } : undefined,
  });
  await mount(host.renderer.SlotRegistry);
  await mount(host.modelSelection.ModelDirectoryResolver);
  const slots = ctx.get('slots');
  const resolver = ctx.get('modelDirectories');
  // The generated shelf apply() installs a style element. It is an unrendered
  // UI primitive here, not a DOM/layout test; no model or slot logic is stubbed.
  const document = {
    createElement(tag) { assert.equal(tag, 'style'); return { dataset: {}, remove() {} }; },
    head: { appendChild() {} },
  };
  const shelfModule = await loadClientFactory(new URL('../lib/client.js', import.meta.url), 'dsh-model-shelf', host.modules, { document });
  const Shell = () => null;
  const NativePicker = () => null;
  const NativeBadge = () => null;
  const shellModule = { inject: ['slots'], apply(scope) {
    scope.slots.register({ name: 'root', children: { [modelSeat]: { kind: 'single', scope: 'session' } } }, Shell);
  } };
  // Exact published native child declaration; the shelf must not claim it.
  const nativeModule = { inject: ['slots'], apply(scope) {
    scope.slots.inject(modelSeat, () => scope.slots.register({ name: modelSeat,
      children: { [labelSeat]: { kind: 'single', scope: 'session', inline: true } },
    }, NativePicker));
    scope.slots.inject(labelSeat, () => scope.slots.register({ name: labelSeat }, NativeBadge));
  } };
  let shell = declared ? await mount(shellModule) : undefined;
  let shelf, native;
  if (order === 'shelf-first') { shelf = await mount(shelfModule); native = await mount(nativeModule); }
  else { native = await mount(nativeModule); shelf = await mount(shelfModule); }
  return {
    host, ctx, slots, resolver, scopes, projections, requests, NativePicker, NativeBadge,
    get shelf() { return shelf; }, get native() { return native; }, get shell() { return shell; },
    remountShelf: async () => { shelf = await mount(shelfModule); },
    remountNative: async () => { native = await mount(nativeModule); },
    declare: async () => { shell = await mount(shellModule); },
    props: (id = 'session-a') => slots.entriesOfSlot(modelSeat)[0].inject(id),
    directory: (id = 'session-a') => resolver.directoryFor(id),
    replyWith: callback => { selectResponse = callback; },
    project: (selection, id = 'session-a') => projections.get(id).set({ next: selection }),
    refreshCatalog(value) { catalog = value; for (const callback of events.get('llm/adapters-updated')) callback(); },
    get catalogCalls() { return catalogCalls; },
  };
}

// Independent of the loader's pin table: accidentally dropping a pin must fail
// a required version's tests, never silently shrink the compatibility matrix.
for (const version of ['0.2.1-rc.2', '0.2.1-rc.4', '0.2.1-rc.5', '0.2.2-alpha.2']) {
  test(`${version}: shelf shares the real session store and preserves complete route/effort`, async t => {
    const f = await fixture(t, version);
    const props = f.props();
    const nativeDirectory = f.directory();
    assert.ok(nativeDirectory instanceof f.host.modelSelection.ModelDirectory);
    assert.equal(props.directory, nativeDirectory.store);
    assert.equal(f.props().directory, props.directory);
    const second = f.props('session-b');
    assert.notEqual(second.directory, props.directory);
    await Promise.all([props.load(), second.load()]);
    assert.equal(f.catalogCalls, 1, 'both sessions must reuse the real catalog load');
    assert.deepEqual(props.directory.getSnapshot().current, initial);
    const pending = deferred();
    f.replyWith(() => pending.promise);
    const selection = props.select(target);
    assert.deepEqual(f.requests, [{ sessionId: 'session-a', provider: 'provider-b', model: 'vendor/shared-model', reasoningEffort: 'low' }]);
    assert.equal(nativeDirectory.store.getSnapshot().status, 'selecting');
    assert.deepEqual(nativeDirectory.store.getSnapshot().pending, target);
    assert.deepEqual(second.directory.getSnapshot().current, initial);
    pending.resolve({ ok: true, value: { selected: target } });
    assert.deepEqual(await selection, { ok: true, value: undefined });
    // RPC acknowledgement alone is not the durable projection.
    assert.deepEqual(props.directory.getSnapshot().current, initial);
    f.project(target);
    assert.deepEqual(props.directory.getSnapshot().current, target);
    assert.equal(props.directory.getSnapshot().status, 'ready');
    assert.equal(props.directory.getSnapshot().pending, null);
  });

  test(`${version}: default effort remains absent on the wire, not an invented level`, async t => {
    const f = await fixture(t, version);
    const props = f.props();
    await props.load();
    await props.select({ provider: 'provider-a', model: 'vendor/shared-model' });
    assert.deepEqual(f.requests, [{ sessionId: 'session-a', provider: 'provider-a', model: 'vendor/shared-model' }]);
  });

  test(`${version}: refused selection retains the saved identity and allows a retry`, async t => {
    const f = await fixture(t, version);
    const props = f.props();
    await props.load();
    const refusal = { ok: false, error: { code: 'session/writer-held', message: 'Another window owns the writer' } };
    f.replyWith(async () => refusal);
    assert.equal(await props.select(target), refusal);
    assert.deepEqual(props.directory.getSnapshot().current, initial);
    assert.equal(props.directory.getSnapshot().status, 'error');
    assert.equal(props.directory.getSnapshot().pending, null);
    assert.match(props.directory.getSnapshot().error, /session\/writer-held/);
    f.replyWith(async () => { f.project(target); return { ok: true, value: { selected: target } }; });
    assert.equal((await props.select(target)).ok, true);
    assert.deepEqual(props.directory.getSnapshot().current, target);
    assert.equal(props.directory.getSnapshot().status, 'ready');
    assert.equal(props.directory.getSnapshot().error, null);
    assert.equal(f.requests.length, 2);
  });

  test(`${version}: rejected transport clears real selecting state before retry`, async t => {
    const f = await fixture(t, version);
    const props = f.props();
    await props.load();
    const pending = deferred();
    f.replyWith(() => pending.promise);
    const attempt = props.select(target);
    assert.equal(props.directory.getSnapshot().status, 'selecting');
    pending.reject(new Error('transport disconnected'));
    await assert.rejects(attempt, /transport disconnected/);
    assert.equal(props.directory.getSnapshot().status, 'ready');
    assert.equal(props.directory.getSnapshot().pending, null);
    assert.equal(props.directory.getSnapshot().error, null);
    assert.deepEqual(props.directory.getSnapshot().current, initial);
    f.replyWith(async () => { f.project(target); return { ok: true, value: { selected: target } }; });
    assert.equal((await props.select(target)).ok, true);
    assert.deepEqual(props.directory.getSnapshot().current, target);
    assert.equal(props.directory.getSnapshot().status, 'ready');
  });

  test(`${version}: reconnect invalidates a late refusal without undoing a newer selection`, async t => {
    const f = await fixture(t, version);
    const props = f.props();
    await props.load();
    const old = deferred();
    f.replyWith(() => old.promise);
    const obsolete = props.select(initial);
    f.ctx.emit('connection/reset');
    await props.load();
    f.replyWith(async () => { f.project(target); return { ok: true, value: { selected: target } }; });
    await props.select(target);
    old.resolve({ ok: false, error: { code: 'session/writer-held', message: 'obsolete refusal' } });
    assert.equal((await obsolete).ok, false);
    assert.deepEqual(props.directory.getSnapshot().current, target);
    assert.equal(props.directory.getSnapshot().status, 'ready');
    assert.equal(props.directory.getSnapshot().error, null);
    assert.equal(props.directory.getSnapshot().pending, null);
  });

  test(`${version}: missing provider retains saved route and effort across catalog refresh`, async t => {
    const f = await fixture(t, version);
    const props = f.props();
    await props.load();
    f.refreshCatalog({
      default: target, routableProviders: ['provider-b'],
      groups: [catalogValue.groups[1]],
      failures: [{ id: 'provider-a', name: 'Same display name', message: 'temporarily offline' }],
    });
    await props.load();
    assert.deepEqual(props.directory.getSnapshot().current, initial);
    assert.equal(props.directory.getSnapshot().retainedEffort, 'High');
    assert.equal(props.directory.getSnapshot().routable, false);
    assert.deepEqual(props.directory.getSnapshot().failures, [{ id: 'provider-a', name: 'Same display name', message: 'temporarily offline' }]);
    assert.deepEqual(f.requests, []);
    f.refreshCatalog(catalogValue);
    await props.load();
    assert.deepEqual(props.directory.getSnapshot().current, initial);
    assert.equal(props.directory.getSnapshot().routable, true);
  });

  test(`${version}: addressed subagents cannot load or submit through shelf callbacks`, async t => {
    const f = await fixture(t, version);
    const props = f.props('child-session');
    const loads = f.catalogCalls;
    assert.equal(props.available, false);
    assert.equal(await props.load(), undefined);
    assert.equal(await props.select(target), undefined);
    assert.equal(f.catalogCalls, loads);
    assert.deepEqual(f.requests, []);
    assert.notEqual(props.directory.getSnapshot().status, 'selecting');
    await assert.rejects(f.directory('child-session').select(target), /unavailable for addressed subagent sessions/);
  });

  for (const order of ['native-first', 'shelf-first']) {
    test(`${version}: ${order} preserves native label ownership and restores native on shelf disposal`, async t => {
      const f = await fixture(t, version, { order });
      const winner = f.slots.entriesOfSlot(modelSeat)[0];
      assert.equal(winner.options.priority, -100);
      assert.notEqual(winner.component, f.NativePicker);
      assert.equal(winner.children, undefined);
      assert.deepEqual(f.slots.entries(modelSeat).map(entry => entry.options.priority ?? 0), [-100, 0]);
      assert.deepEqual(f.slots.spec(labelSeat), { kind: 'single', scope: 'session', inline: true });
      assert.equal(f.slots.entriesOfSlot(labelSeat)[0].component, f.NativeBadge);
      await f.shelf.dispose();
      assert.equal(f.slots.entriesOfSlot(modelSeat)[0].component, f.NativePicker);
      assert.equal(f.slots.entriesOfSlot(labelSeat)[0].component, f.NativeBadge);
      await f.remountShelf();
      assert.equal(f.slots.entriesOfSlot(modelSeat)[0].options.priority, -100);
      await f.native.dispose();
      assert.equal(f.slots.spec(labelSeat), undefined, 'only the native entry owns its child declaration');
      assert.equal(f.slots.entriesOfSlot(modelSeat)[0].options.priority, -100);
      await f.remountNative();
      assert.equal(f.slots.entries(labelSeat).length, 1);
      assert.deepEqual(f.slots.entries(modelSeat).map(entry => entry.options.priority ?? 0), [-100, 0]);
    });
  }

  test(`${version}: pending slot injection follows declaration lifetime and never revives a disposed shelf`, async t => {
    const f = await fixture(t, version, { declared: false });
    assert.equal(f.slots.entries(modelSeat).length, 0);
    await f.declare();
    assert.equal(f.slots.entriesOfSlot(modelSeat)[0].options.priority, -100);
    await f.shell.dispose();
    assert.equal(f.slots.entries(modelSeat).length, 0);
    assert.equal(f.slots.spec(labelSeat), undefined);
    await f.declare();
    assert.deepEqual(f.slots.entries(modelSeat).map(entry => entry.options.priority ?? 0), [-100, 0]);
    await f.shell.dispose();
    await f.shelf.dispose();
    await f.declare();
    assert.deepEqual(f.slots.entries(modelSeat).map(entry => entry.component), [f.NativePicker]);
  });

  test(`${version}: session disposal prevents projection and late RPC from mutating the retained store`, async t => {
    const f = await fixture(t, version);
    const props = f.props();
    await props.load();
    const pending = deferred();
    f.replyWith(() => pending.promise);
    const selection = props.select(target);
    await f.scopes.get('session-a').dispose();
    const detached = props.directory.getSnapshot();
    f.project(target);
    pending.resolve({ ok: true, value: { selected: target } });
    await selection;
    assert.equal(props.directory.getSnapshot(), detached);
  });
}

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
// A widened range accidentally admits unverified runtimes; an rc.2-only range
// incorrectly refuses the newly verified releases. Use the host's real
// SemVer interpretation, not string membership or a homemade parser.
for (const [version, admitted] of [
  ['0.2.1-rc.2', true], ['0.2.1-rc.4', true], ['0.2.1-rc.5', true], ['0.2.2-alpha.2', true],
  ['0.2.0-rc.2', false], ['0.2.1-rc.3', false], ['0.2.1-rc.6', false],
  ['0.2.2-alpha.3', false], ['0.2.1', false], ['0.2.2', false], ['0.3.0', false],
]) {
  test(`manifest admission ${version}: ${admitted ? 'allow' : 'deny'}`, () => {
    assert.equal(semver.satisfies(version, manifest.engines.dsh, { includePrerelease: true }), admitted);
  });
}
