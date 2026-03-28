import { gGet, gPost, gPut, gDelete, ensureSheetsFolder } from './drive.js'
import { SHEET_TAB, SETTINGS_TAB, SHEET_HDR } from './constants.js'
import { extractFileId } from './drive.js'

// ─────────────────────────────────────────────────────
// Raw read/write helpers
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
// Sheet formatting — futuristic dark theme
// ─────────────────────────────────────────────────────
export async function formatSheet(sheetId, token) {
  try {
    const meta = await gGet(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, token)
    const allItemsTab = meta?.sheets?.find(s => s.properties.title === SHEET_TAB)
    const settingsTab = meta?.sheets?.find(s => s.properties.title === SETTINGS_TAB)
    if (!allItemsTab) return

    const gid = allItemsTab.properties.sheetId
    const sgid = settingsTab?.properties?.sheetId

    const requests = [
      // Freeze header row
      { updateSheetProperties: { properties: { sheetId: gid, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
      // Header row — deep dark background, accent text
      { repeatCell: { range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.055, green: 0.055, blue: 0.09 },
          textFormat: { foregroundColor: { red: 0.667, green: 0.616, blue: 0.965 }, bold: true, fontSize: 11 },
          horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
          borders: { bottom: { style: 'SOLID', width: 2, color: { red: 0.545, green: 0.482, blue: 0.965 } } }
        }}, fields: 'userEnteredFormat' }
      },
      // Data rows — alternating subtle dark
      { repeatCell: { range: { sheetId: gid, startRowIndex: 1, endRowIndex: 1000 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.063, green: 0.063, blue: 0.082 },
          textFormat: { foregroundColor: { red: 0.878, green: 0.871, blue: 0.949 }, fontSize: 10 },
          verticalAlignment: 'MIDDLE',
        }}, fields: 'userEnteredFormat' }
      },
      // Column widths
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },  properties: { pixelSize: 160 }, fields: 'pixelSize' } }, // ID
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },  properties: { pixelSize: 200 }, fields: 'pixelSize' } }, // Name
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },  properties: { pixelSize: 120 }, fields: 'pixelSize' } }, // Category
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },  properties: { pixelSize: 130 }, fields: 'pixelSize' } }, // Group
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },  properties: { pixelSize: 130 }, fields: 'pixelSize' } }, // Brand
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 },  properties: { pixelSize: 80  }, fields: 'pixelSize' } }, // Size
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: 10, endIndex: 11 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } }, // Photo URL
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'COLUMNS', startIndex: 11, endIndex: 12 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } }, // Preview
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'ROWS', startIndex: 0, endIndex: 1 },     properties: { pixelSize: 36  }, fields: 'pixelSize' } }, // Header height
      // Add auto-filter
      { setBasicFilter: { filter: { range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: SHEET_HDR.length } } } },
      // Row height for data rows
      { updateDimensionProperties: { range: { sheetId: gid, dimension: 'ROWS', startIndex: 1, endIndex: 1000 }, properties: { pixelSize: 28 }, fields: 'pixelSize' } },
    ]

    // Hide Settings tab to prevent accidental edits
    if (sgid !== undefined) {
      requests.push({ updateSheetProperties: { properties: { sheetId: sgid, hidden: true }, fields: 'hidden' } })
    }

    await gPost(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, { requests }, token)
  } catch (e) { console.warn('formatSheet', e) }
}

// ─────────────────────────────────────────────────────
// Settings tab
// ─────────────────────────────────────────────────────
export async function ensureSettingsTab(sheetId, token) {
  try {
    const meta = await gGet(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, token)
    const exists = meta?.sheets?.some(s => s.properties.title === SETTINGS_TAB)
    if (!exists) {
      await gPost(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        requests: [{ addSheet: { properties: { title: SETTINGS_TAB } } }]
      }, token)
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SETTINGS_TAB + '!A1')}?valueInputOption=RAW`,
        { method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
          body:JSON.stringify({ values:[['Key','Value','Updated']] }) }
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
// Item row helpers
// ─────────────────────────────────────────────────────
export function makeRow(item, groups) {
  const g = groups.find(x => x.id === item.group)
  const photoUrl = item.drivePhotoUrl || ''
  const thumb    = item.driveThumb || ''
  const preview  = thumb ? `=IMAGE("${thumb}")` : ''
  return [
    item.id, item.name, item.category,
    g ? g.name : '—',          // col D: Group name (human readable)
    item.group || '',           // col E: Group ID (for reliable re-sync)
    item.brand || '', item.size || '',
    item.colors.join(', '), item.location || '',
    item.tags.join(', '), item.description || '',
    photoUrl, preview,
    new Date(item.addedAt).toLocaleDateString(),
    item.loanedTo || '',        // col O: current borrower name
    item.loanLog || '',         // col P: audit log e.g. "LoanOut: 2025-01-15 14:32 | LoanIn: 2025-01-20 09:00"
  ]
}

export function rowToItem(row, groups, existingMap) {
  const ex = existingMap[row[0]]

  // Detect whether this sheet has the new Group ID column (col E)
  // Old sheets: col4=Brand. New sheets: col4=GroupID (starts with 'g' or is empty)
  // We detect by checking if row[4] looks like a group ID or a brand name
  const hasGroupIdCol = row[4] === '' || /^g[0-9]/.test(row[4] || '') || groups.some(g => g.id === row[4])

  let groupId, brandVal, sizeVal, colorsVal, locationVal, tagsVal, descVal, rawUrl, addedAtVal, loanedToVal, loanLogVal

  if (hasGroupIdCol) {
    // New schema: ID,Name,Category,GroupName,GroupID,Brand,Size,Colors,Location,Tags,Desc,PhotoURL,Preview,DateAdded,LoanedTo,LoanLog
    groupId     = resolveGroupId(row[3] || '', row[4] || '', groups)
    brandVal    = row[5] || ''
    sizeVal     = row[6] || ''
    colorsVal   = row[7] || ''
    locationVal = row[8] || ''
    tagsVal     = row[9] || ''
    descVal     = row[10] || ''
    rawUrl      = (row[11] || '').trim()
    addedAtVal  = row[13] || new Date().toISOString()
    loanedToVal = row[14] || ''
    loanLogVal  = row[15] || ''
  } else {
    // Old schema (no GroupID col): ID,Name,Category,Group,Brand,Size,Colors,Location,Tags,Desc,PhotoURL,Preview,DateAdded,LoanedTo
    groupId     = resolveGroupId(row[3] || '', '', groups)
    brandVal    = row[4] || ''
    sizeVal     = row[5] || ''
    colorsVal   = row[6] || ''
    locationVal = row[7] || ''
    tagsVal     = row[8] || ''
    descVal     = row[9] || ''
    rawUrl      = (row[10] || '').trim()
    addedAtVal  = row[12] || new Date().toISOString()
    loanedToVal = row[13] || ''
    loanLogVal  = row[14] || ''
  }

  const hm = rawUrl.match(/=HYPERLINK\("([^"]+)"/i)
  const drivePhotoUrl = hm ? hm[1] : (rawUrl && !rawUrl.startsWith('=') ? rawUrl : null)
  const fileId    = extractFileId(drivePhotoUrl)
  const driveThumb = fileId ? `/.netlify/functions/img?id=${fileId}` : null

  return {
    id:           row[0],
    name:         row[1] || '',
    category:     row[2] || 'Other',
    group:        groupId,
    brand:        brandVal,
    size:         sizeVal,
    colors:       colorsVal ? colorsVal.split(', ').filter(Boolean) : [],
    location:     locationVal,
    tags:         tagsVal ? tagsVal.split(', ').filter(Boolean) : [],
    description:  descVal,
    drivePhotoUrl, driveThumb, fileId,
    addedAt:      addedAtVal,
    loanedTo:     loanedToVal,
    loanLog:      loanLogVal,
    photo:        ex?.photo || null,
    sheetSynced:  true,
  }
}

function resolveGroupId(name, id, groups) {
  // Try exact ID match first — always reliable
  if (id) {
    const byId = groups.find(x => x.id === id)
    if (byId) return byId.id
  }
  // Fall back to name match
  if (name && name !== '—') {
    const byName = groups.find(x => x.name.toLowerCase() === name.trim().toLowerCase())
    if (byName) return byName.id
  }
  return groups[0]?.id || 'g1'
}

export async function upsertItem(sheetId, item, groups, token) {
  const colA = await sheetRead(sheetId, `${SHEET_TAB}!A:A`, token)
  if (!colA) return false
  const row = makeRow(item, groups)
  const idx = colA.findIndex(r => r[0] === item.id)
  if (idx >= 1) {
    await sheetPut(sheetId, `${SHEET_TAB}!A${idx+1}:P${idx+1}`, [row], token)
  } else {
    await sheetAppend(sheetId, `${SHEET_TAB}!A:P`, [row], token)
  }
  return true
}

export async function deleteItem(sheetId, itemId, token) {
  const meta = await gGet(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, token)
  if (!meta || meta.error) return false
  const tab = meta.sheets?.find(s => s.properties.title === SHEET_TAB)
  if (!tab) return false
  const gid = tab.properties.sheetId
  const colA = await sheetRead(sheetId, `${SHEET_TAB}!A:A`, token)
  if (!colA) return false
  const idx = colA.findIndex(r => r[0] === itemId)
  if (idx <= 0) return true
  const d = await gPost(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    requests: [{ deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: idx, endIndex: idx+1 } } }]
  }, token)
  return !d.error
}

export async function pullAllItems(sheetId, groups, existingItems, token) {
  const rows = await sheetRead(sheetId, `${SHEET_TAB}!A2:P`, token)
  if (rows === null) throw new Error('Could not read sheet')
  const existingMap = {}
  existingItems.forEach(i => { existingMap[i.id] = i })
  const sheetItems = rows.filter(r => r[0]).map(row => rowToItem(row, groups, existingMap))
  const sheetIds = new Set(sheetItems.map(i => i.id))
  const localOnly = existingItems.filter(i => !i.sheetSynced && !sheetIds.has(i.id))
  return [...sheetItems, ...localOnly]
}

export async function pushAllItems(sheetId, items, groups, token) {
  const rows = [SHEET_HDR, ...items.map(it => makeRow(it, groups))]
  await sheetPut(sheetId, `${SHEET_TAB}!A1`, rows, token)
}

export async function checkForChanges(sheetId, items, token) {
  const colA = await sheetRead(sheetId, `${SHEET_TAB}!A:A`, token)
  if (!colA) return false
  const sheetIds = new Set(colA.slice(1).map(r => r[0]).filter(Boolean))
  const localIds = new Set(items.map(i => i.id))
  if (sheetIds.size !== localIds.size) return true
  for (const id of sheetIds) if (!localIds.has(id)) return true
  return false
}

export async function deleteSpreadsheet(fileId, token) {
  return gDelete(`https://www.googleapis.com/drive/v3/files/${fileId}`, token)
}

export async function listSpreadsheets(token) {
  const q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  const d = await gGet(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc&pageSize=50`,
    token
  )
  if (d?.error) throw new Error(d.error.message)
  return d?.files || []
}

export async function createSpreadsheet(name, token) {
  // Create in Wilson Closet/Sheets/ folder
  const sheetsFolder = await ensureSheetsFolder(token)
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: name },
      sheets: [{ properties: { title: SHEET_TAB } }]
    }),
  })
  const d = await res.json()
  if (!d.spreadsheetId) throw new Error(d.error?.message || 'Create failed')

  // Move to Sheets folder
  if (sheetsFolder) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${d.spreadsheetId}?addParents=${sheetsFolder}&removeParents=root&fields=id`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    })
  }

  // Share: anyone with the link can view
  await gPost(
    `https://www.googleapis.com/drive/v3/files/${d.spreadsheetId}/permissions`,
    { role: 'reader', type: 'anyone' }, token
  )

  return d.spreadsheetId
}
