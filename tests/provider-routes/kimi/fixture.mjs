// Public package bytes only. No package manager, lifecycle, credentials or profile.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { x as untar } from 'tar';
import { checkedDirectory } from '../../provider-options/archives.mjs';

const name = 'dsh-kimi-subscription', version = '1.5.1';
const filename = name + '-' + version + '.tgz';
const integrity = 'sha512-DxIpwCrtB9+baUCBfckMBuRKDHxmwRhCtcMd7WlO0sTGA1XySuo2xWq4Di7PyQKMp5NlWICD+YyKcslijlu8LA==';
const cache = fileURLToPath(new URL('./node_modules/.cache/', import.meta.url));
const archive = join(cache, filename);

function verify(bytes) {
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), integrity, filename);
  return bytes;
}

if (import.meta.main) {
  assert.deepEqual(process.argv.slice(2), ['--prepare']);
  for (const path of [fileURLToPath(new URL('./node_modules/', import.meta.url)), cache]) await checkedDirectory(path);
  try { assert.ok((await lstat(archive)).isFile()); verify(await readFile(archive)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const url = 'https://registry.npmjs.org/' + name + '/-/' + filename;
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    await writeFile(archive, verify(Buffer.from(await response.arrayBuffer())), { flag: 'wx' });
  }
  console.log('Verified ' + filename);
}

export async function unpackSubscription(root) {
  let bytes;
  try { assert.ok((await lstat(archive)).isFile()); bytes = verify(await readFile(archive)); }
  catch (error) {
    if (error.code === 'ENOENT') throw Error('Missing Kimi archive. Run: node tests/provider-routes/kimi/fixture.mjs --prepare');
    throw error;
  }
  const dest = join(root, 'node_modules', name);
  await mkdir(dest, { recursive: true });
  await pipeline(Readable.from([bytes]), untar({ cwd: dest, strip: 1, strict: true,
    filter: (path, entry) => ['package/package.json', 'package/lib/index.js'].includes(path) && entry.type === 'File' }));
  const manifest = JSON.parse(await readFile(join(dest, 'package.json')));
  assert.deepEqual([manifest.name, manifest.version], [name, version]);
}
