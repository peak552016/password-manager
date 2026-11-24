// Offline support: cache the app shell. The vault itself lives in IndexedDB, never here.
const CACHE = 'vault-v2'
const SHELL = new URL('./', self.location).href

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

// network-first so updates arrive quickly, fall back to cache when offline
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? SHELL : req, copy))
        }
        return res
      })
      .catch(async () => (await caches.match(req.mode === 'navigate' ? SHELL : req)) ?? Response.error()),
  )
})
