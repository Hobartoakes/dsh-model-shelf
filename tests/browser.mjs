import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
const react = await readFile(join(dirname(require.resolve('react/package.json')), 'umd/react.production.min.js'), 'utf8');
const reactDOM = await readFile(join(dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.production.min.js'), 'utf8');
const client = await readFile(new URL('lib/client.js', root), 'utf8');
const html = `<!doctype html><meta charset="utf-8"><title>Model organizer test harness</title>
<style>body{font-family:system-ui;margin:0;background:#fafafa;color:#222}#anchor{position:fixed;bottom:30px;right:30px;padding:14px;background:white;border:1px solid #ddd;border-radius:12px;width:650px}body.dark{--dsw-alias-bg-layer-3:#202126;--dsw-alias-bg-layer-2:#292b30;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#ccc;--dsw-alias-label-tertiary:#aaa;--dsw-alias-border-l1:#444;--dsw-alias-interactive-bg-hover:#30333a;background:#161719;color:#eee}</style>
<div id="anchor"></div><script>${react}</script><script>${reactDOM}</script>
<script>window.__ModuleLoader__={load(entry){window.plugin=entry.factory(name=>name==='react'?React:name==='react-dom'?ReactDOM:undefined)}};</script>
<script>${client}</script>
<script>
const listeners=new Set(); const selected=[]; window.selected=selected;
const groups=[{id:'provider-one',name:'服务商甲 · API 中转',models:Array.from({length:16},(_,i)=>({id:i===0?'gpt-example-a':'model-'+i,name:i===0?'GPT 示例模型（完整名称不截断）':'示例模型 '+i,...(i===0?{reasoning:{defaultEffort:'medium',efforts:[{id:'low',name:'低'},{id:'medium',name:'中'},{id:'high',name:'高'}]}}:{})}))},{id:'provider-two',name:'服务商乙 · 官方 API',models:[{id:'gpt-example-a',name:'GPT 示例模型（相同 ID 不同服务商）'},{id:'another-id',name:'另一款模型'}]}];
let state={current:{provider:'provider-one',model:'gpt-example-a',reasoningEffort:'medium'},groups,status:'ready',failures:[],pending:null,error:null};
const store={subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},getSnapshot(){return state}};
window.setState=(next)=>{state={...state,...next};for(const fn of listeners)fn()};
let shouldFail=false, shouldThrow=false, shouldWait=false; window.failNext=()=>shouldFail=true; window.throwNext=()=>shouldThrow=true; window.slowNext=()=>shouldWait=true;
// WorkBuddy Connect owns these two same-origin routes; the picker is a guest on
// them, so the harness answers exactly like the real pair does — including the
// CTXPATCH fields a patched host adds.
const wbGroups=[...groups,{id:'workbuddy-ai',name:'WorkBuddy AI',models:[{id:'wb-flash',name:'DeepSeek V4.1 Flash'}]}];
const wbProbe={running:false,candidates:['wb-flash'],results:[]};
const wbModels=[{id:'wb-flash',name:'DeepSeek V4.1 Flash',contextWindow:300000,supportedContextWindows:[300000,1000000]}];
const wbOverrides={};
const fetchCalls=[]; window.fetchCalls=fetchCalls; window.wbGroups=wbGroups;
const jsonResponse=(body,ok=true,status=200)=>({ok,status,json:async()=>body});
window.publishEfforts=()=>setState({groups:wbGroups.map(g=>g.id!=='workbuddy-ai'?g:{...g,models:g.models.map(m=>m.id==='wb-flash'?{...m,reasoning:{defaultEffort:'medium',efforts:[{id:'low',name:'低'},{id:'medium',name:'中'},{id:'high',name:'高'}]}}:m)})});
window.fetch=async(url,options)=>{fetchCalls.push({url:String(url),options:options??{}});
 if(String(url).endsWith('/ai/status')){const doc={status:'signed-in',probeKey:'test-key',contextWindowPatch:'0.7.1-ctxpatch.1',contextWindowOverrides:{...wbOverrides},probe:{...wbProbe,results:wbProbe.results.map(r=>({...r}))},models:wbModels.map(m=>({...m,contextWindow:wbOverrides[m.id]??m.contextWindow}))};
  if(localStorage.getItem('wbStock')==='1'){delete doc.contextWindowPatch;delete doc.contextWindowOverrides;for(const m of doc.models)delete m.supportedContextWindows;}
  return jsonResponse(doc);}
 if(String(url).endsWith('/ai/probe')){const body=JSON.parse(options.body);
  if(body.action==='set-model-context-window'){if(body.contextWindow===null)delete wbOverrides[body.model];else wbOverrides[body.model]=body.contextWindow;return jsonResponse({state:'updated',model:body.model,contextWindow:body.contextWindow});}
  wbProbe.candidates=['wb-flash'];wbProbe.results=[{id:'wb-flash',validation:'validating',efforts:['low','medium','high'],probedAt:1}];window.publishEfforts();return jsonResponse({state:'ok',validation:'validating',efforts:['low','medium','high'],requests:2});}
 return jsonResponse({error:'not found'},false,404);};
const disposers=[]; const ctx={effect(fn){const dispose=fn();if(dispose)disposers.push(dispose)},sessions:{subagentAddress(){return undefined}},modelDirectories:{directoryFor(){return {store,resetConnected(){window.setState({status:'ready',pending:null})},async load(){return state},async select(selection){selected.push(selection);window.setState({status:'selecting'});if(shouldWait){shouldWait=false;await new Promise(resolve=>window.finishSelection=resolve)}if(shouldThrow){shouldThrow=false;throw Error('transport disconnected')}if(shouldFail){shouldFail=false;window.setState({status:'error'});return {ok:false,error:{code:'session/writer-held',message:'held'}}}window.setState({current:selection,status:'ready'});return {ok:true}}}}},slots:{inject(name,fn){return fn()},register(options,Component){window.registration=options;window.render=(locked=false)=>{root.render(React.createElement(Component,{locked,...options.inject('test-session')}))};return()=>{}}}};
const root=ReactDOM.createRoot(document.getElementById('anchor'));plugin.apply(ctx);window.render();window.dispose=()=>{root.unmount();for(const fn of disposers.reverse())fn()};
</script>`;
await mkdir(new URL('tests/artifacts/', root), { recursive: true });
const htmlURL = new URL('tests/artifacts/harness.html', root);
await writeFile(htmlURL, html);
const browserOptions = process.env.DSH_TEST_BROWSER_EXECUTABLE
  ? { executablePath: process.env.DSH_TEST_BROWSER_EXECUTABLE, headless: true }
  : { channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true };
// A sandbox that refuses to spawn a browser can still attach to one that was
// started outside it, which keeps this suite runnable during plugin development.
const browser = process.env.DSH_TEST_CDP_URL
  ? await chromium.connectOverCDP(process.env.DSH_TEST_CDP_URL)
  : await chromium.launch(browserOptions);
let checks = 0;
const ok = (name) => { checks++; console.log(`PASS ${name}`); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(htmlURL.href);
  const open = async () => { await page.locator('.dmo-trigger').click(); await page.locator('.dmo-panel').waitFor({ state: 'visible' }); };
  // Exercise the real bundled picker; only the native directory boundary is synthetic.
  const prefsKey = 'dsh-model-shelf.preferences.v1';
  const one = '["provider-one","gpt-example-a"]', two = '["provider-two","gpt-example-a"]';
  const other = '["provider-one","model-1"]';
  const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), prefsKey);
  const reset = async (prefs = {}) => {
    await page.evaluate(({ key, prefs }) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify({ version: 1, ...prefs })); }, { key: prefsKey, prefs });
    await page.reload(); await open();
  };
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const rowKeys = () => page.locator('.dmo-row').evaluateAll(rows => rows.map(row => row.dataset.modelKey));
  const groupIds = () => page.locator('.dmo-group').evaluateAll(rows => rows.map(row => row.dataset.providerId));
  // Icons are local, decorative, and preserve provider/model identities.
  await reset();
  assert.ok(await page.getByText('图标依据目录标识，不验证实际上游。', { exact: true }).isVisible());
  const iconNetworkRequests = [];
  const onIconRequest = req => { if (req.resourceType() === 'image' && /^https?:/i.test(req.url())) iconNetworkRequests.push(req.url()); };
  page.on('request', onIconRequest);
  await page.evaluate(() => setState({ groups: [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }] }], current: { provider: 'deepseek-official', model: 'deepseek-v4.1-flash' } }));
  const iconGroup = page.locator('.dmo-group[data-provider-id="deepseek-official"]');
  assert.equal(await iconGroup.locator('.dmo-provider-icon[data-icon="default"]').count(), 1);
  assert.equal(await iconGroup.locator('.dmo-model-icon[data-icon="default"]').count(), 1);
  assert.equal(await iconGroup.locator('.dmo-model-icon').getAttribute('aria-hidden'), 'true');
  await iconGroup.locator('.dmo-group-heading').click();
  assert.equal(await iconGroup.locator('.dmo-provider-icon[data-icon="default"]').count(), 1);
  await iconGroup.locator('.dmo-group-heading').click();
  await iconGroup.locator('.dmo-favorite').click();
  await page.getByRole('tab', { name: /^收藏/ }).click();
  assert.equal(await page.locator('.dmo-model-icon[data-icon="default"]').count(), 1);
  await page.evaluate(() => setState({ groups: [{ id: 'relay', name: 'Relay', models: [{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }] }] }));
  await page.getByRole('tab', { name: /^主列表/ }).click();
  assert.equal(await page.locator('.dmo-provider-icon[data-icon="default"]').count(), 1);
  assert.equal(await page.locator('.dmo-model-icon[data-icon="default"]').count(), 1);
  await page.evaluate(() => setState({ groups: [
    { id: 'workbuddy', name: 'WorkBuddy', models: [{ id: 'claude-sonnet-4-5', name: 'Claude' }] },
    { id: 'openai-codex', name: 'ChatGPT', models: [{ id: 'gpt-6.1-terra', name: 'GPT' }] }
  ] }));
  assert.equal(await page.locator('.dmo-provider-icon[data-icon="default"]').count(), 2);
  assert.equal(await page.locator('.dmo-model-icon[data-icon="default"]').count(), 2);
  for (const img of await page.locator('.dmo-list img.dmo-icon').all()) {
    await img.evaluate(el => el.decode());
    assert.ok(await img.evaluate(el => el.naturalWidth > 0));
  }
  assert.deepEqual(iconNetworkRequests, []);
  page.off('request', onIconRequest);
  ok('provider and model icons appear offline with stable identities');
  // Collapsed provider cards keep every organization control in a compact row.
  await reset({ providerNotes: { 'provider-one': '工作账号' } });
  const compactGroup = page.locator('.dmo-group[data-provider-id="provider-one"]');
  await compactGroup.locator('.dmo-group-heading').click();
  assert.equal(await compactGroup.locator('.dmo-group-heading').getAttribute('aria-expanded'), 'false');
  const compactLayout = await compactGroup.evaluate(group => {
    const rect = selector => group.querySelector(selector).getBoundingClientRect();
    const drag = rect('.dmo-drag'), up = rect('.dmo-order-up'), down = rect('.dmo-order-down');
    const note = rect('.dmo-note-action'), action = rect('.dmo-provider-action'), bounds = group.getBoundingClientRect();
    return { orderRow: Math.abs(drag.y - up.y) < 2 && Math.abs(up.y - down.y) < 2,
      actionRow: Math.abs(note.y - action.y) < 2, height: bounds.height, text: group.innerText };
  });
  assert.ok(compactLayout.orderRow, 'drag/up/down must share a row');
  assert.ok(compactLayout.actionRow, 'note and archive buttons must share a row');
  assert.ok(compactLayout.height <= 72, `collapsed card must be compact: ${compactLayout.height}px`);
  for (const text of ['服务商甲', 'provider-one', '工作账号', '16 款']) assert.ok(compactLayout.text.includes(text));
  ok('collapsed provider card fits organization controls on compact rows');
  // Long notes remain discoverable and narrow cards keep controls inside their bounds.
  const longNote = '长备注'.repeat(40);
  await reset({ providerNotes: { 'provider-one': longNote } });
  // Keep this case focused on the card: a long note for the current model also
  // exposes an unrelated pre-existing footer overflow at small viewport heights.
  await page.evaluate(() => setState({ current: { provider: 'provider-two', model: 'another-id' } }));
  await page.setViewportSize({ width: 320, height: 600 });
  await compactGroup.locator('.dmo-group-heading').click(); await settle();
  assert.ok((await compactGroup.locator('.dmo-group-title').getAttribute('title')).includes(longNote));
  await compactGroup.locator('.dmo-group-heading').focus();
  const detailsMetrics = await compactGroup.locator('.dmo-group-details').evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, whiteSpace: getComputedStyle(el).whiteSpace, active: document.activeElement?.className }));
  assert.ok(detailsMetrics.scrollWidth <= detailsMetrics.clientWidth && detailsMetrics.scrollHeight <= detailsMetrics.clientHeight, `keyboard focus must reveal full ID and note: ${JSON.stringify(detailsMetrics)}`);
  for (const selector of ['.dmo-drag', '.dmo-order-up', '.dmo-order-down', '.dmo-note-action', '.dmo-provider-action']) {
    const contained = await compactGroup.locator(selector).evaluate(el => {
      const a = el.getBoundingClientRect(), b = el.closest('.dmo-group').getBoundingClientRect();
      return a.left >= b.left && a.right <= b.right;
    });
    assert.ok(contained, `${selector} must remain inside a narrow card`);
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await reset({ providerNotes: { 'provider-one': '工作账号' } });
  await compactGroup.locator('.dmo-group-heading').click();
  await compactGroup.locator('.dmo-provider-action').click();
  await page.getByRole('tab', { name: /^不常用/ }).click();
  const archived = page.locator('.dmo-group[data-provider-id="provider-one"]');
  if (await archived.locator('.dmo-group-heading').getAttribute('aria-expanded') === 'true') await archived.locator('.dmo-group-heading').click();
  assert.ok(await archived.getByRole('button', { name: '恢复服务商：provider-one' }).isVisible());
  assert.ok(await archived.locator('.dmo-note-action').isVisible());
  await page.setViewportSize({ width: 1280, height: 1000 });
  ok('long notes and archived provider controls remain usable in narrow cards');
  // The composer owns these inherited variables; exercise the actual built trigger.
  await reset({ providerNotes: { 'provider-one': '工作账号' } });
  await page.keyboard.press('Escape'); await settle();
  const trigger = page.locator('.dmo-trigger');
  const triggerCopy = trigger.locator('.dmo-trigger-copy');
  const triggerIcon = trigger.locator('svg');
  const wideText = '工作账号 · GPT 示例模型（完整名称不截断） · 中';
  const fullName = 'GPT 示例模型（完整名称不截断） · 工作账号 · 服务商甲 · API 中转（provider-one） / gpt-example-a · 中';
  assert.equal(await triggerCopy.isVisible(), true);
  assert.equal(await triggerCopy.innerText(), wideText);
  assert.equal(await triggerIcon.isVisible(), false);
  await page.locator('#anchor').evaluate(anchor => {
    anchor.style.setProperty('--dsh-composer-model-text-display', 'none');
    anchor.style.setProperty('--dsh-composer-model-icon-display', 'block');
  });
  assert.equal(await triggerCopy.isVisible(), false, 'inherited compact mode hides trigger text');
  assert.equal(await triggerIcon.isVisible(), true, 'inherited compact mode shows a decorative icon');
  assert.equal(await page.getByRole('button', { name: fullName, exact: true }).count(), 1);
  assert.equal(await triggerIcon.getAttribute('aria-hidden'), 'true');
  assert.equal(await triggerIcon.getAttribute('focusable'), 'false');
  assert.equal(await trigger.getByRole('img').count(), 0);
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.body.classList.toggle('dark', dark), dark);
    assert.equal(await triggerIcon.evaluate(icon => getComputedStyle(icon).stroke === getComputedStyle(icon.parentElement).color), true);
  }
  await page.evaluate(() => document.body.classList.remove('dark'));
  for (const key of ['Enter', 'Space']) {
    await trigger.focus(); await page.keyboard.press(key);
    await page.getByRole('dialog', { name: '模型选择器', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.getByRole('searchbox').evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('Escape'); await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
  }
  assert.equal(await page.evaluate(() => selected.length), 0);
  await page.evaluate(() => setState({ current: { provider: 'provider-two', model: 'gpt-example-a' } }));
  await settle();
  assert.equal(await page.getByRole('button', { name: 'GPT 示例模型（相同 ID 不同服务商） · 服务商乙 · 官方 API（provider-two） / gpt-example-a', exact: true }).count(), 1);
  await page.evaluate(() => setState({ current: { provider: 'provider-one', model: 'gpt-example-a', reasoningEffort: 'medium' } }));
  await settle();
  await page.locator('#anchor').evaluate(anchor => {
    anchor.style.setProperty('--dsh-composer-model-text-display', 'block');
    anchor.style.setProperty('--dsh-composer-model-icon-display', 'none');
  });
  assert.equal(await triggerCopy.isVisible(), true);
  assert.equal(await triggerCopy.innerText(), wideText);
  assert.equal(await triggerIcon.isVisible(), false);
  await page.locator('#anchor').evaluate(anchor => {
    anchor.style.removeProperty('--dsh-composer-model-text-display');
    anchor.style.removeProperty('--dsh-composer-model-icon-display');
  });
  assert.equal(await triggerCopy.isVisible(), true);
  assert.equal(await triggerCopy.innerText(), wideText);
  assert.equal(await triggerCopy.evaluate(copy => getComputedStyle(copy).userSelect), 'text');
  assert.equal(await triggerIcon.isVisible(), false);
  assert.equal(await page.getByRole('button', { name: fullName, exact: true }).count(), 1);
  ok('inherited composer compact mode preserves full identity, themed decorative icon, keyboard activation and wide fallback');

  const organizationFailures = [];
  const scenario = async (name, run) => {
    try { await run(); ok(name); } catch (error) { organizationFailures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
  };
  await scenario('flat favorites share display/keyboard order and atomic favorite membership', async () => {
    await reset({ collapsed: ['["favorites","provider-one"]', '["favorites","provider-two"]'], providerNotes: { 'provider-two': 'Personal route' } });
    await page.getByRole('button', { name: /^收藏：服务商乙 .*gpt-example-a/ }).click();
    await page.getByRole('button', { name: '收藏：服务商甲 · API 中转 / model-1', exact: true }).click();
    await page.getByRole('button', { name: '收藏：服务商甲 · API 中转 / gpt-example-a', exact: true }).click();
    assert.deepEqual((await saved()).favorites, [two, other, one]);
    assert.deepEqual((await saved()).favoriteOrder, [two, other, one]);
    assert.equal(await page.evaluate(() => selected.length), 0);
    await page.getByRole('tab', { name: /^收藏/ }).click();
    assert.deepEqual(await rowKeys(), [two, other, one]);
    assert.equal(await page.locator('.dmo-group-heading, .dmo-tools').count(), 0);
    assert.ok((await page.locator('.dmo-row').first().innerText()).includes('Personal route'));
    await page.setViewportSize({ width: 390, height: 600 }); await settle();
    assert.equal(await page.locator('.dmo-panel').evaluate(e => e.scrollWidth <= e.clientWidth), true);
    await page.screenshot({ path: fileURLToPath(new URL('tests/artifacts/flat-favorites-narrow.png', root)) });
    await page.setViewportSize({ width: 1280, height: 1000 }); await settle();
    await page.locator('.dmo-row').first().locator('.dmo-select').click();
    await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => selected.at(-1)), { provider: 'provider-two', model: 'gpt-example-a' });
    await open();
    await page.getByRole('searchbox').press('ArrowDown'); await page.getByRole('searchbox').press('ArrowDown'); await page.getByRole('searchbox').press('Enter');
    await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => selected.at(-1)), { provider: 'provider-one', model: 'model-1' });
    await open(); await page.getByRole('searchbox').press('ArrowUp'); await page.getByRole('searchbox').press('Enter');
    await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => selected.at(-1)), { provider: 'provider-one', model: 'gpt-example-a' });
    await open(); await page.locator('.dmo-row').first().locator('.dmo-favorite').click();
    assert.deepEqual((await saved()).favoriteOrder, [other, one]);
    await page.getByRole('tab', { name: /^主列表/ }).click();
    await page.getByRole('button', { name: /^收藏：服务商乙 .*gpt-example-a/ }).click();
    assert.deepEqual((await saved()).favoriteOrder, [other, one, two]);
    await page.getByRole('tab', { name: /^收藏/ }).click();
    assert.deepEqual(await rowKeys(), [other, one, two]);
    await page.getByRole('searchbox').fill('Personal route'); assert.deepEqual(await rowKeys(), [two]);
  });
  await scenario('provider archive inherits arrivals, preserves individual flags and restores explicitly', async () => {
    await reset({ uncommon: [other, '["provider-two","another-id"]'], favorites: [one], providerOrder: { main: ['offline-main'], uncommon: ['offline-uncommon'] } });
    await page.getByRole('searchbox').fill('provider-one gpt-example-a');
    await page.getByRole('button', { name: '整组移至不常用：provider-one', exact: true }).click({ timeout: 2000 });
    assert.equal(await page.locator('.dmo-row').count(), 0);
    assert.equal(await page.evaluate(() => selected.length), 0);
    assert.deepEqual(await page.evaluate(() => state.current), { provider: 'provider-one', model: 'gpt-example-a', reasoningEffort: 'medium' });
    assert.deepEqual((await saved()).collapsed, []);
    assert.deepEqual((await saved()).providerOrder.uncommon, ['offline-uncommon', 'provider-two', 'provider-one']);
    assert.deepEqual((await saved()).uncommon, [other, '["provider-two","another-id"]']);
    await page.getByRole('searchbox').fill(''); await page.getByRole('tab', { name: /^不常用/ }).click();
    assert.deepEqual(await groupIds(), ['provider-two', 'provider-one']);
    const archived = page.locator('.dmo-group[data-provider-id="provider-one"]');
    assert.ok(await archived.locator('.dmo-move').first().isDisabled());
    assert.ok((await archived.innerText()).includes('先恢复服务商'));
    await page.evaluate(() => setState({ groups: groups.map(g => g.id === 'provider-one' ? { ...g, models: [...g.models, { id: 'new-arrival', name: 'New arrival' }] } : g) }));
    assert.equal(await archived.locator('.dmo-row').count(), 17);
    await page.getByRole('tab', { name: /^收藏/ }).click();
    assert.deepEqual(await rowKeys(), [one]);
    await page.locator('.dmo-select').click(); await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => selected.at(-1).provider), 'provider-one');
    await open();
    await page.getByRole('button', { name: '恢复服务商：provider-one', exact: true }).click();
    assert.deepEqual((await saved()).uncommonProviders, []);
    assert.deepEqual((await saved()).providerOrder.main, ['offline-main', 'provider-two', 'provider-one']);
    await page.getByRole('tab', { name: /^主列表/ }).click();
    assert.deepEqual(await groupIds(), ['provider-two', 'provider-one']);
    assert.ok((await rowKeys()).includes('["provider-one","new-arrival"]'));
    assert.ok(!(await rowKeys()).includes(other));
    await page.getByRole('tab', { name: /^不常用/ }).click();
    assert.deepEqual(await rowKeys(), ['["provider-two","another-id"]', other]);
  });
  await scenario('remembered empty favorites wins over current model across reopen and reload', async () => {
    await reset({ uncommonProviders: ['provider-one'] });
    assert.equal(await page.getByRole('tab', { name: /^不常用/ }).getAttribute('aria-selected'), 'true');
    assert.equal((await saved()).lastList, null);
    await page.getByRole('tab', { name: /^收藏/ }).click();
    assert.equal((await saved()).lastList, 'favorites');
    await page.keyboard.press('Escape'); await open();
    assert.equal(await page.getByRole('tab', { name: /^收藏/ }).getAttribute('aria-selected'), 'true');
    await page.reload(); await open();
    assert.equal(await page.getByRole('tab', { name: /^收藏/ }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('.dmo-row').count(), 0);
    await reset({ uncommon: [one] });
    assert.equal(await page.getByRole('tab', { name: /^不常用/ }).getAttribute('aria-selected'), 'true');
    await reset(); assert.equal(await page.getByRole('tab', { name: /^主列表/ }).getAttribute('aria-selected'), 'true');
  });
  await scenario('catalog orders persist unsearched arrivals once and retain offline positions', async () => {
    await reset({ favorites: [two, one], providerOrder: { main: ['offline', 'provider-two'], uncommon: ['offline-uncommon'] } });
    await settle();
    assert.deepEqual((await saved()).providerOrder.main, ['offline', 'provider-two', 'provider-one']);
    assert.deepEqual((await saved()).favoriteOrder, [one, two]);
    await page.evaluate(() => {
      window.preferenceWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key === 'dsh-model-shelf.preferences.v1') window.preferenceWrites++; return original.call(this, key, value); };
    });
    await page.getByRole('searchbox').fill('no-match');
    await page.evaluate(() => setState({ groups: [...groups, { id: 'new-provider', name: 'New', models: [{ id: 'new', name: 'New' }] }] }));
    await settle();
    assert.deepEqual((await saved()).providerOrder.main, ['offline', 'provider-two', 'provider-one', 'new-provider']);
    assert.equal(await page.evaluate(() => preferenceWrites), 1);
    await page.evaluate(() => setState({ groups: [...state.groups].reverse() })); await settle();
    assert.equal(await page.evaluate(() => preferenceWrites), 1);
    await page.evaluate(() => setState({ groups: [groups[0]] })); await settle();
    assert.deepEqual((await saved()).favoriteOrder, [one, two]);
    await page.evaluate(() => setState({ groups: [...groups].reverse() })); await settle();
    assert.equal(await page.evaluate(() => preferenceWrites), 1);
    await page.getByRole('searchbox').fill('');
    assert.deepEqual(await groupIds(), ['provider-two', 'provider-one']);
  });
  await scenario('catalog discovery does not overwrite corrupt preferences or hide their warning', async () => {
    await page.evaluate(key => localStorage.setItem(key, '{broken'), prefsKey);
    await page.reload(); await open(); await settle();
    assert.equal(await page.getByRole('alert').count(), 1);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), prefsKey), '{broken');
    await page.getByRole('tab', { name: /^收藏/ }).click();
    assert.equal((await saved()).lastList, 'favorites');
    assert.equal(await page.getByRole('alert').count(), 0);
  });
  await scenario('provider drag reorders full keys independently without selection or folding', async () => {
    await reset({ lastList: 'main', uncommon: [other, '["provider-two","another-id"]'], providerOrder: { main: ['provider-one', 'offline', 'provider-two'], uncommon: ['provider-one', 'provider-two'] } });
    const handles = page.locator('.dmo-drag');
    assert.equal(await handles.count(), 2, 'independent provider handles exist');
    await page.getByRole('button', { name: '全部折叠', exact: true }).click();
    await handles.first().dragTo(handles.last());
    assert.deepEqual(await groupIds(), ['provider-two', 'provider-one']);
    assert.deepEqual((await saved()).providerOrder.main, ['offline', 'provider-two', 'provider-one']);
    assert.deepEqual((await saved()).providerOrder.uncommon, ['provider-one', 'provider-two']);
    assert.equal(await page.locator('.dmo-row').count(), 0);
    assert.equal(await page.evaluate(() => selected.length), 0);
    await page.getByRole('tab', { name: /^不常用/ }).click();
    await handles.first().dragTo(handles.last());
    assert.deepEqual(await groupIds(), ['provider-two', 'provider-one']);
    await page.reload(); await open();
    assert.deepEqual(await groupIds(), ['provider-two', 'provider-one']);
    await page.getByRole('tab', { name: /^主列表/ }).click();
    assert.deepEqual(await groupIds(), ['provider-two', 'provider-one']);
    await page.evaluate(() => setState({ groups: [...groups, { id: 'new-provider', models: [{ id: 'new' }] }, { id: 'offline', models: [{ id: 'back' }] }] }));
    assert.deepEqual(await groupIds(), ['offline', 'provider-two', 'provider-one', 'new-provider']);
    await settle();
    assert.deepEqual((await saved()).providerOrder.main, ['offline', 'provider-two', 'provider-one', 'new-provider']);
  });
  await scenario('keyboard ordering skips offline neighbors, retains focus and announces position', async () => {
    await reset({ lastList: 'main', providerOrder: { main: ['provider-one', 'offline', 'provider-two'] } });
    assert.equal(await page.locator('.dmo-order-up').count(), 2, 'keyboard alternatives exist');
    assert.ok(await page.locator('.dmo-order-up').first().isDisabled());
    assert.ok(await page.locator('.dmo-order-down').last().isDisabled());
    const down = page.locator('.dmo-group[data-provider-id="provider-one"] .dmo-order-down');
    await down.focus(); await page.keyboard.press('Enter');
    assert.deepEqual(await groupIds(), ['provider-two', 'provider-one']);
    assert.deepEqual((await saved()).providerOrder.main, ['offline', 'provider-two', 'provider-one']);
    assert.ok((await page.locator('.dmo-order-status').innerText()).includes('第 2 / 2'));
    assert.equal(await page.evaluate(() => document.activeElement.closest('.dmo-group')?.dataset.providerId), 'provider-one');
    await page.keyboard.press('Enter');
    assert.deepEqual(await groupIds(), ['provider-one', 'provider-two']);
    assert.equal(await page.evaluate(() => selected.length), 0);
    assert.deepEqual((await saved()).collapsed, []);
  });
  await scenario('favorite drag and keyboard reorder persist full identities and append new items', async () => {
    const offline = '["offline","model"]';
    await reset({ lastList: 'favorites', favorites: [one, two, offline], favoriteOrder: [one, offline, two] });
    await page.locator('.dmo-drag').first().dragTo(page.locator('.dmo-drag').last());
    assert.deepEqual(await rowKeys(), [two, one]);
    assert.deepEqual((await saved()).favoriteOrder, [offline, two, one]);
    await page.locator('.dmo-order-up').last().focus(); await page.keyboard.press('Space');
    assert.deepEqual(await rowKeys(), [one, two]);
    assert.deepEqual((await saved()).favoriteOrder, [offline, one, two]);
    assert.equal(await page.evaluate(() => selected.length), 0);
    await page.reload(); await open(); assert.deepEqual(await rowKeys(), [one, two]);
    await page.getByRole('tab', { name: /^主列表/ }).click();
    await page.getByRole('button', { name: '收藏：服务商甲 · API 中转 / model-1', exact: true }).click();
    await page.getByRole('tab', { name: /^收藏/ }).click();
    assert.deepEqual(await rowKeys(), [one, two, other]);
    await page.evaluate(() => setState({ groups: [...groups, { id: 'offline', name: 'Returned', models: [{ id: 'model', name: 'Returned model' }] }] }));
    assert.deepEqual(await rowKeys(), [offline, one, two, other]);
  });
  // Start a real browser mouse gesture, then alter the directory/UI before release.
  const beginDrag = async (source) => {
    await source.scrollIntoViewIfNeeded();
    await page.evaluate(() => { window.dragStarts = 0; document.addEventListener('dragstart', () => window.dragStarts++, { once: true, capture: true }); });
    const b = await source.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 12, b.y + b.height / 2 + 6, { steps: 4 });
    await page.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2 + 8);
    assert.equal(await page.evaluate(() => dragStarts), 1, 'native dragstart fired');
  };
  const releaseAt = async (target) => {
    const b = await target.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.up(); await settle();
  };
  await scenario('native drags cancel across tabs, query, source disappearance and Escape', async () => {
    for (const list of ['main', 'favorites']) {
      const setup = async () => {
        await reset({ lastList: list, favorites: [one, two], uncommon: [other, '["provider-two","another-id"]'], collapsed: ['["main","provider-one"]', '["main","provider-two"]'] });
        await settle();
      };
      const orders = async () => { const p = await saved(); return { providers: p.providerOrder, favorites: p.favoriteOrder }; };
      for (const reason of ['tab', 'tab-back', 'query', 'query-clear', 'source', 'source-return', 'escape']) {
        await setup(); const before = await orders();
        await beginDrag(page.locator('.dmo-drag').first());
        if (reason.startsWith('tab')) {
          await page.getByRole('tab', { name: /^不常用/ }).evaluate(e => e.click());
          assert.equal(await page.getByRole('tab', { name: /^不常用/ }).getAttribute('aria-selected'), 'true');
          if (reason === 'tab-back') await page.getByRole('tab', { name: list === 'main' ? /^主列表/ : /^收藏/ }).evaluate(e => e.click());
        } else if (reason.startsWith('query')) {
          await page.getByRole('searchbox').fill('provider');
          if (reason === 'query-clear') await page.getByRole('searchbox').fill('');
        } else if (reason.startsWith('source')) {
          await page.evaluate(() => setState({ groups: [groups[1]] })); await settle();
          assert.equal(await page.locator('.dmo-drag').count(), 1, 'actual source disappeared');
          if (reason === 'source-return') { await page.evaluate(() => setState({ groups })); await settle(); }
        } else { await page.keyboard.press('Escape'); }
        await releaseAt(page.locator('.dmo-drag').last());
        assert.deepEqual(await orders(), before, `${list}: ${reason} cannot reorder`);
        assert.equal(await page.evaluate(() => selected.length), 0);
        if (await page.locator('.dmo-group-heading[aria-expanded="false"]').count()) await page.locator('.dmo-group-heading[aria-expanded="false"]').first().click();
        await page.locator('.dmo-select').first().click({ timeout: 2000 });
        await page.locator('.dmo-panel').waitFor({ state: 'hidden', timeout: 2000 });
        assert.equal(await page.evaluate(() => selected.length), 1, 'next intentional click is not swallowed');
      }
      await setup(); const before = await orders();
      await page.getByRole('searchbox').fill('provider');
      assert.equal(await page.locator('.dmo-order button:enabled').count(), 0);
      assert.equal(await page.locator('[draggable="true"]').count(), 0);
      await page.getByRole('searchbox').fill('');
      // Untrusted external data must not create an internal drag capability.
      await page.locator('.dmo-drag').last().evaluate(e => { const dt = new DataTransfer(); dt.setData('text/plain', 'provider-one'); e.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt })); });
      assert.deepEqual(await orders(), before);
    }
  });
  await scenario('order controls remain readable and separate from copyable identity in both themes and narrow layouts', async () => {
    for (const list of ['main', 'favorites']) {
      await page.setViewportSize({ width: 1280, height: 1000 });
      await reset({ lastList: list, favorites: [one, two], providerNotes: { 'provider-one': '工作账号 / Full account identity' } });
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.body.classList.toggle('dark', dark), dark);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 600 : 1000 }); await settle();
          const layout = await page.locator('.dmo-panel').evaluate(panel => {
            const container = panel.querySelector('.dmo-group-top, .dmo-row');
            const identity = container.querySelector('.dmo-group-heading, .dmo-select');
            const actions = container.querySelector('.dmo-provider-actions, .dmo-row-actions');
            const order = container.querySelector('.dmo-order');
            const i = identity.getBoundingClientRect(), a = actions.getBoundingClientRect(), o = order.getBoundingClientRect();
            return { overflow: panel.scrollWidth > panel.clientWidth || panel.querySelector('.dmo-list').scrollWidth > panel.querySelector('.dmo-list').clientWidth,
              separated: o.right <= i.left && i.right <= a.left, copyable: getComputedStyle(identity).userSelect, draggable: identity.draggable,
              identity: identity.textContent };
          });
          assert.equal(layout.overflow, false); assert.equal(layout.separated, true);
          assert.equal(layout.copyable, 'text'); assert.equal(layout.draggable, false);
          assert.ok(layout.identity.includes('provider-one')); assert.ok(layout.identity.includes('Full account identity'));
          await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL(`tests/artifacts/order-${list}-${dark ? 'dark' : 'light'}-${width}.png`, root)) });
        }
      }
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
  });
  await scenario('locked session keeps selection blocked with order controls present', async () => {
    await reset({ lastList: 'favorites', favorites: [one, two] });
    await page.evaluate(() => render(true)); await settle();
    assert.equal(await page.locator('.dmo-select').first().getAttribute('aria-disabled'), 'true');
    await page.locator('.dmo-select').first().click({ force: true });
    await page.locator('.dmo-order-down').first().click();
    assert.equal(await page.evaluate(() => selected.length), 0);
    await page.keyboard.press('Escape');
    await page.locator('.dmo-trigger').click({ force: true }); assert.equal(await page.locator('.dmo-panel').count(), 0);
  });
  assert.deepEqual(organizationFailures, []);
  await reset();
  assert.equal(await page.evaluate(() => window.registration.priority), -100);
  // DSH 0.2.1: the seat's own registration must NOT declare the model-label
  // child slot. The host's model-selection plugin already declares it, and a key
  // may only be declared once — a second declaration makes that plugin throw on
  // every load. Assert the shelf stays out of it.
  assert.equal(await page.evaluate(() => window.registration.children), undefined);
  assert.equal(await page.evaluate(() => plugin.inject.includes('remote') && plugin.inject.includes('remote.session')), true);
  assert.equal(await page.getByRole('searchbox').evaluate((e) => e === document.activeElement), true);
  const box = await page.locator('.dmo-panel').boundingBox(); assert.equal(Math.round(box.width), 640); assert.ok(box.height > 360); assert.ok(box.y >= 12 && box.y + box.height <= 988);
  ok('wide/tall popup stays inside viewport and overrides named slot');
  assert.equal(await page.locator('.dmo-row').count(), 18);
  assert.ok((await page.locator('.dmo-row').first().innerText()).includes('服务商甲 · API 中转（provider-one）'));
  assert.ok((await page.locator('.dmo-row').first().innerText()).includes('模型 ID：gpt-example-a'));
  ok('every row displays provider and exact model ID');
  // Regression screenshots stay in ignored artifacts; never overwrite publication images.
  await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL('tests/artifacts/main-list.png', root)) });
  await page.evaluate(() => document.body.classList.add('dark'));
  await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL('tests/artifacts/dark-list.png', root)) });
  await page.evaluate(() => document.body.classList.remove('dark'));
  await page.getByRole('button', { name: '移至不常用：服务商甲 · API 中转 / gpt-example-a', exact: true }).click();
  assert.equal(await page.locator('.dmo-row').count(), 17); assert.equal(await page.evaluate(() => selected.length), 0);
  await page.getByRole('tab', { name: '不常用 (1)', exact: true }).click(); assert.equal(await page.locator('.dmo-row').count(), 1);
  ok('manual move does not select/delete model or move identical ID from another provider');
  await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL('tests/artifacts/uncommon-list.png', root)) });
  await page.reload(); await open();
  assert.equal(await page.getByRole('tab', { name: '不常用 (1)', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByRole('button', { name: '移回主列表：服务商甲 · API 中转 / gpt-example-a', exact: true }).click();
  await page.getByRole('tab', { name: '主列表 (18)', exact: true }).click(); assert.equal(await page.locator('.dmo-row').count(), 18);
  ok('manual preference persists on reload and restores to main list');
  await page.getByRole('button', { name: '全部折叠', exact: true }).click(); assert.equal(await page.locator('.dmo-row').count(), 0);
  await page.getByRole('searchbox').fill('服务商乙 gpt-example-a'); assert.equal(await page.locator('.dmo-row').count(), 1);
  await page.getByRole('searchbox').fill(''); assert.equal(await page.locator('.dmo-row').count(), 0);
  await page.reload(); await open(); assert.equal(await page.locator('.dmo-row').count(), 0);
  await page.getByRole('button', { name: '全部展开', exact: true }).click();
  ok('fold state persists; search temporarily expands without overwriting fold preference');
  await page.evaluate(() => failNext());
  await page.getByRole('button', { name: '选择 服务商乙 · 官方 API 的 另一款模型，模型 ID another-id', exact: true }).click();
  await page.getByRole('alert').waitFor(); assert.ok(await page.locator('.dmo-panel').isVisible());
  ok('rejected selection stays open with actionable error');
  await page.getByLabel('思考强度', { exact: true }).selectOption('high');
  assert.equal(await page.evaluate(() => selected.at(-1).reasoningEffort), 'high'); assert.ok(await page.locator('.dmo-panel').isVisible());
  ok('reasoning strength retains native selection API');
  await page.getByRole('button', { name: '选择 服务商甲 · API 中转 的 GPT 示例模型（完整名称不截断），模型 ID gpt-example-a', exact: true }).click();
  await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => selected.at(-1).reasoningEffort), 'high');
  await open(); ok('reselecting current model preserves customized reasoning strength');
  await page.evaluate(() => throwNext());
  await page.getByRole('button', { name: '选择 服务商乙 · 官方 API 的 另一款模型，模型 ID another-id', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button', { name: '选择 服务商乙 · 官方 API 的 另一款模型，模型 ID another-id', exact: true }).isDisabled(), false);
  assert.ok(await page.getByRole('button', { name: '重新加载', exact: true }).isVisible());
  ok('transport rejection resets native pending selection instead of stranding disabled controls');
  await page.getByRole('searchbox').fill('服务商乙 another-id');
  await page.getByRole('searchbox').press('ArrowDown'); await page.getByRole('searchbox').press('Enter');
  await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => selected.at(-1)), { provider: 'provider-two', model: 'another-id' });
  ok('keyboard search selects exact provider/model pair');
  await open(); await page.keyboard.press('Escape'); assert.equal(await page.locator('.dmo-panel').count(), 0); assert.equal(await page.locator('.dmo-trigger').evaluate((e) => e === document.activeElement), true);
  ok('Escape closes and restores trigger focus');
  await open();
  await page.evaluate(() => slowNext());
  await page.getByRole('button', { name: '选择 服务商甲 · API 中转 的 示例模型 1，模型 ID model-1', exact: true }).click();
  await page.keyboard.press('Escape'); await open();
  await page.evaluate(() => finishSelection());
  await page.waitForFunction(() => document.querySelector('.dmo-current')?.textContent.includes('model-1'));
  assert.ok(await page.locator('.dmo-panel').isVisible());
  ok('late async success cannot close a newly reopened popup');
  await page.evaluate(() => setState({groups:[],current:{provider:'offline-provider',model:'offline-model',reasoningEffort:'high'},retainedEffort:'高',routable:false}));
  assert.ok((await page.locator('.dmo-current').innerText()).includes('已保留思考强度：高'));
  assert.ok((await page.locator('.dmo-current').innerText()).includes('当前模型暂不可用'));
  await page.evaluate(() => setState({groups,current:{provider:'provider-two',model:'another-id'},retainedEffort:undefined,routable:true}));
  ok('unavailable catalog preserves current identity and retained reasoning label');
  await page.locator('.dmo-close').focus(); await page.keyboard.press('Shift+Tab'); assert.ok(await page.locator('.dmo-panel').evaluate((e) => e.contains(document.activeElement)));
  await page.screenshot({ path: fileURLToPath(new URL('tests/artifacts/wide-picker.png', root)) });
  await page.evaluate(() => document.body.classList.add('dark'));
  assert.equal(await page.locator('.dmo-panel').evaluate((e) => getComputedStyle(e).backgroundColor), 'rgb(32, 33, 38)');
  await page.screenshot({ path: fileURLToPath(new URL('tests/artifacts/dark-picker.png', root)) });
  ok('focus remains in popup and dark theme uses host surface tokens');
  await page.setViewportSize({ width: 390, height: 600 });
  // The popup re-places itself from a resize listener, and React commits that
  // asynchronously: measure the settled layout, not the pre-resize one.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const mobile = await page.locator('.dmo-panel').boundingBox(); assert.ok(mobile.x >= 12 && mobile.width <= 366 && mobile.y >= 12 && mobile.y + mobile.height <= 588);
  await page.screenshot({ path: fileURLToPath(new URL('tests/artifacts/narrow-picker.png', root)) });
  ok('narrow window layout fits without horizontal or vertical overflow');
  await page.setViewportSize({ width: 1280, height: 1000 });
  const beforeFavorites = await page.evaluate(() => selected.length);
  await page.getByRole('button', { name: '收藏：服务商甲 · API 中转 / gpt-example-a', exact: true }).click();
  await page.getByRole('tab', { name: '收藏 (1)', exact: true }).click();
  assert.equal(await page.locator('.dmo-row').count(), 1);
  assert.equal(await page.evaluate(() => selected.length), beforeFavorites);
  await page.getByRole('button', { name: '移至不常用：服务商甲 · API 中转 / gpt-example-a', exact: true }).click();
  assert.equal(await page.locator('.dmo-row').count(), 1);
  assert.ok(await page.getByRole('button', { name: '移回主列表：服务商甲 · API 中转 / gpt-example-a', exact: true }).isVisible());
  await page.reload(); await open();
  await page.getByRole('tab', { name: '收藏 (1)', exact: true }).click();
  assert.equal(await page.locator('.dmo-row').count(), 1);
  await page.getByRole('button', { name: '取消收藏：服务商甲 · API 中转 / gpt-example-a', exact: true }).click();
  assert.equal(await page.locator('.dmo-row').count(), 0);
  assert.ok(await page.getByRole('tab', { name: '不常用 (1)', exact: true }).isVisible());
  ok('favorites survive reload, are provider-specific and never alter uncommon classification or select a model');
  await page.getByRole('tab', { name: /^主列表/ }).click();
  await page.evaluate(() => setState({ groups: groups.map(g => ({...g, name:'同平台 API'})) }));
  const edit = (id) => page.getByRole('button', { name: '编辑账号备注：同平台 API / '+id, exact: true });
  await edit('provider-one').click();
  await page.getByLabel('账号备注：provider-one', { exact: true }).fill('示例工作账号');
  await page.getByLabel('账号备注：provider-one', { exact: true }).press('Enter');
  await edit('provider-two').click();
  await page.getByLabel('账号备注：provider-two', { exact: true }).fill('示例个人账号');
  await page.getByRole('button', { name: '保存备注', exact: true }).click();
  await page.getByRole('searchbox').fill('示例个人账号 gpt-example-a');
  assert.equal(await page.locator('.dmo-row').count(), 1);
  assert.ok((await page.locator('.dmo-row').innerText()).includes('provider-two'));
  assert.ok((await page.locator('.dmo-row').innerText()).includes('账号备注：示例个人账号'));
  await page.getByRole('button', { name: /^收藏：同平台 API \/ gpt-example-a，账号备注 示例个人账号/ }).click();
  await page.getByRole('tab', { name: '收藏 (1)', exact: true }).click();
  await page.getByRole('searchbox').fill('');
  await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL('tests/artifacts/favorites-list.png', root)) });
  assert.equal(await page.evaluate(() => selected.length), 0);
  await page.reload(); await open(); await page.getByRole('tab', { name: '收藏 (1)', exact: true }).click();
  assert.ok((await page.locator('.dmo-row').innerText()).includes('账号备注：示例个人账号'));
  assert.ok((await page.locator('.dmo-trigger').innerText()).includes('示例工作账号'));
  assert.equal(await page.evaluate(() => selected.length), 0);
  ok('same-platform account notes persist, remain distinct, are searchable and appear in favorites and current trigger');
  await page.getByRole('button', { name: '编辑账号备注：服务商乙 · 官方 API / provider-two', exact: true }).click();
  await page.getByLabel('账号备注：provider-two', { exact: true }).fill('不应保存');
  await page.getByLabel('账号备注：provider-two', { exact: true }).press('Escape');
  assert.ok(await page.locator('.dmo-panel').isVisible());
  assert.equal(await page.locator('.dmo-note-editor').count(), 0);
  assert.ok((await page.locator('.dmo-row').innerText()).includes('示例个人账号'));
  await page.getByRole('button', { name: '编辑账号备注：服务商乙 · 官方 API / provider-two', exact: true }).click();
  await page.getByLabel('账号备注：provider-two', { exact: true }).fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: '保存备注', exact: true }).click();
  assert.equal(await page.locator('.dmo-panel img').count(), 0);
  assert.ok((await page.locator('.dmo-row').innerText()).includes('<img src=x onerror=alert(1)>'));
  await page.getByRole('button', { name: '编辑账号备注：服务商乙 · 官方 API / provider-two', exact: true }).click();
  await page.getByLabel('账号备注：provider-two', { exact: true }).fill('');
  await page.getByRole('button', { name: '保存备注', exact: true }).click();
  assert.ok(!(await page.locator('.dmo-row').innerText()).includes('账号备注：'));
  ok('note editing supports keyboard cancel, clearing and safe literal rendering without HTML execution');
  const spacing = await page.evaluate(() => {
    const button = document.querySelector('.dmo-note-action');
    const group = button.closest('.dmo-group, .dmo-row');
    const b = button.getBoundingClientRect(), g = group.getBoundingClientRect();
    return { gap: g.right - b.right, inside: b.left >= g.left && b.right <= g.right };
  });
  assert.ok(spacing.inside);
  assert.ok(spacing.gap >= 8, `账号备注按钮右侧应留出间距，当前 ${spacing.gap}px`);
  ok('account note button keeps clear spacing from the group border');
  await page.setViewportSize({ width: 390, height: 600 });
  await page.getByRole('button', { name: '编辑账号备注：服务商乙 · 官方 API / provider-two', exact: true }).click();
  const noteBox = await page.locator('.dmo-note-editor').boundingBox();
  assert.ok(noteBox.x >= 12 && noteBox.x + noteBox.width <= 378);
  assert.ok(await page.getByRole('button', { name: '保存备注', exact: true }).isVisible());
  await page.getByRole('button', { name: '取消', exact: true }).click();
  ok('account note editor and three lists fit a narrow viewport');
  // --- WorkBuddy reasoning-effort detection and the explicit unpin ----------
  await page.setViewportSize({ width: 1280, height: 1000 });
  if ((await page.locator('.dmo-panel').count()) > 0) { await page.keyboard.press('Escape'); await page.locator('.dmo-panel').waitFor({ state: 'hidden' }); }
  await page.evaluate(() => setState({ groups: wbGroups }));
  await open();
  await page.getByRole('tab', { name: /^主列表/ }).click();
  await page.getByRole('button', { name: '选择 WorkBuddy AI 的 DeepSeek V4.1 Flash，模型 ID wb-flash', exact: true }).click();
  await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
  await open();
  await page.waitForFunction(() => document.querySelector('.dmo-probe')?.textContent.includes('该模型未声明思考强度'));
  assert.equal(await page.evaluate(() => fetchCalls.filter((c) => c.url.endsWith('/ai/status')).length), 1);
  assert.equal(await page.getByLabel('思考强度', { exact: true }).count(), 0);
  ok('a model WorkBuddy lists as a detection candidate offers detection inside the picker');

  await page.getByRole('button', { name: '检测思考强度', exact: true }).click();
  assert.ok((await page.locator('.dmo-probe-confirm').innerText()).includes('WorkBuddy'));
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await page.evaluate(() => fetchCalls.some((c) => c.options.method === 'POST')), false);
  ok('detection asks first and sends nothing when declined');

  await page.getByRole('button', { name: '检测思考强度', exact: true }).click();
  await page.getByRole('button', { name: '确认检测', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.dmo-effort-source')?.textContent === '已探测');
  const probeCall = await page.evaluate(() => fetchCalls.find((c) => c.options.method === 'POST'));
  assert.equal(probeCall.url, '/plugins/dsh-workbuddy-connect/ai/probe');
  assert.equal(probeCall.options.headers['x-workbuddy-probe-key'], 'test-key');
  assert.deepEqual(JSON.parse(probeCall.options.body), { action: 'probe', model: 'wb-flash' });
  assert.ok((await page.locator('.dmo-probe').innerText()).includes('已检测：low / medium / high'));
  assert.equal(await page.getByLabel('思考强度', { exact: true }).inputValue(), 'medium');
  ok('a confirmed detection reuses WorkBuddy and renders the verified levels in place');

  await page.evaluate(() => setState({ groups }));
  await page.waitForFunction(() => document.querySelector('.dmo-probe')?.textContent.includes('已探测到档位'));
  assert.equal(await page.getByLabel('思考强度', { exact: true }).count(), 0);
  await page.evaluate(() => publishEfforts());
  await page.getByLabel('思考强度', { exact: true }).waitFor({ state: 'visible' });
  ok('a verdict the catalog has not published yet is reported, never faked as a dropdown');

  await page.getByLabel('思考强度', { exact: true }).selectOption('high');
  assert.equal(await page.evaluate(() => selected.at(-1).reasoningEffort), 'high');
  assert.ok(await page.getByRole('button', { name: '恢复服务商默认', exact: true }).isVisible());
  await page.getByRole('button', { name: '恢复服务商默认', exact: true }).click();
  await page.waitForFunction(() => { const last = window.selected.at(-1); return last !== undefined && !('reasoningEffort' in last); });
  assert.deepEqual(await page.evaluate(() => selected.at(-1)), { provider: 'workbuddy-ai', model: 'wb-flash' });
  assert.equal(await page.getByRole('button', { name: '恢复服务商默认', exact: true }).count(), 0);
  assert.ok(await page.locator('.dmo-panel').isVisible());
  ok('restoring the provider default unpins the level and keeps the popup open');

  // --- per-model context window (CTXPATCH host) -----------------------------
  assert.equal(await page.locator('.dmo-context-note').innerText(), '当前生效 300K');
  assert.equal(await page.getByLabel('上下文容量', { exact: true }).inputValue(), '');
  assert.deepEqual(await page.getByLabel('上下文容量', { exact: true }).locator('option').allInnerTexts(), ['服务商默认', '300K', '1M']);
  const postsBefore = await page.evaluate(() => fetchCalls.filter((c) => c.options.method === 'POST').length);
  await page.getByLabel('上下文容量', { exact: true }).selectOption('1000000');
  await page.waitForFunction(() => document.querySelector('.dmo-context-note')?.textContent === '当前生效 1M');
  const pinned = await page.evaluate(() => JSON.parse(fetchCalls.filter((c) => c.options.method === 'POST').at(-1).options.body));
  assert.deepEqual(pinned, { action: 'set-model-context-window', model: 'wb-flash', contextWindow: 1000000 });
  assert.equal(await page.evaluate(() => fetchCalls.filter((c) => c.options.method === 'POST').length), postsBefore + 1);
  assert.equal(await page.getByLabel('上下文容量', { exact: true }).inputValue(), '1000000');
  assert.ok((await page.locator('.dmo-probe').innerText()).includes('上下文容量已设为 1M'));
  ok('a model window is pinned per model, in place, through the owner control route');

  await page.getByLabel('上下文容量', { exact: true }).selectOption('');
  await page.waitForFunction(() => document.querySelector('.dmo-context-note')?.textContent === '当前生效 300K');
  assert.deepEqual(await page.evaluate(() => JSON.parse(fetchCalls.filter((c) => c.options.method === 'POST').at(-1).options.body)),
    { action: 'set-model-context-window', model: 'wb-flash', contextWindow: null });
  assert.equal(await page.getByLabel('上下文容量', { exact: true }).inputValue(), '');
  assert.ok((await page.locator('.dmo-probe').innerText()).includes('已恢复服务商默认容量'));
  ok('clearing the pin returns that one model to the provider default');

  // A stock host has no patch stamp: the control must not appear at all. The
  // status document is cached per provider for a minute, so this reloads the
  // harness (which resets that cache) with the stock answer turned on.
  await page.evaluate(() => localStorage.setItem('wbStock', '1'));
  await page.reload();
  await open();
  await page.evaluate(() => setState({ groups: wbGroups }));
  await page.getByRole('tab', { name: /^主列表/ }).click();
  await page.getByRole('button', { name: '选择 WorkBuddy AI 的 DeepSeek V4.1 Flash，模型 ID wb-flash', exact: true }).click();
  await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
  await open();
  await page.waitForFunction(() => document.querySelector('.dmo-probe') !== null);
  assert.equal(await page.getByLabel('上下文容量', { exact: true }).count(), 0);
  assert.equal(await page.locator('.dmo-context-note').count(), 0);
  ok('an unpatched WorkBuddy host is never shown a per-model window control');
  await page.evaluate(() => localStorage.removeItem('wbStock'));
  await page.evaluate(() => dispose()); assert.equal(await page.locator('style[data-plugin="dsh-model-shelf"]').count(), 0);
  ok('plugin lifecycle disposes injected stylesheet');
  assert.deepEqual(errors, []);
  console.log(`Browser checks: ${checks}, uncaught page errors: ${errors.length}`);
} finally { await browser.close(); }
