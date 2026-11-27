// Browser-side composition using the DSH 0.2.2-rc.5 frontend's own Cordis,
// React, stores, renderer, native directory, and Connection client. Sessions,
// catalog projection and the surrounding composer are deterministic inputs.
export async function mountShelf({ clients, models, initial }) {
  const seat = 'conversation.input.model', prefix = '@deepseek-ai/dsh-client-';
  const cache = new Map();
  function requireHost(id) {
    if (cache.has(id)) return cache.get(id);
    const seeds = window.fixtureModules;
    const value = Array.isArray(seeds) ? seeds.find(e => e.id === id)?.factory(requireHost) : seeds ? seeds[id] : window.__DSH_MODULES__.makeRequire(new Set())(id);
    if (value === undefined) throw Error('missing published frontend import ' + id);
    cache.set(id,value); return value;
  }
  for (const [id,code] of Object.entries(clients)) {
    const previous = window.__ModuleLoader__;
    try { window.__ModuleLoader__ = { load(entry) { if (entry.id !== id) throw Error('unexpected factory'); const mod=entry.factory(requireHost);cache.set(id,mod);cache.set(id+'/client',mod); } }; new Function(code)(); }
    finally { window.__ModuleLoader__ = previous; }
  }
  const ctx = new (requireHost('@deepseek-ai/cordis').Context)(), React = requireHost('react');
  const mount = async (mod) => { const f=ctx.plugin(mod); await f.await(); if (f.state!==2) throw Error('inactive fixture plugin');return f; };
  const provide=(key,svc)=>ctx.reflect.provide(key,svc), noop=()=>()=>{};
  const bindings=new Map(), scopes=new Map();
  let sessionId='fixture-A',locked=false;
  const groups=['openai-codex','openai-api'].map(id=>({id,name:id,models}));
  for(const id of ['fixture-A','fixture-B','child']) {
    const projection=requireHost(prefix+'store').createSnapshotStore({next:initial});
    scopes.set(id,(await mount(()=>{})).ctx);
    bindings.set(id,{projection,session:{getSnapshot:()=>({blank:false}),projections:{faceOf:()=>projection}}});
  }
  const wire={modelCatalog:async()=>({ok:true,value:{default:initial,groups,routableProviders:groups.map(g=>g.id),failures:[]}}),
    async selectModel({sessionId,...selected}) { bindings.get(sessionId).projection.set({next:selected});return {ok:true,value:{selected}}; } };
  const handlers=new Map();
  provide('remote.session',wire);provide('remote',{session:wire,$on(name,fn){handlers.set(name,fn);return()=>handlers.delete(name);}});
  provide('sessions',{scope:id=>scopes.get(id),binding:id=>bindings.get(id),subagentAddress:id=>id==='child'?{parentId:'fixture-A'}:undefined});
  provide('commandUi',{register:noop}); provide('locale',{register:noop,bind:()=>key=>key,resolveText:v=>v?.en??v});
  await mount(requireHost(prefix+'connection'));
  const conn=ctx.get('connection');
  conn.registerGenerationSource((signal,ready)=>{ready({home:'/fixture'});return new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));});
  let loop=conn.start({}); window.dropConnection=()=>loop.stop();window.restoreConnection=()=>{loop=conn.start({});};
  await mount(requireHost(prefix+'ui-renderer').SlotRegistry);
  await mount({inject:['slots'],apply(c){c.slots.register({name:'root',children:{[seat]:{kind:'single',scope:'session'}}},()=>null);}});
  await mount(requireHost(prefix+'ui-model-selection'));
  const slots=ctx.get('slots'), winner=()=>slots.entries(seat)[0];const native=winner();
  const shelf=await mount(requireHost('dsh-model-shelf'));
  if(winner().options.priority!==-100 || winner().component===native.component)throw Error('shelf did not win native seat');
  if(winner().inject(sessionId).directory!==native.inject(sessionId).directory)throw Error('shelf is not using native directory');
  const div=document.createElement('div');document.getElementById('root').hidden=true;document.body.append(div);
  const root=requireHost('react-dom/client').createRoot(div);
  function paint(){const e=winner();requireHost('react-dom').flushSync(()=>root.render(React.createElement(e.component,{...e.inject(sessionId),locked,t:k=>k,renderSlot:()=>null})));}
  window.project=selection=>bindings.get(sessionId).projection.set({next:selection});
  window.changeSession=id=>{sessionId=id;paint();}; window.lockShelf=value=>{locked=value;paint();};
  window.accountChanged=()=>handlers.get('credentials/record-updated')?.();
  window.restoreNative=async()=>{root.unmount();await shelf.dispose();if(winner().component!==native.component)throw Error('native seat not restored');};
  // Faults affect delivery only. DSH/connector still parse the original real
  // RPC. No replacement success/status envelope is ever manufactured here.
  let nextFault; const send=window.fetch.bind(window);
  window.holdReply=(method,skip=0)=>{
    let reached,release;
    const seen=new Promise(ok=>{reached=ok;}), wait=new Promise(ok=>{release=ok;});
    nextFault={method,skip,reached,wait}; window.replySeen=seen;window.releaseReply=release;
  };
  window.fetch=async(input,init)=>{
    const fault=nextFault;
    if(!fault || !String(input).endsWith('/preferences/'+fault.method) || fault.skip-->0) return send(input,init);
    nextFault=undefined; const response=await send(input,init); await response.clone().arrayBuffer(); fault.reached();
    if(await fault.wait==='lost') throw Error('fixture: readback delivery lost');
    return response;
  };
  // Independent fixture actor; use the native RPC client, including its envelope.
  window.refreshAccountCatalog=()=>conn.rpc.call('/api','codex-subscription/preferences/models',{},AbortSignal.timeout(6000)).then(r=>r.ok);
  window.otherWrite=value=>conn.rpc.call('/api','codex-subscription/preferences/update',{outputVerbosity:value},new AbortController().signal).then(r=>r.ok);
  window.ownerReady=async()=>{const r=await conn.rpc.call('/api','codex-subscription/preferences/status',{},new AbortController().signal);return r.ok && r.value.writable===true && r.value.verbosityModels.includes(initial.model);};
  paint();
}
