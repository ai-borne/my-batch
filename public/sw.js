const cacheName = 'ajinkyans-shell-v3'
const shell = ['/', '/index.html', '/offline.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(shell)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name !== cacheName).map((name) => caches.delete(name)))))
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data === 'ajinkyans:purge-caches') event.waitUntil(caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }
  const path = new URL(request.url).pathname
  const cacheableAsset = path.startsWith('/assets/') || path.startsWith('/icons/') || path === '/manifest.webmanifest'
  if (!cacheableAsset) return
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) void caches.open(cacheName).then((cache) => cache.put(request, response.clone())).catch(() => undefined)
    return response
  })))
})
