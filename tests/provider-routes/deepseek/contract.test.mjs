import test from 'node:test';
import assert from 'node:assert/strict';

const routes = ['deepseek-official', 'deepseek-account'];
const target = { sessionId: 'fixture', provider: routes[0], model: 'deepseek-flash', epoch: 1 };
const snapshot = t => ({ status: 'ready', routable: true, current: { provider: t.provider, model: t.model }, groups: [{ id: t.provider, models: [{ id: t.model }] }] });
const owner = provider => ({provider, settingsNs: provider === routes[0] ? 'key.one' : 'account.two', settingsPath: []});
const form = provider => ({ ns: owner(provider).settingsNs, revision: 0, applies: 'live',
  schema: {uid: 7, refs: {7: { type: 'object', dict: {maxTokens: 9} }, 9: {type: 'number', meta: { step: 1, min: 1, max: Number.MAX_SAFE_INTEGER }}}},
  base: {maxTokens: 8192}, user: {}, value: {maxTokens: 8192, ...(provider === routes[0] ? {models: [{id: target.model}]} : {modelOverrides: {}})},
});

async function factory() { return (await import('../../../src/provider-routes/deepseek.js')).createDeepSeekOptions; }
function fixture(create, t = target) {
  const rows = routes.map(owner), forms = routes.map(form), writes = [];
  const f = { state: snapshot(t), rows, forms, writes, writable: true, reads: 0 };
  const services = { directory: { getSnapshot: () => f.state }, llm: { listConfigurableProviders: () => f.rows }, settings: {
    describe() { f.reads++; return {writable: f.writable, namespaces: f.forms}; },
    mutate(ns, ops, rev) { writes.push([ns, ops, rev]); const row = f.forms.find(x => x.ns === ns); const [op] = ops;
      if (op.op === 'set') row.user.maxTokens = op.value; else delete row.user.maxTokens;
      row.value.maxTokens = row.user.maxTokens ?? row.base.maxTokens; row.revision++; return structuredClone(row);
    }
  }};
  return Object.assign(f, { io: create(services), services });
}

test('route defaults patch only maxTokens on the unique live owner, and reset to its inherited value', async () => {
  const create = await factory();
  for (const provider of routes) {
    const t = {...target, provider}, f = fixture(create, t);
    const [initial] = await f.io.read(t);
    assert.equal(initial.id, 'maxTokens'); assert.equal(initial.value, 8192); assert.equal(initial.editor.unit, 'token');
    assert.match(initial.scope, /其他会话/); assert.ok(!initial.reset); assert.equal(f.writes.length, 0);
    assert.equal(await f.io.write(t, initial, {set: 2048}, undefined, () => true), 'applied');
    const [reopened] = await f.io.read(t); assert.equal(reopened.value, 2048); assert.ok(reopened.reset);
    assert.equal(await f.io.write(t, reopened, {reset: true}, undefined, () => true), 'applied');
    assert.deepEqual(f.writes, [[owner(provider).settingsNs,[{op:'set',path:['maxTokens'],value:2048}],0], [owner(provider).settingsNs,[{op:'unset',path:['maxTokens']}],1]]);
    assert.equal((await f.io.read(t))[0].value, 8192);
    assert.equal(f.forms.find(x => x.ns !== owner(provider).settingsNs).revision, 0);
  }
});

test('wrong session, model, relay or stale directory never even reads settings', async () => {
  const create = await factory();
  for (const change of [{provider:'relay'},{model:'deepseek-flash-clone'},{sessionId:' '},{sessionId:1},{epoch:-1}]) {
    const t = {...target,...change}, f = fixture(create,t); let directories = 0;
    f.services.llm.listConfigurableProviders = () => { directories++; return f.rows; };
    assert.deepEqual(await f.io.read(t),[]); assert.equal(directories,0); assert.equal(f.reads,0);
  }
  for (const corrupt of [f=>f.state.routable=false, f=>f.state.status='loading', f=>f.state.current.model='other',
    f=>f.state.groups=[], f=>f.state.groups.push(f.state.groups[0]), f=>f.state.groups[0].models.push({id:target.model})]) {
    const f = fixture(create); corrupt(f); assert.deepEqual(await f.io.read(target),[]); assert.equal(f.reads,0);
  }
});

test('require exactly one root owner, a live versioned form, known schema and unshadowed model', async () => {
  const create = await factory();
  for (const corrupt of [f=>f.rows=[], f=>f.rows.push({...f.rows[0],settingsNs:'other'}), f=>f.rows[1].settingsNs=f.rows[0].settingsNs,
    f=>f.rows[0].settingsPath=['providers','mirror'], f=>f.rows[0].error='blocked', f=>f.forms.push({...f.forms[0]}),
    f=>f.writable=false, f=>f.forms[0].applies='reload', f=>delete f.forms[0].revision, f=>f.forms[0].revision=-1,
    f=>delete f.forms[0].schema.refs[7].dict.maxTokens, f=>f.forms[0].schema.refs[9].type='string',
    f=>delete f.forms[0].schema.refs[9].meta.step, f=>f.forms[0].value.maxTokens='8192',
    f=>f.forms[0].value.models=[], f=>f.forms[0].value.models[0].maxTokens=512, f=>f.forms[0].user.maxTokens=4096,
    f=>f.forms[0].base.maxTokens=0, f=>delete f.forms[0].user, f=>delete f.services.settings.mutate]) {
    const f = fixture(create); corrupt(f); assert.deepEqual(await f.io.read(target),[]); assert.equal(f.writes.length,0);
  }
  const t={...target,provider:routes[1]}, a=fixture(create,t); a.forms[1].value.modelOverrides[t.model]={maxTokens:1024};
  assert.deepEqual(await a.io.read(t),[]); assert.equal(a.writes.length,0);
});

test('returns only one whitelisted field; numeric inputs are not coerced, extra keys cannot become paths', async () => {
  const f = fixture(await factory());
  f.forms[0].value.unrelated='omit-me'; f.forms[0].user.headers={unrelated:'omit-me'};
  const options = await f.io.read(target); assert.deepEqual(options.map(x=>x.id),['maxTokens']);
  assert.doesNotMatch(JSON.stringify(options),/omit-me|headers/);
  const [field]=options;
  for (const change of [{set:'1'},{set:0},{set:-1},{set:1.1},{set:Number.MAX_SAFE_INTEGER+1},{set:Infinity},{set:NaN},
    {reset:true},{set:2,reset:true},{set:2,path:['contextWindow']},{set:2,thinking:'off'}]) {
    assert.equal(await f.io.write(target,field,change,undefined,()=>true),'refused');
  }
  assert.equal(await f.io.write(target,{...field},{set:3},undefined,()=>true),'refused');
  assert.equal(f.writes.length,0);
  for (const set of [1,Number.MAX_SAFE_INTEGER]) {
    const [current] = await f.io.read(target); assert.equal(await f.io.write(target,current,{set},undefined,()=>true),'applied');
  }
});

test('CAS conflict, revoked owner, cancellation and A→B→A epoch invalidate a draft; never retry', async () => {
  const create=await factory();
  for (const [expected,change] of [ ['conflict', f=>f.forms[0].revision++], ['refused',f=>f.rows=[]],
    ['refused', f=>f.writable=false], ['stale',f=>f.state.current.provider=routes[1]] ]) {
    const f=fixture(create), [field]=await f.io.read(target); change(f);
    assert.equal(await f.io.write(target,field,{set:2},undefined,()=>true),expected); assert.equal(f.writes.length,0);
  }
  const f=fixture(create), [field]=await f.io.read(target);
  assert.equal(await f.io.write({...target,epoch:3},field,{set:2},undefined,()=>true),'refused');
  assert.equal(await f.io.write(target,field,{set:2},undefined,()=>false),'stale');
  f.services.settings.describe=()=>{ f.state.routable=false; return {writable:true,namespaces:f.forms}; };
  assert.equal(await f.io.write(target,field,{set:2},undefined,()=>true),'stale'); assert.equal(f.writes.length,0);
  const g=fixture(create), [draft]=await g.io.read(target); let count=0;
  g.services.settings.mutate=()=>{ count++; throw Object.assign(Error(),{code:'settings/conflict'}); };
  assert.equal(await g.io.write(target,draft,{set:2},undefined,()=>true),'conflict'); assert.equal(count,1);
});

test('ambiguous receipt or changed readback cannot confirm a committed or superseded mutation', async () => {
  const create=await factory();
  for (const response of [() => {throw Error('timeout');}, () => ({}), r=>({...r,value:{...r.value,maxTokens:7}}),
    r=>({...r,user:{}}), r=>({...r,ns:'different'}), r=>({...r,revision:r.revision+1}), (r,f)=>{f.writable=false; return r;}]) {
    const f=fixture(create), [field]=await f.io.read(target), mutate=f.services.settings.mutate, reads=f.reads;
    f.services.settings.mutate=(...args)=>response(mutate(...args),f);
    assert.equal(await f.io.write(target,field,{set:333},undefined,()=>true),'unconfirmed');
    assert.equal(f.writes.length,1); assert.equal(f.forms[0].value.maxTokens,333);
    assert.equal(f.reads-reads,2, 'one preflight and one independent readback');
  }
});

test('the two variant inputs stay candidates until integrated; native reasoning is not another shelf field', async () => {
  const {readFile}=await import('node:fs/promises'); const rows=JSON.parse(await readFile(new URL('./evidence.json',import.meta.url)));
  const keys=['route','variant','field','status','packagePin','source','ownerProof','writeSurface','requestProof','reason'];
  assert.equal(rows.length,4);
  for (const provider of routes) {
    const r=rows.filter(x=>x.variant===provider);
    assert.deepEqual(r.map(x=>[x.field,x.status]),[['maxTokens','candidate'],['reasoningEffort','builtin']]);
    for (const row of r) {
      assert.deepEqual(Object.keys(row).sort(),[...keys].sort()); assert.equal(row.route,'deepseek');
      assert.match(row.packagePin,/0\.2\.2-rc\.5/); assert.match(JSON.stringify(row.source),/9c2670d3bce5275e0d1610272958121af87787bb/);
      assert.match(row.requestProof,/node --test tests\/provider-routes\/deepseek\/contract\.test\.mjs/);
      assert.ok(row.ownerProof && row.writeSurface && row.reason);
    }
  }
});

// Supply DSH_DEEPSEEK_TEST_PACKAGES for a loose 0.2.2-rc.5 dependency tree,
// or DSH_TEST_INSTALL_DIR for a Windows distribution (code carrier, never its profile).
test('fixed DeepSeek connectors consume independently reopened route caps at the serialized Messages boundary', async t => {
  const {createIsolation} = await import('../../clean-profile-support.mjs');
  const {mkdtemp, rm} = await import('node:fs/promises');
  const {execFileSync} = await import('node:child_process');
  const {tmpdir} = await import('node:os');
  const {join, resolve} = await import('node:path');
  const {fileURLToPath} = await import('node:url');
  const packages = process.env.DSH_DEEPSEEK_TEST_PACKAGES;
  const install = process.env.DSH_TEST_INSTALL_DIR ?? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness');
  const exe = packages ? process.execPath : join(install,'DeepSeek Harness.exe');
  const anchor = packages ? resolve(packages) : join(install,'resources','app.asar','dsh');
  const root = await mkdtemp(join(tmpdir(),'shelf-deepseek-'));
  try {
    const {env,cwd} = await createIsolation(root,exe,process.env);
    if (!packages) env.ELECTRON_RUN_AS_NODE = '1';
    env.DEEPSEEK_API_KEY = 'fixture-key-only';
    const worker = fileURLToPath(new URL('./offline.mjs',import.meta.url));
    const proof = execFileSync(exe,['--expose-internals',worker,root,anchor],{env,cwd,timeout:45000,encoding:'utf8',windowsHide:true});
    assert.match(proof,/Two owners \/ two models; real profile set \+ reset for each; serialized Messages: \d+; outbound sockets: 0/);
    t.diagnostic(proof.trim());
  } finally { await rm(root,{recursive:true,force:true,maxRetries:3}); }
});
