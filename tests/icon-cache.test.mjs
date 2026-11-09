import test from 'node:test';
import assert from 'node:assert/strict';
import { createIconStore } from '../src/icon-cache.js';
import { normalizePreferences } from '../src/preferences.js';

const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
const memory = () => { const m = new Map(); return { getItem:k=>m.get(k)??null, setItem:(k,v)=>m.set(k,v) }; };
const registry = Object.freeze({ special: 'special.png' });
const pngResponse = () => new Response(png, { status: 200, headers: { 'content-type':'image/png' } });

test('network icon setting defaults off and only an explicit true survives normalization', () => {
  assert.equal(normalizePreferences({version:1}).iconNetwork, false);
  assert.equal(normalizePreferences({version:1,iconNetwork:true}).iconNetwork, true);
  assert.equal(normalizePreferences({version:1,iconNetwork:'true'}).iconNetwork, false);
});

test('bundled and cached icons resolve offline and enabling is required for network', async () => {
  const storage=memory(); let calls=0;
  const a=createIconStore({storage, bundled:{built:'data:image/png;base64,YQ=='}, registry, fetcher:async()=>{calls++;return pngResponse();}});
  assert.equal(a.get('built'),'data:image/png;base64,YQ==');
  await a.load('special',false); assert.equal(calls,0); assert.equal(a.get('special'),null);
  await a.load('special',true); assert.equal(calls,1); assert.match(a.get('special'),/^data:image\/png;base64,/);
  const b=createIconStore({storage,bundled:{},registry,fetcher:()=>{throw Error('unexpected');}});
  assert.equal(b.get('special'),a.get('special')); await b.load('special',false);
});

test('requests only an allowlisted fixed slug without credentials, and deduplicates', async () => {
  let calls=[]; const store=createIconStore({storage:memory(),bundled:{},registry,fetcher:async(url,opts)=>{calls.push({url,opts});return pngResponse();}});
  await Promise.all([store.load('special',true),store.load('special',true),store.load('../../secret',true)]);
  assert.equal(calls.length,1); assert.equal(calls[0].url,'https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/special.png');
  assert.equal(calls[0].opts.credentials,'omit'); assert.equal(calls[0].opts.referrerPolicy,'no-referrer');
});

test('bad or oversized responses and unavailable storage leave fallback intact', async () => {
  for(const response of [new Response('bad',{headers:{'content-type':'image/png'}}),new Response(png,{headers:{'content-type':'text/html'}}),new Response(png,{headers:{'content-type':'image/png','content-length':'9999999'}})]){
    const store=createIconStore({storage:memory(),bundled:{},registry,fetcher:async()=>response}); await store.load('special',true); assert.equal(store.get('special'),null);
  }
  const store=createIconStore({storage:{getItem(){throw Error()},setItem(){throw Error()}},bundled:{},registry,fetcher:async()=>pngResponse()});
  await store.load('special',true); assert.match(store.get('special'),/^data:image\/png;base64,/);
});

test('disabling aborts pending downloads and reenabling permits an immediate retry', async () => {
  let resolveFirst; let calls=0;
  const store=createIconStore({storage:memory(),bundled:{},registry,fetcher:async()=>{ calls++; return calls===1 ? new Promise(resolve=>{resolveFirst=resolve;}) : pngResponse(); }});
  store.setEnabled(true); const first=store.load('special');
  store.setEnabled(false); store.setEnabled(true);
  const second=store.load('special'); resolveFirst(pngResponse());
  await Promise.all([first,second]); assert.equal(calls,2); assert.match(store.get('special'),/^data:image\/png;base64,/);
});

test('a previously cached icon can be invalidated after a display decode failure', async () => {
  const storage=memory(); const store=createIconStore({storage,bundled:{},registry,fetcher:async()=>pngResponse()});
  await store.load('special',true); assert.ok(store.get('special'));
  store.discard('special'); assert.equal(store.get('special'),null);
  const reloaded=createIconStore({storage,bundled:{},registry,fetcher:async()=>pngResponse()});
  assert.equal(reloaded.get('special'),null);
});
