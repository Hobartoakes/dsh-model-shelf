// Supplemental to the inventory: the early picker imports client-runtime/client.
// Select from the actual archived Web/picker declarations, never a newer store.
import assert from 'node:assert/strict';
import { hash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { list } from 'tar';
import semver from 'semver';
import matrix from './matrix.json' with {type:'json'};
const registry = 'https://registry.npmjs.org/';
const runtime = '@deepseek-ai/dsh-client-runtime';
const catalog = await (await fetch(registry + encodeURIComponent(runtime))).json();
const modules = '@deepseek-ai/dsh-client-modules';
const moduleCatalog = await (await fetch(registry+encodeURIComponent(modules))).json();
const pins = {};
async function read(a, wanted) {
  const response = await fetch(a.tarball,{ redirect:'error', signal:AbortSignal.timeout(30000) });
  assert.ok(response.ok,a.tarball); const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal('sha512-'+hash('sha512',bytes,'base64'),a.integrity);
  const files = {};
  await pipeline(Readable.from([bytes]),list({strict:true,onentry(e){
    if(e.type!=='File'||!wanted.includes(e.path)) return;
    const chunks=[];e.on('data',x=>chunks.push(x));e.on('end',()=>{files[e.path]=Buffer.concat(chunks).toString()});
  }}));
  return {files,sha256:hash('sha256',bytes)};
}
for(const row of matrix.hosts.filter(h=>h.disposition==='different-package-layout')) {
  const ranges=[]; let moduleRange;
  for(const key of ['web','modelSelection']) {
    const a=matrix.archives[row.components[key]];
    const {files}=await read(a,['package/package.json','package/cordis.patch.yml']);
    const p=JSON.parse(files['package/package.json']);assert.equal(p.name+'@'+p.version,row.components[key]);
    if(key==='web') {assert.ok(files['package/cordis.patch.yml'].includes(runtime));moduleRange=p.dependencies[modules];assert.ok(moduleRange);}
    const range=(key==='web'?p.dependencies:p.devDependencies)[runtime];assert.ok(range);ranges.push(range);
  }
  const version=Object.keys(catalog.versions).filter(v=>ranges.every(r=>semver.satisfies(v,r))).sort(semver.compare)[0];
  const p=catalog.versions[version], url=registry+runtime+'/-/dsh-client-runtime-'+version+'.tgz';
  assert.equal(p.dist.tarball,url);
  const {files,sha256}=await read(p.dist,['package/lib/client.js','package/package.json']);
  const manifest=JSON.parse(files['package/package.json']);assert.equal(manifest.version,version);assert.equal(manifest.name,runtime);
  pins[row.version]={name:runtime,version,tarball:url,integrity:p.dist.integrity,sha256,ranges,selection:'lowest published satisfying Web dependencies and picker devDependencies'};
  const mv=Object.keys(moduleCatalog.versions).filter(v=>semver.satisfies(v,moduleRange)).sort(semver.compare)[0];
  const mp=moduleCatalog.versions[mv];const md=await read(mp.dist,['package/package.json','package/lib/client.js']);
  assert.equal(JSON.parse(md.files['package/package.json']).version,mv);assert.equal(mp.dist.tarball,registry+modules+'/-/dsh-client-modules-'+mv+'.tgz');
  pins[row.version].modules={ name:modules,version:mv,tarball:mp.dist.tarball,integrity:mp.dist.integrity,sha256:md.sha256,range:moduleRange };
  assert.ok(md.files['package/lib/client.js'] && files['package/lib/client.js'],'missing runtime bundle');
}
console.log(JSON.stringify(pins,null,2));
