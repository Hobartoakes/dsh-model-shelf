// Offline consistency checks for the published package inventory, not plugin tests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import semver from 'semver';
import { posix } from 'node:path';

const parse = async path => JSON.parse(await readFile(path, 'utf8'));
const m = await parse(process.argv[2] ?? new URL('./matrix.json', import.meta.url));
assert.equal(m.schemaVersion, 2, 'a same-number registry listing is not an audited host graph');
const hosts = new Map(m.hosts.map(h => [h.version, h]));
const coreVersions = m.registry.core.versions;
assert.equal(hosts.size, m.hosts.length);
assert.deepEqual([...hosts.values()].filter(h => !!h.components.core).map(h => h.version).sort(), [...coreVersions].sort());
const archive = (h, key) => m.archives[h.components[key]];
let legacyPins = 0;
if (process.argv[3]) {
  for (const old of await parse(process.argv[3])) {
    assert.ok(hosts.has(old.version), old.version);
    for (const [key, pin] of Object.entries(old.pins)) {
      const id = m.registry[key].name + '@' + old.version;
      assert.equal(m.archives[id]?.integrity, pin, id); legacyPins++;
    }
  }
}
for (const a of Object.values(m.archives)) {
  assert.match(a.sha256, /^[a-f0-9]{64}$/); assert.match(a.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  assert.ok(a.bytes > 0); assert.equal(a.tarball, 'https://registry.npmjs.org/' + a.name + '/-/' + a.name.split('/')[1] + '-' + a.version + '.tgz');
}
for (const h of hosts.values()) {
  assert.equal(h.runtime, 'not-run'); assert.ok(h.disposition && h.reason);
  for (const [role, id] of Object.entries(h.components)) {
    assert.ok(m.archives[id], id);
    const record=archive(h,role);
    assert.equal(record.name,m.registry[role].name); assert.equal(id,record.name+'@'+record.version);
    assert.ok(m.registry[role].versions.includes(record.version),id);
    if(h.workspace?.[role]) assert.equal(record.version,h.workspace[role].version,'tag '+id);
    // Check even peer/dev constraints not needed to discover the component.
    for (const [field,deps] of Object.entries(record.declarations)) for (const [to,range] of Object.entries(deps)) {
      if(h.components[to]) assert.ok(semver.satisfies(archive(h,to).version,range),h.version+': '+role+'.'+field+' -> '+to+' '+range);
    }
    if (role !== 'core') assert.ok(h.edges.some(e => e.to === role), role + ' lacks a package source');
  }
  for (const e of h.edges) {
    const a = archive(h,e.from); assert.ok(a, e.from);
    assert.equal(a.declarations[e.field]?.[e.to], e.range, a.name + ' -> ' + e.to);
    if (h.components[e.to]) assert.ok(semver.satisfies(archive(h,e.to).version, e.range), JSON.stringify(e));
  }
  if (h.tag) {
    assert.equal(h.lock.url,m.sources.rawAtCommit+h.tag.commit+'/pnpm-lock.yaml');
    assert.equal(h.lock.status,200); assert.match(h.lock.sha256,/^[a-f0-9]{64}$/);
    for(const [from,links] of Object.entries(h.lock.importerLinks)) for(const [to,value] of Object.entries(links)) {
      if(!value.startsWith('link:') || !h.workspace[from] || !h.workspace[to])continue;
      assert.equal(posix.join(posix.dirname(h.workspace[from].path),value.slice(5),'package.json'),h.workspace[to].path,h.version+': '+from+' -> '+to);
    }
  }
  if (h.disposition === 'four-package-fixture') {
    for (const key of ['core','web','frontend','cordis','modelSelection','renderer','slots','store','primitives']) assert.ok(archive(h,key), key);
    for (const key of ['modelSelection','renderer']) assert.ok(archive(h,'web').patchNames.includes(key), 'Web patch registration: ' + key);
    assert.match(h.lock.cliCordis, /^link:.*vendor\/cordis$/);
  }
}
for (const v of ['0.0.1-rc.1','0.0.1-rc.2']) { const h = hosts.get(v); assert.equal(h.disposition,'legacy-picker'); assert.equal(h.components.modelSelection, undefined); assert.ok(h.edges.some(e=>e.to==='legacyPicker')); }
for (const [v, cordis] of [['0.2.2-rc.5','4.1.0'],['0.2.3-alpha.1','4.1.0'],['0.2.3-alpha.2','4.2.0-alpha.1']]) {
  const h=hosts.get(v); assert.equal(h.disposition,'four-package-fixture'); assert.equal(archive(h,'cordis').version,cordis); assert.ok(h.tag?.commit); assert.equal(archive(h,'modelSelection').version,v);
}
assert.equal(hosts.get('0.2.2-rc.5').lock.webReact, '18.3.1');
assert.equal(hosts.get('0.2.2-rc.5').lock.webReactDOM, '18.3.1(react@18.3.1)');
assert.equal(semver.satisfies('24.21.0',archive(hosts.get('0.2.3-alpha.2'),'core').engines.node),false);
for (const v of ['0.1.2-alpha.1','0.1.3-alpha.1']) { const h=hosts.get(v); assert.equal(h.disposition,'no-npm-core'); assert.ok(h.release && h.tag?.commit); }
const count = field => Object.fromEntries([...new Set(m.hosts.map(h=>h[field]))].map(label=>[label,m.hosts.filter(h=>h[field]===label).length]));
console.log(JSON.stringify({hosts:hosts.size,npmCores:coreVersions.length,archives:Object.keys(m.archives).length,legacyPins,classes:count('disposition'),runtime:count('runtime')}));
