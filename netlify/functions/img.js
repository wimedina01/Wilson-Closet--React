// Proxies Google Drive images — handles auth transparently
// The file must be set to "anyone can view" (done on upload)
export default async function handler(request) {
  const url = new URL(request.url)
  const id  = url.searchParams.get('id')

  if (!id || !/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
    return new Response('Bad request', { status: 400 })
  }

  // Try multiple Drive download URLs in priority order
  const attempts = [
    `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0`,
    `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
    `https://drive.google.com/uc?id=${id}&export=download`,
  ]

  for (const driveUrl of attempts) {
    try {
      const res = await fetch(driveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WilsonCloset/2.0)',
          'Accept':     'image/*,*/*',
        },
        redirect: 'follow',
      })

      if (!res.ok) continue

      const ct = res.headers.get('content-type') || ''

      // Reject HTML responses (Google's "confirm download" page)
      if (ct.includes('text/html')) {
        const text = await res.text()
        if (text.includes('<html')) continue
      }

      const buffer      = await res.arrayBuffer()
      const contentType = ct.includes('image') ? ct : 'image/jpeg'

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type':                 contentType,
          'Cache-Control':                'public, max-age=604800, immutable',
          'Access-Control-Allow-Origin':  '*',
        },
      })
    } catch { continue }
  }

  return new Response('Image unavailable', { status: 404 })
}
