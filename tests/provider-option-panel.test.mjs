import assert from 'node:assert/strict';
import test from 'node:test';
import { openProviderDrafts, observeProviderTarget, createProviderConnection } from '../src/provider-option-panel.js';

const target = { sessionId:'A', provider:'openai-codex', model:'gpt-5.4', epoch:1, reasoningActive:true };
const option = Object.freeze({ id:'outputVerbosity', label:'回答详略', value:'default', editor:{choices:['default','low','high']}, scope:'影响其他会话', reset:'default' });
function session(result = 'applied') {
  const writes=[], views=[]; let current=true, reads=0;
  const io = { async read() { reads++; return [option]; }, async write(...args) { writes.push(args); return result; } };
  const draft = openProviderDrafts(io,target,()=>current,view=>views.push(view));
  return { draft, writes, views, io, get reads() { return reads; }, invalidate() {current=false;} };
}

test('only an explicit save writes once',async()=>{
  const held=Promise.withResolvers(), s=session(held.promise); await s.draft.load();
  s.draft.edit(option.id,{set:'low'}); s.draft.cancel(option.id); assert.equal(s.views.at(-1).rows[0].value,'default'); assert.deepEqual(s.writes,[]);
  s.draft.edit(option.id,{set:'low'}); const a=s.draft.save(option.id),b=s.draft.save(option.id);
  assert.equal(s.writes.length,1); assert.equal(s.writes[0][0],target); assert.equal(s.writes[0][1],option); assert.deepEqual(s.writes[0][2],{set:'low'});
  held.resolve('applied'); await Promise.all([a,b]); assert.equal(s.views.at(-1).rows[0].result,'applied');
  await s.draft.save(option.id); assert.equal(s.writes.length,1);
});

test('stale completion cannot affect a reopened target',async()=>{
  const held=Promise.withResolvers(), old=session(held.promise); await old.draft.load(); old.draft.edit(option.id,{set:'high'});
  const pending=old.draft.save(option.id);const viewsBefore=old.views.length;old.draft.close();
  const fresh=session(); await fresh.draft.load();held.resolve('applied');await pending;
  assert.equal(old.writes[0][3].aborted,true);assert.equal(old.writes[0][4](),false);assert.equal(old.views.length,viewsBefore);
  assert.equal(fresh.views.at(-1).rows[0].result,undefined);assert.equal(fresh.views.at(-1).rows[0].value,'default');
});

for(const result of ['refused','saved-not-live','conflict','unconfirmed']) test('retain truthful '+result+' until explicit reread',async()=>{
  const s=session(result); await s.draft.load();s.draft.edit(option.id,{set:'high'});await s.draft.save(option.id);
  assert.equal(s.views.at(-1).rows[0].result,result); assert.equal(s.reads,1);await s.draft.save(option.id);assert.equal(s.writes.length,1);
  await s.draft.load();assert.equal(s.reads,2);assert.equal(s.views.at(-1).rows[0].value,'default');assert.equal(s.writes.length,1);
});

test('stale load and lock cannot publish fields or authorize a write',async()=>{
  const held=Promise.withResolvers(),s=session(); s.io.read=()=>held.promise;const first=s.draft.load();s.draft.close();held.resolve([option]);await first;
  assert.ok(s.views.every(v=>v.rows.length===0));const lock=session();await lock.draft.load();lock.draft.edit(option.id,{set:'low'});lock.invalidate();await lock.draft.save(option.id);assert.deepEqual(lock.writes,[]);
});
function store(value) { const subs=new Set();return { getSnapshot:()=>value,subscribe(fn){subs.add(fn);return()=>subs.delete(fn);},set(v){value=v;for(const fn of subs)fn();} }; }
const snapshot={status:'ready',routable:true,current:{provider:target.provider,model:target.model},groups:[{id:target.provider,models:[{id:target.model,reasoning:{defaultEffort:'medium',efforts:['low','medium','high'].map(id=>({id}))}}]}]};
test('retired connection scopes cannot restore their old owner or clear the new owner',()=>{
  const link=createProviderConnection(), a=store('connected'), b=store('connected'), gen=store({id:1});
  const first=link.attach({state:a,generation:gen,rpc:{call(){}}});const old=link.getSnapshot();
  const second=link.attach({state:b,generation:gen,rpc:{call(){}}});const current=link.getSnapshot();assert.notEqual(old,current);
  a.set('disconnected');assert.equal(link.getSnapshot(),current);a.set('connected');first();assert.equal(link.getSnapshot(),current);
  second();assert.equal(link.getSnapshot(),null);
});
function sources() {
  const dir=store(snapshot),link=createProviderConnection(),state=store('connected'),generation=store({id:1});
  const detach=link.attach({state,generation,rpc:{call(){throw Error('observing a target must never send RPC');}}});
  const src=observeProviderTarget(dir,link,target.sessionId), stop=src.subscribe(()=>{});return {dir,link,src,stop,state,generation,detach};
}

test('batched A → B → A, catalog replacement, and reconnect each permanently invalidate the old epoch',()=>{
  const s=sources(), first=s.src.getSnapshot();assert.ok(first.target.reasoningActive);
  s.dir.set({...snapshot,current:{provider:'openai-api',model:target.model}});s.dir.set(snapshot);const second=s.src.getSnapshot();assert.ok(second.target.epoch>first.target.epoch);
  s.dir.set({...snapshot,groups:structuredClone(snapshot.groups)});const third=s.src.getSnapshot();assert.ok(third.target.epoch>second.target.epoch);
  s.state.set('disconnected');assert.equal(s.src.getSnapshot(),null);s.generation.set({id:2});s.state.set('connected');const next=s.src.getSnapshot();assert.ok(next.target.epoch>third.target.epoch);
  s.detach();assert.equal(s.src.getSnapshot(),null);s.stop();
});

test('only the verified exact model/effective effort has a summary; route ambiguity hides the whole section',()=>{
  const s=sources();
  for(const [model,effort,expected] of [['gpt-5.4','low',true],['gpt-5.4','off',false],['gpt-5.4','max',false],['gpt-5.4-other','medium',false]]){
    const m={id:model,reasoning:{efforts:[{id:effort}]}};
    s.dir.set({...snapshot,current:{provider:target.provider,model,reasoningEffort:effort},groups:[{id:target.provider,models:[m]}]});assert.equal(s.src.getSnapshot().target.reasoningActive,expected);
  }
  s.dir.set({...snapshot,groups:[{id:target.provider, models:[{id:target.model, reasoning:{defaultEffort:'high',efforts:[{id:'high'}]}}]}]});
  assert.equal(s.src.getSnapshot().target.reasoningActive,false,'a different implicit mode is not the tested default');
  for(const overrides of [{routable:false},{routable:undefined},{status:'loading'},{groups:[...snapshot.groups,...snapshot.groups]},{groups:[]}]){
    s.dir.set({...snapshot,...overrides});assert.equal(s.src.getSnapshot(),null);
  }
  s.stop();s.detach();
});
