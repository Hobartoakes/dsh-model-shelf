import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { x as untar } from 'tar';

const registry = 'https://registry.npmjs.org';
const cacheRoot = fileURLToPath(new URL('./vendor/hosts/', import.meta.url));
const require = createRequire(import.meta.url);
const packageNames = {
  modelSelection: '@deepseek-ai/dsh-client-ui-model-selection',
  slots: '@deepseek-ai/dsh-client-ui-slots',
  store: '@deepseek-ai/dsh-client-store',
  renderer: '@deepseek-ai/dsh-client-ui-renderer',
};
// Published npm dist.integrity, captured 2026-10-29. These are deliberately
// checked in: a moved dist-tag or modified cache must never change the matrix.
const pins = {
  '0.2.1-rc.2': {
    modelSelection: 'sha512-vQ/MfeWbhR8kEjKDxWnJ9Wf5RgltngVnq+8TAnfx5cA/4PDlUD/Fm4K3/KWAgUMz7pS+x4yno4ri3SHSsksb5g==',
    slots: 'sha512-/DroOBXeQzFczr07RkMh2FolFL8yW8GTryc7fvaM7QPiFvwHv8oWoBGESQ3AaVQHY9TgpYhJ5X8JuMtaYovE4A==',
    store: 'sha512-cYijKdEVbvROtorEcTl6ZkHMSbi2Utkh3pklaLQuC7aQl0FgMxXsnvNpmlx6AEjJkaZB+Quwmd3tH9EKFZf0dQ==',
    renderer: 'sha512-HYS0vcreOjVEyizEbPJdbH42w9RU+zWtVXdhrGdPAUdQKTgiX7K12WITv64/w8T2efbO+g94SBTswWjfxGKXoQ==',
  },
  '0.2.1-rc.4': {
    modelSelection: 'sha512-UfFq8ID9jZcvM/MQ8HHL5Zp8KE8ZvVjBNEs2lq5ecbj1oO0k0TAVw3uJZGNXHiltFqUzV/pzJ0+JCEG484Gw8w==',
    slots: 'sha512-0ESZvB9Pr9sCjs381M51w+Hos+H7In9seT4Tg/YRc/fZOo/Td4Ez42XGV7n4vN5pEHR6SXATHULgVtPIoxltNA==',
    store: 'sha512-4pyNXUq8/5c7swTrgA69XEKguV5U6ooVFpiNPUIFHHcW0T8egf6fi8ex9Mp+opnTjq8Bkwvme8iMHENxo3v6Hg==',
    renderer: 'sha512-KTCjcA2Wh5rQ5u+6wwFo3zS7dpQ4y7LZMf7yfU3HqqTzNnoeTtO9TiwqEKbqCNk+qDLvxnPG2S28PLZQ0s2vhw==',
  },
  // Official metadata verified 2026-10-30; all four peers require Cordis ~4.0.5.
  '0.2.1-rc.5': {
    modelSelection: 'sha512-aL/NDqqDZqLrdWgW80cq33auuaqTF7BOUKaJplP4S1LLAl8DsfKGsiuCNwagjmtoZOxE+3y3FPlg9LrsKgUY7w==',
    slots: 'sha512-CPqLPr1wYZAjxjwahcrud+Wf4sb5nKWqkukZOX3T/MLZ2lLJCOdDDlB5ji9ozLNCKwQw8nlcQPTiWzXMriNmMA==',
    store: 'sha512-CDi+x1DSXVVrSNflGjDa1dovyWbcQ4Gmyz200sk2TYL69X74LyfPrAWkGA66z4v10o4VlRQxFz6hJ5YDFhoi/w==',
    renderer: 'sha512-WJ3Rwg6f/5XPJwmqoDtYYC7DZZt6z9piQR1sOq1UwGrdY71l5QbwITnKPvVRZ5/WiHIdqmVdkAtCl19bwNcbKQ==',
  },
  '0.2.2-alpha.2': {
    modelSelection: 'sha512-Zo9qZlmNRZrwpSR3KOQma5hmP1vL93wXnWN0z4oewl0ikUeTmYJ52EMnieNFlxg6eseKd5+buDlHGRCt9LpuRQ==',
    slots: 'sha512-OOl2LZXuoR2hXr4WHdl8dFnp2eONepBaphhnQLYSd+EAvtOKoh2xA7Uj1NvESgyYAzRzkYgJEzbNl6an/K47hQ==',
    store: 'sha512-vGeI3ewFYtO3tUUmT0nd8SmcuDuMSJkj3G5MS1ovZRLgowMzqtUqii0GsYmOKLe6R/edIYdhvdVU6sahCZ2JXA==',
    renderer: 'sha512-aEqbZxnzudASF7C2mK6a6uNkDoSpfHYwJPNnYfOBqYCjHxVf/o7kHbt2F5AWkeHiqlcFc5W0JCs3Qg4m2oIiJg==',
  },
};

async function download(url, request) {
  const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`host fixture download failed: ${response.status} ${url}`);
  return response;
}

async function packageAt(version, key, cacheDirectory, request) {
  const name = packageNames[key];
  const leaf = name.split('/')[1];
  const directory = join(cacheDirectory, version, leaf);
  const archivePath = join(directory, 'package.tgz');
  const url = `${registry}/${name}/-/${leaf}-${version}.tgz`;
  const integrity = pins[version][key];
  let archive;
  try { archive = await readFile(archivePath); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const metadata = await (await download(`${registry}/${encodeURIComponent(name)}/${version}`, request)).json();
    if (metadata.name !== name || metadata.version !== version || metadata.dist?.tarball !== url || metadata.dist?.integrity !== integrity) {
      throw new Error(`published host fixture metadata does not match pin: ${name}@${version}`);
    }
    archive = Buffer.from(await (await download(url, request)).arrayBuffer());
  }
  const actual = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
  if (actual !== integrity) throw new Error(`host fixture integrity mismatch: ${name}@${version}`);
  await mkdir(directory, { recursive: true });
  await writeFile(archivePath, archive);
  // Never trust loose cached code. Re-extract the verified bytes before loading;
  // no scripts, links, or paths outside the official package subtree are used.
  await pipeline(Readable.from([archive]), untar({
    cwd: directory, strict: true,
    filter(path, entry) {
      if (!path.startsWith('package/') || path.includes('\\') || path.split('/').includes('..')) return false;
      return entry.type === 'File' || entry.type === 'Directory';
    },
  }));
  const packageRoot = join(directory, 'package');
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  if (manifest.name !== name || manifest.version !== version) throw new Error(`host fixture manifest mismatch: ${name}@${version}`);
  const receipt = { name, version, url, integrity, sha256: createHash('sha256').update(archive).digest('hex') };
  await writeFile(join(directory, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return { root: packageRoot, receipt };
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

// Options are test seams for isolated cache/network failure cases; neither the
// registry, package allowlist nor integrity pins can be overridden.
export async function loadHostPackages(version, { cacheDirectory = cacheRoot, fetch: request = globalThis.fetch } = {}) {
  if (typeof version !== 'string' || !Object.hasOwn(pins, version)) throw new Error(`unsupported host version: ${version}`);
  const vendor = resolve(fileURLToPath(new URL('./vendor/', import.meta.url)));
  cacheDirectory = resolve(cacheDirectory);
  if (!cacheDirectory.startsWith(vendor + sep)) throw new Error('host fixture cache must stay inside tests/vendor');
  await assertUnlinkedCache(vendor, cacheDirectory);
  const packages = {};
  // Fail before starting another fetch; a failed test never leaves hidden work.
  for (const key of Object.keys(packageNames)) packages[key] = await packageAt(version, key, cacheDirectory, request);
  const cordis = await import(version === '0.2.2-alpha.2' ? 'cordis-alpha' : 'cordis-rc');
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
