// Fresh browser contexts; only SRI-verified official archives and fixture sessions.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { loadPublishedWeb } from '../host-packages.mjs';
import { frontendPage } from '../host-inventory/web-fixture.mjs';
import { mountSeat } from '../host-inventory/seat-fixture.mjs';

const shelfCode = await readFile(new URL('../../lib/client.js', import.meta.url), 'utf8');
for (const version of ['0.0.1-rc.5', '0.2.2-rc.5']) {
  test(version + ': missing option services preserve an explicit effort reset and native fallback', async t => {
    const web = await loadPublishedWeb(version, { offline: true });
    const names = Object.fromEntries(Object.entries(web.receipts).map(([key, row]) => [key, row.name]));
    const browser = await chromium.launch(process.env.DSH_TEST_BROWSER_EXECUTABLE
      ? { executablePath: process.env.DSH_TEST_BROWSER_EXECUTABLE } : { channel: process.platform === 'win32' ? 'msedge' : 'chrome' });
    t.after(() => browser.close());
    const { page, errors, denied } = await frontendPage(browser, web);
    page.setDefaultTimeout(5000);
    const route = { provider: 'openai-codex', model: 'gpt-5.4' }, target = { ...route, provider: 'openai-api' };
    const { enabled, earlyWire } = await page.evaluate(mountSeat, { clients: web.clients, names, shelfCode, initial: { ...route, reasoningEffort: 'high' }, target });
    assert.equal(enabled, true); assert.equal(earlyWire, version === '0.0.1-rc.5');

    await page.locator('.dmo-trigger').click();
    const effort = page.getByLabel('思考强度', { exact: true });
    assert.equal(await effort.inputValue(), 'high');
    assert.equal(await page.locator('.dmo-provider-options').count(), 0);
    await effort.selectOption('low');
    await page.waitForFunction(() => window.seatFixture.current().reasoningEffort === 'low');
    const reset = page.getByRole('button', { name: '恢复服务商默认', exact: true });
    await reset.click(); await reset.waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => window.seatFixture.current()), route);
    await page.locator('.dmo-select[aria-pressed="false"]').click();
    await page.locator('.dmo-panel').waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => window.seatFixture.current()), target);
    assert.deepEqual(await page.evaluate(() => window.seatFixture.requests),
      [{ ...route, reasoningEffort: 'low' }, route, target].map(selection => ({ sessionId: 'fixture-session', ...selection })));

    await page.evaluate(() => window.seatFixture.disposeShelf());
    const native = page.locator('#contract-seat button[aria-haspopup="menu"]');
    assert.equal(await native.count(), 1);
    await page.evaluate(() => window.seatFixture.noCapability());
    assert.equal(await native.count(), 1);
    await native.click(); await page.getByRole('menu').first().waitFor({ state: 'visible' });
    await page.evaluate(() => window.seatFixture.disposeAll());
    assert.deepEqual(errors, []); assert.deepEqual(denied, []);
  });
}
