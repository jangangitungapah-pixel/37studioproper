/* global self, caches, fetch, Response, URL */
const APP_CACHE = '37musicstudio-app-v3';
const ASSET_CACHE = '37musicstudio-assets-v3';

const CORE_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/manifest-admin.webmanifest',
  '/manifest-client.webmanifest',
  '/manifest-guard.webmanifest',
  '/icons/pwa-icon-192.png',
  '/icons/pwa-icon-512.png',
  '/icons/pwa-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/admin-icon-192.png',
  '/icons/admin-icon-512.png',
  '/icons/admin-maskable-512.png',
  '/icons/admin-apple-touch-icon.png',
  '/icons/client-icon-192.png',
  '/icons/client-icon-512.png',
  '/icons/client-maskable-512.png',
  '/icons/client-apple-touch-icon.png',
  '/icons/guard-icon-192.png',
  '/icons/guard-icon-512.png',
  '/icons/guard-maskable-512.png',
  '/icons/guard-apple-touch-icon.png',
];

function isHtmlResponse(response) {
  return response.headers.get('content-type')?.includes('text/html');
}

async function putCache(cacheName, request, response) {
  if (!response || !response.ok || isHtmlResponse(response)) return response;

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());

  return response;
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);

  if (cached) return cached;

  const response = await fetch(request);

  return putCache(ASSET_CACHE, request, response);
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match('/offline.html');
    return offline || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fresh = fetch(request)
    .then((response) => putCache(APP_CACHE, request, response))
    .catch(() => null);

  return cached || fresh || Response.error();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const allowedCaches = new Set([APP_CACHE, ASSET_CACHE]);

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('37musicstudio-') && !allowedCaches.has(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith('/__/') ||
    url.pathname.includes('firestore') ||
    url.pathname.includes('firebase') ||
    url.pathname.includes('cloudinary') ||
    url.pathname.includes('onesignal')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  if (
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/manifest-admin.webmanifest' ||
    url.pathname === '/manifest-client.webmanifest' ||
    url.pathname === '/manifest-guard.webmanifest' ||
    url.pathname === '/offline.html' ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
