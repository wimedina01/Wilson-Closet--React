/**
 * POST /.netlify/functions/request
 * Guest sends an item request. This function:
 * 1. Stores the request in a shared KV store (Netlify Blobs)
 * 2. Sends an email to the owner via their Gmail OAuth token
 *    (token is passed from the share URL — owner embeds it)
 *
 * Since we can't use Netlify Blobs without extra setup,
 * we store requests in the Google Sheet's "Requests" tab.
 * The owner's app polls this tab for new notifications.
 *
 * Body: { ownerEmail, ownerSheetId, items[], requesterName, requesterEmail, message }
 */
export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: cors() })
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const { ownerEmail, sheetId, sheetToken, items, requesterName, requesterEmail, message } = body

  if (!requesterName || !requesterEmail || !items?.length) {
    return json({ error: 'Missing required fields' }, 400)
  }

  const results = { notifStored: false, emailSent: false, errors: [] }

  // ── 1. Store notification in Google Sheet "Requests" tab
  if (sheetId && sheetToken) {
    try {
      // Ensure Requests tab exists
      const meta = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${sheetToken}` } }
      ).then(r => r.json())

      const hasTab = meta?.sheets?.some(s => s.properties.title === 'Requests')
      if (!hasTab) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sheetToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Requests' } } }] })
        })
        // Header row
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Requests!A1')}?valueInputOption=RAW`,
          { method: 'PUT', headers: { Authorization: `Bearer ${sheetToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [['ID','Item IDs','Item Names','Requester','Email','Message','At','Read']] }) }
        )
      }

      // Append the request row
      const notifId = 'n' + Date.now() + Math.random().toString(36).slice(2)
      const row = [
        notifId,
        items.map(i => i.id).join('|'),
        items.map(i => i.name).join(', '),
        requesterName,
        requesterEmail,
        message || '',
        new Date().toISOString(),
        'false'
      ]
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Requests!A:H')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', headers: { Authorization: `Bearer ${sheetToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }) }
      )
      results.notifStored = true
    } catch (e) {
      results.errors.push('Sheet store failed: ' + e.message)
    }
  }

  // ── 2. Send email via Gmail API using owner's token
  if (sheetToken && ownerEmail) {
    try {
      const itemLines = items.map(item =>
        `• ${item.name}${item.size ? ' (Size ' + item.size + ')' : ''}${item.location ? ' — ' + item.location : ''}`
      ).join('\n')

      const subject = `Wilson Closet: ${items.length} item${items.length > 1 ? 's' : ''} requested by ${requesterName}`
      const emailBody = [
        `${requesterName} (${requesterEmail}) has requested:`,
        '',
        itemLines,
        '',
        message ? `Message: "${message}"` : '',
        '',
        '— Wilson Closet App',
      ].filter(l => l !== null).join('\n')

      const raw = btoa(unescape(encodeURIComponent([
        `To: ${ownerEmail}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        emailBody,
      ].join('\n')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const emailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sheetToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      })

      if (emailRes.ok) {
        results.emailSent = true
      } else {
        const err = await emailRes.json().catch(() => ({}))
        results.errors.push('Email failed: ' + (err.error?.message || emailRes.status))
      }
    } catch (e) {
      results.errors.push('Email error: ' + e.message)
    }
  }

  return json(results, 200)
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
