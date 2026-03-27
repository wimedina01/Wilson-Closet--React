import { getStore } from '@netlify/blobs'

function generateCode(len = 7) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default async function handler(req) {
  const store = getStore({ name: 'short-links', consistency: 'strong' })

  // GET  /shorten?code=ABC  → resolve a short code
  // POST /shorten { url }   → create a short link

  if (req.method === 'GET') {
    const code = new URL(req.url).searchParams.get('code')
    if (!code) return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    const url = await store.get(code, { type: 'text' })
    if (!url) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ url }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    const { url } = body
    if (!url) return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    // Check if this URL already has a short code (reverse lookup)
    // Use a hash-based key for dedup
    const hashKey = '_rev_' + simpleHash(url)
    const existing = await store.get(hashKey, { type: 'text' })
    if (existing) {
      return new Response(JSON.stringify({ code: existing }), { headers: { 'Content-Type': 'application/json' } })
    }

    const code = generateCode()
    await store.set(code, url)
    await store.set(hashKey, code)
    return new Response(JSON.stringify({ code }), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

function simpleHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}
