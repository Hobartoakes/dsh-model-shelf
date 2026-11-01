// Offline synthetic comparison: run browser.mjs first to create its harness.
import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const harness = await readFile(new URL('tests/artifacts/harness.html', root), 'utf8');
const current = await readFile(new URL('lib/client.js', root), 'utf8');
const baseline = execFileSync('git', ['show', 'HEAD:lib/client.js'], { cwd: fileURLToPath(root), encoding: 'utf8', maxBuffer: 5e6 });
if (!harness.includes(current)) throw new Error('Harness does not contain the current build; run npm run test:browser first');
const oldURL = new URL('tests/artifacts/perf-before.html', root);
const newURL = new URL('tests/artifacts/perf-after.html', root);
await writeFile(oldURL, harness.replace(current, baseline));
await writeFile(newURL, harness);
const options = process.env.DSH_TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.DSH_TEST_BROWSER_EXECUTABLE, headless: true } : { channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true };
const browser = await chromium.launch(options);
try {
  for (const [label, url] of [['before', oldURL], ['after', newURL]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const opens = [], scrolls = [], remoteImages = [];
    let actualImages = 0, decodedImages = 0;
    page.on('request', req => { if (req.resourceType() === 'image' && /^https?:/i.test(req.url())) remoteImages.push(req.url()); });
    await page.goto(url.href);
    await page.evaluate(() => { localStorage.clear(); setState({ groups: Array.from({length: 13}, (_, n) => ({id: n === 0 ? 'deepseek-official' : 'bench-' + n, name: 'Provider ' + n, models: Array.from({length: 50}, (_, m) => ({id: n === 0 && m === 0 ? 'deepseek-v4.1-flash' : 'model-' + m, name: 'Model ' + m}))})), current: {provider:'deepseek-official',model:'deepseek-v4.1-flash'} }); });
    for (let i = 0; i < 6; i++) {
      const start = performance.now();
      await page.locator('.dmo-trigger').click();
      await page.locator('.dmo-row').last().waitFor();
      opens.push(performance.now() - start);
      if (i === 0) {
        actualImages = await page.locator('.dmo-list img.dmo-icon').count();
        decodedImages = await page.locator('.dmo-list img.dmo-icon').evaluateAll(async images => { await Promise.all(images.map(img => img.decode())); return images.filter(img => img.naturalWidth > 0).length; });
      }
      const scrollStart = performance.now();
      await page.locator('.dmo-list').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      scrolls.push(performance.now() - scrollStart);
      await page.keyboard.press('Escape');
      await page.locator('.dmo-panel').waitFor({state:'hidden'});
    }
    console.log(JSON.stringify({ label, syntheticModels: 650, actualImages, decodedImages, baselineIncludesNoCompactChanges: true, remoteImageRequests: remoteImages.length, unit: 'ms', firstOpen: opens[0], samePageReopens: opens.slice(1), scroll: scrolls }));
    await page.close();
  }
} finally { await browser.close(); }
