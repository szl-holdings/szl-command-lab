// SPDX-License-Identifier: Apache-2.0
// Local Chromium/Edge smoke test of the exact Python gateway and fixed demos.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS resolves the CI browser test dependency through NODE_PATH. */
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');

const origin = process.env.ATLAS_TEST_ORIGIN || 'http://127.0.0.1:7868';
const evidenceDir = process.env.ATLAS_EVIDENCE_DIR;
function capture(page, name) {
  if (!evidenceDir) return Promise.resolve();
  mkdirSync(evidenceDir, { recursive: true });
  return page.screenshot({ path: resolve(evidenceDir, name + '.png'), fullPage: false });
}
assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const catalog = {
  captured_at: '2026-10-08T00:00:00Z', state: 'PARTIAL',
  counts: { models: 1, kernels: 1, datasets: 1, spaces: 1, assets: 4 },
  assets: [
    { type: 'model', id: 'SZLHOLDINGS/SZL-Khipu-1.5B', slug: 'SZL-Khipu-1.5B' },
    { type: 'kernel', id: 'SZLHOLDINGS/governed-inference-meter', slug: 'governed-inference-meter' },
    { type: 'dataset', id: 'SZLHOLDINGS/a11oy-verifiable-corpus', slug: 'a11oy-verifiable-corpus' },
    { type: 'space', id: 'SZLHOLDINGS/a11oy', slug: 'a11oy' },
  ].map(row => ({ ...row, href: 'https://huggingface.co/' + row.id, tags: ['fixture'], downloads: 1, last_modified: '2026-10-08T00:00:00Z' })),
};

test('Atlas demo anchor, local Python views, failures, and narrow layout', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 500, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/\/api\/(catalog|estate|build-info)(\?|$)/, async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/catalog') await new Promise(resolve => setTimeout(resolve, 500));
      const data = path === '/api/catalog' ? catalog : path === '/api/estate'
        ? { surfaces: [], reachable_surfaces: 0, simulated_surfaces: 0, captured_at: catalog.captured_at }
        : { state: 'REVISION_UNAVAILABLE', source_revision: null };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(origin + '/#loop');
    await page.locator('#asset-list .asset-row').first().waitFor();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.demo-disclosure').getAttribute('open'), '');
    assert.equal(await page.locator('#nav-list a[href="#loop"]').count(), 1);
    const position = await page.evaluate(() => {
      const section = document.querySelector('#loop').getBoundingClientRect();
      const button = document.querySelector('#run-loop').getBoundingClientRect();
      const result = document.querySelector('#loop-result').getBoundingClientRect();
      return { sectionTop: section.top, buttonBottom: button.bottom, resultTop: result.top,
        font: parseFloat(getComputedStyle(document.querySelector('#loop-result')).fontSize) };
    });
    assert.ok(position.sectionTop >= -10 && position.sectionTop <= 160, JSON.stringify(position));
    assert.ok(position.resultTop >= position.buttonBottom, JSON.stringify(position));
    assert.ok(position.resultTop - position.buttonBottom < 90, JSON.stringify(position));
    assert.ok(position.font >= 14, JSON.stringify(position));
    await capture(page, 'demo-anchor-500');

    const button = page.locator('#run-loop');
    await button.click();
    await page.locator('#loop-result').getByText('ADVISORY DEMO').waitFor();
    assert.match(await page.locator('#loop-result').innerText(), /5\/5 checks passed.*Conjecture 1/);
    assert.ok(await page.evaluate(() => document.querySelector('#loop-result').getBoundingClientRect().bottom <= innerHeight + 2), 'result should be visible after a narrow-screen run');
    await page.locator('#zero-heart').check();
    await button.click();
    await page.locator('#loop-result').getByText('BLOCKED').waitFor();
    assert.match(await page.locator('#loop-result').innerText(), /4\/5 checks passed/);
    await page.locator('#zero-heart').uncheck();

    let runs = 0;
    await page.route(/\/api\/organs\/integrity\?/, async route => {
      runs += 1;
      await new Promise(resolve => setTimeout(resolve, 350));
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ body: { blocked: false, live_count: 5, conjecture_1: 'OPEN', organs: [] },
          energy: { honesty: 'UNAVAILABLE' } }) });
    });
    await page.evaluate(() => { const b = document.querySelector('#run-loop'); b.click(); b.click(); });
    await page.locator('#loop-result').getByText('ADVISORY DEMO').waitFor();
    assert.equal(runs, 1, 'disabled button must prevent duplicate requests');
    await page.unroute(/\/api\/organs\/integrity\?/);

    await page.route(/\/api\/organs\/integrity\?/, route => route.abort('failed'));
    await button.click();
    await page.locator('#loop-result').getByText('UNAVAILABLE').waitFor();
    assert.equal(await button.isEnabled(), true);
    await page.unroute(/\/api\/organs\/integrity\?/);

    await page.route(/\/api\/organs\/integrity\?/, async route => {
      await new Promise(resolve => setTimeout(resolve, 6500));
      try { await route.abort('timedout'); } catch { /* client aborts first */ }
    });
    const timeoutStart = Date.now();
    await button.click();
    await page.locator('#loop-result').getByText('UNAVAILABLE').waitFor({ timeout: 6500 });
    assert.ok(Date.now() - timeoutStart < 6400, 'client deadline should end the pending request');
    assert.equal(await button.isEnabled(), true);
    await page.unroute(/\/api\/organs\/integrity\?/);

    await page.goto(origin + '/demos');
    assert.match(await page.locator('h1').innerText(), /Inspect a bounded result/);
    await capture(page, 'demo-index-500');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#main');
    await page.getByRole('link', { name: 'Try retrieval' }).click();
    await page.getByRole('link', { name: 'Inventory' }).click();
    assert.match(await page.locator('[role="status"]').innerText(), /Authority NONE/);
    await page.goBack();
    await page.goBack();
    await page.getByRole('link', { name: 'Try receipt verification' }).click();
    for (const [id, integrity] of [['intact', 'PASS'], ['tampered', 'FAIL'], ['unsigned', 'PASS']]) {
      await page.goto(origin + '/demos/receipts/' + id);
      const status = await page.locator('[role="status"]').innerText();
      assert.match(status, new RegExp('integrity ' + integrity));
      assert.match(status, /signature SKIP/);
    }
    await page.setViewportSize({ width: 375, height: 850 });
    await page.goto(origin + '/demos/receipts/tampered');
    await capture(page, 'receipt-tampered-375');
    await page.goto(origin + '/demos/retrieval/%3Cscript%3E');
    assert.equal(await page.locator('h1').innerText(), 'Unknown demo fixture.');
    assert.ok(!(await page.locator('script').count()));

    for (const width of [320, 375, 500]) {
      await page.setViewportSize({ width, height: 850 });
      for (const path of ['/demos', '/demos/retrieval/inventory', '/demos/receipts/tampered', '/launchpad']) {
        await page.goto(origin + path);
        const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        assert.ok(layout.scrollWidth <= layout.width + 2, JSON.stringify({ path, ...layout }));
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await browser.close();
  }
});
