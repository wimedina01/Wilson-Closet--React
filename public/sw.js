const CACHE    = 'wc-v2.5'
const IMG_CACHE = 'wc-img-v2.5'
const APP_VERSION = '2.5.0'

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/manifest.json'])).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return

  if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(netFirst(request)); return
  }
  if (url.pathname === '/.netlify/functions/img') {
    e.respondWith(imgCache(request)); return
  }
  if (url.pathname.startsWith('/.netlify/functions/')) {
    e.respondWith(netFirst(request)); return
  }
  e.respondWith(shellFirst(request))
})

async function shellFirst(req) {
  const cache  = await caches.open(CACHE)
  const cached = await cache.match(req)
  const net    = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r }).catch(() => null)
  return cached || net || new Response('Offline', { status: 503 })
}

async function netFirst(req) {
  try {
    const r = await fetch(req)
    if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()) }
    return r
  } catch {
    const c = await caches.match(req)
    if (c) return c
    if (req.mode === 'navigate') { const s = await caches.match('/'); if (s) return s }
    return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
}

async function imgCache(req) {
  const cache  = await caches.open(IMG_CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const r = await fetch(req)
    if (r.ok) {
      const keys = await cache.keys()
      if (keys.length >= 200) await cache.delete(keys[0])
      cache.put(req, r.clone())
    }
    return r
  } catch { return new Response('', { status: 503 }) }
}

self.addEventListener('sync', e => {
  if (e.tag === 'wc-sync') e.waitUntil(self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage({ type: 'SYNC_NOW' }))))
})

// Listen for skip waiting message from the app (for update flow)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
