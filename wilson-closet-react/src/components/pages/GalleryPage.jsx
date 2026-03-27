import { useState } from 'react'
import DriveImage from '../DriveImage.jsx'
import { ls } from '../../lib/storage.js'

export default function GalleryPage({ groupId, groups, items, token, gToken, gUser }) {
  const [reqItem,   setReqItem]   = useState(null)
  const [reqName,   setReqName]   = useState('')
  const [reqEmail,  setReqEmail]  = useState('')
  const [reqMsg,    setReqMsg]    = useState('')
  const [submitted, setSubmitted] = useState(false)

  const g     = groups.find(x => x.id === groupId)
  const gItems = items.filter(i => i.group === groupId)

  async function submitRequest() {
    if (!reqName.trim() || !reqEmail.trim()) return
    const notif = {
      id: 'n' + Date.now(), itemId: reqItem.id, itemName: reqItem.name,
      from: reqName, fromEmail: reqEmail, message: reqMsg,
      read: false, at: new Date().toISOString(),
    }
    const existing = ls.getJ('wc_notifs', [])
    ls.setJ('wc_notifs', [notif, ...existing])
    setSubmitted(true)

    // Send Gmail notification if signed in
    if (gToken && gUser?.email) {
      const subj = `Wilson Closet: Request — ${reqItem.name}`
      const body = `${reqName} (${reqEmail}) requested:\n\n📦 ${reqItem.name}\n💬 ${reqMsg || '(no message)'}\n\n— Wilson Closet`
      const raw  = btoa(unescape(encodeURIComponent(
        ['To: ' + gUser.email, 'Subject: ' + subj, 'Content-Type: text/plain; charset=utf-8', '', body].join('\n')
      ))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      try {
        await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${gToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        })
      } catch {}
    }
  }

  return (
    <div className="page" style={{ overflow: 'hidden' }}>
      <div className="gallery-header">
        <div className="sb-logo-text">Wilson <em>Closet</em></div>
        <div style={{ fontSize: 14, color: 'var(--ink2)', marginTop: 5 }}>
          {g ? `${g.emoji} ${g.name}` : 'Shared Closet'}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {gItems.length === 0 ? (
          <div className="empty"><div className="empty-icon">👗</div><div className="empty-title">No items yet</div></div>
        ) : (
          <div className="gallery-grid">
            {gItems.map(item => (
              <div key={item.id} className="gallery-card" onClick={() => { setReqItem(item); setSubmitted(false) }}>
                <DriveImage
                  item={item} token={token}
                  style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}
                />
                <div style={{ padding: '9px 11px 11px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 2 }}>{item.category}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                    {item.size ? 'Size ' + item.size : ''}{item.brand ? ' · ' + item.brand : ''}
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 9 }}
                    onClick={e => { e.stopPropagation(); setReqItem(item); setSubmitted(false) }}
                  >📨 Request</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Modal */}
      {reqItem && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setReqItem(null)}>
          <div className="modal" style={{ maxHeight: '70vh' }}>
            <div className="modal-handle" />
            <div className="modal-header">
              <div className="modal-title">{submitted ? 'Request Sent!' : `Request: ${reqItem.name}`}</div>
              <button className="ib" onClick={() => setReqItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Request sent!</div>
                  <div style={{ fontSize: 13, color: 'var(--ink3)' }}>The owner will be notified.</div>
                </div>
              ) : (
                <>
                  <div className="fg"><label className="fl">Your Name</label><input className="fi" value={reqName} onChange={e => setReqName(e.target.value)} placeholder="Full name" /></div>
                  <div className="fg"><label className="fl">Your Email</label><input className="fi" type="email" value={reqEmail} onChange={e => setReqEmail(e.target.value)} placeholder="your@email.com" /></div>
                  <div className="fg"><label className="fl">Message (optional)</label><textarea className="fi" value={reqMsg} onChange={e => setReqMsg(e.target.value)} placeholder="Any notes…" /></div>
                </>
              )}
            </div>
            {!submitted && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setReqItem(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={submitRequest} disabled={!reqName || !reqEmail}>
                  📨 Send Request
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
