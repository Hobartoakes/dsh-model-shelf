import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

// Opt-in Windows integration test. Never modifies the user's desktop profile.
const root = fileURLToPath(new URL('../', import.meta.url));
const install = process.env.DSH_TEST_INSTALL_DIR ?? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness');
const electron = join(install, 'DeepSeek Harness.exe');
const cliEntry = join(install, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js');
const packageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const archive = process.argv[2] ?? join(root, 'dist-draft', `dsh-model-shelf-${packageVersion}.tgz`);
const runRoot = join(root, 'tests', 'artifacts', `clean-${Date.now()}-${randomUUID().slice(0, 8)}`);
const home = join(runRoot, 'home');
const profileName = 'shelf-validation';
const profileDir = join(home, 'profiles', profileName);
const patch = join(profileDir, 'cordis.patch.yml');
const desktop = join(homedir(), '.dsh', 'profiles', 'desktop');
const desktopFiles = ['package.json', 'cordis.patch.yml'];
const fingerprint = async () => Promise.all(desktopFiles.map(async (name) => {
  try { return createHash('sha256').update(await readFile(join(desktop, name))).digest('hex'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}));
const redact = (text) => String(text).replace(/([?&]token=)[^\s"'<>]+/gi, '$1[REDACTED]').replaceAll(root, '[plugin-root]').replaceAll(homedir(), '[user-home]');
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/API_KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL/i.test(key) || ['DSH_PROFILE_DIR', 'DSH_PROFILE', 'DSH_SESSION_ID', 'DSH_WEB_URL', 'DSH_WORKSPACE'].includes(key)) delete env[key];
}
Object.assign(env, { DSH_HOME: home, ELECTRON_RUN_AS_NODE: '1', DSH_TELEMETRY_DISABLED: '1', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' });
let browser, server;
const checks = [];
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`); };
const launch = (args) => spawn(electron, ['--expose-internals', cliEntry, ...args], { env, cwd: runRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const runCLI = (args, timeout = 120000) => new Promise((resolve, reject) => {
  const child = launch(args); let output = '';
  const collect = (chunk) => { output += chunk.toString(); };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  const timer = setTimeout(() => { child.kill(); reject(new Error('Test CLI timed out: ' + args[0])); }, timeout);
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (code) => { clearTimeout(timer); if (code === 0) resolve(output); else reject(new Error(`Test CLI exit ${code}: ${redact(output).slice(-6000)}`)); });
});
const stopServer = async () => {
  if (!server) return;
  const child = server; server = null;
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => { const timer = setTimeout(resolve, 5000); child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill(); });
};
const startServer = () => new Promise((resolve, reject) => {
  server = launch(['--profile', profileName, '--host', '127.0.0.1', '--port', '0', '--no-open']);
  const child = server; let output = ''; let ready = false;
  const timer = setTimeout(() => { reject(new Error('Clean server startup timed out: ' + redact(output).slice(-5000))); }, 90000);
  const collect = (chunk) => {
    output += chunk.toString();
    if (ready) return;
    const text = output.replace(/\x1b\[[0-9;]*m/g, '');
    const match = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+\/[^\s]*)/.exec(text);
    if (match) {
      const url = new URL(match[1]);
      if (url.port === '19387') { clearTimeout(timer); reject(new Error('Refusing to use active GUI port')); return; }
      ready = true; clearTimeout(timer); resolve(url);
    }
  };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (code) => { clearTimeout(timer); if (!ready) reject(new Error(`Clean server exited ${code}: ${redact(output).slice(-5000)}`)); });
});
const onboardingPatch = [{ id: 'ui-settings-models', config: { credentialOnboarding: false } }];
const writePatch = async (disabled) => {
  const rows = disabled === undefined ? onboardingPatch : [...onboardingPatch, { id: 'model-shelf', disabled }];
  await writeFile(patch, JSON.stringify(rows, null, 2) + '\n');
};
const checkBoot = async (label, expected) => {
  const url = await startServer();
  console.log(`Isolated ${label} test origin: ${url.origin} (not the active GUI)`);
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage(); const pageErrors = [], consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(redact(error.message)));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(redact(message.text())); });
  try {
    // Token is consumed privately into the test browser's HttpOnly cookie, never logged.
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(new URL(page.url()).search, '');
    await page.waitForFunction(() => Array.isArray(window.__DSH_BOOT__?.entries), { timeout: 30000 });
    // Dismiss only the stock preview notice in this newly-created test home.
    const previewContinue = page.getByRole('button', { name: '继续', exact: true });
    await previewContinue.waitFor({ state: 'visible', timeout: 5000 }).then(() => previewContinue.click()).catch(() => {});
    const graph = await page.evaluate(() => window.__DSH_BOOT__.entries);
    const entry = graph.find((row) => row.id === 'dsh-model-shelf');
    assert.equal(Boolean(entry), expected);
    assert.ok(graph.some((row) => row.id === '@deepseek-ai/dsh-client-ui-model-selection'));
    if (expected) {
      const response = await context.request.get(new URL(entry.url, url.origin + '/').href);
      assert.equal(response.status(), 200);
      assert.ok((await response.text()).includes("id: 'dsh-model-shelf'"));
      await page.locator('style[data-plugin="dsh-model-shelf"]').waitFor({ state: 'attached', timeout: 30000 });
      if (await page.locator('.dmo-trigger').count() === 0) {
        const create = page.getByRole('button', { name: /新会话|新对话|New conversation|New chat/ }).first();
        if (await create.count()) await create.click();
      }
      await page.locator('.dmo-trigger').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('.dmo-trigger').click();
      await page.locator('.dmo-panel').waitFor({ state: 'visible', timeout: 10000 });
      assert.ok((await page.locator('.dmo-title').textContent()).includes('Model Shelf'));
      assert.ok(await page.getByRole('tab', { name: /^不常用/ }).isVisible());
      const installedPackage = JSON.parse(await readFile(join(profileDir, 'node_modules', 'dsh-model-shelf', 'package.json'), 'utf8'));
      if (installedPackage.version === '1.1.0') {
        await page.locator('.dmo-note-action').first().click();
        await page.locator('.dmo-note-input').fill('隔离测试账号');
        await page.locator('.dmo-note-input').press('Enter');
        assert.ok((await page.locator('.dmo-panel').innerText()).includes('账号备注：隔离测试账号'));
        await page.locator('.dmo-favorite').first().click();
        await page.getByRole('tab', { name: '收藏 (1)', exact: true }).click();
        assert.equal(await page.locator('.dmo-row').count(), 1);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('.dmo-trigger').waitFor({ state: 'visible', timeout: 30000 });
        await page.locator('.dmo-trigger').click();
        await page.getByRole('tab', { name: '收藏 (1)', exact: true }).click();
        assert.ok((await page.locator('.dmo-row').innerText()).includes('账号备注：隔离测试账号'));
      }
      await page.locator('.dmo-panel').screenshot({ path: join(runRoot, `${label}.png`) });
    } else {
      const nativePicker = page.getByRole('button', { name: /^选择模型，当前|^请选择模型$|^Select model/ }).first();
      await nativePicker.waitFor({ state: 'visible', timeout: 30000 });
      assert.equal(await nativePicker.getAttribute('aria-haspopup'), 'menu');
      await nativePicker.click();
      await page.getByRole('menu').first().waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('style[data-plugin="dsh-model-shelf"]').count(), 0);
      assert.equal(await page.locator('.dmo-trigger').count(), 0);
    }
    assert.deepEqual(pageErrors, []);
    assert.ok(!consoleErrors.some((message) => /slot entry crashed|without inject/i.test(message)), 'Caught slot failures must not be hidden by fallback');
    pass(`${label}: native client graph and actual browser UI match expected plugin state`);
  } catch (error) {
    await page.screenshot({ path: join(runRoot, `${label}-failure.png`) }).catch(() => {});
    const text = await page.locator('body').innerText().catch(() => '');
    throw new Error(redact(error.stack ?? error) + '\nClient console:\n' + consoleErrors.join('\n').slice(0, 6000) + '\nClean fixture visible text:\n' + redact(text).slice(0, 6000));
  } finally { await context.close(); await stopServer(); }
};

try {
  assert.equal(process.platform, 'win32', 'This clean-profile integration fixture currently supports Windows only');
  await access(electron);
  if (/^https:\/\//.test(archive)) {
    const source = new URL(archive);
    assert.equal(source.hostname, 'github.com', 'Remote fixture must be a public GitHub Release asset');
    assert.equal(source.username + source.password + source.search + source.hash, '', 'Do not pass credentials or private download URLs');
    assert.ok(/^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+\.tgz$/.test(source.pathname));
  } else {
    await access(archive);
  }
  const before = await fingerprint();
  await mkdir(home, { recursive: true });
  await runCLI(['--profile', profileName, '--from-default-profile', 'web', '--dump-config']);
  await runCLI(['plugin', '--profile', profileName, 'add', archive, '--ignore-scripts']);
  let manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}), ['dsh-model-shelf']);
  assert.deepEqual(manifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-model-shelf']);
  pass('clean profile installation contains only shipped web bundles and the target plugin');
  await writePatch(undefined);
  const browserOptions = process.env.DSH_TEST_BROWSER_EXECUTABLE
    ? { executablePath: process.env.DSH_TEST_BROWSER_EXECUTABLE, headless: true }
    : { channel: 'msedge', headless: true };
  browser = await chromium.launch(browserOptions);
  await checkBoot('installed', true);
  await writePatch(true); await checkBoot('disabled', false);
  await writePatch(false); await checkBoot('reenabled', true);
  await writePatch(undefined);
  await runCLI(['plugin', '--profile', profileName, 'remove', 'dsh-model-shelf']);
  manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies?.['dsh-model-shelf'], undefined);
  assert.ok(!manifest.dsh.profile.bundles.includes('dsh-model-shelf'));
  await checkBoot('uninstalled', false);
  pass('uninstall removes dependency and bundle without orphaned plugin patch rows');
  assert.deepEqual(await fingerprint(), before);
  pass('active desktop manifest and patch fingerprints unchanged');
  await writeFile(join(runRoot, 'result.json'), JSON.stringify({ success: true, checks, runtime: '0.2.0-rc.2', isolatedHome: true, credentialCopies: false, realModelCalls: false }, null, 2));
  console.log(`Clean profile checks: ${checks.length}; test evidence kept under ignored tests/artifacts.`);
} catch (error) {
  console.error(redact(error.stack ?? error)); process.exitCode = 1;
} finally { await browser?.close(); await stopServer(); }
