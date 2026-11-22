import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { hash } from 'node:crypto';
import { chromium } from 'playwright-core';
import semver from 'semver';
import matrix from './matrix.json' with {type:'json'};
import manifest from '../../package.json' with {type:'json'};
import { loadPublishedWeb } from '../host-packages.mjs';
import {frontendPage} from './web-fixture.mjs';
import {mountSeat} from './seat-fixture.mjs';
import {earlyBoot} from './boot-settlement.mjs';
const shelfCode=await readFile(new URL('../../lib/client.js',import.meta.url),'utf8');
const initial={provider:'fixture-a',model:'vendor/shared-model',reasoningEffort:'high'};
const target={provider:'fixture-b',model:'vendor/shared-model',reasoningEffort:'low'};
const args=process.argv.slice(2),offline=args.includes('--offline');
const output=args.find(s=>s.startsWith('--output='))?.slice('--output='.length);
const selected=args.filter(s=>s!=='--offline'&&!s.startsWith('--output='));
for(const v of selected)assert.ok(matrix.hosts.some(h=>h.version===v),'unknown exact host version: '+v);
const hosts=matrix.hosts.filter(h=>!selected.length||selected.includes(h.version));
const browser=await chromium.launch({...process.env.DSH_TEST_BROWSER_EXECUTABLE?{executablePath:process.env.DSH_TEST_BROWSER_EXECUTABLE}:{channel:process.platform==='win32'?'msedge':'chrome'},headless:true});
const runs=[];
try {for(const row of hosts){
 const result={version:row.version,admitted:semver.satisfies(row.version,manifest.engines.dsh,{includePrerelease:true}),
   desktopEvidence:row.version==='0.2.2-rc.5'?'separate pilot archive':'not run',
   coreNode:matrix.archives[row.components.core]?.engines?.node??null,fullHostStarted:false};runs.push(result);
 if(!row.components.modelSelection){result.tier=result.admitted?'untested':'incompatible-admission';result.reason=row.reason;continue;}
 let f;
 try{
   const web=await loadPublishedWeb(row.version,{offline});
   const names=Object.fromEntries(Object.entries(web.receipts).map(([key,r])=>[key,r.name]));
   result.packages=Object.fromEntries(Object.entries(web.receipts).map(([k,r])=>[k,r.name+'@'+r.version]));
   assert.match(web.clients.conversation,/["']conversation\.input\.model["']\s*:\s*\{\s*kind:\s*.[Ss]ingle.\s*,\s*scope:\s*.session./,'published composer must own the session model seat');
   if(row.disposition==='different-package-layout') result.webSettlement=await earlyBoot(browser,web,shelfCode);
   delete web.clients.conversation; // declaration checked; do not boot the rest of the composer.
   f=await frontendPage(browser,web);const {page}=f;page.setDefaultTimeout(3500);
   const env=await page.evaluate(mountSeat,{clients:web.clients,names,shelfCode,initial,target});Object.assign(result,env);
   if(env.enabled){
     const trigger=page.locator('.dmo-trigger');await trigger.click();await page.locator('.dmo-panel .dmo-row').first().waitFor({state:'visible'});await page.keyboard.press('Escape');
     const route=await page.evaluate(()=>window.seatFixture.verifyRoute());
     const {acknowledgement,...observed}=route; assert.deepEqual(observed,{before:initial,wire:{sessionId:'fixture-session',...target},after:target,childRequests:0}); result.route=route;
     await trigger.click();const choice=page.locator('.dmo-row').filter({has:page.locator('.dmo-select[aria-pressed="false"]')});
     assert.equal(await choice.getAttribute('data-model-key'),JSON.stringify([initial.provider,initial.model]));
     await choice.locator('.dmo-select').click();
     const panel=page.locator('.dmo-panel');
     await page.waitForFunction(()=>!document.querySelector('.dmo-panel') || document.querySelector('.dmo-panel').textContent.includes('模型切换未成功'));
     const ui=await page.evaluate(()=>({wire:window.seatFixture.requests.at(-1),current:window.seatFixture.current(),count:window.seatFixture.requests.length}));
     const changed={provider:initial.provider,model:initial.model};assert.deepEqual(ui,{wire:{sessionId:'fixture-session',...changed},current:changed,count:2});
     result.shelfButton={...ui,closed:!await panel.isVisible(),falseFailure:await panel.isVisible() && (await panel.innerText()).includes('模型切换未成功')};
     if(result.shelfButton.falseFailure){assert.equal(acknowledgement,'void');await page.keyboard.press('Escape');}
     else assert.equal(result.shelfButton.closed,true);
     // A rejected RPC must not close the chooser or report the target as current.
     await trigger.click();await page.evaluate(()=>window.seatFixture.rejectNext());
     await page.locator('.dmo-select[aria-pressed="false"]').click();
     await page.getByText(/fixture selection refused/).first().waitFor({state:'visible'});
     const rejected=await page.evaluate(()=>({wire:window.seatFixture.requests.at(-1),current:window.seatFixture.current(),count:window.seatFixture.requests.length}));
     assert.deepEqual(rejected.wire,{sessionId:'fixture-session',provider:target.provider,model:target.model});assert.deepEqual(rejected.current,changed);assert.equal(rejected.count,3);
     assert.equal(await panel.isVisible(),true);result.rejection='visible error, chooser open, previous route kept';await page.keyboard.press('Escape');
   } else {
     assert.ok(env.earlyWire,'unexpected shelf inactivity');
     assert.equal(await page.locator('.dmo-trigger').count(),0);
   }
   await page.evaluate(()=>window.seatFixture.disposeShelf()); result.seatAfterDisposal='native';
   const native=page.locator('#contract-seat button[aria-haspopup="menu"]').first();
   async function openNative(){await native.click();assert.equal(await native.getAttribute('aria-expanded'),'true');const menu=page.getByRole('menu').first();await menu.waitFor({state:'visible'});let menuText=await menu.innerText();if(!menuText.includes('Fixture')){const modelBranch=menu.getByRole('menuitem').first();await modelBranch.click();await page.getByText('Fixture fixture-a',{exact:false}).first().waitFor({state:'visible'});menuText=await page.getByRole('menu').first().innerText();}assert.match(menuText,/Fixture/);const evidence={expanded:true,catalogVisible:true,menu:menuText};await page.keyboard.press('Escape');if(await native.getAttribute('aria-expanded')==='true')await page.keyboard.press('Escape');assert.equal(await native.getAttribute('aria-expanded'),'false');return evidence;}
   result.nativeClickAfterDispose=await openNative();
   await page.evaluate(()=>window.seatFixture.noCapability());result.nativeClickMissingCapability=await openNative();
   await page.evaluate(()=>window.seatFixture.disposeAll());assert.deepEqual(f.errors,[]);assert.deepEqual(f.denied,[]);
   result.tier=result.webSettlement?.settled===false?'incompatible-boot':result.shelfButton?.falseFailure?'incompatible-ui':env.enabled?'package-contract':'native-fallback';
   if(result.tier.startsWith('incompatible-')) process.exitCode=1;
 }catch(e){result.tier='failed';result.error=e.message;result.errors=f?.errors;result.denied=f?.denied;process.exitCode=1;}
 finally{if(f)await f.context.close();}
 console.error(row.version,result.tier,result.error?.slice(0,500)??'');
}}finally{await browser.close();}
const files=['./matrix.json','./early-pins.json','../host-packages.mjs','./run-contracts.mjs','./web-fixture.mjs','./seat-fixture.mjs','./boot-settlement.mjs'];
const inputs=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash('sha256',await readFile(new URL(file,import.meta.url)))])));
// From the separate Windows pilot receipt; never apply that pass to different client/archive bytes.
const pilot={host:'0.2.2-rc.5',carrier:'Windows Desktop',plugin:'1.6.0-local.1',checks:8,
  clientSHA256:'5b9994ad20eceaea799bcb6b1467d09982289e6d34ca44708a1ed6c00b053421',
  archiveSHA256:'f88baf4c10f821900b789913f0345f639c70858a6066df89c6bb42f633d7b6b7',
  file:'tests/artifacts/clean-0.2.2-rc.5-1795363695552-3d73b594/result.json',receiptSHA256:'dd8a27b32c1b04ccefdfffab9976eef3709650a31837fa6c4352293cdcc3f043'};
const report=JSON.stringify({schemaVersion:1,inputs,pilot,observedAt:new Date().toISOString(),node:process.version,browser:browser.version(),platform:process.platform,driver:'playwright-core@'+manifest.devDependencies['playwright-core'],clientSHA256:hash('sha256',shelfCode),pluginVersion:manifest.version,hosts:runs},null,2)+'\n';
if(output) await writeFile(output,report,{flag:'wx'}); else process.stdout.write(report);
