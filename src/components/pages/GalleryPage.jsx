import { useState, useEffect } from 'react'
import DriveImage from '../DriveImage.jsx'
import { ls } from '../../lib/storage.js'

/**
 * GalleryPage — public-facing shared closet view.
 *
 * Works in TWO modes:
 * 1. Owner is signed in on this browser → use items from app state directly
 * 2. Guest (different browser, not signed in) → fetch items from Netlify
 *    function which reads the public Google Sheet (no auth needed)
 *
 * Share URL format: #gallery/{groupId}/{sheetId}
 * The sheetId is embedded so the Netlify function knows which sheet to read.
 */
export default function GalleryPage({ groupId, sheetId, ownerToken, ownerEmail, groups, items: ownerItems, token, gToken, gUser }) {
  const [items,     setItems]    = useState([])
  const [loading,   setLoading]  = useState(true)
  const [fetchErr,  setFetchErr] = useState(null)
  const [selected,  setSelected] = useState(new Set())
  const [reqStep,   setReqStep]  = useState(null)   // null | 'form' | 'done'
  const [reqName,   setReqName]  = useState('')
  const [reqEmail,  setReqEmail] = useState('')
  const [reqMsg,    setReqMsg]   = useState('')
  const [sending,   setSending]  = useState(false)

  // Resolve group — may need to match by name since guest has no internal group IDs
  const g = groups.find(x => x.id === groupId)

  useEffect(() => {
    loadItems()
  }, [groupId, sheetId])

  async function loadItems() {
    setLoading(true); setFetchErr(null)

    // MODE 1: Owner is signed in AND has items in memory
    if (ownerItems && ownerItems.length > 0) {
      const filtered = ownerItems.filter(i => i.group === groupId)
      setItems(filtered)
      setLoading(false)
      return
    }

    // MODE 2: Guest — fetch from Netlify function (public sheet read)
    if (!sheetId) {
      setFetchErr('Share link is incomplete — missing sheet ID. Ask the owner to reshare.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/.netlify/functions/gallery?sheet=${sheetId}&group=${groupId}`)
      const data = await res.json()
      if (data.error) { setFetchErr(data.error); setLoading(false); return }

      // Guest items come with group NAME (not ID) from the sheet
      // Match by group name if we have group info, otherwise show all
      let filtered = data.items || []
      if (g) {
        filtered = filtered.filter(i =>
          i.group.toLowerCase() === g.name.toLowerCase()
        )
      }
      setItems(filtered)
    } catch (e) {
      setFetchErr('Could not load items: ' + e.message)
    }
    setLoading(false)
  }

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
    const requestedItems = items.filter(i => selected.has(i.id))

    // Use the owner's token (embedded in share URL) to:
    // 1. Store notification in the sheet's Requests tab
    // 2. Send email to the owner — all server-side via Netlify function
    const activeToken = ownerToken || gToken || null
    const activeEmail = ownerEmail || gUser?.email || null

    try {
      const res = await fetch('/.netlify/functions/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail:      activeEmail,
          sheetId:         sheetId,
          sheetToken:      activeToken,
          items:           requestedItems.map(i => ({
            id:       i.id,
            name:     i.name,
            size:     i.size || '',
            location: i.location || '',
          })),
          requesterName:  reqName,
          requesterEmail: reqEmail,
          message:        reqMsg,
        }),
      })
      const result = await res.json()
      if (!result.emailSent && !result.notifStored) {
        console.warn('Request may not have reached owner:', result.errors)
      }
    } catch (e) {
      console.warn('Request submit error:', e)
    }

    setSending(false)
    setReqStep('done')
  }

  function reset() {
    setSelected(new Set()); setReqStep(null)
    setReqName(''); setReqEmail(''); setReqMsg('')
  }

  const selectedItems = items.filter(i => selected.has(i.id))
  const displayToken  = token || null   // null for guests — DriveImage falls back to emoji

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>

      {/* Header */}
      <div className="gallery-header" style={{ flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 20, background: 'linear-gradient(135deg,var(--neon2),var(--cyan))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Wilson Closet
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 4 }}>
          {g ? `${g.emoji} ${g.name}` : 'Shared Closet'}
          {!loading && ` · ${items.length} item${items.length !== 1 ? 's' : ''}`}
        </div>
        {selected.size > 0 && (
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setReqStep('form')}>
              📨 Request {selected.size} item{selected.size > 1 ? 's' : ''}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ marginLeft: 6 }}>Clear</button>
          </div>
        )}
      </div>

      {/* Instruction hint */}
      {!loading && items.length > 0 && selected.size === 0 && (
        <div style={{ padding: '7px 14px', textAlign: 'center', fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace', flexShrink: 0 }}>
          Tap items to select · Request multiple at once
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--ink3)' }}>
            <div style={{ width: 28, height: 28, border: '2.5px solid var(--neon)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono,monospace' }}>Loading closet…</div>
          </div>
        ) : fetchErr ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 36, opacity: .3 }}>🔒</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink2)' }}>Unable to load items</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.6, maxWidth: 280 }}>{fetchErr}</div>
            {fetchErr.includes('publicly accessible') && (
              <div style={{ fontSize: 11, color: 'var(--neon2)', background: 'var(--neon-lt)', padding: '10px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border-glow)', maxWidth: 300, lineHeight: 1.6 }}>
                ℹ️ The owner needs to set their Google Sheet sharing to <strong>"Anyone with link can view"</strong>
              </div>
            )}
            <button className="btn btn-secondary btn-sm" onClick={loadItems}>Try Again</button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10 }}>
            <div style={{ fontSize: 48, opacity: .15 }}>👗</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink2)' }}>No items yet</div>
          </div>
        ) : (
          <div className="gallery-grid" style={{ paddingBottom: 100 }}>
            {items.map(item => {
              const isSel = selected.has(item.id)
              return (
                <div
                  key={item.id}
                  className="gallery-card"
                  onClick={() => toggleItem(item.id)}
                  style={{
                    border:     isSel ? '2px solid var(--neon)' : '',
                    boxShadow:  isSel ? 'var(--sh-neon)' : '',
                    transform:  isSel ? 'scale(1.02)' : '',
                    transition: 'var(--t)',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <DriveImage
                      item={item}
                      token={displayToken}
                      style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, background: 'var(--bg2)' }}
                    />
                    {isSel && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--neon)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: '#fff', boxShadow: 'var(--sh-neon)',
                      }}>✓</div>
                    )}
                    {item.loanedTo && (
                      <div className="loan-badge">📤 On Loan</div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div className="ccat">{item.category}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                    {(item.size || item.brand) && (
                      <div style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace' }}>
                        {[item.size ? 'Size ' + item.size : '', item.brand].filter(Boolean).join(' · ')}
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
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,16,.97)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-glow)', borderRadius: 99,
          padding: '10px 20px', display: 'flex', gap: 10, alignItems: 'center',
          boxShadow: 'var(--sh-neon)', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon2)' }}>{selected.size} selected</span>
          <button className="btn btn-primary btn-sm" onClick={() => setReqStep('form')}>📨 Request</button>
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
                  <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 14 }}>The owner will be notified.</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {selectedItems.map(i => (
                      <span key={i.id} style={{ background: 'var(--neon-lt)', color: 'var(--neon2)', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{i.name}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
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
                  <div className="fg"><label className="fl">Message (optional)</label><textarea className="fi" value={reqMsg} onChange={e => setReqMsg(e.target.value)} placeholder="Any notes…" /></div>
                </>
              )}
            </div>
            {reqStep === 'form' && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={reset}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={submitRequest} disabled={!reqName || !reqEmail || sending}>
                  {sending ? 'Sending…' : '📨 Send Request'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
