import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { activeModel } from './host.mjs';
import { mountShelf } from './mount-shelf.mjs';

export async function shelfBrowser(host, modules, identity) {
  const packages=join(modules,'node_modules','@deepseek-ai');
  const dist=join(packages,'dsh-web-frontend','dist');
  const html=await readFile(join(dist,'index.html'),'utf8');
  const files=new Map();
  for(const name of await readdir(join(dist,'assets'))) if (/\.(?:js|css)$/.test(name)) files.set('/assets/'+name,await readFile(join(dist,'assets',name)));
  const entry=new URL(html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)[1],'http://localhost/').pathname;
  const standalone=files.get(entry).includes('globalThis.__DSH_MODULES__=');
  const clients=Object.fromEntries(await Promise.all([
    ['@deepseek-ai/dsh-client-connection',join(packages,'dsh-client-connection/lib/client.browser.js')],
    ['@deepseek-ai/dsh-client-ui-renderer',join(packages,'dsh-client-ui-renderer/lib/client.js')],
    ['@deepseek-ai/dsh-client-ui-model-selection',join(packages,'dsh-client-ui-model-selection/lib/client.js')],
    ['dsh-model-shelf',new URL('../../lib/client.js',import.meta.url)]
  ].map(async ([id,path])=>[id,await readFile(path,'utf8')])));
  const trace = [], blocked = [], errors = [];
  const server = createServer(async (req, res) => {
    try {
      const path = req.url.split('?')[0];
      if (path === '/') { if (host.connection.authorizeIndex(req, res)) { res.setHeader('content-type','text/html; charset=utf-8'); res.end(html); } return; }
      if (files.has(path)) { res.setHeader('content-type',path.endsWith('.css')?'text/css':'text/javascript; charset=utf-8'); res.end(files.get(path)); return; }
      if (path.startsWith('/api/')) { const field = path.replace('/api/codex-subscription/preferences/', ''); assert.ok(['status','update'].includes(field)); trace.push(field); await host.routes.get('/api').handler(req,res); return; }
      res.writeHead(404).end();
    } catch { errors.push('HTTP bridge failed'); if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  await new Promise((ok,no) => server.once('error',no).listen(0,'127.0.0.1',ok));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let context;
  const close = async () => { try { await context?.close(); } finally { server.closeAllConnections(); await new Promise(done => server.close(done)); } };
  try {
    // Even Chromium background services have no direct external proxy route.
    server.on('connect',(_req,socket)=>socket.destroy());
    context = await chromium.launchPersistentContext(join(modules,'browser-profile'), { serviceWorkers:'block', ...(process.env.SHELF_BROWSER_EXE ? { executablePath: process.env.SHELF_BROWSER_EXE } : { channel: process.platform === 'win32' ? 'msedge' : 'chrome' }), headless: true,
      env: { ...process.env, ...(process.platform === 'win32' ? { USERPROFILE:identity } : {}) }, proxy: { server:origin, bypass:'127.0.0.1' },
      args: ['--disable-background-networking','--disable-quic','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    await context.route('**/*', r => { if (new URL(r.request().url()).origin === origin) return r.continue(); blocked.push('network'); return r.abort(); });
    await context.routeWebSocket('**/*', ws => { blocked.push('websocket'); ws.close(); });
    const page = await context.newPage(); page.on('pageerror', error => { if(error.message!=='fixture: captured static modules') errors.push('page error'); }); page.setDefaultTimeout(4500);
    // No token or shared cookie: a POST to the real route must be refused.
    await page.goto(origin);
    assert.equal(await page.evaluate(async () => (await fetch('/api/codex-subscription/preferences/status', { method: 'POST' })).status), 401);
    await page.addInitScript(standalone => {
      window.__DSH_BOOT__={rev:'fixture',entries:[]};
      if (!standalone) window.__ModuleLoader__={create({staticModules}){window.fixtureModules=staticModules;throw Error('fixture: captured static modules');}};
    },standalone);
    await page.goto(host.connection.authenticatedUrl(origin + '/')); assert.equal(page.url(),origin + '/');
    await page.evaluate(mountShelf, { clients, models: host.models, initial: { provider:'openai-codex', model:activeModel } });
    assert.equal(await page.evaluate(() => window.ownerReady()), true, 'real authenticated status/owner before UI assertions'); trace.length=0;
    return { page, trace, blocked, errors, close };
  } catch (err) { await close(); throw err; }
}
