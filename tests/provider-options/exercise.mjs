import assert from 'node:assert/strict';
import { bootHost, activeModel, plainModel, fastOnly, ultraOnly, unknownTier, catalogRows } from './host.mjs';
import { isolateNetwork } from './local-transport.mjs';
import { shelfBrowser } from './shelf-browser.mjs';
import { verifyRaces } from './races.mjs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
// Fail closed if this internal worker is launched by hand under a daily profile.
const modules = resolve(process.argv[2] ?? '');
assert.equal(dirname(modules), fileURLToPath(new URL('../artifacts', import.meta.url)));
assert.match(basename(modules), /^codex-profile-[a-zA-Z0-9]+$/);
for (const [key, dir] of Object.entries({ DSH_HOME:'dsh-home', DSH_AGENTS_HOME:'agents-home', HOME:'user', USERPROFILE:'user', TEMP:'tmp' })) {
  assert.equal(process.env[key], join(modules,dir), 'isolated worker required: ' + key);
}
assert.equal(process.cwd(), join(modules,'cwd'));
// Every positive save goes through the same browser, owner, profile and final Fetch as the other fields.
async function verifySpeed({ page, host, net, ui, row, control, close, open, choose, request, baseline }) {
  const speed = row('speedMode'), select = control('speedMode');
  const show = async model => {
    await close(); await page.evaluate(model => window.project({ provider: 'openai-codex', model }), model);
    await open(); await row('outputVerbosity').waitFor(); // all five synthetic models advertise verbosity
  };
  const baselines = new Map([[activeModel, baseline]]);
  for (const model of [fastOnly, ultraOnly, plainModel, unknownTier]) baselines.set(model, await request(model));
  for (const body of baselines.values()) assert.ok(!Object.hasOwn(body,'service_tier'), 'standard omits the key');
  const wire = (model, sent, tier) => assert.deepEqual(sent, {
    ...baselines.get(model), ...(tier === undefined ? {} : { service_tier: tier })
  }, model + ': check key presence and keep text/reasoning unchanged');
  const checkPicker = async (stored, choices) => {
    if (!choices.length) { assert.equal(await speed.count(),0); return; }
    await select.waitFor(); assert.equal(await select.inputValue(),stored);
    assert.deepEqual(await select.locator('option:enabled').evaluateAll(opts => opts.map(o => o.value)),choices);
    const copy = await speed.innerText();
    assert.equal(/快速[^。]*更多 Credits/.test(copy), choices.includes('fast'));
    assert.equal(/极速[^。]*订阅额度[^。]*Credits/.test(copy), choices.includes('ultrafast'));
    if (!choices.includes(stored)) {
      assert.equal(await select.locator('option:checked:disabled').count(),1,'not a writable tier');
      assert.match(copy,/当前模型按标准速度处理/);
    }
  };
  const both = ['standard','fast','ultrafast'];
  await checkPicker('standard',both);
  for (const [stored,tier] of [['fast','priority'],['ultrafast','ultrafast']]) {
    wire(activeModel, await choose('speedMode',stored),tier);
    const writes = host.writes.length;
    for (const [model, offered] of [[fastOnly,'fast'],[ultraOnly,'ultrafast'],[plainModel,null],[unknownTier,null]]) {
      await show(model); await checkPicker(stored, offered ? ['standard',offered] : []);
      wire(model, await request(model), offered === stored ? tier : undefined);
    }
    assert.equal(host.writes.length,writes,'switching models must not rewrite a shared preference');
    assert.equal((await host.readConfig()).speedMode,stored);
    await show(activeModel); await checkPicker(stored,both);
  }
  const writes = host.writes.length;
  await speed.getByRole('button',{name:'恢复默认'}).click(); await speed.getByRole('button',{name:'取消'}).click();
  assert.equal(await select.inputValue(),'ultrafast'); assert.equal(host.writes.length,writes);
  wire(activeModel, await choose('speedMode','standard',true));
  // Both single-tier models can save. An inapplicable shared value never falls back to fast.
  await show(fastOnly); wire(fastOnly, await choose('speedMode','fast',false,fastOnly),'priority');
  await show(ultraOnly); await checkPicker('fast',['standard','ultrafast']);
  wire(ultraOnly, await choose('speedMode','ultrafast',false,ultraOnly),'ultrafast');
  await show(fastOnly); await checkPicker('ultrafast',['standard','fast']);
  wire(fastOnly, await choose('speedMode','standard',true,fastOnly));
  // The independent fixture actor removes a tier after the draft opens. The
  // original status and current model ID still match; the new catalog must not.
  await show(activeModel); await select.selectOption('ultrafast');
  const before = host.writes.length, start = ui.trace.length, catalogs = net.catalogs;
  catalogRows.find(r => r.slug === activeModel).service_tiers = [{id:'priority'}];
  await ui.refreshCatalog(); assert.ok(net.catalogs > catalogs);
  await speed.getByRole('button',{name:'保存',exact:true}).click(); await speed.getByText(/未保存/).waitFor();
  assert.deepEqual(ui.trace.slice(start),['status']); assert.equal(host.writes.length,before);
  await close(); await open(); await checkPicker('standard',['standard','fast']);
  wire(activeModel,await request());
}

const net = isolateNetwork();
let host, ui;
try {
  host = await bootHost(modules);
  const request = (model = activeModel, effort) => net.next(host,model,effort);
  const baseline = await request();
  const modelDefault = catalogRows.find(m => m.slug === activeModel).default_verbosity;
  assert.equal(baseline.text.verbosity, modelDefault); assert.equal(baseline.reasoning.effort, 'medium'); assert.ok(Object.hasOwn(baseline.reasoning,'summary'));
  for (const effort of ['low','medium','high']) assert.equal((await request(activeModel,effort)).reasoning.effort,effort);
  assert.equal((await request(plainModel)).reasoning, undefined);
  ui = await shelfBrowser(host, modules, process.argv[3]); const {page,trace} = ui;
  const toggle = () => page.locator('.dmo-trigger').click();
  const open = async () => { await toggle(); await page.locator('.dmo-panel').waitFor(); };
  const close = async () => { await page.keyboard.press('Escape'); await page.locator('.dmo-panel').waitFor({ state:'detached' }); };
  const row = id => page.locator('[data-provider-option="' + id + '"]');
  const control = id => row(id).getByRole('combobox');
  const choose = async (field,value,reset=false,model=activeModel) => {
    const writes = host.writes.length, start = trace.length;
    if (reset) await row(field).getByRole('button',{name:'恢复默认',exact:true}).click(); else await control(field).selectOption(value);
    assert.equal(host.writes.length,writes);
    await row(field).getByRole('button',{name:'保存',exact:true}).click();
    await row(field).getByText('已保存',{exact:true}).waitFor();
    assert.equal(host.writes.length, writes+1); assert.equal(host.writes.at(-1), field);
    assert.deepEqual(trace.slice(start),['status','update','status']);
    assert.equal((await host.readConfig())[field],value, 'profile was persisted');
    await close(); await open(); assert.equal(await control(field).inputValue(),value,'reopened owner value');
    assert.deepEqual(trace.slice(start),['status','update','status','status']);
    return request(model);
  };
  await open(); assert.equal(await control('outputVerbosity').inputValue(),'default');
  assert.match(await page.locator('.dmo-provider-options').innerText(),/其他使用它的会话也会受到影响/);
  await control('outputVerbosity').selectOption('medium'); await row('outputVerbosity').getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await control('outputVerbosity').inputValue(),'default'); assert.deepEqual(host.writes,[]);
  assert.equal((await choose('outputVerbosity','low')).text.verbosity,'low');
  assert.equal((await choose('outputVerbosity','default',true)).text.verbosity,modelDefault);
  for (const summary of ['concise','detailed','none','auto']) {
    const sent = await choose('reasoningSummary',summary,summary==='auto');
    assert.equal(sent.reasoning.effort,baseline.reasoning.effort); assert.equal(sent.text.verbosity,modelDefault);
    if (summary==='none') assert.ok(!Object.hasOwn(sent.reasoning,'summary'));
    else assert.equal(sent.reasoning.summary,summary==='auto'?baseline.reasoning.summary:summary);
    if (summary==='detailed') assert.equal((await request(plainModel)).reasoning,undefined);
  }
  assert.equal(host.writes.length,6);
  await verifySpeed({page, host, net, ui, row, control, close, open, choose, request, baseline});
  await control('reasoningSummary').selectOption('none');
  await page.evaluate(current => window.project(current), {provider:'openai-codex',model:plainModel});
  await page.waitForFunction(() => document.querySelector('[data-provider-option="outputVerbosity"]') && !document.querySelector('[data-provider-option="reasoningSummary"]'));
  const calls = trace.length;
  await page.evaluate(current => window.project(current), {provider:'openai-api',model:activeModel});
  await page.locator('.dmo-provider-options').waitFor({state:'detached'});
  await close(); await open(); assert.equal(await page.locator('.dmo-provider-options').count(),0); assert.equal(trace.length,calls);
  assert.equal(host.writes.length,12); await verifyRaces(ui,host); assert.equal(net.forbidden,0); assert.deepEqual(ui.blocked,[]); assert.deepEqual(ui.errors,[]);
  console.log('PASS DSH 0.2.2-rc.5 authenticated HTTP bridge + SettingsForms/Loader, Codex 3.2.28 + pi-ai 1.3.0: 12 shelf saves/reopens (6 verbosity/summary, 6 speed); model default='+modelDefault+'; summary auto/concise/detailed/none; effort low/medium/high and declared default; no reasoning; speed fast/ultrafast/reset: priority/ultrafast/omitted, single tiers and absent/unknown controls, revoked tier: zero patches; same-ID API: zero RPC. Serialized ordinary requests: '+net.requests+'. External provider connections: 0.');
} finally { try { await ui?.close(); } finally { await host?.dispose(); net.dispose(); } }
