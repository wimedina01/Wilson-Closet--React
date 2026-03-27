// ─────────────────────────────────────────────────────
// Google API primitives — token auth centralised here
// ─────────────────────────────────────────────────────
let _onExpired = null
export function setExpiredCallback(fn) { _onExpired = fn }

async function gFetch(url, opts = {}) {
  const token = opts._token
  const fetchOpts = { ...opts }
  delete fetchOpts._token
  fetchOpts.headers = { Authorization: `Bearer ${token}`, ...fetchOpts.headers }

  const res = await fetch(url, fetchOpts)
  if (res.status === 401) { _onExpired?.(); throw new Error('Session expired') }
  return res
}

export async function gGet(url, token) {
  const res = await gFetch(url, { _token: token })
  return res.json()
}
export async function gPost(url, body, token) {
  const res = await gFetch(url, {
    _token: token, method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}
export async function gPut(url, body, token) {
  const res = await gFetch(url, {
    _token: token, method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}
export async function gDelete(url, token) {
  const res = await gFetch(url, { _token: token, method: 'DELETE' })
  return res.status === 204
}

// ─────────────────────────────────────────────────────
// Photo cache — fileId → object URL (blob)
// Cleared on page unload; persists across re-renders
// ─────────────────────────────────────────────────────
const photoCache = new Map()

export function getCachedPhoto(fileId) {
  return photoCache.get(fileId) || null
}

/**
 * Fetch a Drive file as an image using the user's auth token.
 * This is the ONLY reliable cross-device approach:
 *   GET /drive/v3/files/{id}?alt=media  (authenticated)
 * → returns the raw bytes → blob URL → used as img src
 *
 * Works because the user owns/has access to the file.
 * Does NOT require the file to be publicly shared.
 */
export async function fetchDrivePhoto(fileId, token) {
  if (!fileId || !token) return null
  const cached = photoCache.get(fileId)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.size) return null
    const url = URL.createObjectURL(blob)
    photoCache.set(fileId, url)
    return url
  } catch (e) {
    console.warn('fetchDrivePhoto', fileId, e)
    return null
  }
}

// Extract Drive file ID from any known URL format
export function extractFileId(url) {
  if (!url) return null
  // Proxy URL: /.netlify/functions/img?id=...
  const pm = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
  if (pm) return pm[1]
  // Drive share/view URL: /d/{id}/
  const dm = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/)
  if (dm) return dm[1]
  return null
}

// ─────────────────────────────────────────────────────
// Drive folder (lazy-created)
// ─────────────────────────────────────────────────────
let _folderId = null

export async function ensureDriveFolder(token) {
  if (_folderId) return _folderId
  const stored = localStorage.getItem('wc_folderid')
  if (stored) { _folderId = stored; return _folderId }
  try {
    const q = encodeURIComponent(
      "mimeType='application/vnd.google-apps.folder' and name='Wilson Closet Photos' and trashed=false"
    )
    const sr = await gGet(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
      token
    )
    if (sr?.files?.length) {
      _folderId = sr.files[0].id
      localStorage.setItem('wc_folderid', _folderId)
      return _folderId
    }
    const cr = await gPost(
      'https://www.googleapis.com/drive/v3/files',
      { name: 'Wilson Closet Photos', mimeType: 'application/vnd.google-apps.folder' },
      token
    )
    if (cr.id) {
      _folderId = cr.id
      localStorage.setItem('wc_folderid', _folderId)
    }
  } catch (e) { console.warn('ensureDriveFolder', e) }
  return _folderId
}

export function resetFolderCache() {
  _folderId = null
  localStorage.removeItem('wc_folderid')
}

// ─────────────────────────────────────────────────────
// Upload compressed photo to Drive
// ─────────────────────────────────────────────────────
export async function uploadToDrive(b64, mime, name, token) {
  try {
    const folderId = await ensureDriveFolder(token)
    const bytes    = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const blob     = new Blob([bytes], { type: mime })
    const ext      = mime.split('/')[1] || 'jpg'
    const fname    = name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now() + '.' + ext

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify({
      name: fname, parents: folderId ? [folderId] : [],
    })], { type: 'application/json' }))
    form.append('file', blob)

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
    )
    const d = await res.json()
    if (!d.id) { console.warn('uploadToDrive: no id', d); return null }

    // Make publicly readable (for proxy fallback)
    await gPost(
      `https://www.googleapis.com/drive/v3/files/${d.id}/permissions`,
      { role: 'reader', type: 'anyone' },
      token
    )

    const fileId = d.id

    // Cache blob URL immediately — same device shows photo instantly
    const objUrl = URL.createObjectURL(blob)
    photoCache.set(fileId, objUrl)

    return {
      viewUrl:   d.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      directUrl: `/.netlify/functions/img?id=${fileId}`,  // public proxy fallback
      fileId,
    }
  } catch (e) {
    console.warn('uploadToDrive', e)
    return null
  }
}

// ─────────────────────────────────────────────────────
// Compress photo to max 900px JPEG (~20-60KB)
// Handles large desktop files and PNG/HEIC from mobile
// ─────────────────────────────────────────────────────
export function compressPhoto(dataUrl) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const MAX = 900
      let w = img.width, h = img.height
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
      if (h > MAX) { w = Math.round(w * MAX / h); h = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const compressed = canvas.toDataURL('image/jpeg', 0.78)
      resolve({ dataUrl: compressed, b64: compressed.split(',')[1], mime: 'image/jpeg' })
    }
    img.onerror = () => {
      const b64 = dataUrl.split(',')[1]
      resolve({ dataUrl, b64, mime: 'image/jpeg' })
    }
    img.src = dataUrl
  })
}
