import assert from 'node:assert/strict';
import manifest from '../../package.json' with {type:'json'};
import {frontendPage} from './web-fixture.mjs';

// Exercise the real frontend's runPluginBoot -> loader.await -> assertEntriesActive.
// Fixture entry supplies an inert composer/root and no remote.session. It never
// decides whether the graph settled: only the published app renders/mounts it.
const services='fixture-boot-services', marker='fixture-root-after-settlement';
const serviceCode='window.__ModuleLoader__.load({id:'+JSON.stringify(services)+', factory: () => ({ apply(ctx) {'+
  'const provide=(k,v)=>ctx.reflect.provide(k,v);const state={byId:{}};'+
  'provide("sessions",{list:{subscribe:()=>()=>{},getSnapshot:()=>state},subagentAddress:()=>undefined});'+
  'provide("layout",{});provide("slots",{install(){},renderSlot:()=>"'+marker+'",inject:()=>()=>{},register:()=>()=>{},spec:()=>undefined});'+
  'provide("remote",{});provide("modelDirectories",{directoryFor(){throw Error("no fixture session")}});'+
  'provide("uiRenderer",{mount(el){el.textContent="'+marker+'";return ()=>{}}}); }})})';
const poison='fixture-pending-control';
const poisonCode='window.__ModuleLoader__.load({id:"'+poison+'",factory:()=>({inject:["neverProvided"],apply(){throw Error("must not activate")}})})';
async function boot(browser,web,shelf,control) {
  const ids=[services,'dsh-model-shelf',...(control?[poison]:[])];
  const graph={rev:'fixture',entries:ids.map(id=>({id,rev:'fixture',url:'/fixture/'+id+'.js',inject:id===manifest.name?manifest.dsh.client.inject:[],immediately:false}))};
  const scripts=Object.fromEntries(graph.entries.map(({id,url},i)=>[url,[serviceCode,shelf,poisonCode][i]]));
  const f=await frontendPage(browser,web,{graph,scripts});
  try{
    await f.page.waitForFunction(marker=>document.body.innerText.includes(marker)||document.body.innerText.includes('Failed to load plugins'),marker,{timeout:6000});
    const text=(await f.page.locator('body').innerText()).trim();assert.deepEqual(f.denied,[]);assert.deepEqual(f.errors,[]);
    if(text.includes(marker))return {settled:true};
    assert.match(text,/did not activate/);return {settled:false,message:text};
  }finally{await f.context.close();}
}
export async function earlyBoot(browser,web,shelf) {
  const negative=await boot(browser,web,shelf,true);assert.equal(negative.settled,false);assert.match(negative.message,/fixture-pending-control: pending.*neverProvided/);
  const actual=await boot(browser,web,shelf,false);
  if(!actual.settled) assert.match(actual.message,/dsh-model-shelf: pending.*remote.session/);
  return {...actual,negativeControl:'pending entry rejected'};
}
