/* 中国象棋 Service Worker：让页面可以离线使用、并且能被"安装"成应用。
 *
 * 缓存策略：
 *   * 页面本身用 network-first —— 这样你改了引擎、推了新版本，刷新就能拿到，
 *     不会因为缓存而一直玩旧版本（离线时回退到缓存）。
 *   * 静态资源（音频、图标）用 cache-first —— 它们基本不变，省流量也更快。
 *
 * 改动资源后记得把 VERSION 加一，否则老缓存不会更新。 */
const VERSION = 'xiangqi-v1';
const STATIC_ASSETS = [
  './bgm.mp3',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.ico',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // 单个资源失败不能拖垮整个安装
    await Promise.all(STATIC_ASSETS.map(async (u) => {
      try { await cache.add(new Request(u, { cache: 'reload' })); } catch (err) { /* 忽略 */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isDocument = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isDocument) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        return cached || new Response('离线且没有缓存', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(VERSION);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
