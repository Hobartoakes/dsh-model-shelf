// Test dependencies only. --prepare may download these public tarballs; the
// contract reads only authenticated bytes. Never install or run package scripts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { x as untar } from 'tar';

const cache = join(tmpdir(), 'dsh-model-shelf-qwen-archives');
const version = '0.7.5';
const digests = {
  core: 'Kg1ngkpPcAWWlMIliF8RBVqsZheifkC1xfuAkYObwgaCA/LeKU32CmJpHEYtCegFmIqTJAUgOdjOPi2fozeBUg==',
  runtime: 'Cb5tIp77kh8cxJbaJsFZdEgly1h7QYy31FNU0cvFIIVQFvf9fqheiKd3p2ExzB+YElXO9SmZNVHMDgYgJqIOiA==',
  dashscope: '5n3QF4V+Tl6oQtPGWLQxoXkh41XnKOAr6JLgpmO9mdXJIgf/5OwYKMUtfl/ydWrK4HVTXSOj1KGIemckjI/dcw==',
};

export async function nativeArchives({ prepare = false, into } = {}) {
  if (prepare) await mkdir(cache, { recursive: true });
  const hint = 'Run node tests/provider-routes/qwen/native-archives.mjs --prepare first';
  assert.ok((await lstat(cache).catch(() => undefined))?.isDirectory(), hint);
  for (const [leaf, hash] of Object.entries(digests)) {
    const name = '@dsh-ai-providers/' + leaf, filename = leaf + '-' + version + '.tgz';
    const path = join(cache, filename);
    let bytes, cold = false;
    try { assert.ok((await lstat(path)).isFile(), filename); bytes = await readFile(path); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (!prepare) throw Error(hint + ': ' + filename);
      const response = await fetch('https://registry.npmjs.org/' + name + '/-/' + filename,
        { redirect: 'error', signal: AbortSignal.timeout(60000) });
      assert.equal(response.status, 200, name); bytes = Buffer.from(await response.arrayBuffer()); cold = true;
    }
    assert.equal(createHash('sha512').update(bytes).digest('base64'), hash, filename);
    if (cold) await writeFile(path, bytes, { flag: 'wx' });
    if (!into) continue;
    const cwd = join(into, 'node_modules', name);
    await mkdir(cwd, { recursive: true });
    await pipeline(Readable.from([bytes]), untar({ cwd, strip: 1, strict: true,
      filter: (p, e) => p.startsWith('package/') && !p.includes('\\') && !p.split('/').some(s => s === '..' || s === 'node_modules') && ['File','Directory'].includes(e.type) }));
    const manifest = JSON.parse(await readFile(join(cwd, 'package.json')));
    assert.equal(manifest.name, name); assert.equal(manifest.version, version);
  }
}

if (import.meta.main) {
  assert.deepEqual(process.argv.slice(2), ['--prepare']);
  await nativeArchives({ prepare: true });
  console.log('Verified public Qwen fixture archives:', Object.keys(digests).length);
}
