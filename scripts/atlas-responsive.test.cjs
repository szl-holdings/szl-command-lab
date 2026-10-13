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
  counts: { models: 1, kernels: 1, datasets: 1, spaces: 2, assets: 5 },
  assets: [
    { type: 'model', id: 'SZLHOLDINGS/SZL-Khipu-1.5B', slug: 'SZL-Khipu-1.5B', pipeline: 'text-generation', downloads: 4 },
    { type: 'kernel', id: 'SZLHOLDINGS/governed-inference-meter', slug: 'governed-inference-meter', downloads: 3 },
    { type: 'dataset', id: 'SZLHOLDINGS/a11oy-verifiable-corpus', slug: 'a11oy-verifiable-corpus', downloads: 2 },
    { type: 'space', id: 'SZLHOLDINGS/a11oy', slug: 'a11oy', downloads: 1 },
    { type: 'space', id: 'SZLHOLDINGS/README', slug: 'README', role: 'organization_profile', role_label: 'Organization profile', downloads: 0 },
  ].map(row => ({ ...row, href: 'https://huggingface.co/' + row.id, tags: ['synthetic-browser-fixture'], last_modified: '2026-10-04T00:00:00Z' })),
};

test('Atlas reflows in narrow frames, desktop widths, and 200–400% zoom', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const results = [];
  const observationResults = [];
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
      if (Math.abs(layout.zoom - (spec.zoom || 1)) > .01) failures.push('requested CSS zoom was not applied');
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
        await scope.locator('#asset-search').fill('Organization profile');
        assert.equal(await scope.locator('#asset-list .asset-row').count(), 1);
        assert.match(await scope.locator('#asset-list').innerText(), /README[\s\S]*Organization profile/);
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
    for (const mode of ['unavailable', 'cached', 'observed-zero', 'legacy-failure']) {
      const page = await browser.newPage({ viewport: { width: 320, height: 1000 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const payload = structuredClone(fixture);
      payload.captured_at = '2026-10-04T16:10:00Z';
      payload.errors = { models: 'models inventory unavailable: TimeoutError' };
      payload.family_observations = Object.fromEntries(['models', 'kernels', 'datasets', 'spaces'].map(family => [family, { state: 'FRESH', observed_at: payload.captured_at }]));
      if (mode === 'cached') {
        payload.family_observations = Object.fromEntries(['models', 'kernels', 'datasets', 'spaces'].map(family => [family, { state: 'CACHED', observed_at: '2026-10-04T16:00:00Z' }]));
        payload.assets = payload.assets.map(asset => ({ ...asset, observation_state: 'CACHED', observed_at: '2026-10-04T16:00:00Z' }));
      } else {
        payload.assets = payload.assets.filter(asset => asset.type !== 'model');
        payload.counts.assets -= 1;
        payload.counts.models = mode === 'unavailable' ? null : 0;
        payload.family_observations.models = { state: mode === 'observed-zero' ? 'FRESH' : 'UNAVAILABLE', observed_at: mode === 'observed-zero' ? payload.captured_at : null };
        if (mode === 'observed-zero') { payload.errors = {}; payload.state = 'VERIFIED_PUBLIC_LISTING'; }
        if (mode === 'legacy-failure') delete payload.family_observations;
      }
      await page.route(`${origin}/api/**`, route => {
        const path = new URL(route.request().url()).pathname;
        const data = path === '/api/catalog' ? payload : path === '/api/estate'
          ? { surfaces: [], reachable_surfaces: 0, simulated_surfaces: 0, captured_at: payload.captured_at }
          : { state: 'REVISION_UNAVAILABLE', source_revision: null };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      });
      await page.goto(origin);
      await page.waitForFunction(() => document.querySelector('#state-models').textContent !== 'Awaiting observation');
      const metric = await page.locator('#count-models').innerText();
      const observation = await page.locator('#state-models').innerText();
      const capture = await page.locator('#capture-line').innerText();
      if (mode === 'cached') {
        assert.equal(metric, '1');
        assert.match(observation, /Cached · observed Oct 4, 16:00 UTC/);
        assert.match(capture, /PARTIAL.*checked Oct 4, 16:10 UTC.*models: cached/);
        for (const selector of ['#model-spotlights', '#surface-grid', '#evidence-grid', '#kernel-list', '#asset-list']) {
          assert.match(await page.locator(selector).innerText(), /Cached listing · observed Oct 4, 16:00 UTC/);
        }
      } else if (mode === 'observed-zero') {
        assert.equal(metric, '0');
        assert.match(observation, /Observed Oct 4, 16:10 UTC/);
        assert.match(await page.locator('#model-spotlights').innerText(), /No model repositories were present/);
      } else {
        assert.equal(metric, '—');
        assert.match(observation, /Unavailable · no current count/);
        assert.match(capture, /PARTIAL.*models: unavailable/);
        assert.match(await page.locator('#model-spotlights').innerText(), /Model inventory is unavailable/);
      }
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const overflow = await page.evaluate(() => [...document.querySelectorAll('.metric-band *, #model-spotlights *, #kernel-list *, #capture-line')].filter(node => {
        if (!node.getClientRects().length) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2);
      }).map(node => ({ text: node.textContent.trim().slice(0, 60), rect: node.getBoundingClientRect().toJSON() })));
      observationResults.push({ mode, metric, observation, capture, errors, overflow });
      assert.deepEqual(errors, []);
      assert.deepEqual(overflow, []);
      if (evidenceDir) {
        mkdirSync(evidenceDir, { recursive: true });
        await page.locator('.metric-band').scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(evidenceDir, `catalog-${mode}.png`), fullPage: false });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(resolve(evidenceDir, 'responsive-results.json'), JSON.stringify({ observed_at: new Date().toISOString(), scope: 'LOCAL_BROWSER_SYNTHETIC_PROVIDER_DATA', results, observationResults }, null, 2) + '\n');
    }
  }
  assert.deepEqual(results.filter(row => row.failures.length).map(row => ({ name: row.name, failures: row.failures, hero: row.hero, overflow: row.overflow.slice(0, 8), smallTargets: row.smallTargets, zoomTier: row.zoomTier, experience: row.experience, bodyWidth: row.bodyWidth })), []);
});

async function inspectNative(page, {contrast = true, targets = true} = {}) {
  return page.evaluate(({contrast,targets}) => {
    const viewport = innerWidth;
    const overflowingText = [], contrastFailures = [], targetFailures = [];
    const context = document.createElement('canvas').getContext('2d', {willReadFrequently:true});
    context.canvas.width=1; context.canvas.height=1;
    const colorCache=new Map(),groundCache=new WeakMap(),styleCache=new WeakMap();
    function style(el) {if(!styleCache.has(el))styleCache.set(el,getComputedStyle(el));return styleCache.get(el);}
    function rgba(color) {if(!colorCache.has(color)){context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);colorCache.set(color,[...context.getImageData(0,0,1,1).data].map((x,i)=>i===3?x/255:x));}return colorCache.get(color);}
    function over(f,b) { const a=f[3]+b[3]*(1-f[3]);return [0,1,2].map(i=>a?(f[i]*f[3]+b[i]*b[3]*(1-f[3]))/a:0).concat(a); }
    function ground(el) {if(!groundCache.has(el))groundCache.set(el,over(rgba(style(el).backgroundColor),el.parentElement?ground(el.parentElement):[255,255,255,1]));return groundCache.get(el);}
    function luminance(c) {return c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
    function visible(el) {return el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) && !el.closest('[hidden],[aria-hidden="true"]');}
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;let lowestContrast=Infinity,textNodes=0;
    while((node=walker.nextNode())) {
      const el=node.parentElement;
      if(!node.textContent.trim() || !el || el.closest('script,style,svg,.skip-link,.skip,.sr-only') || !visible(el))continue;
      const range=document.createRange();range.selectNodeContents(node);
      const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)continue;
      textNodes++;
      if(rect.left < -2 || rect.right > viewport+2)overflowingText.push({text:node.textContent.trim().slice(0,90),class:el.className,box:rect.toJSON()});
      if(contrast) {
        const s=style(el), b=ground(el), f=over(rgba(s.color),b);
        const [a,z]=[luminance(f),luminance(b)].sort((a,b)=>b-a),ratio=(a+.05)/(z+.05);
        const large=parseFloat(s.fontSize)>=24 || (parseFloat(s.fontSize)>=18.666 && parseFloat(s.fontWeight)>=700);
        lowestContrast=Math.min(lowestContrast,ratio);
        if(ratio+.005 < (large?3:4.5))contrastFailures.push({text:node.textContent.trim().slice(0,100),class:el.className,ratio,threshold:large?3:4.5,color:s.color,background:b,computedBackground:s.backgroundColor,parsedBackground:rgba(s.backgroundColor)});
      }
    }
    if(targets)for(const el of document.querySelectorAll('a,button,summary')) {
      if(!visible(el)||el.closest('.skip-link,.skip'))continue;
      const b=el.getBoundingClientRect();
      if(b.width<43.9||b.height<43.9)targetFailures.push({text:el.textContent.trim().slice(0,90),width:b.width,height:b.height});
    }
    return {viewport,scrollWidth:document.documentElement.scrollWidth,bodyOverflow:getComputedStyle(document.body).overflowX,
      overflowingText,contrastFailures,targetFailures,lowestContrast:Number.isFinite(lowestContrast)?lowestContrast:null,textNodes};
  },{contrast,targets});
}


test('Native Atlas, Launchpad and demo frames retain readable controls and source states', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const checked = [];
  try {
    for (const path of ['/', '/launchpad', '/demos', '/demos/receipts/tampered']) {
      for (const spec of [{width:375},{width:1440},{width:375,forced:true},{width:320,js:false}]) {
        const page = await browser.newPage({viewport:{width:spec.width,height:1000}, reducedMotion:'reduce', forcedColors:spec.forced?'active':'none', javaScriptEnabled:spec.js!==false});
        const writes=[],external=[],errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.route('**/*',route=>{
          const req=route.request(),url=new URL(req.url());
          if(url.origin!==origin){external.push(url.origin+url.pathname);return route.abort();}
          if(!['GET','HEAD'].includes(req.method())){writes.push(req.method+' '+url.pathname);return route.abort();}
          if(url.pathname.startsWith('/api/')){
            const payload=url.pathname==='/api/catalog'?fixture:url.pathname==='/api/estate'?{surfaces:[],captured_at:fixture.captured_at}:url.pathname==='/api/build-info'?{state:'REVISION_UNAVAILABLE',source_revision:null}:{state:'UNAVAILABLE'};
            return route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});
          }
          return route.continue();
        });
        await page.goto(origin+path,{waitUntil:'load'});
        if(path==='/'&&spec.js===false){
          const startup=await page.evaluate(()=>({
            activeAnimations:document.getAnimations().filter(a=>a.playState==='running').length,
            durations:[...document.querySelectorAll('.button.primary,.hero-visual')].map(el=>getComputedStyle(el).transitionDuration),
          }));
          assert.equal(startup.activeAnimations,0,'reduced motion does not animate the first native layout');
          assert.ok(startup.durations.every(value=>value==='0s'),'static elements must not acquire positive transition durations');
        }
        if(path==='/'&&spec.js!==false){await page.locator('#asset-list .asset-row').first().waitFor();await page.locator('.demo-disclosure > summary').click();}
        const geometry=await inspectNative(page,{contrast:!spec.forced});
        checked.push({path,...spec,...geometry,errors,writes,external});
        if(evidenceDir){mkdirSync(evidenceDir,{recursive:true});if(spec.width===1440||spec.js===false)await page.screenshot({path:resolve(evidenceDir,`native-${path.replace(/[^a-z0-9]/g,'_')}-${spec.width}.png`)});}
        if(path==='/'&&spec.js===false){
          assert.equal(await page.locator('#nav-list a').count(),6);
          assert.equal(await page.locator('#nav-list a').first().isVisible(),true);
          assert.equal(await page.locator('#menu-button').isVisible(),false);
          assert.match(await page.locator('noscript').innerText(),/unavailable without JavaScript/);
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
  if(evidenceDir)writeFileSync(resolve(evidenceDir,'native-style-results.json'),JSON.stringify({scope:'LOCAL_SOURCE_AND_FIXED_FIXTURES',limits:['Chromium only','Computed text pairs; excludes native SVG and gradient-pixel conformance','No deployed runtime verdict'],checked},null,2)+'\n');
  const failed=checked.filter(x=>x.scrollWidth>x.viewport+2||x.overflowingText.length||x.contrastFailures.length||x.targetFailures.length||x.errors.length||x.writes.length||x.external.length);
  assert.equal(failed.length,0,JSON.stringify(failed.map(({path,width,js,overflowingText,contrastFailures,targetFailures,scrollWidth})=>({path,width,js,overflowingText,contrastFailures,targetFailures,scrollWidth})),null,2));
});
