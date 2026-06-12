/**
 * AI OS Service Worker — v1
 * Strategy: Cache-first for static assets, network-first for API calls.
 * On install, pre-cache the app shell (index.html + key assets).
 */

const CACHE_VERSION = 'ai-os-v1'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const ASSET_CACHE = `${CACHE_VERSION}-assets`

// App shell files to pre-cache on install
const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icon.svg',
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

// ── Activate — clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // API calls: network-first, no caching
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Hashed assets (Vite dist/assets/*): cache-first, long-lived
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const fresh = await fetch(request)
        if (fresh.ok) cache.put(request, fresh.clone())
        return fresh
      })
    )
    return
  }

  // Navigation requests (SPA): network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/')
        return cached ?? new Response('Offline', { status: 503 })
      })
    )
    return
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const fetchPromise = fetch(request).then((fresh) => {
        if (fresh.ok) cache.put(request, fresh.clone())
        return fresh
      })
      return cached ?? fetchPromise
    })
  )
})

// ── Push event ────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'AI OS', body: 'New notification' }
  try { data = event.data.json() } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'ai-os',
      data: { url: data.url || '/' },
    })
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find(c => c.url.includes(url))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
