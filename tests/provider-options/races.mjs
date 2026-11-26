import assert from 'node:assert/strict';
import { activeModel } from './host.mjs';

// Start on the same-ID API route, with all six positive writes accounted for.
export async function verifyRaces(ui, host) {
  const {page,trace}=ui, row=page.locator('[data-provider-option="outputVerbosity"]');
  const control=row.getByRole('combobox'), save=row.getByRole('button',{name:'保存',exact:true});
  const project=provider=>page.evaluate(([provider,model])=>window.project({provider,model}),[provider,activeModel]);
  const settle=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const close=()=>page.keyboard.press('Escape'),open=()=>page.locator('.dmo-trigger').click();
  const arm=(method,skip=0)=>page.evaluate(([m,k])=>window.holdReply(m,k),[method,skip]);
  const seen=()=>page.evaluate(()=>Promise.race([window.replySeen,new Promise((_,no)=>setTimeout(()=>no(Error('reply not reached')),3500))]));
  const deliver=value=>page.evaluate(v=>window.releaseReply(v),value);
  const detached=()=>page.locator('.dmo-provider-options').waitFor({state:'detached'});
  const noSuccess=async()=>assert.equal(await row.getByText('已保存',{exact:true}).count(),0);
  await project('openai-codex'); assert.equal(await control.inputValue(),'default');
  const losing=[
    async()=>{await close();await detached();await open();},
    ()=>page.evaluate(model=>{window.project({provider:'openai-api',model});window.project({provider:'openai-codex',model});},activeModel),
    ()=>page.evaluate(()=>{window.changeSession('fixture-B');window.changeSession('fixture-A');}),
    ()=>page.evaluate(()=>window.accountChanged()),
    async()=>{await page.evaluate(()=>window.lockShelf(true));await detached();await page.evaluate(()=>window.lockShelf(false));},
    async()=>{await page.evaluate(()=>window.dropConnection());await detached();const count=trace.length;await close();await open();await settle();assert.equal(trace.length,count,'disconnected: no owner reads or writes');await page.evaluate(()=>window.restoreConnection());},
  ];
  for (const leave of losing) {
    const writes=host.writes.length;
    await control.selectOption('low');await arm('status');await save.click();await seen(); // preflight completed, not delivered
    await leave();await deliver('late');await settle();assert.equal(await control.inputValue(),'default');await noSuccess();
    assert.equal(host.writes.length,writes,'lost target must invalidate preflight');
  }
  // Same browser profile, second normal session and identical model. A double
  // submit may not repeat the dispatched patch; B can read the new shared
  // value but must NEVER inherit A's result, including after a late receipt.
  const before=host.writes.length;
  await control.selectOption('low');await arm('update');
  await row.getByRole('button',{name:'取消',exact:true}).focus();await page.keyboard.press('Tab');
  assert.equal(await save.evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');
  await seen();await save.evaluate(el=>el.click());assert.equal(host.writes.length,before+1);
  await page.evaluate(()=>window.changeSession('fixture-B'));assert.equal(await control.inputValue(),'low');
  await deliver('late');await settle();await noSuccess();assert.equal(host.writes.length,before+1);
  // Independent writer changed the preflight value. It is the only write.
  await control.selectOption('high');assert.equal(await page.evaluate(()=>window.otherWrite('medium')),true);
  const atConflict=trace.length;await save.click();await row.getByText('设置已变更，请重新读取').waitFor();
  assert.deepEqual(trace.slice(atConflict),['status']);assert.equal(host.writes.length,before+2);
  await page.getByRole('button',{name:'重新读取服务商选项'}).click();assert.equal(await control.inputValue(),'medium');
  // A real successful write and matching stored value don't prove delivery
  // of the independent read. No success, no retry; a fresh opening can read.
  await control.selectOption('high');await arm('status',1);const atLoss=trace.length;
  await save.click();await seen();await deliver('lost');await row.getByText(/未确认，请重新读取/).waitFor();
  assert.deepEqual(trace.slice(atLoss),['status','update','status']);await noSuccess();assert.equal((await host.readConfig()).outputVerbosity,'high');
  await close();await open();assert.equal(await control.inputValue(),'high');
  // Previously focused draft cannot survive entry into an addressed child.
  await control.selectOption('low');const childAt=trace.length;
  await page.evaluate(()=>window.changeSession('child'));await detached();await settle();assert.equal(trace.length,childAt);
  await page.evaluate(()=>window.changeSession('fixture-B'));assert.equal(await control.inputValue(),'high');
  await control.selectOption('low');await arm('status');await save.click();await seen();
  await page.evaluate(()=>window.restoreNative());await deliver('late');await settle();
  assert.equal(host.writes.length,before+3);assert.equal(trace.filter(x=>x==='update').length,host.writes.length);
  console.log('PASS real RPC fault controls: Escape/Tab/Enter; close, A-B-A, session, account catalog refresh, lock, disconnect/reconnect, child, native fallback; double submit: 1 patch; late success hidden; conflict: 0 patches; readback loss: unconfirmed.');
}
