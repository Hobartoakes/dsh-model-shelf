// Offline consistency and byte binding. This never upgrades an inventory row
// to a runtime result and does not replace rerunning the browser contracts.
import assert from 'node:assert/strict';
import { hash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import matrix from './matrix.json' with {type:'json'};
import early from './early-pins.json' with {type:'json'};
import manifest from '../../package.json' with {type:'json'};
import semver from 'semver';

const args = process.argv.slice(2);
const report = JSON.parse(await readFile(args.find(a=>!a.startsWith('--')) ?? new URL('./contracts.json',import.meta.url), 'utf8'));
assert.equal(report.schemaVersion,1);
assert.equal(report.pluginVersion,manifest.version);
assert.ok(Date.parse(report.observedAt)); assert.match(report.browser,/^\d+\./);
const digest = async url => hash('sha256',await readFile(url));
assert.equal(report.clientSHA256,await digest(new URL('../../lib/client.js',import.meta.url)),'rerun contracts on current client');
const inputs=['./matrix.json','./early-pins.json','../host-packages.mjs','./run-contracts.mjs','./web-fixture.mjs','./seat-fixture.mjs','./boot-settlement.mjs'];
assert.deepEqual(Object.keys(report.inputs),inputs);for(const p of inputs)assert.equal(report.inputs[p],await digest(new URL(p,import.meta.url)),p);
assert.deepEqual(report.hosts.map(r=>r.version),matrix.hosts.map(h=>h.version));
assert.equal(report.pilot.host,'0.2.2-rc.5');assert.equal(report.pilot.checks,8);
if(args.includes('--pilot')) {
  const path=new URL('../../'+report.pilot.file,import.meta.url);
  const raw=await readFile(path), pilot=JSON.parse(raw);
  assert.equal(hash('sha256',raw),report.pilot.receiptSHA256);
  assert.equal(pilot.carrier,report.pilot.carrier);assert.equal(pilot.runtime.actual,report.pilot.host);assert.equal(pilot.success,true);
  assert.equal(pilot.packageVersion,report.pilot.plugin);assert.equal(pilot.checks.length,report.pilot.checks);
  assert.equal(pilot.clientSHA256,report.pilot.clientSHA256);assert.equal(pilot.archiveSHA256,report.pilot.archiveSHA256);
  assert.deepEqual(pilot.phases.map(p=>[p.label,p.success]),['installed','disabled','reenabled','uninstalled'].map(n=>[n,true]));
}
const counts={}, rows=[];
const yes='归还 / 点开', blank='—';
for(const [i,r] of report.hosts.entries()) {
  const h=matrix.hosts[i];assert.equal(r.admitted,semver.satisfies(h.version,manifest.engines.dsh,{includePrerelease:true}));
  assert.equal(r.fullHostStarted,false);assert.equal(r.coreNode,matrix.archives[h.components.core]?.engines?.node??null);
  assert.equal(r.desktopEvidence,r.version===report.pilot.host?'separate pilot archive':'not run');
  const desktop=r.version===report.pilot.host?'旧 pilot 8/8':'未测';
  let behavior,why;
  if (!h.components.modelSelection) {
    assert.equal(r.reason,h.reason);assert.equal(r.tier,r.admitted?'untested':'incompatible-admission');assert.equal(r.packages,undefined);
    behavior=r.admitted?'未测':'准入不兼容';why=r.admitted?'无同版 npm CLI':'旧 picker / frontend 身份 404；未执行';
  } else {
    assert.equal(r.admitted,true);const expected=['frontend','modelSelection','conversation',...(h.components.renderer?['renderer']:[])];
    if(h.disposition==='different-package-layout') expected.push('runtime','modules');
    assert.deepEqual(Object.keys(r.packages).sort(),expected.sort());
    for(const key of expected){const extra=key==='runtime'?early[r.version]:key==='modules'?early[r.version]?.modules:null;
      assert.equal(r.packages[key],extra?extra.name+'@'+extra.version:h.components[key]);}
    assert.equal(r.seatAfterDisposal,'native');for(const click of [r.nativeClickAfterDispose,r.nativeClickMissingCapability]){
      assert.equal(click.expanded,true);assert.equal(click.catalogVisible,true);assert.match(click.menu,/Fixture/);
    }
    if(h.disposition==='different-package-layout') {assert.equal(r.webSettlement.settled,true,r.version);assert.equal(r.webSettlement.negativeControl,'pending entry rejected');}
    if(r.label) assert.deepEqual(r.label,{kind:'single',scope:'session',inline:true});
    if(r.enabled){
      assert.equal(r.tier,'package-contract');assert.equal(r.route.childRequests,0);assert.equal(r.route.before.provider,'fixture-a');
      assert.deepEqual(r.route.after,{provider:'fixture-b',model:'vendor/shared-model',reasoningEffort:'low'});
      assert.deepEqual(r.route.wire,{sessionId:'fixture-session',...r.route.after});assert.equal(r.shelfButton.closed,true);assert.equal(r.shelfButton.falseFailure,false);
      assert.equal(r.rejection,'visible error, chooser open, previous route kept');
      behavior='官方包：书架通过';why=r.earlyWire?'旧连接 API，小图启动结算通过':'同版前端、原生目录与控件';
    } else {
      assert.equal(r.tier,'native-fallback');assert.equal(r.earlyWire,true);assert.equal(r.route,undefined);
      behavior='仅原生回退';why='没有新会话接口；小图启动结算通过';
    }
    if(h.version==='0.2.3-alpha.2') why+='；完整 CLI 另需 Node '+r.coreNode.replace(' || ',' 或 ');
  }
  counts[r.tier]=(counts[r.tier]??0)+1;
  rows.push('| '+[r.version,behavior,desktop,r.seatAfterDisposal?yes:blank,r.nativeClickMissingCapability?'点开':blank,h.components.modelSelection?(r.label?'原生声明 / 徽标保留':'该宿主无此子槽'):blank,why].join(' | ')+' |');
}
if(args.includes('--rows'))console.log(rows.join('\n'));
else console.log(JSON.stringify({hosts:report.hosts.length,counts,client:report.clientSHA256,fullHostsStarted:0,desktopPilot:report.pilot.host}));
