/**
 * FuelTrack - Service Worker
 * Soporte Offline-First para Camiones Cisterna y Despachos en Zonas Rurales y Mineras sin senal.
 */

const CACHE_NAME = 'fueltrack-cache-v1.0.01';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './favicon.svg',
  './version.json',
  './src/app.js',
  './src/sw-register.js',
  './src/core/thermalFuelCompensatorEngine.js',
  './src/core/compartmentSealAuditorEngine.js',
  './src/services/fuelLiterLedgerService.js',
  './src/services/fuelTrackCache.service.js',
  './src/utils/cryptoSeal.js',
  './src/utils/formatters.js',
  './src/utils/sanitizer.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith('fueltrack-cache-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const isHtmlOrVersion =
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('/version.json') ||
    url.pathname === '/version.json';

  if (isHtmlOrVersion) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
