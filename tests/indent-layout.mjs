// Targeted regression: missing/scoped-wrong padding must fail real rendered geometry.
// Reuses only the existing synthetic host HTML, never executes the full suite.
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const label = process.argv[2];
assert.match(label ?? '', /^[A-Za-z0-9_-]+$/, 'Supply a new evidence directory name');
const out = new URL(`tests/artifacts/${label}/`, root);
await mkdir(out); // Never overwrite prior evidence.
const tmp = new URL('temp/', out); await mkdir(tmp);
process.env.TEMP = fileURLToPath(tmp); process.env.TMP = fileURLToPath(tmp);
const sha = value => createHash('sha256').update(value).digest('hex');
const require = createRequire(import.meta.url);
const source = await readFile(new URL('tests/browser.mjs', root), 'utf8');
const template = source.match(/const html = `([\s\S]*?)`;\r?\nawait mkdir/);
assert.ok(template, 'Existing synthetic HTML boundary not found');
const client = await readFile(new URL('lib/client.js', root), 'utf8');
const cssSource = await readFile(new URL('src/style.css', root), 'utf8');
const embedded = client.match(/style\.textContent = ("(?:\\.|[^"\\])*");/);
assert.ok(embedded, 'Generated stylesheet missing');
assert.equal(JSON.parse(embedded[1]), cssSource, 'Rebuild required: source and generated CSS differ');
const manifest = await readFile(new URL('package.json', root), 'utf8');
const react = await readFile(join(dirname(require.resolve('react/package.json')), 'umd/react.production.min.js'), 'utf8');
const reactDOM = await readFile(join(dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.production.min.js'), 'utf8');
assert.equal([...template[1].matchAll(/\$\{(react|reactDOM|client)\}/g)].length, 3);
const values = { react, reactDOM, client };
const html = template[1].replace(/\$\{(react|reactDOM|client)\}/g, (_, key) => values[key]);
const htmlURL = new URL('harness.html', out);
await writeFile(htmlURL, html, { flag: 'wx' });
const rule = '.dmo-group>.dmo-row>.dmo-select{padding-left:2px;padding-right:14px}';
const results = [];
const evidence = {
  startedAt: new Date().toISOString(), candidateVersion: JSON.parse(manifest).version,
  inputs: { clientSHA256: sha(client), cssSHA256: sha(cssSource), manifestSHA256: sha(manifest),
    browserFixtureSourceSHA256: sha(source), harnessSHA256: sha(html),
    testSHA256: sha(await readFile(new URL(import.meta.url))) },
  scope: 'synthetic real-client geometry only; no desktop/profile/install/full-suite', results,
};
let browser;
const close = (a, b) => Math.abs(a - b) < 0.05;
try {
  // No CDP attach, sandbox bypass, or browser fallback if launch is refused.
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  evidence.browserVersion = browser.version();
  for (const width of [1280, 390, 320]) for (const dark of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const result = { width, dark, passed: false, pageErrors: [], networkRequests: [] };
    results.push(result);
    try {
      await context.route(/^https?:/, route => { result.networkRequests.push(route.request().url()); return route.abort(); });
      const page = await context.newPage();
      page.on('pageerror', error => result.pageErrors.push(error.message));
      await page.goto(htmlURL.href);
      await page.evaluate(value => document.body.classList.toggle('dark', value), dark);
      // Existing host mock has a fixed-width composer: open wide, then resize.
      await page.locator('.dmo-trigger').click();
      await page.setViewportSize({ width, height: 1000 });
      const group = page.locator('.dmo-group[data-provider-id="provider-one"]');
      const original = await page.locator('style[data-plugin="dsh-model-shelf"]').textContent();
      const baseline = original.replace(rule, '');
      const apply = async css => {
        await page.evaluate(text => { document.querySelector('style[data-plugin="dsh-model-shelf"]').textContent = text; }, css);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      };
      const measure = locator => locator.evaluate(row => {
        const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const select = row.querySelector('.dmo-select');
        return { row: rect(row), hit: rect(select), icon: rect(row.querySelector('.dmo-icon')),
          text: rect(row.querySelector('.dmo-copy')), paddingLeft: getComputedStyle(select).paddingLeft,
          paddingRight: getComputedStyle(select).paddingRight };
      });
      const row = group.locator('.dmo-row').first(); await row.waitFor();
      await apply(baseline); result.before = await measure(row);
      await apply(original); result.after = await measure(row);
      assert.equal(result.before.paddingLeft, '8px'); assert.equal(result.before.paddingRight, '8px');
      assert.equal(result.after.paddingLeft, '2px', 'Expanded row left padding must be 2px');
      assert.equal(result.after.paddingRight, '14px', 'Expanded row right padding must be 14px');
      assert.ok(close(result.after.icon.x - result.before.icon.x, -6), 'Icon must move left exactly 6px');
      assert.ok(close(result.after.text.x - result.before.text.x, -6), 'Text must move left exactly 6px');
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(close(result.before.hit[key], result.after.hit[key]), 'Hit box ' + key);
      assert.ok(close(result.before.row.height, result.after.row.height), 'Row height');
      assert.ok(close(result.before.text.width, result.after.text.width), 'Text width');
      assert.equal(result.after.icon.width, 24); assert.equal(result.after.icon.height, 24);
      assert.equal(original.split(rule).length - 1, 1);
      await page.screenshot({ path: fileURLToPath(new URL(`${width}-${dark ? 'dark' : 'light'}.png`, out)) });
      await group.locator('.dmo-group-heading').click();
      await apply(baseline); result.collapsedBefore = await group.boundingBox();
      await apply(original); result.collapsedAfter = await group.boundingBox();
      assert.deepEqual(result.collapsedAfter, result.collapsedBefore);
      await group.locator('.dmo-group-heading').click();
      await row.locator('.dmo-favorite').click();
      await page.getByRole('tab', { name: /^收藏/ }).click();
      const favorite = page.locator('.dmo-list > .dmo-row').first();
      await apply(baseline); result.favoriteBefore = await measure(favorite);
      await apply(original); result.favoriteAfter = await measure(favorite);
      assert.deepEqual(result.favoriteAfter, result.favoriteBefore);
      assert.equal(result.favoriteAfter.paddingLeft, '8px'); assert.equal(result.favoriteAfter.paddingRight, '8px');
      assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.networkRequests, []);
      assert.equal(await page.evaluate(() => window.selected.length), 0, 'No model selection should occur');
      result.passed = true;
      console.log(`PASS ${width}px ${dark ? 'dark' : 'light'}: 8/8 -> 2/14, content -6px; controls unchanged`);
    } catch (error) {
      result.error = { name: error.name, message: error.message };
      console.error(`FAIL ${width}px ${dark ? 'dark' : 'light'}: ${error.message}`);
    } finally { await context.close(); }
  }
} catch (error) {
  evidence.fatalError = { name: error.name, message: error.message };
  console.error(error.message);
} finally {
  if (browser) { await browser.close(); evidence.browserClosed = true; }
  evidence.passed = results.filter(x => x.passed).length;
  evidence.completedAt = new Date().toISOString();
  evidence.allPassed = evidence.passed === 6 && !evidence.fatalError;
  await writeFile(new URL('geometry.json', out), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  console.log(`Geometry result ${evidence.passed}/6; evidence ${fileURLToPath(out)}`);
  if (!evidence.allPassed) process.exitCode = 1;
}
