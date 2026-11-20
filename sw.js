// Soundify Service Worker – macht die App komplett offline nutzbar.
// Beim ersten Öffnen wird alles gespeichert; danach startet Soundify auch ohne Internet.
// Funktioniert sowohl lokal (localhost) als auch online in einem Unterordner (z. B. GitHub Pages).
const VERSION = 'soundify-v6';
const BASE = new URL('./', self.registration.scope).href;
const ASSETS = ['./', 'manifest.webmanifest', 'icon-48.png', 'icon-64.png', 'icon-96.png', 'icon-128.png', 'icon-192.png', 'icon-256.png', 'icon-512.png', 'icon-maskable-512.png']
  .map(p => new URL(p, BASE).href);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // einzeln laden, damit ein fehlendes Icon nicht die ganze Installation abbricht
    await Promise.all(ASSETS.map(u => fetch(u, { cache: 'reload' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Sofort aus dem Speicher antworten (schnell + offline) und im Hintergrund aktualisieren
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/__')) return;
  const key = req.mode === 'navigate' ? BASE : url.href.split('#')[0].split('?')[0];
  // Die App-Seite selbst: immer zuerst die neueste Version holen, nur offline aus dem Speicher
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res.ok) { await c.put(BASE, res.clone()); return res; }
      } catch (_) { }
      return (await c.match(BASE)) || new Response('Offline', { status: 503 });
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const cached = await c.match(key);
    const net = fetch(req).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    return (await net) || (await c.match(BASE)) || new Response('Offline', { status: 503 });
  })());
});
