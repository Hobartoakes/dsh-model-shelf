// Read-only network inventory. No install, package scripts, factory evaluation,
// tar extraction, desktop, profile or filesystem cache. stdout is the snapshot.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import semver from 'semver';
import { list } from 'tar';

const npm = 'https://registry.npmjs.org/';
const project = 'deepseek-ai/deepseek-harness';
const api = 'https://api.github.com/repos/' + project + '/';
const raw = 'https://raw.githubusercontent.com/' + project + '/';
const desktop = 'https://download.deepseek.com/dsh-desk/';
const names = Object.fromEntries(Object.entries({
  core:'dsh', web:'dsh-web-app', frontend:'dsh-web-frontend', legacyFrontend:'dsh-frontend',
  modelSelection:'dsh-client-ui-model-selection', legacyPicker:'dsh-client-ui-model', legacyModels:'dsh-client-ui-models',
  conversation:'dsh-client-ui-conversation', renderer:'dsh-client-ui-renderer', slots:'dsh-client-ui-slots', store:'dsh-client-store',
  primitives:'dsh-client-ui-primitives', cordis:'cordis', loader:'cordis-plugin-loader', include:'cordis-plugin-include', timer:'cordis-plugin-timer', cosmokit:'cosmokit', schema:'schemastery',
}).map(([k,v]) => [k,'@deepseek-ai/' + v]));
const roles = Object.keys(names);
const fields = ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies'];
const dirs = {core:'apps/cli', web:'packages/bundle/web-app', frontend:'apps/web', modelSelection:'packages/client/ui-model-selection',
  conversation:'packages/client/ui-conversation', renderer:'packages/client/ui-renderer', slots:'packages/client/ui-slots', store:'packages/client/store',
  primitives:'packages/client/ui-primitives', cordis:'vendor/cordis', loader:'vendor/loader', include:'vendor/include', timer:'vendor/timer', cosmokit:'vendor/cosmokit', schema:'vendor/schemastery'};
const hash = (alg,bytes,enc='hex') => createHash(alg).update(bytes).digest(enc);
const sorted = a => [...a].sort(semver.compare);
const only = process.argv.slice(2);
assert.ok(only.every(v => semver.valid(v) === v), 'optional arguments must be exact versions');

async function request(url, { method='GET', allow404=false }={}) {
  for (let attempt=0;;attempt++) {
    let r;
    try { r = await fetch(url, {method, redirect:'error',signal:AbortSignal.timeout(45000)}); }
    catch (e) { if (!attempt) continue; throw Error(method + ' ' + url + ': ' + e.message); }
    if (r.ok || (allow404 && r.status===404)) return r;
    await r.body?.cancel();
    if (!attempt && [429,502,503,504].includes(r.status)) continue;
    throw Error(method + ' ' + url + ': HTTP ' + r.status);
  }
}
async function pages(endpoint) {
  const rows=[];
  for (let page=1;;page++) {
    const batch=await (await request(api + endpoint + '?per_page=100&page=' + page)).json();
    rows.push(...batch); if (batch.length < 100) return rows;
  }
}
async function pool(items,fn,limit=4) {
  const out=[]; let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while (next<items.length) { const i=next++; out[i]=await fn(items[i]); }
  })); return out;
}
const feedURL=desktop+'feeds/win-x64/nightly.yml';
const [catalogs, tagList, releaseList, feedText] = await Promise.all([
  pool(roles,async role=>{
    const url=npm+encodeURIComponent(names[role]); const r=await request(url,{allow404:true});
    if (r.status===404) { await r.body?.cancel(); return {url,status:404,versions:{}}; }
    const p=await r.json(); assert.equal(p.name,names[role]); return {url,status:r.status,...p};
  }), pages('tags'), pages('releases'), request(feedURL).then(r=>r.text()),
]);
const catalog=Object.fromEntries(roles.map((k,i)=>[k,catalogs[i]]));
const tags=new Map(tagList.filter(t=>/^dsh-v/.test(t.name)&&semver.valid(t.name.slice(5))).map(t=>[t.name.slice(5),{name:t.name,commit:t.commit.sha}]));
const releases=new Map(releaseList.filter(r=>!r.draft && r.tag_name.startsWith('dsh-v') && semver.valid(r.tag_name.slice(5))).map(r=>[r.tag_name.slice(5),{url:r.html_url,published:r.published_at,assets:r.assets.map(a=>a.name)}]));
const versionSet=sorted(new Set([...Object.keys(catalog.core.versions),...tags.keys(),...releases.keys()]));
for (const v of only) assert.ok(versionSet.includes(v),'not a released host label: '+v);
const archives=new Map();
const roleByName=new Map(Object.entries(names).map(([k,n])=>[n,k]));
function declarations(p) {
  return Object.fromEntries(fields.flatMap(field=>{
    const d=Object.entries(p[field]??{}).filter(([n])=>roleByName.has(n)).map(([n,v])=>[roleByName.get(n),v]);
    return d.length?[[field,Object.fromEntries(d)]]:[];
  }));
}
async function inspectArchive(role,version) {
  const p=catalog[role].versions[version], name=names[role], leaf=name.split('/')[1];
  assert.equal(p?.name,name); assert.equal(p.version,version); assert.equal(semver.valid(version),version);
  const tarball=npm+name+'/-/'+leaf+'-'+version+'.tgz'; assert.equal(p.dist.tarball,tarball);
  const data=Buffer.from(await (await request(tarball)).arrayBuffer());
  const integrity='sha512-'+hash('sha512',data,'base64'); assert.equal(integrity,p.dist.integrity,tarball);
  const files=[], text=new Map(), frontendMentions={};
  // Only collect named entries in memory. Never follow archive paths/links.
  await pipeline(Readable.from([data]),list({strict:true,onentry(entry){
    if(entry.type!=='File') return;
    const path=entry.path.replace(/\/{2,}/g,'/').replace(/^package\//,''); files.push(path);
    const wanted=path==='package.json'||(role==='web'&&path==='cordis.patch.yml')||((role==='modelSelection'||role==='renderer')&&path==='lib/client.js');
    const bundle=role==='frontend'&&/\.js$/.test(path)&&!path.startsWith('src/');
    if(!wanted&&!bundle) return;
    const chunks=[]; entry.on('data',c=>chunks.push(c)); entry.on('end',()=>{
      const s=Buffer.concat(chunks).toString();
      if(wanted) { assert.ok(!text.has(path),'duplicate '+path+' in '+tarball); text.set(path,s); }
      if(bundle) for (const k of ['slots','store','primitives','renderer','cordis']) if(!frontendMentions[k]&&s.includes(names[k])) frontendMentions[k]=path;
    });
  }}));
  const manifest=JSON.parse(text.get('package.json'));
  assert.equal(manifest.name,name); assert.equal(manifest.version,version);
  // The registry is not the archive. Check the publish-time dependency fields.
  for(const field of fields) assert.deepEqual(manifest[field]??{},p[field]??{},name+'@'+version+' '+field);
  const record={name,version,tarball,integrity,sha256:hash('sha256',data),bytes:data.length,
    directory:manifest.repository?.directory,engines:manifest.engines, declarations:declarations(manifest),
    entries:files.filter(f=>['lib/bin.js','lib/index.js','lib/client.js','cordis.patch.yml','npm-shrinkwrap.json'].includes(f)).sort()};
  if(role==='core') record.registrySource={gitHead:p.gitHead??null,attestationURL:p.dist.attestations?.url??null};
  if(role==='frontend') record.builtJsMentions=frontendMentions;
  if(role==='web') {
    const patch=text.get('cordis.patch.yml');
    // Only exact, literal YAML name scalars in the published patch. A subpath,
    // an identifier, a comment or a substring is not a package registration.
    const matches=(patch??'').matchAll(/^[ \t]*(?:-\s+)?name:\s*(['"]?)(@deepseek-ai\/[\w./-]+)\1[ \t]*(?:#.*)?\r?$/gm);
    record.patchNames=[...new Set([...matches].map(m=>roleByName.get(m[2])).filter(Boolean))].sort();
  }
  if(role==='modelSelection'||role==='renderer'){
    const js=text.get('lib/client.js')??'';
    record.client={factory:js.includes('__ModuleLoader__')&&js.includes(name),
      requires:[...new Set([...js.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)].map(m=>m[1]))].sort(),
      ...(role==='modelSelection'?{literals:Object.fromEntries(['conversation.input.model','directoryFor(','subagentAddress(','resetConnected(','slots.inject('].map(s=>[s,js.includes(s)]))}:{})};
    if(manifest.dsh?.client?.inject) record.client.inject=manifest.dsh.client.inject;
  }
  return record;
}
function archived(role,version) {
  const id=names[role]+'@'+version;
  if(!archives.has(id)) archives.set(id,inspectArchive(role,version));
  return archives.get(id);
}
// These are the edges required to reproduce the shelf boundary, not a complete
// installation lock for every CLI feature. A dev edge describes the Web build,
// not a claim that this library is installed beside a desktop executable.
const parents={web:['core'],frontend:['web'],legacyFrontend:['web'],modelSelection:['web'],legacyPicker:['web'],legacyModels:['web'],
  renderer:['web'],conversation:['web'],slots:['frontend','modelSelection','renderer','conversation'],store:['frontend','modelSelection','renderer','conversation'],
  primitives:['web','frontend','modelSelection','renderer','conversation','slots','store'],
  cordis:['core'],loader:['core','cordis'],include:['core','cordis'],timer:['core'],cosmokit:['cordis','loader','include','timer'],schema:['core','loader','cordis']};
// Read the scalar importer/version entries of canonical pnpm v9 lockfiles. Do
// not treat a package snapshot elsewhere in the lock as an importer resolution.
async function taggedLock(commit) {
  assert.match(commit,/^[a-f0-9]{40}$/);
  const url=raw+commit+'/pnpm-lock.yaml', r=await request(url,{allow404:true});
  if(r.status===404){await r.body?.cancel();return {url,status:404};}
  const bytes=Buffer.from(await r.arrayBuffer()), lines=bytes.toString('utf8').split(/\r?\n/);
  assert.ok(lines.some(l=>/^lockfileVersion: ['"]?9\.0['"]?$/.test(l)), 'unsupported lock format: '+url);
  const start=lines.indexOf('importers:'); assert.notEqual(start,-1,url);
  const lookup=new Map(Object.entries(dirs).map(([role,path])=>[path,role]));
  const lock={url,status:r.status,sha256:hash('sha256',bytes),importerLinks:{}};
  let importer, dep;
  for(const line of lines.slice(start+1)) {
    if(!line.trim()||line.trimStart().startsWith('#'))continue;
    if(/^\S/.test(line))break;
    if(/^  \S/.test(line)) {importer=lookup.get(line.trim().replace(/:$/,''));dep=null;}
    else if(/^    \S/.test(line))dep=null;
    else if(/^      \S/.test(line))dep=line.trim().replace(/:$/,'').replace(/^['"]|['"]$/g,'');
    else if(importer && dep && /^        version: /.test(line)) {
      const value=line.trim().slice(9).replace(/^['"]|['"]$/g,'');
      const to=roleByName.get(dep);
      if(to) (lock.importerLinks[importer]??={})[to]=value;
      if(importer==='frontend' && dep==='react')lock.webReact=value;
      if(importer==='frontend' && dep==='react-dom')lock.webReactDOM=value;
    }
  }
  lock.cliCordis=lock.importerLinks.core?.cordis;
  return lock;
}
async function host(version) {
  const tag=tags.get(version); const release=releases.get(version);
  const installer=desktop+'bin/win-x64/deepseek-harness-'+version+'-win-x64.exe';
  const [head,lock]=await Promise.all([request(installer,{method:'HEAD',allow404:true}),tag?taggedLock(tag.commit):undefined]);
  const h={version,tag,release,lock,windowsHead:{url:installer,status:head.status,bytes:Number(head.headers.get('content-length'))||undefined},
    components:{},selection:{},edges:[],gaps:[],runtime:'not-run'};
  const found={}; const workspace={};
  async function sourceVersion(role,p) {
    if(!tag)return;
    assert.match(tag.commit,/^[a-f0-9]{40}$/);
    const dir=p?.repository?.directory??dirs[role]; if(!dir)return;
    assert.match(dir,/^(?:[a-z0-9-]+\/)*[a-z0-9-]+$/);
    const url=raw+tag.commit+'/'+dir+'/package.json';
    const r=await request(url,{allow404:true}); if(r.status===404){await r.body?.cancel();return;}
    const m=await r.json();assert.equal(m.name,names[role],url);assert.ok(semver.valid(m.version),url);
    workspace[role]={version:m.version,path:dir+'/package.json',...(!catalog.core.versions[version]?{declarations:declarations(m)}:{})};return m.version;
  }
  async function pin(role,v,how){
    found[role]=await archived(role,v); h.components[role]=names[role]+'@'+v; h.selection[role]=how;
  }
  if(!catalog.core.versions[version]) {
    for(const role of Object.keys(dirs)) await sourceVersion(role);
    h.disposition='no-npm-core';h.reason='Upstream label without this registry core; no adjacent npm release is a substitute.';
  } else {
    await pin('core',version,'npm-version');
    const source=await sourceVersion('core',catalog.core.versions[version]); if(tag&&source!==version) h.gaps.push('source core differs: '+String(source));
    for(const [to,providers] of Object.entries(parents)){
      const candidates=[];
      // Separate production/peer/build declarations; all contributing ranges
      // must hold. An exact declared version wins over a floating selection.
      for(const from of providers) for(const field of fields){
        const range=found[from]?.declarations[field]?.[to]; if(range)candidates.push({from,to,field,range});
      }
      if(!candidates.length) continue;
      h.edges.push(...candidates);
      const list=sorted(Object.keys(catalog[to].versions)).filter(v=>candidates.every(e=>semver.satisfies(v,e.range)));
      if(!list.length){h.gaps.push(to+': no registry version satisfying '+[...new Set(candidates.map(e=>e.range))].join(' & '));continue;}
      const exact=candidates.find(e=>semver.valid(e.range))?.range;
      const ref=await sourceVersion(to,catalog[to].versions[exact??list[0]]);
      const v=exact??ref??list[0];
      if(!list.includes(v)){h.gaps.push(to+': workspace/registry constraint conflict '+v);continue;}
      if(ref && ref!==v){h.gaps.push(to+': exact declaration '+v+' differs from tag '+ref);continue;}
      await pin(to,v,exact?'exact-declaration':ref?'source-tag':'lowest-published-in-range (not a lock)');
      // A semver ceiling is illustrative; npm dist-tag preference, installer
      // lock and other transitive constraints can select something else.
      if(list.at(-1)!==v) (h.alternativeMax??={})[to]=list.at(-1);
    }
    const missing=['modelSelection','renderer','slots','store'].filter(k=>!found[k]);
    if(!found.modelSelection && h.edges.some(e=>e.to==='legacyPicker')){
      h.disposition='legacy-picker';h.reason='Web declares legacy picker, not model-selection; old picker/frontend identities unavailable. Do not borrow a newer Web build.';
    } else if(missing.length){
      h.disposition='different-package-layout';h.reason='No resolved standalone '+missing.join(', ')+' in this release graph. Use its own frontend/renderer/store ownership, not modern replacements.';
    } else if(!found.modelSelection.client.factory||!found.renderer.client.factory||!['slots','store'].every(k=>found[k].entries.includes('lib/index.js'))){
      h.disposition='different-entrypoint';h.reason='Component archives exist but not in the current factory/ESM entry format.';
    } else {
      h.disposition='four-package-fixture';h.reason='Exact component bytes and entrypoints available to exercise; imports, harness version, Cordis and Node must match. No runtime executed.';
    }
    h.npmPublished=catalog.core.time[version];
  }
  if(tag) h.workspace=workspace;
  return h;
}
const hosts=await pool(only.length?sorted(new Set(only)):versionSet,host,6);
const registry=Object.fromEntries(roles.map(k=>[k,{name:names[k],url:catalog[k].url,status:catalog[k].status,versions:sorted(Object.keys(catalog[k].versions))}]));
const receipts=Object.fromEntries(await Promise.all([...archives].sort(([a],[b])=>a.localeCompare(b,'en')).map(async([id,p])=>[id,await p])));
console.log(JSON.stringify({schemaVersion:2,observedAt:new Date().toISOString(),scope:'npm core plus GitHub dsh-v labels; only shelf-related dependencies; no installer bytes or runtime',
  sources:{npm,tags:api+'tags',releases:api+'releases',rawAtCommit:raw,winFeed:{url:feedURL,text:feedText.trim()}},
  registry,hosts,archives:receipts},null,2));
