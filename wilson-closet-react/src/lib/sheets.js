import { gGet, gPost, gPut, gDelete } from './drive.js'
import { SHEET_TAB, SETTINGS_TAB, SHEET_HDR } from './constants.js'
import { extractFileId } from './drive.js'

// ─────────────────────────────────────────────────────
// Sheet ensure — mutex prevents duplicate creation
// ─────────────────────────────────────────────────────
let _mutex = null

export async function ensureSheet(sheetId, sheetName, token, onStatus) {
  if (_mutex) return _mutex
  _mutex = _doEnsure(sheetId, sheetName, token, onStatus)
  const result = await _mutex
  _mutex = null
  return result
}

async function _doEnsure(sheetId, sheetName, token, onStatus) {
  // 1. Verify cached sheetId
  if (sheetId) {
    try {
      const r = await gGet(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=spreadsheetId`, token)
      if (r?.spreadsheetId === sheetId) return sheetId
    } catch {}
    return null // invalid — caller should open picker
  }
  return null // no sheet — open picker
}

// ─────────────────────────────────────────────────────
// Read / write helpers
// ─────────────────────────────────────────────────────
export async function sheetRead(sheetId, range, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  const d = await gGet(url, token)
  if (d?.error) { console.warn('sheetRead error', d.error); return null }
  return d?.values || []
}

export async function sheetPut(sheetId, range, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
  return gPut(url, { values }, token)
}

export async function sheetAppend(sheetId, range, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  return gPost(url, { values }, token)
}

// ─────────────────────────────────────────────────────
// Header guard
// ─────────────────────────────────────────────────────
export async function ensureSheetHeader(sheetId, token) {
  try {
    const rows = await sheetRead(sheetId, `${SHEET_TAB}!A1:A1`, token)
    if (!rows?.length || rows[0][0] !== 'ID') {
      await sheetPut(sheetId, `${SHEET_TAB}!A1`, [SHEET_HDR], token)
    }
  } catch (e) { console.warn('ensureSheetHeader', e) }
}

// ─────────────────────────────────────────────────────
// Settings tab (groups + locations)
// ─────────────────────────────────────────────────────
export async function ensureSettingsTab(sheetId, token) {
  try {
    const meta = await gGet(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, token)
    const exists = meta?.sheets?.some(s => s.properties.title === SETTINGS_TAB)
    if (!exists) {
      await gPost(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        requests: [{ addSheet: { properties: { title: SETTINGS_TAB } } }]
      }, token)
      // Write raw (not USER_ENTERED) so strings don't get evaluated
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SETTINGS_TAB + '!A1')}?valueInputOption=RAW`,
        { method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ values:[['Key','Value','Updated']] }) }
      )
    }
  } catch (e) { console.warn('ensureSettingsTab', e) }
}

export async function pushSettings(sheetId, groups, locations, token) {
  const ts = new Date().toISOString()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SETTINGS_TAB + '!A2')}?valueInputOption=RAW`
  await fetch(url, {
    method:'PUT',
    headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ values: [
      ['groups',    JSON.stringify(groups),    ts],
      ['locations', JSON.stringify(locations), ts],
    ]})
  })
}

export async function pullSettings(sheetId, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SETTINGS_TAB + '!A2:C20')}`
  const d = await gGet(url, token)
  const rows = d?.values || []
  const result = {}
  for (const row of rows) {
    const key = row[0]; const val = row[1]
    if (!key || !val) continue
    try { result[key] = JSON.parse(val) } catch {}
  }
  return result
}

// ─────────────────────────────────────────────────────
// Item rows
// ─────────────────────────────────────────────────────
export function makeRow(item, groups) {
  const g = groups.find(x => x.id === item.group)
  const photoUrl = item.drivePhotoUrl || ''
  const thumb    = item.driveThumb || ''
  const preview  = thumb ? `=IMAGE("${thumb}")` : ''
  return [
    item.id, item.name, item.category, g ? g.name : '—',
    item.brand || '', item.size || '',
    item.colors.join(', '), item.location || '',
    item.tags.join(', '), item.description || '',
    photoUrl, preview,
    new Date(item.addedAt).toLocaleDateString(),
  ]
}

export function rowToItem(row, groups, existingMap) {
  const ex = existingMap[row[0]]
  const rawUrl = (row[10] || '').trim()
  // Handle legacy HYPERLINK formula
  const hm = rawUrl.match(/=HYPERLINK\("([^"]+)"/i)
  const drivePhotoUrl = hm ? hm[1] : (rawUrl && !rawUrl.startsWith('=') ? rawUrl : null)
  const fileId = extractFileId(drivePhotoUrl)
  const driveThumb = fileId ? `/.netlify/functions/img?id=${fileId}` : null

  return {
    id:          row[0],
    name:        row[1] || '',
    category:    row[2] || 'Other',
    group:       resolveGroupId(row[3] || '', groups),
    brand:       row[4] || '',
    size:        row[5] || '',
    colors:      row[6] ? row[6].split(', ').filter(Boolean) : [],
    location:    row[7] || '',
    tags:        row[8] ? row[8].split(', ').filter(Boolean) : [],
    description: row[9] || '',
    drivePhotoUrl,
    driveThumb,
    fileId,
    addedAt:     row[12] || new Date().toISOString(),
    photo:       ex?.photo || null,   // preserve local compressed photo
    sheetSynced: true,
  }
}

function resolveGroupId(name, groups) {
  if (!name) return groups[0]?.id || 'g1'
  const g = groups.find(x => x.name.toLowerCase() === name.toLowerCase())
  return g?.id || groups[0]?.id || 'g1'
}

// ─────────────────────────────────────────────────────
// Upsert (find row by ID and update, or append)
// ─────────────────────────────────────────────────────
export async function upsertItem(sheetId, item, groups, token) {
  const colA = await sheetRead(sheetId, `${SHEET_TAB}!A:A`, token)
  if (!colA) return false
  const row = makeRow(item, groups)
  const idx = colA.findIndex(r => r[0] === item.id)
  if (idx >= 1) {
    await sheetPut(sheetId, `${SHEET_TAB}!A${idx+1}:M${idx+1}`, [row], token)
  } else {
    await sheetAppend(sheetId, `${SHEET_TAB}!A:M`, [row], token)
  }
  return true
}

// ─────────────────────────────────────────────────────
// Delete a row by item ID
// ─────────────────────────────────────────────────────
export async function deleteItem(sheetId, itemId, token) {
  const meta = await gGet(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, token)
  if (!meta || meta.error) return false
  const tab = meta.sheets?.find(s => s.properties.title === SHEET_TAB)
  if (!tab) return false
  const gid = tab.properties.sheetId
  const colA = await sheetRead(sheetId, `${SHEET_TAB}!A:A`, token)
  if (!colA) return false
  const idx = colA.findIndex(r => r[0] === itemId)
  if (idx <= 0) return true  // not found = already gone
  const d = await gPost(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    requests: [{ deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } } }]
  }, token)
  return !d.error
}

// ─────────────────────────────────────────────────────
// Full pull from sheet
// ─────────────────────────────────────────────────────
export async function pullAllItems(sheetId, groups, existingItems, token) {
  const rows = await sheetRead(sheetId, `${SHEET_TAB}!A2:M`, token)
  if (rows === null) throw new Error('Could not read sheet')
  const existingMap = {}
  existingItems.forEach(i => { existingMap[i.id] = i })
  const sheetItems = rows.filter(r => r[0]).map(row => rowToItem(row, groups, existingMap))
  const sheetIds = new Set(sheetItems.map(i => i.id))
  const localOnly = existingItems.filter(i => !i.sheetSynced && !sheetIds.has(i.id))
  return [...sheetItems, ...localOnly]
}

// Push all items (overwrite)
export async function pushAllItems(sheetId, items, groups, token) {
  const rows = [SHEET_HDR, ...items.map(it => makeRow(it, groups))]
  await sheetPut(sheetId, `${SHEET_TAB}!A1`, rows, token)
}

// ─────────────────────────────────────────────────────
// Background sync check — just read IDs
// ─────────────────────────────────────────────────────
export async function checkForChanges(sheetId, items, token) {
  const colA = await sheetRead(sheetId, `${SHEET_TAB}!A:A`, token)
  if (!colA) return false
  const sheetIds = new Set(colA.slice(1).map(r => r[0]).filter(Boolean))
  const localIds = new Set(items.map(i => i.id))
  if (sheetIds.size !== localIds.size) return true
  for (const id of sheetIds) if (!localIds.has(id)) return true
  return false
}

// ─────────────────────────────────────────────────────
// Delete a spreadsheet from Drive
// ─────────────────────────────────────────────────────
export async function deleteSpreadsheet(fileId, token) {
  return gDelete(`https://www.googleapis.com/drive/v3/files/${fileId}`, token)
}

// ─────────────────────────────────────────────────────
// List all spreadsheets in Drive
// ─────────────────────────────────────────────────────
export async function listSpreadsheets(token) {
  const q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  const d = await gGet(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc&pageSize=50`,
    token
  )
  if (d?.error) throw new Error(d.error.message)
  return d?.files || []
}

// Create a new spreadsheet
export async function createSpreadsheet(name, token) {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { title: name }, sheets: [{ properties: { title: SHEET_TAB } }] }),
  })
  const d = await res.json()
  if (!d.spreadsheetId) throw new Error(d.error?.message || 'Create failed')
  return d.spreadsheetId
}
