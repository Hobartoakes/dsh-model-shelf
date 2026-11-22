import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { x as untar, list } from 'tar';

const vendor = resolve(fileURLToPath(new URL('./vendor/', import.meta.url)));
const cacheRoot = join(vendor, 'hosts');
const registry = 'https://registry.npmjs.org';
const require = createRequire(import.meta.url);
const packageNames = {
  modelSelection: '@deepseek-ai/dsh-client-ui-model-selection', slots: '@deepseek-ai/dsh-client-ui-slots',
  store: '@deepseek-ai/dsh-client-store', renderer: '@deepseek-ai/dsh-client-ui-renderer', frontend: '@deepseek-ai/dsh-web-frontend', runtime: '@deepseek-ai/dsh-client-runtime', conversation: '@deepseek-ai/dsh-client-ui-conversation', modules: '@deepseek-ai/dsh-client-modules',
};
// Focused non-DOM regression suite. The wider browser contract uses each
// frontend's embedded modules, not these Node aliases or a primitives proxy.
const nodeVersions = new Set(['0.2.1-rc.2','0.2.1-rc.4','0.2.1-rc.5','0.2.2-alpha.2','0.2.2-rc.1','0.2.2-rc.3','0.2.2-rc.5','0.2.3-alpha.1']);
const cordisAliases = { '4.0.5': 'cordis-rc', '4.0.6-alpha.1': 'cordis-alpha', '4.1.0': 'cordis-current' };
let inventory;
async function hostRow(version) {
  inventory ??= JSON.parse(await readFile(new URL('./host-inventory/matrix.json', import.meta.url), 'utf8'));
  const row = inventory.hosts.find(h => h.version === version);
  if (!row?.components.modelSelection) throw new Error('unsupported host version: ' + version);
  return row;
}
async function download(url, request) {
  const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('host fixture download failed: ' + response.status + ' ' + url);
  return response;
}
async function verifiedArchive(row, key, cache, request, a = inventory.archives[row.components[key]]) {
  const name = packageNames[key];
  if (!a || a.name !== name || !/^\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?$/.test(a.version)) throw new Error('invalid host component: ' + key);
  const version = a.version, leaf = name.split('/')[1], directory = join(cache, version, leaf);
  const url = registry + '/' + name + '/-/' + leaf + '-' + version + '.tgz';
  if (a.tarball !== url) throw new Error('untrusted host fixture URL');
  const archivePath = join(directory, 'package.tgz');
  let archive, cold = false;
  try { archive = await readFile(archivePath); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    cold = true;
    const metadata = await (await download(registry + '/' + encodeURIComponent(name) + '/' + version, request)).json();
    if (metadata.name !== name || metadata.version !== version || metadata.dist?.tarball !== url || metadata.dist?.integrity !== a.integrity) {
      throw new Error('published host fixture metadata does not match pin: ' + name + '@' + version);
    }
    archive = Buffer.from(await (await download(url, request)).arrayBuffer());
  }
  const sha256 = createHash('sha256').update(archive).digest('hex');
  if ('sha512-' + createHash('sha512').update(archive).digest('base64') !== a.integrity || sha256 !== a.sha256) {
    throw new Error('host fixture integrity mismatch: ' + name + '@' + version);
  }
  if (cold) { await mkdir(directory, { recursive: true }); await writeFile(archivePath, archive); }
  return { archive, directory, receipt: { name, version, url, integrity: a.integrity, sha256 } };
}
function checkManifest(manifest, receipt) {
  if (manifest.name !== receipt.name || manifest.version !== receipt.version) throw new Error('host fixture manifest mismatch');
}
async function packageAt(row, key, cache, request) {
  const { archive, directory, receipt } = await verifiedArchive(row, key, cache, request);
  await pipeline(Readable.from([archive]), untar({ cwd: directory, strict: true, filter(path, entry) {
    return path.startsWith('package/') && !path.includes('\\') && !path.split('/').includes('..') && ['File','Directory'].includes(entry.type);
  } }));
  const root = join(directory, 'package');
  checkManifest(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')), receipt);
  await writeFile(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return { root, receipt };
}

// Run an unmodified published browser factory, resolving only declared imports.
// No global window/document is installed and no UI is rendered in these tests.
export async function loadClientFactory(file, id, modules, { document } = {}) {
  let result;
  const window = new EventTarget();
  window.__ModuleLoader__ = { load(entry) {
    if (entry.id !== id || result !== undefined) throw new Error(`unexpected client factory: ${entry.id}`);
    result = entry.factory((name) => {
      if (!Object.hasOwn(modules, name)) throw new Error(`unmapped client dependency: ${name}`);
      return modules[name];
    });
  } };
  const code = await readFile(file, 'utf8');
  new Function('window', 'document', code)(window, document);
  if (result === undefined) throw new Error(`missing client factory: ${id}`);
  return result;
}

// This cache needs no links. Reject pre-existing symlinks/junctions in its
// ancestors AND contents before any package fetch/read/write/extraction. This
// is a preflight check, not protection against hostile concurrent path swaps.
async function assertUnlinkedCache(vendor, cacheDirectory) {
  let path = vendor;
  for (const segment of ['', ...cacheDirectory.slice(vendor.length + 1).split(sep)]) {
    path = join(path, segment);
    let stat;
    try { stat = await lstat(path); }
    catch (error) {
      if (error.code === 'ENOENT') return; // Remaining descendants do not exist.
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`host fixture cache contains a symbolic link or junction: ${path}`);
  }
  const directories = [cacheDirectory];
  while (directories.length) {
    const directory = directories.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`host fixture cache contains a symbolic link or junction: ${path}`);
      if (entry.isDirectory()) directories.push(path);
    }
  }
}

async function checkedCache(cacheDirectory) {
  const cache = resolve(cacheDirectory);
  if (!cache.startsWith(vendor + sep)) throw new Error('host fixture cache must stay inside tests/vendor');
  await assertUnlinkedCache(vendor, cache);
  return cache;
}

export async function loadHostPackages(version, { cacheDirectory = cacheRoot, fetch: request = globalThis.fetch } = {}) {
  if (!nodeVersions.has(version)) throw new Error('unsupported host version: ' + version);
  const cache = await checkedCache(cacheDirectory), row = await hostRow(version), packages = {};
  for (const key of ['modelSelection','slots','store','renderer']) packages[key] = await packageAt(row, key, cache, request);
  const cordis = await import(cordisAliases[inventory.archives[row.components.cordis].version]);
  const slots = await import(pathToFileURL(join(packages.slots.root, 'lib/index.js')).href);
  const store = await import(pathToFileURL(join(packages.store.root, 'lib/index.js')).href);
  const modules = {
    '@deepseek-ai/cordis': cordis,
    '@deepseek-ai/dsh-client-ui-slots': slots,
    '@deepseek-ai/dsh-client-store': store,
    // These are only looked up by unrendered native controls. Calling one is
    // a harness error, never a successful fake implementation of the control.
    '@deepseek-ai/dsh-client-ui-primitives': new Proxy({}, { get: (_, key) => {
      if (key === '__esModule') return true;
      return () => { throw new Error(`native UI primitive unexpectedly rendered: ${String(key)}`); };
    } }),
    'react': require('react'),
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-dom': require('react-dom'),
    'react-dom/client': require('react-dom/client'),
  };
  const modelSelection = await loadClientFactory(join(packages.modelSelection.root, 'lib/client.js'), packageNames.modelSelection, modules);
  const renderer = await loadClientFactory(join(packages.renderer.root, 'lib/client.js'), packageNames.renderer, modules);
  return { version, cordis, slots, store, modelSelection, renderer, modules, packages };
}
// Only serve files actually present in the SRI-checked archive. A stale loose
// file in the cache can never become a browser route or an executable asset.
export async function loadPublishedWeb(version, { offline = false } = {}) {
  const row = await hostRow(version);
  const cache = await checkedCache(join(vendor, 'web-contract-archives'));
  const request = offline ? () => { throw Error('archive not cached for offline run: ' + version); } : globalThis.fetch;
  const assets = new Map(), clients = {}, receipts = {};
  const early = row.disposition === 'different-package-layout' ? JSON.parse(await readFile(new URL('./host-inventory/early-pins.json', import.meta.url), 'utf8'))[version] : undefined;
  if (row.disposition === 'different-package-layout' && !early) throw Error('missing early runtime pin: ' + version);
  for (const key of ['frontend','modelSelection','renderer','runtime','conversation','modules'].filter(k => k === 'runtime' || k === 'modules' ? !!early : row.components[k])) {
    const {archive,receipt} = await verifiedArchive(row, key, cache, request, key === 'runtime' ? early : key === 'modules' ? early.modules : undefined);
    let manifest;
    await pipeline(Readable.from([archive]), list({strict: true, onentry(entry) {
      if (entry.type !== 'File') return;
      const path = entry.path.replace(/^package\//, '');
      if (path.includes('\\') || path.split('/').includes('..')) return;
      const asset = key === 'frontend' && path.startsWith('dist/') && !path.endsWith('.map');
      if (!asset && path !== 'package.json' && path !== 'lib/client.js') return;
      const parts = []; entry.on('data', bytes => parts.push(bytes)); entry.on('end', () => {
        const bytes = Buffer.concat(parts);
        if (asset) assets.set('/' + path.slice(5), bytes);
        else if (path === 'package.json') manifest = JSON.parse(bytes.toString());
        else clients[key] = bytes.toString();
      });
    } }));
    checkManifest(manifest, receipt); receipts[key] = receipt;
  }
  if (!assets.has('/index.html') || !clients.modelSelection || (row.components.renderer && !clients.renderer)) throw Error('missing published web entry: ' + version);
  return { row, assets, clients, receipts };
}
