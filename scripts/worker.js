const prefix = 'notenlernen-shell-';
const cacheName = prefix + BUILD.version;
const precache = new Set(BUILD.assets.map(({ path }) => path));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const entries = await Promise.all(BUILD.assets.map(async ({ path, digest }) => {
      const url = new URL(path, self.location.origin);
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`Shell-Datei fehlt: ${path}`);
      const bytes = await self.crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
      const actual = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (actual !== digest) throw new Error(`Shell-Datei passt nicht zur Version: ${path}`);
      return [url, response];
    }));

    try {
      const cache = await caches.open(cacheName);
      await Promise.all(entries.map(([url, response]) => cache.put(url, response)));
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
    // Updates werden erst nach Zustimmung registriert.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(prefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const entry = request.mode === 'navigate' && url.pathname === '/' ? '/index.html' : url.pathname;
  if (!precache.has(entry)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(new URL(entry, url.origin)) ?? fetch(request);
  })());
});
