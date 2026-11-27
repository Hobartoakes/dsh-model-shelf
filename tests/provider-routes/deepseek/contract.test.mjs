import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { Socket } from 'node:net';
import { basename, join, resolve } from 'node:path';

const routes = ['deepseek-official', 'deepseek-account'];
if (process.argv[2] === '--deepseek-offline') await runOffline(...process.argv.slice(3));
else registerTests();

function registerTests() {
  test('both output caps are gaps; reasoning effort stays in the native model selector', async () => {
    const rows=JSON.parse(await readFile(new URL('./evidence.json',import.meta.url)));
    const keys=['route','variant','field','status','packagePin','source','ownerProof','writeSurface','requestProof','reason'];
    assert.equal(rows.length,4);
    for (const provider of routes) {
      const r=rows.filter(x=>x.variant===provider);
      assert.deepEqual(r.map(x=>[x.field,x.status]),[['maxTokens','gap'],['reasoningEffort','builtin']]);
      for (const row of r) {
        assert.deepEqual(Object.keys(row).sort(),[...keys].sort()); assert.equal(row.route,'deepseek');
        assert.match(row.packagePin,/0\.2\.2-rc\.5/); assert.match(JSON.stringify(row.source),/9c2670d3bce5275e0d1610272958121af87787bb/);
        assert.match(row.requestProof,/node --test tests\/provider-routes\/deepseek\/contract\.test\.mjs/);
        assert.ok(row.ownerProof && row.writeSurface && row.reason);
      }
    }
  });

  for (const provider of routes) {
    test(provider + ': a valid standby form is not the active sender', async t => {
      const proof = await isolatedProof(provider);
      assert.ok(proof.includes(provider + ': standby form, different sender; no shelf target; shelf RPCs: 0; Codex control: outputVerbosity; outbound sockets: 0'));
      t.diagnostic(proof.trim());
    });
  }
  test('fixed DeepSeek connectors consume independently reopened route caps at the serialized Messages boundary', async t => {
    const proof = await isolatedProof('native');
    assert.match(proof, /Connector-admin set and reset on both routes; serialized Messages: 18; outbound sockets: 0/);
    t.diagnostic(proof.trim());
  });
}

// Supply a loose pinned dependency tree or the installed code carrier, never its profile.
async function isolatedProof(scenario) {
  const {createIsolation} = await import('../../clean-profile-support.mjs');
  const {mkdtemp, rm} = await import('node:fs/promises');
  const {execFileSync} = await import('node:child_process');
  const {tmpdir} = await import('node:os');
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
    return execFileSync(exe,['--expose-internals',worker,'--deepseek-offline',root,anchor,scenario],{env,cwd,timeout:45000,encoding:'utf8',windowsHide:true});
  } finally { await rm(root,{recursive:true,force:true,maxRetries:3}); }
}

// CurrentProviderOptions mounts an editor only for a target returned by this selector.
async function assertNoShelfTarget(current, models) {
  const { createProviderConnection, observeProviderTarget } = await import('../../../src/provider-option-panel.js');
  const connection = createProviderConnection(), calls = [];
  const control = { provider: 'openai-codex', model: 'gpt-5.4' };
  const statusMethod = 'codex-subscription/preferences/status';
  const fixedStore = value => ({ getSnapshot: () => value, subscribe: () => () => {} });
  const detach = connection.attach({
    state: fixedStore('connected'), generation: fixedStore({ id: 1 }),
    rpc: { async call(base, method) {
      calls.push([base, method]);
      if (base !== '/api' || method !== statusMethod) throw Error('Unexpected shelf RPC: ' + method);
      return { ok: true, value: { writable: true, composerModelPicker: 'auto', availableModels: [{ id: control.model }],
        verbosityModels: [control.model], outputVerbosity: 'default' } };
    } },
  });
  const select = (current, models) => observeProviderTarget(fixedStore({ status: 'ready', routable: true,
    current, groups: [{ id: current.provider, models }] }), connection, 'fixture').getSnapshot();
  try {
    assert.equal(select(current, models), null, current.provider + ': no option adapter, hence no fields or submit path');
    assert.deepEqual(calls, [], 'the shelf did not even request a settings read or write');

    // Same connected selector, supported route: a disconnected or always-null shelf must fail.
    const item = select(control, [{ id: control.model }]);
    assert.ok(item, 'the Codex control must have a shelf target');
    const fields = await item.io.read(item.target);
    assert.ok(fields.some(field => field.id === 'outputVerbosity'), 'the control exposes a real shelf option');
    assert.deepEqual(calls, [['/api', statusMethod]]);
  } finally { detach(); }
}

// Only the fixture knows which entries it mounted. Their IDs are not a client API.
async function runOffline(fixtureRoot, packages, scenario) {
  assert.ok(scenario === 'native' || routes.includes(scenario));
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
  const native = {[api]:'llm-deepseek-api-key', [acct]:'llm-deepseek-account'};
  const entries = [['editor','config-editor'], ['settings','settings'], ['llm','llm']];
  const plugins = new Map(), dispatches = [];
  if (scenario === 'native') {
    for (const provider of routes) entries.push([ids[provider],native[provider]]);
  } else {
    // Two separate loader entries on the same host. Only the standby declares a form.
    const provider = scenario, name = provider === api ? 'DeepSeek' : 'DeepSeek Account';
    entries.push(['standby','directory-only'], ['sender','dispatch-only']);
    plugins.set('directory-only', {Config: req(pkg(native[provider])).Config, inject: ['llm'], apply(ctx) {
      ctx.llm.registerConfigurableProviders([{provider, displayName: name, settingsNs: ctx.fiber.entry.options.id, settingsPath: []}]);
    }});
    plugins.set('dispatch-only', {inject: ['llm'], apply(ctx) {
      const {LlmAdapter} = req(pkg('llm')), sender = ctx.fiber.entry.options.id;
      class Sender extends LlmAdapter {
        providerInfo() { return {id:provider, name}; }
        async listModels() { return [{provider,id:flash,name:flash}]; }
        async *stream(call) { dispatches.push([sender,call.provider,call.model]); yield {type:'finish',reason:{kind:'stop'}}; }
      }
      ctx.llm.registerAdapter([provider], new Sender());
    }});
  }
  await writeFile(join(bundle,'cordis.patch.yml'), JSON.stringify([{insert:entries.map(([id, name]) => ({id,name:'cordis:'+name}))}]));
  await writeFile(join(dir,'cordis.yml'),'[]\n');
  const profile = {name:'route', startedBundles:['route-fixture'], dir, patchPath:join(dir,'cordis.patch.yml'), installAnchor:join(home,'package.json'), cwd:process.cwd(), home, overlays:[]};
  const ctx = await boot('dsh',join(dir,'cordis.yml'),readProfilePatches('dsh',profile), ctx => {
    ctx.provide('profileContext',profile);
    ctx.provide('appReady',{onReady(fn){ fn(); return () => {}; }});
    ctx.provide('deepseekAccount',{resolveToken:async () => 'fixture-account-only'});
    for (const [,name] of entries) { const mod = plugins.get(name) ?? req(pkg(name)); ctx.loader.builtins[name] = mod.default ?? mod; }
  });
  try {
    await ctx.plugin(req(pkg('api-settings-controller')).default);
    const settings = ctx.settingsController;
    if (scenario !== 'native') {
      const provider = scenario, model = flash, current = {provider,model};
      const rows = ctx.llm.listConfigurableProviders();
      assert.deepEqual(rows.map(r => [r.provider,r.settingsNs,r.settingsPath]), [[provider,'standby',[]]]);
      const [row] = rows;
      assert.deepEqual(ctx.llm.listProviders(), [{id:provider,name:row.displayName}]);
      const models = await ctx.llm.listModels(provider);
      assert.deepEqual(models.map(m => [m.provider,m.id]), [[provider,model]]);
      for await (const chunk of ctx.llm.stream({...current,messages:[]})) assert.equal(chunk.type, 'finish');
      assert.deepEqual(dispatches, [['sender',provider,model]], 'the host dispatched to the other plugin');
      const descriptor = settings.describe();
      const forms = descriptor.namespaces.filter(r => r.schema?.refs?.[r.schema.uid]?.dict?.maxTokens !== undefined);
      assert.equal(descriptor.writable, true); assert.deepEqual(forms.map(r => r.ns), [row.settingsNs]);
      const [form] = forms, {refs,uid} = form.schema, field = refs[refs[uid].dict.maxTokens];
      assert.deepEqual([form.applies,field.type,field.meta.min,field.meta.max,field.meta.step], ['live','number',1,Number.MAX_SAFE_INTEGER,1]);
      assert.equal(form.value.maxTokens, form.base.maxTokens); assert.equal(form.user.maxTokens, undefined);

      await assertNoShelfTarget(current, models);
      assert.equal(settings.describe().namespaces.find(r=>r.ns===row.settingsNs).revision, form.revision);
      assert.equal(sockets,0); assert.equal(serialized,0); assert.equal(listings,0); assert.equal(unexpectedFetches,0);
      console.log(provider + ': standby form, different sender; no shelf target; shelf RPCs: 0; Codex control: outputVerbosity; outbound sockets: 0');
      return;
    }

    // Connector capability only: the fixture administrator addresses the entries it installed.
    // A remote shelf does not know that binding and is never used for these edits.
    for (const provider of routes) assert.deepEqual((await ctx.llm.listModels(provider)).map(m=>m.id), [flash,pro]);
    const readForm = ns => settings.describe().namespaces.find(r=>r.ns===ns);
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
      const ns = ids[provider];
      assert.equal((await request(provider,flash)).cap,4096, 'listing bounds route default');
      const start = readForm(ns);
      assert.equal(start.value.maxTokens,256000); assert.equal(start.user.maxTokens,undefined);
      const networkBefore = [serialized,listings];
      await settings.mutate(ns,[{op:'set',path:['maxTokens'],value:2048}],start.revision);
      assert.equal(stored(ns),2048); assert.equal(stored(ids[other]),undefined);
      const again = readForm(ns);
      assert.equal(again.value.maxTokens,2048); assert.equal(again.base.maxTokens,256000); assert.equal(again.user.maxTokens,2048);
      assert.deepEqual([serialized,listings],networkBefore,'profile edits do not probe the provider');
      assert.deepEqual(await request(provider,flash),{model:flash,cap:2048,thinking:'enabled',effort:'high'});
      assert.equal((await request(provider,pro)).cap,2048,'same route, other model affected');
      assert.equal((await request(other,flash)).cap,4096,'same model, other route untouched');
      assert.equal((await request(provider,flash,{maxTokens:73})).cap,73, 'explicit per-call cap wins');
      assert.deepEqual(await request(provider,flash,{reasoningEffort:'off'}),{model:flash,cap:2048,thinking:'disabled',effort:undefined});
      assert.equal((await ctx.llm.resolveModelInfo(provider,flash)).context.contextWindow,1048576);
      await settings.mutate(ns,[{op:'unset',path:['maxTokens']}],again.revision);
      assert.equal(stored(ns),undefined); assert.equal(readForm(ns).value.maxTokens,256000);
      assert.equal((await request(provider,pro)).cap,256000); assert.equal((await request(provider,flash)).cap,4096);
    }
    for (const provider of [api,acct]) {
      const ns=ids[provider], form=readForm(ns);
      const op = provider === api ? {op:'set',path:['models'],value:[{id:flash,maxTokens:321}]} :
        {op:'set',path:['modelOverrides',flash,'maxTokens'],value:321};
      await settings.mutate(ns,[op],form.revision);
      assert.equal((await request(provider,flash)).cap,321);
    }
    assert.equal(sockets,0); assert.equal(unexpectedFetches,0);
    console.log('Connector-admin set and reset on both routes; serialized Messages: ' + serialized + '; outbound sockets: 0');
  } finally { await ctx.fiber.dispose(); }
}
