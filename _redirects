// Public gallery data fetcher — no auth needed
// Reads the "All Items" tab from a Google Sheet that is shared publicly
// The sheet owner must set sharing to "Anyone with link can view"
export default async function handler(request) {
  const url      = new URL(request.url)
  const sheetId  = url.searchParams.get('sheet')
  const groupId  = url.searchParams.get('group')

  if (!sheetId || !/^[a-zA-Z0-9_-]{10,}$/.test(sheetId)) {
    return json({ error: 'Missing sheet ID' }, 400)
  }

  try {
    // Use the public Sheets v4 API with an API key approach via export
    // Sheets that are "anyone can view" are readable via the CSV export endpoint
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=All+Items`
    const res = await fetch(csvUrl, {
      headers: { 'Accept': 'text/csv' }
    })

    if (!res.ok) {
      return json({ error: 'Sheet not publicly accessible. Set sharing to "Anyone with link can view".' }, 403)
    }

    const text = await res.text()
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      return json({ error: 'Sheet not publicly accessible.' }, 403)
    }

    // Parse CSV
    const rows = parseCSV(text)
    if (rows.length < 2) return json({ items: [], groups: [] })

    const headers = rows[0].map(h => h.trim())
    const items = rows.slice(1)
      .filter(row => row[0] && row[0].trim())
      .map(row => {
        const get = (name) => {
          const idx = headers.indexOf(name)
          return idx >= 0 ? (row[idx] || '').trim() : ''
        }
        const drivePhotoUrl = get('Photo URL') || null
        const fileId = drivePhotoUrl ? extractFileId(drivePhotoUrl) : null
        return {
          id:           get('ID'),
          name:         get('Name'),
          category:     get('Category') || 'Other',
          group:        get('Group'),
          brand:        get('Brand'),
          size:         get('Size'),
          colors:       get('Colors') ? get('Colors').split(', ').filter(Boolean) : [],
          location:     get('Location'),
          tags:         get('Tags') ? get('Tags').split(', ').filter(Boolean) : [],
          description:  get('Description'),
          drivePhotoUrl,
          // Use proxy URL for cross-device image display
          driveThumb:   fileId ? `/.netlify/functions/img?id=${fileId}` : null,
          fileId,
          loanedTo:     get('On Loan To') || '',
          addedAt:      get('Date Added') || new Date().toISOString(),
          sheetSynced:  true,
          photo:        null,
        }
      })
      // Filter by group name if groupId provided (groupId is the internal ID like g1)
      // We can't filter by internal ID since sheet stores group names
      // Return all items, let the client filter

    return json({ items }, 200)
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control':               'public, max-age=30',
    },
  })
}

function extractFileId(url) {
  if (!url) return null
  const m1 = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
  if (m1) return m1[1]
  const m2 = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/)
  if (m2) return m2[1]
  return null
}

function parseCSV(text) {
  const rows = []
  let row = [], cell = '', inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i+1]
    if (inQuote) {
      if (ch === '"' && next === '"') { cell += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cell += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { row.push(cell); cell = '' }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(cell); rows.push(row); row = []; cell = ''
        if (ch === '\r') i++
      } else cell += ch
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim()))
}
