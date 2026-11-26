import assert from 'node:assert/strict';
import { bootHost, activeModel, plainModel, catalogRows } from './host.mjs';
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
  const choose = async (field,value,reset=false) => {
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
    return request();
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
  await control('reasoningSummary').selectOption('none');
  await page.evaluate(current => window.project(current), {provider:'openai-codex',model:plainModel});
  await page.waitForFunction(() => document.querySelector('[data-provider-option="outputVerbosity"]') && !document.querySelector('[data-provider-option="reasoningSummary"]'));
  const calls = trace.length;
  await page.evaluate(current => window.project(current), {provider:'openai-api',model:activeModel});
  await page.locator('.dmo-provider-options').waitFor({state:'detached'});
  await close(); await open(); assert.equal(await page.locator('.dmo-provider-options').count(),0); assert.equal(trace.length,calls);
  assert.equal(host.writes.length,6); await verifyRaces(ui,host); assert.equal(net.forbidden,0); assert.deepEqual(ui.blocked,[]); assert.deepEqual(ui.errors,[]);
  console.log('PASS DSH 0.2.2-rc.5 authenticated HTTP bridge + SettingsForms/Loader, Codex 3.2.28 + pi-ai 1.3.0: six shelf saves/reopens; model default='+modelDefault+'; summary auto/concise/detailed/none; effort low/medium/high and declared default; no reasoning; same-ID API: zero RPC. External provider connections: 0.');
} finally { try { await ui?.close(); } finally { await host?.dispose(); net.dispose(); } }
