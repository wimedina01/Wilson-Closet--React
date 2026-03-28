/**
 * POST /.netlify/functions/request
 * Guest sends item request → stores in sheet + emails owner with item images
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
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Requests!A1')}?valueInputOption=RAW`,
          { method: 'PUT', headers: { Authorization: `Bearer ${sheetToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [['ID','Item IDs','Item Names','Requester','Email','Message','At','Read']] }) }
        )
      }

      const notifId = 'n' + Date.now() + Math.random().toString(36).slice(2)
      const row = [
        notifId,
        items.map(i => i.id).join('|'),
        items.map(i => i.name).join(', '),
        requesterName, requesterEmail,
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

  // ── 2. Send HTML email with item images
  if (sheetToken && ownerEmail) {
    try {
      const subject = `Wilson Closet: ${items.length} item${items.length > 1 ? 's' : ''} requested by ${requesterName}`

      // Build HTML email with item cards including images
      const itemCards = items.map(item => {
        // Use Netlify proxy for image — Drive web URLs require auth, proxy serves publicly
        const origin = 'https://wilsoncloset.netlify.app'
        const imgSrc = item.fileId
          ? `${origin}/.netlify/functions/img?id=${item.fileId}`
          : null
        const imgHtml = imgSrc
          ? `<img src="${imgSrc}" alt="${item.name}" width="120" height="120" style="width:120px;height:120px;object-fit:cover;border-radius:8px;display:block;" />`
          : `<div style="width:120px;height:120px;background:#1A1A2E;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:40px;">${getCatEmoji(item.category)}</div>`
        // Deep link to the item in the app
        const itemLink = `${origin}/#item/${item.id}`

        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #2E2E38;vertical-align:top;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="136" style="padding-right:16px;vertical-align:top;">${imgHtml}</td>
                  <td style="vertical-align:top;">
                    <div style="font-size:11px;color:#7B5FFF;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${item.category || ''}</div>
                    <a href="${itemLink}" style="font-size:16px;font-weight:700;color:#A78BFF;margin-bottom:6px;display:block;text-decoration:none;">${item.name} ↗</a>
                    ${item.brand ? `<div style="font-size:12px;color:#8B89A8;margin-bottom:3px;">Brand: ${item.brand}</div>` : ''}
                    ${item.size ? `<div style="font-size:12px;color:#8B89A8;margin-bottom:3px;">Size: ${item.size}</div>` : ''}
                    ${item.location ? `<div style="font-size:12px;color:#8B89A8;">📍 ${item.location}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      }).join('')

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050508;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#050508;min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0F0F18,#161622);border:1px solid #2E2E38;border-radius:20px 20px 0 0;padding:28px 28px 20px;text-align:center;">
            <div style="font-size:24px;font-weight:700;background:linear-gradient(135deg,#A78BFF,#00E5FF);-webkit-background-clip:text;color:#A78BFF;margin-bottom:6px;">Wilson Closet</div>
            <div style="font-size:12px;color:#5C5A6E;font-family:monospace;letter-spacing:1px;text-transform:uppercase;">v2.3 · Item Request</div>
          </td>
        </tr>

        <!-- Request info -->
        <tr>
          <td style="background:#0F0F18;border-left:1px solid #2E2E38;border-right:1px solid #2E2E38;padding:20px 28px 0;">
            <div style="background:#1A1A2E;border:1px solid rgba(123,95,255,.2);border-radius:12px;padding:16px 18px;margin-bottom:20px;">
              <div style="font-size:11px;color:#7B5FFF;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📨 New Request</div>
              <div style="font-size:16px;font-weight:700;color:#F0EEFF;margin-bottom:4px;">${requesterName}</div>
              <div style="font-size:12px;color:#8B89A8;">${requesterEmail}</div>
              ${message ? `<div style="font-size:13px;color:#9997AA;margin-top:10px;font-style:italic;padding-top:10px;border-top:1px solid #2E2E38;">"${message}"</div>` : ''}
            </div>

            <div style="font-size:11px;color:#5C5A6E;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
              ${items.length} Item${items.length > 1 ? 's' : ''} Requested
            </div>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="background:#0F0F18;border-left:1px solid #2E2E38;border-right:1px solid #2E2E38;padding:0 28px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${itemCards}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0A0A10;border:1px solid #2E2E38;border-top:none;border-radius:0 0 20px 20px;padding:20px 28px;text-align:center;">
            <div style="font-size:11px;color:#4A4860;line-height:1.8;">
              Developed by Wilson Medina · v2.3 · 2025<br>
              Powered by Claude AI · Anthropic
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

      // Gmail API requires base64url encoded RFC 2822 message
      const emailMsg = [
        `To: ${ownerEmail}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        html,
      ].join('\r\n')

      const raw = btoa(unescape(encodeURIComponent(emailMsg)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

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

function getCatEmoji(cat) {
  const map = { Tops:'👕', Bottoms:'👖', Dresses:'👗', Outerwear:'🧥', Shoes:'👟', Accessories:'👜' }
  return map[cat] || '📦'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
