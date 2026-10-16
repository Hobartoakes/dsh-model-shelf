import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
const react = await readFile(join(dirname(require.resolve('react/package.json')), 'umd/react.production.min.js'), 'utf8');
const reactDOM = await readFile(join(dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.production.min.js'), 'utf8');
const client = await readFile(new URL('lib/client.js', root), 'utf8');
const html = `<!doctype html><meta charset="utf-8"><title>sel test</title>
<style>body{font-family:system-ui;margin:0;background:#fafafa;color:#222}#anchor{position:fixed;bottom:30px;right:30px;padding:14px;background:white;border:1px solid #ddd;border-radius:12px;width:650px}</style>
<div id="anchor"></div><script>localStorage.clear()</script><script>${react}</script><script>${reactDOM}</script>
<script>window.__ModuleLoader__={load(entry){window.plugin=entry.factory(name=>name==='react'?React:name==='react-dom'?ReactDOM:undefined)}};</script>
<script>${client}</script>
<script>
const listeners=new Set(); const selected=[]; window.selected=selected;
const groups=[{id:'provider-one',name:'服务商甲 · API 中转',models:[{id:'gpt-example-a',name:'GPT 示例模型'}]}];
let state={current:{provider:'provider-one',model:'gpt-example-a',reasoningEffort:'medium'},groups,status:'ready',failures:[],pending:null,error:null};
const store={subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},getSnapshot(){return state}};
const ctx={effect(fn){const dispose=fn();if(dispose)dispose()},sessions:{subagentAddress(){return undefined}},modelDirectories:{directoryFor(){return {store,resetConnected(){},async load(){return state},async select(s){selected.push(s);window.setState({current:s,status:'ready'});return {ok:true}}}}},slots:{inject(name,fn){return fn()},register(options,Component){window.registration=options;window.render=()=>{root.render(React.createElement(Component,{locked:false,...options.inject('test-session')}))};return()=>{}}}};
const root=ReactDOM.createRoot(document.getElementById('anchor'));try{localStorage.removeItem('dsh-model-shelf.preferences.v1');localStorage.removeItem('dsh-model-organizer.preferences.v1')}catch(e){}plugin.apply(ctx);window.render();
</script>`;
await mkdir(new URL('tests/artifacts/sel/', root), { recursive: true });
const htmlURL = new URL('tests/artifacts/sel/harness.html', root);
await writeFile(htmlURL, html);
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(htmlURL.href);
  await page.locator('.dmo-trigger').click();
  await page.locator('.dmo-panel').waitFor({ state: 'visible' });
  await page.locator('.dmo-select').first().waitFor({ state: 'visible' });

  // 1a. Drag-select across the group heading title text (.dmo-group-title).
  const gt = page.locator('.dmo-group-title');
  const gbox = await gt.boundingBox();
  await page.mouse.move(gbox.x + 2, gbox.y + gbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gbox.x + gbox.width - 2, gbox.y + gbox.height / 2, { steps: 8 });
  await page.mouse.up();
  const groupTitleSel = await page.evaluate(() => window.getSelection()?.toString() ?? '');

  // The group-heading drag may have toggled the group collapsed; re-expand it.
  if (!(await page.locator('.dmo-select').first().isVisible().catch(() => false))) {
    await page.locator('.dmo-group-heading').first().click();
    await page.locator('.dmo-select').first().waitFor({ state: 'visible' });
  }

  // 1. Drag-select across the identity text inside the .dmo-select row.
  const ident = page.locator('.dmo-select .dmo-identity').first();
  const box = await ident.boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const dragSel = await page.evaluate(() => window.getSelection()?.toString() ?? '');
  const chosenAfterDrag = await page.evaluate(() => window.selected.length);
  const identDiag = await page.evaluate(() => {
    const el = document.querySelector('.dmo-select .dmo-identity');
    const sel = document.querySelector('.dmo-select');
    const r = el?.getBoundingClientRect();
    const cs = el ? getComputedStyle(el) : null;
    return {
      text: el?.textContent ?? null,
      rect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
      userSelect: cs?.userSelect ?? null,
      webkit: cs?.webkitUserSelect ?? null,
      selectExists: !!sel,
      identityCount: document.querySelectorAll('.dmo-identity').length,
      panelVisible: !!document.querySelector('.dmo-panel'),
      rowSnippet: document.querySelector('.dmo-row')?.outerHTML.slice(0, 260) ?? null,
      listHTML: document.querySelector('.dmo-list')?.innerHTML.slice(0, 1200) ?? null,
      storedPrefs: localStorage.getItem('dsh-model-shelf.preferences.v1') ?? null
    };
  });

  // 1b. Test a larger drag distance on a fresh identity to rule out click threshold.
  const identB = page.locator('.dmo-select .dmo-identity').first();
  const boxB = await identB.boundingBox();
  await page.mouse.move(boxB.x + 2, boxB.y + boxB.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxB.x - 60, boxB.y + boxB.height / 2, { steps: 20 });
  await page.mouse.up();
  const dragSelLarger = await page.evaluate(() => window.getSelection()?.toString() ?? '');

  // 2. Drag-select across the trigger text inside the .dmo-trigger button.
  const trig = page.locator('.dmo-trigger-copy');
  const tbox = await trig.boundingBox();
  await page.mouse.move(tbox.x + 2, tbox.y + tbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(tbox.x + tbox.width - 2, tbox.y + tbox.height / 2, { steps: 8 });
  await page.mouse.up();
  const trigSel = await page.evaluate(() => window.getSelection()?.toString() ?? '');

  // 3. Experiment: drag-select after forcing user-select:text on the button itself.
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'selfix';
    style.textContent = '.dmo-select,.dmo-trigger{user-select:text;-webkit-user-select:text}';
    document.head.appendChild(style);
  });
  const openBox = await page.locator('.dmo-trigger').boundingBox();
  await page.mouse.click(openBox.x + openBox.width / 2, openBox.y + openBox.height / 2);
  await page.locator('.dmo-panel').waitFor({ state: 'visible' });
  const ident2 = page.locator('.dmo-identity').first();
  const box2 = await ident2.boundingBox();
  await page.mouse.move(box2.x + 2, box2.y + box2.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width - 2, box2.y + box2.height / 2, { steps: 8 });
  await page.mouse.up();
  const dragSel2 = await page.evaluate(() => window.getSelection()?.toString() ?? '');

  // 4. Verify a <div role="button"> (not a <button>) allows drag-selection of its text.
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'fakebtn';
    d.setAttribute('role', 'button');
    d.textContent = '可复制文本示例';
    d.style.cssText = 'position:fixed;left:20px;top:20px;user-select:text;-webkit-user-select:text;padding:6px';
    document.body.appendChild(d);
  });
  const fb = await page.locator('#fakebtn').boundingBox();
  await page.mouse.move(fb.x + 2, fb.y + fb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + fb.width - 2, fb.y + fb.height / 2, { steps: 8 });
  await page.mouse.up();
  const divRoleSel = await page.evaluate(() => window.getSelection()?.toString() ?? '');

  console.log(JSON.stringify({ dragIdentitySelection: dragSel, chosenAfterDrag, identDiag, dragIdentityLarger: dragSelLarger, dragTriggerSelection: trigSel, groupTitleSelection: groupTitleSel, dragIdentityButtonUserSelectText: dragSel2, divRoleButtonSelection: divRoleSel }, null, 2));
} finally {
  await browser.close();
}
