import { readFile, writeFile, mkdir, access, mkdtemp } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { assertShelfGeometry, assertFlatFavoritesUnchanged } from './host-layout-checks.mjs';
import { selectCarrier, createIsolation, browserEnvironment, normalizeArchive, assertRuntimeVersion, parseStartupURL, redact, withFingerprintGuard, createProcessOwner, assertListenerClosed } from './clean-profile-support.mjs';

// Opt-in Windows integration against the official built frontend; never the daily GUI.
const root = fileURLToPath(new URL('../', import.meta.url));
const carrier = selectCarrier(process.env);
const iconNetworkTest = process.env.DSH_TEST_ICON_NETWORK === '1';
const fixtureProviderId = iconNetworkTest ? 'huggingface' : 'shelf-fixture';
const iconURL = 'https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/huggingface-color.png';
const packageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const archive = normalizeArchive(process.argv[2] ?? join(root, 'dist-draft', `dsh-model-shelf-${packageVersion}.tgz`), root);
const expectedVersion = process.env.DSH_TEST_EXPECTED_VERSION;
const protectedOrigins = ['http://127.0.0.1:59983', 'http://127.0.0.1:19387', process.env.DSH_TEST_ACTIVE_ORIGIN, process.env.DSH_WEB_URL].filter(Boolean).map(value => new URL(value).origin);
const runId = `${expectedVersion ?? 'desktop'}-${Date.now()}-${randomUUID().slice(0, 8)}`;
const evidenceDir = join(root, 'tests', 'artifacts', `clean-${runId}`);
await mkdir(evidenceDir, { recursive: true });
// Keep Windows profile operation paths short and within an explicitly chosen test root.
const runRoot = await mkdtemp(join(process.env.DSH_TEST_RUN_ROOT ?? tmpdir(), 'model-shelf-clean-'));
const fixture = await createIsolation(runRoot, carrier.command, process.env);
if (carrier.electron) fixture.env.ELECTRON_RUN_AS_NODE = '1';
const owner = createProcessOwner(fixture);
const profileName = 'shelf-validation';
const profileDir = join(fixture.env.DSH_HOME, 'profiles', profileName);
const patch = join(profileDir, 'cordis.patch.yml');
const desktopFiles = ['package.json', 'cordis.patch.yml', 'pnpm-lock.yaml', 'node_modules/dsh-model-shelf/package.json', 'node_modules/dsh-model-shelf/lib/client.js'].map(name => join(homedir(), '.dsh', 'profiles', 'desktop', name));
const secrets = [];
const safe = text => redact(text, secrets).replaceAll(homedir(), '[user-home]');
const sha = data => createHash('sha256').update(data).digest('hex');
const checks = [], phases = [];
const result = { success: false, packageVersion, checks, phases, protectedOrigins, runRoot, evidenceDir, environmentNames: Object.keys(fixture.env).sort(), credentialCopies: false, realModelCalls: false, installScripts: false, carrier: carrier.electron ? 'Windows Desktop' : 'explicit Node + official runCli wrapper' };
let browser, server, serverURL;
const pass = name => { checks.push(name); console.log(`PASS ${name}`); };
const runCLI = (args, timeout) => owner.run(carrier.command, [...carrier.args, ...args], timeout);
async function stopServer() {
  if (!server) return;
  await owner.stop(server);
  if (serverURL) await assertListenerClosed(serverURL);
  server = null; serverURL = null;
}
async function startServer() {
  assert.ok(!server, 'Previous server must be stopped');
  server = owner.launch(carrier.command, [...carrier.args, '--profile', profileName, '--host', '127.0.0.1', '--port', '0', '--no-open']);
  const current = server;
  return new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => finish(Error('Clean server startup timed out: ' + safe(current.output).slice(-12000))), 120000);
    const finish = (error, url) => { clearTimeout(timer); current.child.stdout.off('data', inspect); current.child.stderr.off('data', inspect); error ? reject(error) : resolveReady(url); };
    const inspect = () => {
      try {
        const url = parseStartupURL(current.output, protectedOrigins);
        if (url) { serverURL = url; secrets.push(url.href, url.searchParams.get('token')); finish(null, url); }
      } catch (error) { finish(error); }
    };
    current.child.stdout.on('data', inspect); current.child.stderr.on('data', inspect);
    current.done.then(() => finish(Error(`Clean server exited ${current.receipt.code}: ${safe(current.output).slice(-12000)}`)));
  });
}
const providerFile = join(runRoot, 'fixture-provider.mjs');
const providerStats = join(runRoot, 'fixture-provider-stats.json');
const catalogFile = join(runRoot, 'fixture-catalog.json');
async function prepareProvider() {
  // A credential-free profile has no models (observed rc2 pilot). Substitute only
  // the external provider adapter, never the native catalog/directory/RPC/slots.
  const req = !carrier.electron && createRequire(createRequire(resolve(carrier.args[0])).resolve('@deepseek-ai/dsh/package.json'));
  const llmFile = req ? req.resolve('@deepseek-ai/dsh-llm') : join(dirname(carrier.args[1]), '../../dsh-llm/lib/index.js');
  await writeFile(providerStats, JSON.stringify({ listModels: 0, resolveModel: 0, streams: 0 }));
  await writeFile(catalogFile, JSON.stringify(['fixture-a', 'fixture-b']));
  await writeFile(providerFile, `// TEST ONLY: fake provider metadata; all actual model calls fail closed.\nimport { LlmAdapter } from ${JSON.stringify(pathToFileURL(llmFile).href)};\nimport { readFileSync, writeFileSync, watchFile, unwatchFile } from 'node:fs';\nconst statsFile = ${JSON.stringify(providerStats)};\nconst catalogFile = ${JSON.stringify(catalogFile)};\nconst count = key => { const stats = JSON.parse(readFileSync(statsFile)); stats[key]++; writeFileSync(statsFile, JSON.stringify(stats)); };\nclass FixtureAdapter extends LlmAdapter {\n  providerInfo(provider) { return { id: provider, name: 'Model Shelf TEST ONLY' }; }\n  async listModels(provider) { count('listModels'); return JSON.parse(readFileSync(catalogFile)).map(id => ({ provider, id, name: 'TEST ONLY ' + id })); }\n  async resolveModel(provider, model) { count('resolveModel'); return { provider, id: model, name: 'TEST ONLY ' + model, context: { contextWindow: 10000 }, reasoning: { defaultEffort: 'low', efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] } }; }\n  async *stream() { count('streams'); throw Error('MODEL CALL FORBIDDEN in compatibility fixture'); }\n}\nexport const inject = ['llm'];\nexport function apply(ctx) {\n  ctx.llm.registerAdapter([${JSON.stringify(fixtureProviderId)}], new FixtureAdapter());\n  const changed = () => ctx.emit('llm/adapters-updated');\n  watchFile(catalogFile, { interval: 200 }, changed);\n  ctx.effect(() => () => unwatchFile(catalogFile, changed));\n}\n`);
  result.providerFixture = 'TEST ONLY fake LlmAdapter metadata; native host directory/RPC/session/slots untouched';
}
const onboardingPatch = [
  { id: 'ui-settings-models', config: { credentialOnboarding: false } },
  { id: 'workspace-controller', config: { documentsDirectory: join(runRoot, 'documents'), documentsLookupTimeoutMs: 10000 } },
  { id: 'agent-default-model', config: { provider: fixtureProviderId, model: 'fixture-b' } },
  { insert: [{ id: 'shelf-test-provider', name: providerFile }] },
];
async function writePatch(disabled) {
  const rows = disabled === undefined ? onboardingPatch : [...onboardingPatch, { id: 'model-shelf', disabled }];
  await writeFile(patch, JSON.stringify(rows, null, 2) + '\n');
}
async function runtimeIdentity(actual) {
  const manifests = {};
  if (!carrier.electron) {
    const req = createRequire(resolve(carrier.args[0]));
    const cliPath = req.resolve('@deepseek-ai/dsh/package.json');
    const cli = createRequire(cliPath);
    const webPath = cli.resolve('@deepseek-ai/dsh-web-app/package.json');
    const web = createRequire(webPath);
    for (const [name, path] of Object.entries({ cli: cliPath, appBoot: cli.resolve('@deepseek-ai/dsh-app-boot/package.json'), webApp: webPath, frontend: web.resolve('@deepseek-ai/dsh-web-frontend/package.json') })) {
      const pkg = JSON.parse(await readFile(path, 'utf8')); assert.equal(pkg.version, actual, `${name} actual version`); manifests[name] = { path, version: pkg.version };
    }
    const frontend = await readFile(join(dirname(manifests.frontend.path), 'dist', 'index.html'));
    assert.ok(frontend.length > 0); manifests.frontend.entrySHA256 = sha(frontend);
  }
  return { actual, manifests };
}
async function checkBoot(label, expected) {
  const url = await startServer();
  console.log(`Isolated ${label}: ${url.origin}`);
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 1000 } });
  const phase = { label, origin: url.origin, expectedPlugin: expected, pageErrors: [], consoleErrors: [], blockedExternalRequests: [] }; phases.push(phase);
  await context.route('**/*', route => {
    const requestURL = new URL(route.request().url());
    if (requestURL.origin === url.origin) return route.continue();
    if (iconNetworkTest && requestURL.href === iconURL) { phase.iconRequests = (phase.iconRequests ?? 0) + 1; return route.continue(); }
    phase.blockedExternalRequests.push(requestURL.origin); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => phase.pageErrors.push(safe(error.message)));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) phase.consoleErrors.push(safe(message.text())); });
  try {
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(new URL(page.url()).search, '');
    await page.waitForFunction(() => Array.isArray(window.__DSH_BOOT__?.entries), { timeout: 30000 });
    const previewContinue = page.getByRole('button', { name: '继续', exact: true });
    await previewContinue.waitFor({ state: 'visible', timeout: 20000 });
    await previewContinue.click(); await previewContinue.waitFor({ state: 'hidden' });
    const graph = await page.evaluate(() => window.__DSH_BOOT__.entries.map(({ id, url }) => ({ id, url })));
    const entry = graph.find(row => row.id === 'dsh-model-shelf');
    assert.equal(Boolean(entry), expected);
    assert.ok(graph.some(row => row.id === '@deepseek-ai/dsh-client-ui-model-selection'));
    phase.clientIds = graph.map(row => row.id);
    const create = page.getByRole('button', { name: /新会话|新对话|New conversation|New chat/ }).first();
    if (await create.count()) await create.click();
    if (expected) {
      const response = await context.request.get(new URL(entry.url, url.origin + '/').href);
      assert.equal(response.status(), 200);
      const served = await response.text();
      phase.servedClientSHA256 = sha(served);
      await writeFile(join(evidenceDir, `${label}-served-client.js`), served);
      // The official host strips local debug trailers and emits combo source maps.
      // Assert the complete executable body, not byte equality of its transport.
      const built = (await readFile(join(root, 'lib/client.js'), 'utf8')).replace(/(?:\r?\n)?\/\/# sourceURL=[^\r\n]*(?:\r?\n)?$/, '').replace(/(?:\r?\n)?\/\/# sourceMappingURL=[^\r\n]*(?:\r?\n)?$/, '');
      assert.ok(served.includes(built), 'Official combo contains the exact built plugin executable body');
      await page.locator('style[data-plugin="dsh-model-shelf"]').waitFor({ state: 'attached', timeout: 30000 });
      const trigger = page.locator('.dmo-trigger');
      await trigger.waitFor({ state: 'visible', timeout: 30000 }); await trigger.click();
      await page.locator('.dmo-panel').waitFor({ state: 'visible', timeout: 10000 });
      if (iconNetworkTest && label === 'installed') {
        assert.equal(phase.iconRequests ?? 0, 0, 'No icon request without opt-in');
        await page.getByRole('checkbox', { name: /联网下载缺失图标/ }).check();
        await page.locator('.dmo-provider-icon[data-icon="huggingface"]').waitFor({ state: 'visible', timeout: 30000 });
        assert.equal(phase.iconRequests, 1);
        await page.getByRole('checkbox', { name: /联网下载缺失图标/ }).uncheck();
        await page.reload();
        await page.locator('.dmo-trigger').waitFor({ state: 'visible', timeout: 30000 });
        await page.locator('.dmo-trigger').click();
        await page.locator('.dmo-provider-icon[data-icon="huggingface"]').waitFor({ state: 'visible', timeout: 30000 });
        assert.equal(phase.iconRequests, 1, 'Cached icon reload must be offline');
      }
      assert.ok((await page.locator('.dmo-title').textContent()).includes('Model Shelf'));
      await page.locator('.dmo-row').first().waitFor({ state: 'visible', timeout: 30000 });
      assert.ok((await page.locator('.dmo-panel').innerText()).includes('Model Shelf TEST ONLY'));
      const arrived = `fixture-arrival-${label}`;
      await writeFile(catalogFile, JSON.stringify(['fixture-a', 'fixture-b', arrived, 'deepseek-chat', 'gpt-4o']));
      await page.locator('.dmo-row').filter({ hasText: arrived }).waitFor({ state: 'visible', timeout: 15000 });
      phase.liveCatalogRefresh = true;
      for (const icon of ['deepseek', 'openai']) {
        const branded = page.locator(`.dmo-model-icon[data-icon="${icon}"]`).first();
        await branded.waitFor({ state: 'visible' });
        const image = await branded.evaluate(el => ({ tag: el.tagName, src: el.currentSrc, complete: el.complete, naturalWidth: el.naturalWidth, width: el.getBoundingClientRect().width }));
        assert.equal(image.tag, 'IMG'); assert.match(image.src, /^data:image\/png;base64,/);
        assert.equal(image.complete, true); assert.ok(image.naturalWidth > 0); assert.equal(image.width, 24);
      }
      phase.bundledBrandIcons = true;
      phase.geometry = await assertShelfGeometry(page);
      await page.locator('.dmo-note-action').first().click();
      await page.locator('.dmo-note-input').fill('隔离测试账号'); await page.locator('.dmo-note-input').press('Enter');
      const first = page.locator('.dmo-row').first();
      const selectedKey = await first.getAttribute('data-model-key');
      await first.locator('.dmo-favorite').click();
      const second = page.locator('.dmo-row').nth(1);
      const secondKey = await second.getAttribute('data-model-key');
      await second.locator('.dmo-favorite').click();
      await page.getByRole('tab', { name: '收藏 (2)', exact: true }).click();
      assert.equal(await page.locator('.dmo-row').count(), 2);
      await page.locator('.dmo-order-down').first().focus(); await page.keyboard.press('Space');
      phase.favoriteOrder = await page.locator('.dmo-row').evaluateAll(rows => rows.map(row => row.dataset.modelKey));
      assert.deepEqual(phase.favoriteOrder, [secondKey, selectedKey]);
      await assertFlatFavoritesUnchanged(page);
      await page.locator('.dmo-select').last().click();
      await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
      assert.ok((await trigger.getAttribute('aria-label')).includes('隔离测试账号'));
      phase.selectedKey = selectedKey;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await trigger.waitFor({ state: 'visible', timeout: 30000 }); await trigger.click();
      await page.getByRole('tab', { name: '收藏 (2)', exact: true }).click();
      assert.deepEqual(await page.locator('.dmo-row').evaluateAll(rows => rows.map(row => row.dataset.modelKey)), phase.favoriteOrder, 'Keyboard order survives reload');
      assert.equal(await page.locator('.dmo-row').last().getAttribute('data-model-key'), selectedKey);
      assert.ok((await page.locator('.dmo-row').last().innerText()).includes('账号备注：隔离测试账号'));
      assert.equal(await page.locator('.dmo-select').last().getAttribute('aria-pressed'), 'true', 'Native session selection survives reload');
      await page.locator('.dmo-panel').screenshot({ path: join(evidenceDir, `${label}.png`) });
      await page.keyboard.press('Escape');
      const fullName = await trigger.getAttribute('aria-label');
      assert.ok(fullName.includes(fixtureProviderId)); assert.ok(fullName.includes('fixture-a')); assert.ok(fullName.includes('隔离测试账号'));
      phase.fullAccessibleName = fullName;
      // Use a fixture width proven to overflow native and shelf expanded controls.
      // The host decides compact mode by measured fit, not a fixed 390px breakpoint.
      phase.compactCandidates = [];
      for (const width of [390, 360, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const state = await trigger.evaluate(el => ({ viewportWidth: innerWidth, hostCompact: Boolean(el.closest('[data-model-compact]')), textVariable: getComputedStyle(el).getPropertyValue('--dsh-composer-model-text-display').trim(), iconVariable: getComputedStyle(el).getPropertyValue('--dsh-composer-model-icon-display').trim() }));
        phase.compactCandidates.push(state);
        if (state.hostCompact && state.textVariable === 'none' && state.iconVariable === 'block') break;
      }
      await page.waitForFunction(() => {
        const element = document.querySelector('.dmo-trigger');
        if (!element?.closest('[data-model-compact]')) return false;
        const style = getComputedStyle(element);
        return style.getPropertyValue('--dsh-composer-model-text-display').trim() === 'none' && style.getPropertyValue('--dsh-composer-model-icon-display').trim() === 'block';
      }, null, { timeout: 10000 });
      await trigger.locator('.dmo-trigger-copy').waitFor({ state: 'hidden' });
      await trigger.locator('svg').waitFor({ state: 'visible' });
      phase.compact = await trigger.evaluate(element => ({ viewportWidth: innerWidth, hostCompact: Boolean(element.closest('[data-model-compact]')), textVariable: getComputedStyle(element).getPropertyValue('--dsh-composer-model-text-display').trim(), iconVariable: getComputedStyle(element).getPropertyValue('--dsh-composer-model-icon-display').trim() }));
      assert.equal(phase.compact.hostCompact, true, 'Official composer owns the compact decision');
      assert.equal(phase.compact.textVariable, 'none', 'Official composer requests compact text');
      assert.equal(phase.compact.iconVariable, 'block', 'Official composer requests compact icon');
      assert.equal(await trigger.locator('.dmo-trigger-copy').isVisible(), false);
      assert.equal(await trigger.locator('svg').isVisible(), true);
      assert.equal(await trigger.getAttribute('aria-label'), fullName);
      for (const key of ['Enter', 'Space']) { await trigger.focus(); await page.keyboard.press(key); await page.locator('.dmo-panel').waitFor({ state: 'visible' }); await page.keyboard.press('Escape'); }
      await page.setViewportSize({ width: 1280, height: 1000 });
      await trigger.locator('.dmo-trigger-copy').waitFor({ state: 'visible' });
      assert.equal(await trigger.locator('.dmo-trigger-copy').isVisible(), true, 'Wide composer restores the full text after layout settles');
      await trigger.locator('.dmo-trigger-icon').waitFor({ state: 'hidden' });
      assert.equal(await trigger.locator('.dmo-trigger-icon').isVisible(), false, 'Wide composer restores icon-hidden state');
      phase.wide = await trigger.evaluate(el => ({ hostCompact: Boolean(el.closest('[data-model-compact]')), textVariable: getComputedStyle(el).getPropertyValue('--dsh-composer-model-text-display').trim(), iconVariable: getComputedStyle(el).getPropertyValue('--dsh-composer-model-icon-display').trim() }));
      assert.equal(phase.wide.hostCompact, false);
      phase.preferencesAndSelection = true;
    } else {
      const nativePicker = page.getByRole('button', { name: /^选择模型，当前|^请选择模型$|^Select model/ }).first();
      await nativePicker.waitFor({ state: 'visible', timeout: 30000 });
      assert.equal(await nativePicker.getAttribute('aria-haspopup'), 'menu'); await nativePicker.click();
      await page.getByRole('menuitem').first().or(page.getByRole('group').filter({ hasText: /模型|Model/ }).first()).first().waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('style[data-plugin="dsh-model-shelf"]').count(), 0);
      assert.equal(await page.locator('.dmo-trigger').count(), 0);
      phase.nativeFallback = true;
    }
    assert.deepEqual(phase.pageErrors, []);
    assert.ok(!phase.consoleErrors.some(message => /slot entry crashed|without inject/i.test(message)), 'Slot failures cannot be hidden by fallback');
    phase.success = true; pass(`${label}: real client graph, directory and browser UI`);
  } catch (error) {
    await page.screenshot({ path: join(evidenceDir, `${label}-failure.png`) }).catch(() => {});
    const visible = await page.locator('body').innerText().catch(() => '');
    throw Error(safe(error.stack ?? error) + '\nClient console:\n' + phase.consoleErrors.join('\n').slice(-6000) + '\nFixture visible text:\n' + safe(visible).slice(0, 10000));
  } finally { try { await context.close(); } finally { await stopServer(); } }
}

try {
  await withFingerprintGuard(desktopFiles, async () => {
    try {
      assert.equal(process.platform, 'win32', 'This opt-in fixture supports Windows only'); await access(carrier.command);
      if (/^https:\/\//.test(archive)) {
        result.archive = archive;
      } else { await access(archive); result.archive = resolve(archive); result.archiveSHA256 = sha(await readFile(archive)); }
      result.clientSHA256 = sha(await readFile(join(root, 'lib/client.js')));
      const actual = assertRuntimeVersion(await runCLI(['--version']), expectedVersion);
      result.runtime = await runtimeIdentity(actual); pass(`actual runtime identity ${actual}`);
      await runCLI(['--profile', profileName, '--from-default-profile', 'web', '--dump-config']);
      await runCLI(['plugin', '--profile', profileName, 'add', archive, '--ignore-scripts'], 180000);
      let manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'));
      assert.deepEqual(Object.keys(manifest.dependencies ?? {}), ['dsh-model-shelf']);
      assert.deepEqual(manifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-model-shelf']);
      const installed = JSON.parse(await readFile(join(profileDir, 'node_modules/dsh-model-shelf/package.json'), 'utf8'));
      assert.equal(installed.version, packageVersion); result.installedVersion = installed.version;
      assert.equal(sha(await readFile(join(profileDir, 'node_modules/dsh-model-shelf/lib/client.js'))), result.clientSHA256);
      pass('official CLI installs the exact current archive into only the clean profile');
      await prepareProvider();
      await writePatch(undefined);
      const browserProfile = join(runRoot, 'edge-user-data');
      const privateContext = await chromium.launchPersistentContext(browserProfile, { ...(process.env.DSH_TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.DSH_TEST_BROWSER_EXECUTABLE } : { channel: 'msedge' }), headless: true, env: browserEnvironment(fixture.env, process.env), args: ['--enable-automation'], timeout: 30000 });
      browser = privateContext.browser();
      const cdp = await browser.newBrowserCDPSession();
      const commandLine = await cdp.send('Browser.getBrowserCommandLine');
      assert.equal(commandLine.arguments.find(arg => arg.startsWith('--user-data-dir=')), `--user-data-dir=${browserProfile}`);
      result.browserProfile = browserProfile; result.browserIdentityException = 'USERPROFILE only';
      await cdp.detach();
      await checkBoot('installed', true);
      await writePatch(true); await checkBoot('disabled', false);
      await writePatch(false); await checkBoot('reenabled', true);
      await writePatch(undefined);
      await runCLI(['plugin', '--profile', profileName, 'remove', 'dsh-model-shelf']);
      manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'));
      assert.equal(manifest.dependencies?.['dsh-model-shelf'], undefined); assert.ok(!manifest.dsh.profile.bundles.includes('dsh-model-shelf'));
      await checkBoot('uninstalled', false);
      pass('uninstall removes dependency and bundle without orphaned plugin patch rows');
    } finally {
      const failures = [];
      try { await browser?.close(); result.browserClosed = true; } catch (error) { failures.push(error.message); }
      try { await stopServer(); } catch (error) { failures.push(error.message); }
      try { await owner.closeAll(); } catch (error) { failures.push(error.message); }
      result.processes = owner.receipts; result.activeProcesses = owner.activeCount;
      try { result.providerStats = JSON.parse(await readFile(providerStats, 'utf8')); assert.equal(result.providerStats.streams, 0, 'No model streaming calls permitted'); }
      catch (error) { if (error.code !== 'ENOENT') failures.push(error.message); }
      if (failures.length) throw Error(failures.join('\n'));
    }
  }, proof => { result.protectedFiles = proof; });
  pass('protected desktop manifest and patch fingerprints unchanged, all owned processes closed');
  result.success = true;
} catch (error) { result.failure = safe(error.stack ?? error); console.error(result.failure); process.exitCode = 1; }
finally {
  await writeFile(join(evidenceDir, 'result.json'), safe(JSON.stringify(result, null, 2)) + '\n');
  console.log(`Evidence: tests/artifacts/clean-${runId}/result.json; success=${result.success}`);
}
