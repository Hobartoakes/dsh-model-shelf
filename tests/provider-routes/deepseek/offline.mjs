// Called only by contract.test.mjs. No fetch passes through to the network.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { Socket } from 'node:net';
import { basename, join, resolve } from 'node:path';
import { createDeepSeekOptions } from '../../../src/provider-routes/deepseek.js';

const root = resolve(process.argv[2] ?? '');
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
const req = createRequire(join(resolve(process.argv[3]), 'package.json'));
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
