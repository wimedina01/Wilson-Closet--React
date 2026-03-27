/**
 * Wilson Closet — Service Worker v2.1
 *
 * Strategy:
 * - App shell (HTML, JS, CSS, fonts): Cache-first, update in background
 * - Google APIs / Netlify functions: Network-first, fall back to cache
 * - Images from Netlify img proxy: Cache-first with long TTL
 * - Offline: serve cached shell + show offline indicator in app
 */

const CACHE_NAME    = 'wc-shell-v2.1'
const IMG_CACHE     = 'wc-images-v2.1'
const OFFLINE_URL   = '/'

// App shell files to pre-cache on install
const SHELL_URLS = [
  '/',
  '/manifest.json',
]

// ── Install: pre-cache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== IMG_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: routing strategy
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // Google APIs + Netlify functions → network-first
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.startsWith('/.netlify/functions/')
  ) {
    event.respondWith(networkFirst(request))
    return
  }

  // Netlify image proxy → cache-first (images don't change)
  if (url.pathname === '/.netlify/functions/img') {
    event.respondWith(imageCache(request))
    return
  }

  // App shell files (JS, CSS, HTML) → cache-first, refresh in background
  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.html') ||
     url.pathname === '/' ||
     url.pathname.endsWith('.json'))
  ) {
    event.respondWith(shellFirst(request))
    return
  }

  // Everything else → network with cache fallback
  event.respondWith(networkFirst(request))
})

// Cache-first, update in background (stale-while-revalidate)
async function shellFirst(request) {
  const cache    = await caches.open(CACHE_NAME)
  const cached   = await cache.match(request)
  const fetchP   = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone())
    return res
  }).catch(() => null)
  return cached || fetchP || new Response('Offline', { status: 503 })
}

// Network-first, fall back to cache
async function networkFirst(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // For navigation requests offline, return cached shell
    if (request.mode === 'navigate') {
      const shell = await caches.match('/')
      if (shell) return shell
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Image cache — cache-first, long TTL, max 200 images
async function imageCache(request) {
  const cache  = await caches.open(IMG_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const res = await fetch(request)
    if (res.ok) {
      // Trim cache to 200 images max
      const keys = await cache.keys()
      if (keys.length >= 200) await cache.delete(keys[0])
      cache.put(request, res.clone())
    }
    return res
  } catch {
    return new Response('', { status: 503 })
  }
}

// ── Background sync for offline items (future use)
self.addEventListener('sync', event => {
  if (event.tag === 'wc-sync-items') {
    event.waitUntil(syncOfflineItems())
  }
})

async function syncOfflineItems() {
  // Signal the app to flush pending items
  const clients = await self.clients.matchAll()
  clients.forEach(c => c.postMessage({ type: 'SYNC_NOW' }))
}

// ── Push notifications (future use)
self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Wilson Closet', {
      body:    data.body || '',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      vibrate: [100, 50, 100],
      data:    { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})
