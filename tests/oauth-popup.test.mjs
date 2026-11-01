import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

// Load the actual Vite client module (including import.meta.env and its real
// Better Auth client). Only the browser surface and HTTP transport are fakes;
// no broker, user credential, or network connection is used.
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
let vite;
let client;
let fixture;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  globalThis.fetch = (...args) => fixture.fetch(...args);
  client = await vite.ssrLoadModule('/src/lib/auth/client.ts');
});
afterEach(async () => {
  fixture?.releaseSignOut();
  await delay(0);
  fixture?.cleanup();
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});
after(async () => { globalThis.fetch = originalFetch; await vite?.close(); });

function browser({ blocked = false } = {}) {
  const messages = new Set();
  const timers = new Set();
  const storage = new Map([['grok-auth.bearer-token', 'old-session']]);
  const popup = { closed: false };
  let releaseSignOut;
  let startedSignOut;
  const signOutStarted = new Promise(resolve => { startedSignOut = resolve; });
  const signOutResponse = new Promise(resolve => { releaseSignOut = resolve; });
  const w = {
    location: { origin: 'https://fixture.grok-sandbox.com', hostname: 'fixture.grok-sandbox.com', pathname: '/', search: '' },
    sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    open: () => blocked ? null : popup,
    addEventListener: (name, fn) => { if (name === 'message') messages.add(fn); },
    removeEventListener: (name, fn) => { if (name === 'message') messages.delete(fn); },
    setInterval: (fn, ms) => { const id = setInterval(fn, ms); timers.add(id); return id; },
    clearInterval: id => { clearInterval(id); timers.delete(id); },
    setTimeout: (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; },
    clearTimeout: id => { clearTimeout(id); timers.delete(id); },
  };
  globalThis.window = w;
  const fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    if (url.endsWith('/sign-out')) { startedSignOut(); await signOutResponse; }
    else assert.ok(url.endsWith('/get-session'), `unexpected HTTP request: ${url}`);
    return new Response('null', { headers: { 'content-type': 'application/json' } });
  };
  fixture = {
    popup, storage, messages, timers, signOutStarted, releaseSignOut, fetch,
    emit(data, source = popup, origin = w.location.origin) {
      for (const fn of messages) fn({ data, source, origin });
    },
    cleanup() { releaseSignOut(); for (const id of timers) { clearTimeout(id); clearInterval(id); } },
  };
  return fixture;
}
const completion = token => ({ source: 'grok-auth-popup', token });

// This reproduces the former failure: sign-out remains in flight when the
// completion page posts its message and closes. The token must survive until
// clearing the old session finishes, rather than being lost as cancellation.
test('a callback completing during pre-sign-out retains the new session', { timeout: 5000 }, async () => {
  const b = browser();
  const result = client.signIn('grok-google');
  await b.signOutStarted;
  assert.equal(b.messages.size, 1);
  b.emit(completion('new-session'));
  b.popup.closed = true;
  assert.equal(b.storage.get('grok-auth.bearer-token'), 'old-session');
  b.releaseSignOut();
  await result;
  assert.equal(b.storage.get('grok-auth.bearer-token'), 'new-session');
  assert.equal(b.messages.size, 0);
  assert.equal(b.timers.size, 0);
});

test('unrelated windows, origins and malformed messages cannot select a session', { timeout: 5000 }, async () => {
  const b = browser();
  const result = client.signIn('grok-google');
  await b.signOutStarted;
  b.releaseSignOut();
  await delay(0);
  b.emit(completion('other-window-session'), { closed: false });
  b.emit(completion('cross-origin-session'), b.popup, 'https://other.invalid');
  b.emit({ source: 'unrelated', token: 'wrong-message' });
  b.emit(completion({ token: 'not-a-string' }));
  assert.equal(await Promise.race([result.then(() => 'settled'), delay(20, 'pending')]), 'pending');
  b.emit(completion('expected-session'));
  await result;
  assert.equal(b.storage.get('grok-auth.bearer-token'), 'expected-session');
  assert.equal(b.messages.size, 0);
  assert.equal(b.timers.size, 0);
});

test('explicit failure clears the old session and removes popup resources', { timeout: 5000 }, async () => {
  const b = browser();
  const result = client.signIn('grok-x');
  const rejected = assert.rejects(result, /cancelled or failed/);
  await b.signOutStarted;
  b.emit({ ...completion(null), error: 'access_denied' });
  b.releaseSignOut();
  await rejected;
  assert.equal(b.storage.has('grok-auth.bearer-token'), false);
  assert.equal(b.messages.size, 0);
  assert.equal(b.timers.size, 0);
});

test('a blocked popup reports failure without installing listeners', { timeout: 5000 }, async () => {
  const b = browser({ blocked: true });
  const result = client.signIn('grok-google');
  const rejected = assert.rejects(result, /Pop-up blocked/);
  await b.signOutStarted;
  b.releaseSignOut();
  await rejected;
  assert.equal(b.messages.size, 0);
  assert.equal(b.timers.size, 0);
});

test('closing the popup without a completion message cancels and cleans up', { timeout: 5000 }, async () => {
  const b = browser();
  const result = client.signIn('grok-google');
  const rejected = assert.rejects(result, /cancelled or failed/);
  await b.signOutStarted;
  b.releaseSignOut();
  b.popup.closed = true;
  await rejected;
  assert.equal(b.messages.size, 0);
  assert.equal(b.timers.size, 0);
});
