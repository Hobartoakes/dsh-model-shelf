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
const disposers=[]; const ctx={effect(fn){const dispose=fn();if(dispose)disposers.push(dispose)},sessions:{subagentAddress(){return undefined}},modelDirectories:{directoryFor(){return {store,resetConnected(){window.setState({status:'ready',pending:null})},async load(){return state},async select(selection){selected.push(selection);window.setState({status:'selecting'});if(shouldWait){shouldWait=false;await new Promise(resolve=>window.finishSelection=resolve)}if(shouldThrow){shouldThrow=false;throw Error('transport disconnected')}if(shouldFail){shouldFail=false;window.setState({status:'error'});return {ok:false,error:{code:'session/writer-held',message:'held'}}}window.setState({current:selection,status:'ready'});return {ok:true}}}}},slots:{inject(name,fn){return fn()},register(options,Component){window.registration=options;window.render=()=>{root.render(React.createElement(Component,{locked:false,...options.inject('test-session')}))};return()=>{}}}};
const root=ReactDOM.createRoot(document.getElementById('anchor'));plugin.apply(ctx);window.render();window.dispose=()=>{root.unmount();for(const fn of disposers.reverse())fn()};
</script>`;
await mkdir(new URL('tests/artifacts/', root), { recursive: true });
const htmlURL = new URL('tests/artifacts/harness.html', root);
await writeFile(htmlURL, html);
await mkdir(new URL('docs/images/', root), { recursive: true });
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
  await open();
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
  // Publication screenshots: isolated popup, synthetic fixture only, never actual GUI data.
  await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL('docs/images/main-list.png', root)) });
  await page.evaluate(() => document.body.classList.add('dark'));
  await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL('docs/images/dark-list.png', root)) });
  await page.evaluate(() => document.body.classList.remove('dark'));
  await page.getByRole('button', { name: '移至不常用：服务商甲 · API 中转 / gpt-example-a', exact: true }).click();
  assert.equal(await page.locator('.dmo-row').count(), 17); assert.equal(await page.evaluate(() => selected.length), 0);
  await page.getByRole('tab', { name: '不常用 (1)', exact: true }).click(); assert.equal(await page.locator('.dmo-row').count(), 1);
  ok('manual move does not select/delete model or move identical ID from another provider');
  await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL('docs/images/uncommon-list.png', root)) });
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
  await page.locator('.dmo-panel').screenshot({ path: fileURLToPath(new URL('docs/images/favorites-list.png', root)) });
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
    const group = button.closest('.dmo-group');
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
