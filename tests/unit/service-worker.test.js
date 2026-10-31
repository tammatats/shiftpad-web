const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function worker({ fetch, caches }) {
  const events = {};
  const context = vm.createContext({ fetch, caches, URL, self: { location: { origin: 'https://shiftpad.test' }, addEventListener: (name, handler) => { events[name] = handler; }, skipWaiting() {} } });
  vm.runInContext(fs.readFileSync(require.resolve('../../sw.js'), 'utf8'), context);
  return { events, networkFirst: (...args) => context.networkFirst(...args), cacheFirst: (...args) => context.cacheFirst(...args) };
}
test('cache quota failure cannot discard a successful network script or navigation', async () => {
  const response = new Response('working app', { status: 200 });
  const sw = worker({ fetch: async () => response.clone(), caches: { match: async () => undefined, open: async () => ({ put: async () => { throw new Error('QuotaExceededError'); } }) } });
  assert.equal(await (await sw.networkFirst('https://shiftpad.test/app.js', '/app.js')).text(), 'working app');
  assert.equal(await (await sw.cacheFirst('https://shiftpad.test/icons/icon-192.png')).text(), 'working app');
});
test('a temporary HTTP server failure falls back to the working cached shell', async () => {
  const sw = worker({ fetch: async () => new Response('unavailable', { status: 503 }), caches: { match: async () => new Response('cached app'), open: async () => ({ put: async () => {} }) } });
  assert.equal(await (await sw.networkFirst('https://shiftpad.test/', '/index.html')).text(), 'cached app');
});
test('network success remains usable when cache storage itself is unavailable', async () => {
  const sw = worker({ fetch: async () => new Response('working app'), caches: { match: async () => { throw new Error('SecurityError'); }, open: async () => { throw new Error('SecurityError'); } } });
  assert.equal(await (await sw.networkFirst('https://shiftpad.test/', '/index.html')).text(), 'working app');
});
