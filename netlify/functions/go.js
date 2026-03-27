import { getStore } from '@netlify/blobs'

// Redirect handler: /s/{code} → resolve and redirect to full gallery URL
export default async function handler(req, context) {
  const code = context.params.code
  if (!code) {
    return new Response('Missing code', { status: 400 })
  }

  const store = getStore({ name: 'short-links', consistency: 'strong' })
  const target = await store.get(code, { type: 'text' })

  if (!target) {
    return new Response(`<!DOCTYPE html><html><head><title>Not Found</title></head><body style="background:#050508;color:#F0EEFF;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh"><div style="text-align:center"><h2>Link Not Found</h2><p>This short link may have expired or is invalid.</p></div></body></html>`, {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Redirect to the full URL (the gallery hash URL)
  return new Response(null, {
    status: 302,
    headers: { Location: target },
  })
}

export const config = {
  path: '/s/:code',
}
