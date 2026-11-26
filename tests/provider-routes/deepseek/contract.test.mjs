import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { Socket } from 'node:net';
import { basename, join, resolve } from 'node:path';

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

if (process.argv[2] === '--deepseek-offline') await runOffline(process.argv[3], process.argv[4]);
else registerTests();

function registerTests() {
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
      const worker = fileURLToPath(import.meta.url);
      const proof = execFileSync(exe,['--expose-internals',worker,'--deepseek-offline',root,anchor],{env,cwd,timeout:45000,encoding:'utf8',windowsHide:true});
      assert.match(proof,/Two owners \/ two models; real profile set \+ reset for each; serialized Messages: \d+; outbound sockets: 0/);
      t.diagnostic(proof.trim());
    } finally { await rm(root,{recursive:true,force:true,maxRetries:3}); }
  });
}

// Spawned by the last contract in an isolated process; nothing goes to the network.
async function runOffline(fixtureRoot, packages) {
  const createDeepSeekOptions = await factory();
  const root = resolve(fixtureRoot);
  assert.match(basename(root), /^shelf-deepseek-[a-zA-Z0-9]+$/);
  for (const [key, sub] of Object.entries({DSH_HOME:'dsh-home', HOME:'user', USERPROFILE:'user', TEMP:'tmp', APPDATA:'appdata', LOCALAPPDATA:'localappdata'})) {
    assert.equal(process.env[key], join(root, sub), 'isolated worker required: ' + key);
  }
  assert.equal(process.cwd(), join(root, 'cwd'));
  let sockets = 0, unexpectedFetches = 0;
  Socket.prototype.connect = () => { sockets++; throw Error('offline: no socket permitted'); };
  syncBuiltinESMExports();
  const flash = 'deepseek-flash', pro = 'deepseek-v4-pro';
  const listed = [flash, pro].map(id => ({ id, name: id, input_modalities: ['text'], output_modalities: ['text'],
    context_window: 1048576, api_capabilities: {anthropic_messages: {}}, ...(id === flash ? {max_output_tokens: 4096} : {}) }));
  let last, serialized = 0, listings = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/models') {
      listings++; return Response.json({object:'list', data:listed});
    }
    if (request.method !== 'POST' || !url.pathname.endsWith('/messages')) {
      unexpectedFetches++; throw Error('unexpected fixture fetch');
    }
    // The connector (not the test) built AND serialized this Messages body. Keep
    // only the non-sensitive fields under test, never headers or entire requests.
    const body = await request.json();
    last = { model: body.model, cap: body.max_tokens, thinking: body.thinking?.type, effort: body.output_config?.effort };
    serialized++;
    const events = [{type:'message_start',message:{usage:{input_tokens:1}}}, {type:'content_block_start',index:0,content_block:{type:'text',text:'ok'}},
      {type:'content_block_stop',index:0}, {type:'message_delta',delta:{stop_reason:'end_turn'}}, {type:'message_stop'}];
    return new Response(events.map(e => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join(''), {headers:{'content-type':'text/event-stream'}});
  };
  const req = createRequire(join(resolve(packages), 'package.json'));
  const digests = {
    'llm-deepseek-api-key':'072d554c542a1251ca847d5272decb5ead28759dcd940b48b53f76ffa46b2b77',
    'llm-deepseek-account':'4f0f14e1909c7196fbb3ee967e4f8f96a750994b53e44a4d8461ef832d3d9adb',
    'llm-deepseek':'aa4de6cf5136d17534ee7c2c0cc43d9b17b2f1e0c9dc250c2b44a7f694d26258',
    llm:'1ed664800193b1ee9906fdb6fb79971a5a2817c20b939d151bc0ec596c5827d2',
    settings:'041a2682ed77a7025ceb9bf659b80db8b788c338cd1aa644f0bcc6bc122a4091',
    'config-editor':'17e953c5ef913d368b288e3d64e952276ea08a46967bfdd430534b69b9d0c039',
    'api-settings-controller':'36204d6b456997563cf6e5026589b67fa71707c5db35caf708fbb35ccee3dea1',
    'app-boot':'a8d2138bb274bd982079df14a615f6c0d5d7589c9faeae81973128a72293b6de',
  };
  const pkg = name => '@deepseek-ai/dsh-' + name;
  for (const [name, hash] of Object.entries(digests)) {
    assert.equal(req(pkg(name) + '/package.json').version, '0.2.2-rc.5', name);
    assert.equal(createHash('sha256').update(await readFile(req.resolve(pkg(name)))).digest('hex'), hash, name + ' entry bytes');
  }
  const api = 'deepseek-official', acct = 'deepseek-account', ids = {[api]:'fixture-key', [acct]:'fixture-account'};
  const { boot, initProfile, readProfilePatches, loadProfileDirectory } = req(pkg('app-boot'));
  const home = process.env.DSH_HOME, dir = join(home,'profiles','route');
  initProfile(dir, ['route-fixture']);
  const bundle = join(dir,'node_modules','route-fixture');
  await mkdir(bundle,{recursive:true});
  await writeFile(join(home,'package.json'), JSON.stringify({name:'route-fixture-installation'}));
  await writeFile(join(bundle,'package.json'), JSON.stringify({name:'route-fixture',version:'1.0.0',dsh:{bundle:{patch:'cordis.patch.yml'}}}));
  const entries = [ ['editor','config-editor'], ['settings','settings'], ['llm','llm'], [ids[api],'llm-deepseek-api-key'], [ids[acct],'llm-deepseek-account'] ];
  await writeFile(join(bundle,'cordis.patch.yml'), JSON.stringify([{insert:entries.map(([id, name]) => ({id,name:'cordis:'+name}))}]));
  await writeFile(join(dir,'cordis.yml'),'[]\n');
  const profile = {name:'route', startedBundles:['route-fixture'], dir, patchPath:join(dir,'cordis.patch.yml'), installAnchor:join(home,'package.json'), cwd:process.cwd(), home, overlays:[]};
  const ctx = await boot('dsh',join(dir,'cordis.yml'),readProfilePatches('dsh',profile), ctx => {
    ctx.provide('profileContext',profile);
    ctx.provide('appReady',{onReady(fn){ fn(); return () => {}; }});
    ctx.provide('deepseekAccount',{resolveToken:async () => 'fixture-account-only'});
    for (const [,name] of entries) { const mod = req(pkg(name)); ctx.loader.builtins[name] = mod.default ?? mod; }
  });
  try {
    await ctx.plugin(req(pkg('api-settings-controller')).default);
    const settings = ctx.settingsController;
    const groups = await Promise.all([api,acct].map(async id => ({id, models:await ctx.llm.listModels(id)})));
    for (const g of groups) assert.deepEqual(g.models.map(m=>m.id), [flash,pro], g.id+' fixture catalog');
    const state = {status:'ready', routable:true, groups};
    const io = createDeepSeekOptions({settings, llm:ctx.llm, directory:{getSnapshot:()=>state}});
    const target = {sessionId:'offline-session',epoch:0};
    function select(provider, model) { Object.assign(target,{provider,model,epoch:target.epoch+1}); state.current = {provider,model}; }
    const request = async (provider, model, extra = {}) => {
      const before = serialized;
      const messages = [{role:'user', content:[{type:'text', text:'fixture'}]}];
      let finished = false;
      for await (const chunk of ctx.llm.stream({provider,model,messages,...extra})) {
        if (chunk.type === 'finish') { assert.equal(chunk.reason.kind, 'stop', chunk.reason.failure?.message); finished = true; }
      }
      assert.ok(finished, 'host stream finished normally');
      assert.equal(serialized, before + 1, 'next request serialized exactly once'); assert.equal(last.model,model);
      return last;
    };
    const stored = ns => loadProfileDirectory('dsh', dir, profile.installAnchor).patches.findLast(p=>p.id===ns)?.config?.maxTokens;
    for (const provider of [api,acct]) {
      const other = provider === api ? acct : api;
      select(provider,flash);
      assert.equal((await request(provider,flash)).cap,4096, 'listing bounds route default');
      const [start] = await io.read(target);
      assert.equal(start?.owner,ids[provider]); assert.equal(start.value,256000); assert.equal(start.reset,undefined);
      const networkBefore = [serialized,listings];
      assert.equal(await io.write(target,start,{set:2048},undefined,()=>true),'applied');
      assert.equal(stored(ids[provider]),2048); assert.equal(stored(ids[other]),undefined);
      const [again] = await io.read(target);
      assert.equal(again.value,2048); assert.equal(again.reset,256000);
      assert.deepEqual([serialized,listings],networkBefore,'shelf does not probe provider');
      assert.deepEqual(await request(provider,flash),{model:flash,cap:2048,thinking:'enabled',effort:'high'});
      assert.equal((await request(provider,pro)).cap,2048,'same route, other model affected');
      assert.equal((await request(other,flash)).cap,4096,'same model, other route untouched');
      assert.equal((await request(provider,flash,{maxTokens:73})).cap,73, 'explicit per-call cap wins');
      assert.deepEqual(await request(provider,flash,{reasoningEffort:'off'}),{model:flash,cap:2048,thinking:'disabled',effort:undefined});
      assert.equal((await ctx.llm.resolveModelInfo(provider,flash)).context.contextWindow,1048576);
      select(provider,pro);
      const [sibling] = await io.read(target);
      assert.equal(sibling.value,2048);
      assert.equal(await io.write(target,sibling,{reset:true},undefined,()=>true),'applied');
      assert.equal(stored(ids[provider]),undefined); assert.equal((await io.read(target))[0].value,256000);
      assert.equal((await request(provider,pro)).cap,256000); assert.equal((await request(provider,flash)).cap,4096);
    }
    for (const provider of [api,acct]) {
      select(provider,flash);
      const ns=ids[provider], form=settings.describe().namespaces.find(r=>r.ns===ns);
      const op = provider === api ? {op:'set',path:['models'],value:[{id:flash,maxTokens:321}]} :
        {op:'set',path:['modelOverrides',flash,'maxTokens'],value:321};
      await settings.mutate(ns,[op],form.revision); // emulate another administrator, not a shelf call
      assert.deepEqual(await io.read(target),[], 'absolute per-model override suppresses route field');
      assert.equal((await request(provider,flash)).cap,321);
    }
    assert.equal(sockets,0); assert.equal(unexpectedFetches,0);
    console.log('Two owners / two models; real profile set + reset for each; serialized Messages: ' + serialized + '; outbound sockets: 0');
  } finally { await ctx.fiber.dispose(); }
}
