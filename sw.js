'use strict';

const CACHE = 'sans-trace-v2';
const SHELL = [
  './',
  'index.html',
  'stats.html',
  'privacy.html',
  'legal.html',
  'terms.html',
  'css/style.css',
  'js/text-clean.js',
  'js/image-clean.js',
  'js/doc-clean.js',
  'js/app.js',
  'js/stats.js',
  'js/pwa.js',
  'favicon.svg',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
      return hit || fresh;
    }).catch(() => caches.match('index.html'))
  );
});
