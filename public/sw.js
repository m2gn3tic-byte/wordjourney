const APP_BASE = new URL('./', self.registration.scope);
const CACHE_NAME = `wordjourney-v3:${APP_BASE.pathname}`;
const INDEX_URL = new URL('index.html', APP_BASE).href;
const SHELL = ['', 'index.html', 'icon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']
  .map(path => new URL(path, APP_BASE).href);

async function cacheApplication() {
  const cache = await caches.open(CACHE_NAME);
  const seen = new Set();
  async function cacheAsset(url) {
    if (url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname)
      || !/^https?:$/.test(url.protocol) || seen.has(url.href)) return;
    seen.add(url.href);
    const response = await fetch(url.href, { cache: 'reload' });
    if (!response.ok) throw new Error(`Cannot cache asset: ${url.pathname}`);
    await cache.put(url.href, response.clone());
    if (url.pathname.endsWith('.css')) {
      const css = await response.text();
      const dependencies = [...css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^'"\s][^)]*?))\s*\)/gs)]
        .map(match => (match[2] ?? match[3]).trim())
        .filter(value => !/^(?:data:|#)/i.test(value))
        .map(value => new URL(value, url));
      await Promise.all(dependencies.map(cacheAsset));
    }
  }
  try {
    await Promise.all(SHELL.map(url => cacheAsset(new URL(url))));
    const html = await (await cache.match(INDEX_URL)).text();
    const entries = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
      .map(match => new URL(match[1], APP_BASE));
    await Promise.all(entries.map(cacheAsset));
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}
self.addEventListener('install', event => {
  event.waitUntil(cacheApplication().then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('wordjourney-v')
      && name.endsWith(`:${APP_BASE.pathname}`) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
    for (const client of await self.clients.matchAll({ includeUncontrolled: true })) client.postMessage({ type: 'OFFLINE_READY' });
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'OFFLINE_STATUS') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      if (await cache.match(INDEX_URL)) event.source?.postMessage({ type: 'OFFLINE_READY' });
    })());
  }
});
self.addEventListener('fetch', event => {
  const { request } = event, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;
  if (request.mode === 'navigate') {
    if (![APP_BASE.pathname, new URL(INDEX_URL).pathname].includes(url.pathname)) return;
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(INDEX_URL, { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(request, { ignoreVary: true })) || fetch(request);
  })());
});
