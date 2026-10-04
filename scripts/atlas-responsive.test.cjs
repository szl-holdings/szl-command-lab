// SPDX-License-Identifier: Apache-2.0
// Browser regression for the shipped static Atlas, with synthetic provider data.
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');

const origin = process.env.ATLAS_TEST_ORIGIN || 'http://127.0.0.1:7868';
assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'test a local preview only');
const evidenceDir = process.env.ATLAS_EVIDENCE_DIR;
const fixture = {
  captured_at: '2026-10-04T00:00:00Z', state: 'PARTIAL',
  counts: { models: 1, kernels: 1, datasets: 1, spaces: 1, assets: 4 },
  assets: [
    { type: 'model', id: 'SZLHOLDINGS/SZL-Khipu-1.5B', slug: 'SZL-Khipu-1.5B', pipeline: 'text-generation', downloads: 4 },
    { type: 'kernel', id: 'SZLHOLDINGS/governed-inference-meter', slug: 'governed-inference-meter', downloads: 3 },
    { type: 'dataset', id: 'SZLHOLDINGS/a11oy-verifiable-corpus', slug: 'a11oy-verifiable-corpus', downloads: 2 },
    { type: 'space', id: 'SZLHOLDINGS/a11oy', slug: 'a11oy', downloads: 1 },
  ].map(row => ({ ...row, href: 'https://huggingface.co/' + row.id, tags: ['synthetic-browser-fixture'], last_modified: '2026-10-04T00:00:00Z' })),
};

test('Atlas reflows in narrow frames, desktop widths, and 200–400% zoom', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const results = [];
  try {
    for (const spec of [
      ...[320, 375, 744, 768, 1024, 1440, 1920].map(width => ({ name: `width-${width}`, width })),
      { name: 'zoom-200', width: 1440, zoom: 2 },
      { name: 'zoom-400', width: 1440, zoom: 4 },
      { name: 'iframe-320', width: 1440, frame: 320 },
      { name: 'iframe-744', width: 1440, frame: 744 },
      { name: 'touch-375', width: 375, touch: true },
    ]) {
      const page = await browser.newPage({ viewport: { width: spec.width, height: 1000 }, reducedMotion: 'reduce', hasTouch: Boolean(spec.touch), isMobile: Boolean(spec.touch) });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(`${origin}/api/**`, route => {
        const path = new URL(route.request().url()).pathname;
        const payload = path === '/api/catalog' ? fixture : path === '/api/estate'
          ? { surfaces: [], reachable_surfaces: 0, simulated_surfaces: 0, captured_at: fixture.captured_at }
          : path === '/api/build-info' ? { state: 'REVISION_UNAVAILABLE', source_revision: null }
          : { body: { blocked: true, live_count: 0, organs: [] }, energy: { honesty: 'UNAVAILABLE' } };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
      });
      let scope = page;
      if (spec.frame) {
        await page.route(`${origin}/_responsive-host`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Local iframe test</title><iframe title="Atlas preview" src="/" style="width:${spec.frame}px;height:940px;border:0"></iframe>` }));
        await page.goto(`${origin}/_responsive-host`);
        scope = await (await page.locator('iframe').elementHandle()).contentFrame();
      } else {
        await page.goto(origin);
      }
      await scope.locator('#asset-list .asset-row').first().waitFor();
      await scope.locator('.demo-disclosure > summary').click();
      if (spec.zoom) {
        await scope.evaluate(zoom => { document.documentElement.style.zoom = String(zoom); }, spec.zoom);
      }
      await scope.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await scope.evaluate(() => window.scrollTo(0, 0));
      const layout = await scope.evaluate(() => {
        const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
        const view = window.innerWidth;
        const hero = document.querySelector('[aria-label="SZL governed command fabric visualization"]');
        const rect = hero.getBoundingClientRect();
        const overflow = [...document.querySelectorAll('main *, header a, header button, footer a')].filter(node => {
          if (node.closest('.sr-only, .skip, [hidden]') || !node.getClientRects().length) return false;
          const css = getComputedStyle(node);
          if (css.visibility === 'hidden' || css.display === 'none') return false;
          const box = node.getBoundingClientRect();
          return box.width > 0 && (box.right > view + 2 || box.left < -2);
        }).map(node => ({ tag: node.tagName, class: node.className.baseVal || node.className, text: (node.textContent || '').trim().slice(0, 55), box: node.getBoundingClientRect().toJSON() }));
        const smallTargets = [...document.querySelectorAll('a[href],button,input,select,summary')].filter(node => {
          if (node.closest('.skip, [hidden]') || !node.getClientRects().length) return false;
          const target = node.tagName === 'INPUT' && node.closest('label') ? node.closest('label') : node;
          const box = target.getBoundingClientRect();
          return box.width > 0 && (box.height / zoom < 43.5 || box.width / zoom < 43.5);
        }).map(node => ({ tag: node.tagName, id: node.id, text: (node.textContent || '').trim().slice(0, 55) }));
        return { viewport: view, hero: rect.toJSON(), overflow, smallTargets, scrollWidth: document.documentElement.scrollWidth, zoom,
          zoomTier: document.documentElement.dataset.szlZoomTier || null,
          bodyWidth: getComputedStyle(document.body).width,
          experience: Boolean(window.SZLPublicExperience),
        };
      });
      const failures = [];
      if (layout.hero.width < Math.min(240, layout.viewport * .7)) failures.push('hero collapsed');
      if (layout.hero.height < 120) failures.push('hero has no normal-flow height');
      if (layout.overflow.length) failures.push('content leaves the viewport');
      if (errors.length) failures.push('page JavaScript error');
      if (spec.touch && layout.smallTargets.length) failures.push('touch control is smaller than 44px');
      results.push({ ...spec, ...layout, errors, failures });
      if (spec.name === 'width-320') {
        const menu = scope.locator('#menu-button');
        await menu.click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        await menu.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        await menu.click();
        await scope.locator('#nav-list a[href="#build"]').click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        await scope.locator('#asset-search').fill('Khipu');
        assert.equal(await scope.locator('#asset-list .asset-row').count(), 1);
        await scope.locator('#asset-search').fill('no-fixture-matches');
        assert.match(await scope.locator('#asset-list').innerText(), /No public assets match/);
        await scope.locator('#asset-search').fill('');
        await scope.evaluate(() => window.scrollTo(0, 0));
      }
      if (evidenceDir && (failures.length || spec.zoom || spec.frame || ['width-320', 'width-1440', 'touch-375'].includes(spec.name))) {
        mkdirSync(evidenceDir, { recursive: true });
        await page.screenshot({ path: resolve(evidenceDir, `${spec.name}.png`), fullPage: false });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(resolve(evidenceDir, 'responsive-results.json'), JSON.stringify({ observed_at: new Date().toISOString(), scope: 'LOCAL_BROWSER_SYNTHETIC_PROVIDER_DATA', results }, null, 2) + '\n');
    }
  }
  assert.deepEqual(results.filter(row => row.failures.length).map(row => ({ name: row.name, failures: row.failures, hero: row.hero, overflow: row.overflow.slice(0, 8), smallTargets: row.smallTargets, zoomTier: row.zoomTier, experience: row.experience, bodyWidth: row.bodyWidth })), []);
});
