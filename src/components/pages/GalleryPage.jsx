import { useState } from 'react'
import DriveImage from '../DriveImage.jsx'
import { ls } from '../../lib/storage.js'

export default function GalleryPage({ groupId, groups, items, token, gToken, gUser }) {
  const [selected,  setSelected]  = useState(new Set())  // multi-select
  const [reqStep,   setReqStep]   = useState(null)        // null | 'form' | 'done'
  const [reqName,   setReqName]   = useState('')
  const [reqEmail,  setReqEmail]  = useState('')
  const [reqMsg,    setReqMsg]    = useState('')
  const [sending,   setSending]   = useState(false)

  const g      = groups.find(x => x.id === groupId)
  const gItems = items.filter(i => i.group === groupId)

  function toggleItem(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function submitRequest() {
    if (!reqName.trim() || !reqEmail.trim()) return
    setSending(true)
    const requestedItems = gItems.filter(i => selected.has(i.id))

    // Save notification for each item
    const existing = ls.getJ('wc_notifs', [])
    const newNotifs = requestedItems.map(item => ({
      id:        'n' + Date.now() + Math.random(),
      itemId:    item.id,
      itemName:  item.name,
      itemLocation: item.location || '',
      itemPhoto: item.drivePhotoUrl || '',
      itemFileId: item.fileId || '',
      from:      reqName,
      fromEmail: reqEmail,
      message:   reqMsg,
      read:      false,
      at:        new Date().toISOString(),
    }))
    ls.setJ('wc_notifs', [...newNotifs, ...existing])

    // Send 1 email with all requested items
    if (gToken && gUser?.email) {
      const itemLines = requestedItems.map(item =>
        `• ${item.name}${item.size ? ' (Size '+item.size+')' : ''}${item.location ? ' — '+item.location : ''}`
      ).join('\n')

      const subj = `Wilson Closet: ${requestedItems.length} item${requestedItems.length > 1 ? 's' : ''} requested by ${reqName}`
      const body = [
        `${reqName} (${reqEmail}) has requested the following item${requestedItems.length > 1 ? 's' : ''}:`,
        '',
        itemLines,
        '',
        reqMsg ? `Message: "${reqMsg}"` : '',
        '',
        '— Wilson Closet',
      ].join('\n')

      const raw = btoa(unescape(encodeURIComponent(
        ['To: ' + gUser.email, 'Subject: ' + subj, 'Content-Type: text/plain; charset=utf-8', '', body].join('\n')
      ))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')

      try {
        await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${gToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        })
      } catch {}
    }

    setSending(false)
    setReqStep('done')
  }

  function reset() {
    setSelected(new Set()); setReqStep(null)
    setReqName(''); setReqEmail(''); setReqMsg('')
  }

  const selectedItems = gItems.filter(i => selected.has(i.id))

  return (
    <div className="page" style={{ overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="gallery-header">
        <div style={{ fontWeight: 700, fontSize: 20, background: 'linear-gradient(135deg,var(--neon2),var(--cyan))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Wilson Closet
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 4 }}>
          {g ? `${g.emoji} ${g.name}` : 'Shared Closet'} · {gItems.length} items
        </div>
        {selected.size > 0 && (
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setReqStep('form')}>
              📨 Request {selected.size} item{selected.size > 1 ? 's' : ''}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ marginLeft: 6 }}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      {selected.size === 0 && gItems.length > 0 && (
        <div style={{ padding: '8px 14px', textAlign: 'center', fontSize: 11, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace' }}>
          Tap items to select • Request multiple at once
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {gItems.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👗</div>
            <div className="empty-title">No items yet</div>
          </div>
        ) : (
          <div className="gallery-grid">
            {gItems.map(item => {
              const isSel = selected.has(item.id)
              return (
                <div
                  key={item.id}
                  className="gallery-card"
                  onClick={() => toggleItem(item.id)}
                  style={{
                    border: isSel ? '2px solid var(--neon)' : '',
                    boxShadow: isSel ? 'var(--sh-neon)' : '',
                    transform: isSel ? 'scale(1.02)' : '',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <DriveImage item={item} token={token}
                      style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }} />
                    {isSel && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--neon)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: '#fff', boxShadow: 'var(--sh-neon)',
                      }}>✓</div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div className="ccat">{item.category}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                    {(item.size || item.brand) && (
                      <div style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace' }}>
                        {item.size ? 'Size ' + item.size : ''}{item.brand ? ' · ' + item.brand : ''}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating request bar */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,16,.95)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-glow)', borderRadius: 99,
          padding: '10px 20px', display: 'flex', gap: 10, alignItems: 'center',
          boxShadow: 'var(--sh-neon)', zIndex: 50,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon2)' }}>{selected.size} selected</span>
          <button className="btn btn-primary btn-sm" onClick={() => setReqStep('form')}>
            📨 Request
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>✕</button>
        </div>
      )}

      {/* Request Modal */}
      {reqStep && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && reset()}>
          <div className="modal" style={{ maxHeight: '80vh' }}>
            <div className="modal-handle" />
            <div className="modal-header">
              <div className="modal-title">
                {reqStep === 'done' ? '✅ Request Sent!' : `Request ${selectedItems.length} Item${selectedItems.length > 1 ? 's' : ''}`}
              </div>
              <button className="ib" onClick={reset}>✕</button>
            </div>
            <div className="modal-body">
              {reqStep === 'done' ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Request sent!</div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)' }}>The owner will be notified about your request.</div>
                  <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {selectedItems.map(i => (
                      <span key={i.id} style={{ background: 'var(--neon-lt)', color: 'var(--neon2)', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{i.name}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Items preview */}
                  <div style={{ marginBottom: 14 }}>
                    <div className="fl">Requesting</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {selectedItems.map(i => (
                        <span key={i.id} style={{ background: 'var(--neon-lt)', color: 'var(--neon2)', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: '1px solid rgba(123,95,255,.2)' }}>{i.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="fg"><label className="fl">Your Name</label><input className="fi" value={reqName} onChange={e => setReqName(e.target.value)} placeholder="Full name" autoFocus /></div>
                  <div className="fg"><label className="fl">Your Email</label><input className="fi" type="email" value={reqEmail} onChange={e => setReqEmail(e.target.value)} placeholder="your@email.com" /></div>
                  <div className="fg"><label className="fl">Message (optional)</label><textarea className="fi" value={reqMsg} onChange={e => setReqMsg(e.target.value)} placeholder="Any notes about your request…" /></div>
                </>
              )}
            </div>
            {reqStep === 'form' && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={reset}>Cancel</button>
                <button
                  className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={submitRequest} disabled={!reqName || !reqEmail || sending}
                >{sending ? 'Sending…' : `📨 Send Request`}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
