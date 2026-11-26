// Test-only. A warm cache is bytes, never executable loose files. Offline each
// run unpacks verified archives into a fresh profile; no package lifecycle runs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { x as untar } from 'tar';
export const pins = JSON.parse(await readFile(new URL('pins.json', import.meta.url)));
const vendor = fileURLToPath(new URL('../vendor', import.meta.url));
const cache = join(vendor, 'codex-roundtrip', 'archives');
export async function checkedDirectory(path) {
  await mkdir(path, { recursive: true });
  assert.ok((await lstat(path)).isDirectory(), 'fixture path must be a concrete directory');
}
export async function archives({ prepare = false, into } = {}) {
  for (const path of [vendor, join(vendor, 'codex-roundtrip'), cache]) await checkedDirectory(path);
  // Bound download/extraction concurrency, including cold starts on Windows.
  for (let i = 0; i < pins.archives.length; i += 5) await Promise.all(pins.archives.slice(i, i + 5).map(async ([placement, version, integrity]) => {
    const chain = placement.split('/node_modules/');
    assert.ok(chain.every(n => /^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(n)) && /^[0-9][0-9a-z.-]*$/.test(version));
    const name = chain.at(-1), leaf = name.split('/').at(-1), filename = [name.replace('/', '+'), version].join('-') + '.tgz';
    const path = join(cache, filename);
    let data, cold = false;
    try { assert.ok((await lstat(path)).isFile(), 'not a regular archive'); data = await readFile(path); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (!prepare) throw Error('Missing pinned archive (run --prepare): ' + name + '@' + version);
      cold = true;
      const url = 'https://registry.npmjs.org/' + name + '/-/' + leaf + '-' + version + '.tgz';
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
      assert.equal(response.status, 200, name); data = Buffer.from(await response.arrayBuffer());
    }
    assert.equal('sha512-' + createHash('sha512').update(data).digest('base64'), integrity, name + ' integrity');
    if (cold) await writeFile(path, data, { flag: 'wx' });
    if (!into) return;
    const dir = join(into, 'node_modules', placement);
    await mkdir(dir, { recursive: true });
    await pipeline(Readable.from([data]), untar({ cwd: dir, strict: true, strip: 1, filter(p, entry) {
      return !p.includes('\\') && !p.split('/').some(segment => segment === '..' || segment === 'node_modules') && ['File','Directory'].includes(entry.type);
    } }));
    const manifest = JSON.parse(await readFile(join(dir, 'package.json')));
    assert.equal(manifest.name, name); assert.equal(manifest.version, version);
  }));
}
