import { APP_FOLDER_NAME, PHOTOS_FOLDER_NAME, SHEETS_FOLDER_NAME } from './constants.js'

// ─────────────────────────────────────────────────────
// Google API primitives
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
// Photo cache
// ─────────────────────────────────────────────────────
const photoCache = new Map()
export function getCachedPhoto(fileId) { return photoCache.get(fileId) || null }

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
  } catch (e) { console.warn('fetchDrivePhoto', fileId, e); return null }
}

export function extractFileId(url) {
  if (!url) return null
  const pm = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
  if (pm) return pm[1]
  const dm = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/)
  if (dm) return dm[1]
  return null
}

// ─────────────────────────────────────────────────────
// Drive folder hierarchy:
//   Wilson Closet/
//     Pictures/   ← photos go here
//     Sheets/     ← spreadsheets go here
// ─────────────────────────────────────────────────────
let _appFolderId    = null
let _photoFolderId  = null
let _sheetsFolderId = null

async function findOrCreateFolder(name, parentId, token) {
  const parent = parentId ? ` and '${parentId}' in parents` : ''
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false${parent}`
  )
  const fields = 'files(id,name)'
  const r = await gGet(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}`, token)
  if (r?.files?.length) return r.files[0].id
  const cr = await gPost('https://www.googleapis.com/drive/v3/files', {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : [],
  }, token)
  return cr.id || null
}

export async function ensureAppFolder(token) {
  if (_appFolderId) return _appFolderId
  const stored = localStorage.getItem('wc_appfolderid')
  if (stored) { _appFolderId = stored; return _appFolderId }
  _appFolderId = await findOrCreateFolder(APP_FOLDER_NAME, null, token)
  if (_appFolderId) localStorage.setItem('wc_appfolderid', _appFolderId)
  return _appFolderId
}

export async function ensurePhotosFolder(token) {
  if (_photoFolderId) return _photoFolderId
  const stored = localStorage.getItem('wc_photofolderid')
  if (stored) { _photoFolderId = stored; return _photoFolderId }
  const appId = await ensureAppFolder(token)
  _photoFolderId = await findOrCreateFolder(PHOTOS_FOLDER_NAME, appId, token)
  if (_photoFolderId) localStorage.setItem('wc_photofolderid', _photoFolderId)
  return _photoFolderId
}

export async function ensureSheetsFolder(token) {
  if (_sheetsFolderId) return _sheetsFolderId
  const stored = localStorage.getItem('wc_sheetsfolderid')
  if (stored) { _sheetsFolderId = stored; return _sheetsFolderId }
  const appId = await ensureAppFolder(token)
  _sheetsFolderId = await findOrCreateFolder(SHEETS_FOLDER_NAME, appId, token)
  if (_sheetsFolderId) localStorage.setItem('wc_sheetsfolderid', _sheetsFolderId)
  return _sheetsFolderId
}

export function resetFolderCache() {
  _appFolderId = null; _photoFolderId = null; _sheetsFolderId = null
  localStorage.removeItem('wc_appfolderid')
  localStorage.removeItem('wc_photofolderid')
  localStorage.removeItem('wc_sheetsfolderid')
  // Legacy key cleanup
  localStorage.removeItem('wc_folderid')
}

// ─────────────────────────────────────────────────────
// Upload photo → Wilson Closet/Pictures/
// ─────────────────────────────────────────────────────
export async function uploadToDrive(b64, mime, name, token) {
  try {
    const folderId = await ensurePhotosFolder(token)
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: mime })
    const ext   = mime.split('/')[1] || 'jpg'
    const fname = name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now() + '.' + ext

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

    await gPost(
      `https://www.googleapis.com/drive/v3/files/${d.id}/permissions`,
      { role: 'reader', type: 'anyone' }, token
    )

    const fileId = d.id
    const objUrl = URL.createObjectURL(blob)
    photoCache.set(fileId, objUrl)

    return {
      viewUrl:   d.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      directUrl: `/.netlify/functions/img?id=${fileId}`,
      fileId,
    }
  } catch (e) { console.warn('uploadToDrive', e); return null }
}

// ─────────────────────────────────────────────────────
// Compress photo → max 900px JPEG
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
