/**
 * GET /.netlify/functions/poll?sheet={sheetId}&token={ownerToken}&since={isoDate}
 * Owner's app polls this to get new notifications from the Requests tab.
 * Returns requests newer than `since`.
 */
export default async function handler(request) {
  const url   = new URL(request.url)
  const sheet = url.searchParams.get('sheet')
  const token = url.searchParams.get('token')
  const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'

  if (!sheet || !token) return json({ error: 'Missing params' }, 400)

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheet}/values/${encodeURIComponent('Requests!A2:H')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (res.status === 404) return json({ notifications: [] })
    const d = await res.json()
    if (d.error) return json({ notifications: [] })

    const rows = d.values || []
    const sinceDate = new Date(since)

    const notifications = rows
      .filter(row => row[0] && new Date(row[6] || 0) > sinceDate)
      .map(row => ({
        id:           row[0] || '',
        itemIds:      (row[1] || '').split('|').filter(Boolean),
        itemName:     row[2] || '',
        from:         row[3] || '',
        fromEmail:    row[4] || '',
        message:      row[5] || '',
        at:           row[6] || new Date().toISOString(),
        read:         row[7] === 'true',
      }))

    return json({ notifications })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
