// Runs inside one disposable browser context. Only the RPC boundary, session
// projection, enclosing composer, command registration and locale face are fixtures.
// The actual native apply() registers the picker, its child slots and directory.
export async function mountSeat({ clients, shelfCode, names, initial, target }) {
  const seat = 'conversation.input.model', label = seat + '.label';
  const check = (ok, detail) => { if (!ok) throw Error(detail); };
  const cache = new Map();
  const seeds = window.fixtureModules;
  function requireHost(id) {
    if (cache.has(id)) return cache.get(id);
    let value;
    if (Array.isArray(seeds)) value = seeds.find(entry => entry.id === id)?.factory(requireHost);
    else if (seeds) value = Object.hasOwn(seeds,id) ? seeds[id] : undefined;
    else value = window.__DSH_MODULES__.makeRequire(new Set())(id);
    check(value !== undefined, 'unmapped published import: ' + id);
    cache.set(id, value); return value;
  }
  function client(id, code) {
    const previous = window.__ModuleLoader__; let result;
    try {
      window.__ModuleLoader__ = { load(e) { check(e.id === id && result === undefined,'unexpected factory ' + e.id); result = e.factory(requireHost); } };
      new Function(code)();
    } finally { window.__ModuleLoader__ = previous; }
    check(result,'missing factory '+id); cache.set(id,result); cache.set(id+'/client',result); return result;
  }
  const runtime = clients.runtime && client(names.runtime, clients.runtime);
  const renderer = clients.renderer && client(names.renderer, clients.renderer);
  const picker = client(names.modelSelection, clients.modelSelection);
  const shelf = client('dsh-model-shelf', shelfCode);
  const {Context} = requireHost('@deepseek-ai/cordis'), React = requireHost('react');
  const store = runtime || requireHost('@deepseek-ai/dsh-client-store');
  const earlyWire = picker.inject.includes('connection') && !picker.inject.includes('remote.session');
  const ctx = new Context(), scopes = new Map(), bindings = new Map(), requests = [];
  const mount = async mod => { const f = ctx.plugin(mod); await f.await(); return f; };
  const provide = (name,service) => ctx.reflect.provide(name,service);
  let reads = 0, rejectNext = false, current = initial;
  const groups = [initial.provider, target.provider].map(id => ({ id, name: 'Fixture '+id, models: [{ id: initial.model, name: 'Shared Fixture Model', reasoning: { defaultEffort: 'medium', efforts: ['low','medium','high'].map(id=>({id,name:id})) } }] }));
  const selection = async request => { requests.push(structuredClone(request)); if (rejectNext) {rejectNext=false; return {ok:false,error:{code:'fixture/refused',message:'fixture selection refused'}};}
    const { sessionId, ...selected } = request; current=selected; bindings.get(sessionId).projection.set({next:selected}); return {ok:true,value:{selected}}; };
  const noopDispose = () => () => {};
  const remote = { $on: noopDispose };
  if (earlyWire) {
    // Do not invent a remote.session face for a connection.api.sessions picker.
    provide('connection',{ api:{ sessions:{ models: async () => { reads++; return { result:{ok:true,value:{current,groups,routable:true,failures:[]}} }; }, selectModel:async request=>({result:await selection(request)}) } } });
  } else {
    const wire = {modelCatalog:async()=>{reads++;return {ok:true,value:{default:initial,groups,routableProviders:groups.map(g=>g.id),failures:[]}};}, selectModel:selection};
    remote.session=wire; provide('remote.session',wire);
  }
  provide('remote',remote);
  for (const id of ['fixture-session','fixture-child']) {
    const f = await mount(()=>{}), projection = store.createSnapshotStore({ next: initial });
    scopes.set(id,f.ctx); bindings.set(id,{session:{ getSnapshot:()=>({blank:false}), projections:{ faceOf: key=>{check(key==='modelSelection','wrong projection '+key);return projection;} } },projection});
  }
  provide('sessions',{scope:id=>scopes.get(id), binding:id=>bindings.get(id), subagentAddress:id=>id==='fixture-child'?{parentId:'fixture-session',name:'child'}:undefined});
  const dictionaries = new Map();
  function translate(ns,key,vars={}) { const dict=dictionaries.get(ns)??{}; const str=dict[key]??key; return String(str).replace(/\{(\w+)\}/g,(all,k)=>vars[k]??all); }
  provide('locale',{register(ns,dict){dictionaries.set(ns,dict.en);return ()=>dictionaries.delete(ns)},bind:ns=>(key,vars)=>translate(ns,key,vars),resolveText:value=>typeof value==='string'?value:value?.en??value?.key??''});
  provide('commandUi',{register:noopDispose});
  await mount((runtime||renderer).SlotRegistry);
  await mount({inject:['slots'],apply(c){c.slots.register({name:'root',children:{[seat]:{kind:'single',scope:'session'}}},()=>null)}});
  const pickerFiber=await mount(picker);
  const slots=ctx.get('slots');
  const entries=()=>slots.entries(seat), native=entries()[0];
  check(native && entries().length===1,'native apply did not register the model seat');
  const labelSpec = slots.spec(label);const Badge=()=>null;
  if(labelSpec){await mount({inject:['slots'],apply(c){c.slots.inject(label,()=>c.slots.register({name:label},Badge));}});}
  function assertLabel() {check(JSON.stringify(slots.spec(label))===JSON.stringify(labelSpec),'shelf changed native label declaration');if(labelSpec) check(slots.entries(label)[0].component===Badge,'registered native badge was displaced');}
  const getDir=id=>ctx.get('modelDirectories').directoryFor(id);
  const nativeProps=native.inject('fixture-session');
  check(nativeProps.directory===getDir('fixture-session').store,'native store does not belong to published resolver');
  const fiber=await mount(shelf);
  const winner=()=>entries()[0];
  const enabled=winner().component!==native.component;
  const rootDiv=document.createElement('div'); rootDiv.id='contract-seat'; document.getElementById('root').hidden=true;rootDiv.style.cssText='position:relative;padding:1rem';document.body.append(rootDiv);
  const root=requireHost('react-dom/client').createRoot(rootDiv);
  function paint(id='fixture-session') {
    const e=winner(); const props={...e.inject(id), locked:false, t:(key,vars)=>translate(native.options.locale,key,vars), renderSlot:()=>null};
    requireHost('react-dom').flushSync(()=>root.render(React.createElement(e.component,props)));
  }
  async function verifyRoute() {
    check(enabled,'shelf did not enter model seat');check(winner().options.priority===-100,'wrong model seat priority');
    assertLabel();
    const props=winner().inject('fixture-session'), child=winner().inject('fixture-child');
    check(props.available && props.directory===nativeProps.directory,'shelf does not share native directory');
    await props.load(); const before=props.directory.getSnapshot().current;
    check(before.provider===initial.provider&&before.reasoningEffort===initial.reasoningEffort,'wrong initial route');
    const count=reads;
    check(!child.available,'child enabled'); await child.load();await child.select(target);
    check(reads===count&&requests.length===0,'addressed subagent made a wire request');
    const reply = await props.select(target);
    check(requests.length===1,'expected precisely one select request');
    const after=props.directory.getSnapshot().current;
    return {before,wire:requests[0],after,childRequests:0, acknowledgement:reply===undefined?'void':reply?.ok===true?'ok':'other'};
  }
  async function disposeShelf() {
    await fiber.dispose(); check(entries().length===1 && winner().component===native.component,'native seat not restored');
    assertLabel(); paint();
  }
  let fallbackFiber;
  async function noCapability() {
    // Give the shelf a session with no scope/directory. Keep the native
    // resolver and native props fully usable once the shelf retires its seat.
    fallbackFiber=await mount(shelf);
    if(enabled){check(winner().component!==native.component,'shelf failed to re-enter seat');winner().inject('unknown-fixture-session');await Promise.resolve();}
    check(entries().length===1 && winner().component===native.component,'missing session did not return the native entry');
    paint(); // keep this shelf fiber mounted through the positive native click
  }
  async function disposeAll(){root.unmount();await fallbackFiber.dispose();await pickerFiber.dispose();check(!slots.spec(label),'native child survived native owner');await ctx.fiber.dispose();}
  window.seatFixture={paint,verifyRoute,rejectNext:()=>{rejectNext=true;},current:()=>getDir('fixture-session').store.getSnapshot().current,disposeShelf,noCapability,disposeAll,reads:()=>reads,requests};
  paint();return {react:React.version,enabled,earlyWire,label:labelSpec??null,missing:(shelf.inject??[]).filter(k=>ctx.get(k)===undefined)};
}
