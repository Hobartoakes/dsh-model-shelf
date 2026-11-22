

const origin = 'https://dsh-contract.invalid';
const mime = path => path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.html') ? 'text/html' : 'application/octet-stream';
// No server, profile, backend, real session, or user model. Fulfil *all* requests
// from a verified archive; an unknown origin or WebSocket is never connected.
export async function frontendPage(browser, {assets, row, clients}, { graph, scripts = {} } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const errors = [], denied = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.routeWebSocket('**/*', socket => { denied.push(socket.url()); socket.close(); });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      const path = url.pathname === '/' ? '/index.html' : url.pathname;
      const data = url.origin === origin && (assets.get(path) ?? scripts[path]);
      if (data) return route.fulfill({ status: 200, contentType: mime(path), body: data });
      denied.push(url.href); return route.abort('blockedbyclient');
    });
    const entry = assets.get('/index.html').toString().match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)[1];
    const standalone = assets.get(new URL(entry, origin).pathname).includes('globalThis.__DSH_MODULES__=');
    await page.addInitScript(({standalone,graph,modulesCode}) => {
      window.__DSH_BOOT__ = graph ?? { rev: 'fixture', entries: [] };
      if (graph) {
        if (!standalone) {
          // The historical server injected a queue, then preloaded this same
          // published module, whose createClientModuleSystem owns resolution.
          const queue = []; const facade = window.__ModuleLoader__ = {mode:'queue',pendingQueue:queue,load:e=>queue.push(e), create(options) {
            const e=queue.shift(); if(e.id!=='@deepseek-ai/dsh-client-modules') throw Error('wrong bootstrap module');
            const exports=e.factory(id=>{throw Error('unexpected bootstrap import '+id)});
            return exports.createClientModuleSystem(facade,{id:e.id,exports},options);
          }};new Function(modulesCode)();
        }
        return;
      }
      if (!standalone) window.__ModuleLoader__ = { create({ staticModules }) {
        window.fixtureModules = staticModules;
        // Stop at the module boundary. Do not start a partial host graph.
        throw Error('contract fixture: captured published static modules');
      }};
    }, {standalone,graph,modulesCode:graph?clients.modules:undefined});
    await page.goto(origin, {waitUntil:'load'});
    return { context, page, errors, denied, standalone, row, clients };
  } catch (e) { await context.close(); throw e; }
}
