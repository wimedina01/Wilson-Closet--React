import { useState } from 'react'

export default function SharePage({ groups, items, toast, sheetId, gToken, gUser }) {
  const base = location.origin + location.pathname
  const [shortLinks, setShortLinks] = useState({})  // groupId → short URL
  const [shortening, setShortening] = useState({})   // groupId → loading

  function buildLink(groupId) {
    const params = [groupId, sheetId || '', gToken || '', gUser?.email || ''].join('/')
    return `${base}#gallery/${params}`
  }

  async function shortenLink(groupId) {
    const fullUrl = buildLink(groupId)
    setShortening(p => ({ ...p, [groupId]: true }))
    try {
      const res = await fetch('/.netlify/functions/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      })
      const data = await res.json()
      if (data.code) {
        const short = `${location.origin}/s/${data.code}`
        setShortLinks(p => ({ ...p, [groupId]: short }))
        return short
      }
    } catch (e) {
      console.warn('Shorten failed:', e)
    } finally {
      setShortening(p => ({ ...p, [groupId]: false }))
    }
    return null
  }

  async function getShareLink(groupId) {
    if (shortLinks[groupId]) return shortLinks[groupId]
    const short = await shortenLink(groupId)
    return short || buildLink(groupId)
  }

  async function copyLink(groupId) {
    const link = await getShareLink(groupId)
    navigator.clipboard.writeText(link)
      .then(() => toast('Link copied!', 'success'))
      .catch(() => toast('Copy failed', 'error'))
  }

  async function textLink(groupId, groupName) {
    const link = await getShareLink(groupId)
    const msg = encodeURIComponent(`Check out my ${groupName} on Wilson Closet: ${link}`)
    window.open(`sms:?body=${msg}`, '_blank')
  }

  async function whatsappLink(groupId, groupName) {
    const link = await getShareLink(groupId)
    const msg = encodeURIComponent(`Check out my ${groupName} on Wilson Closet: ${link}`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Share Closet</div>
          <div className="ph-sub">Send gallery links to anyone</div>
        </div>
      </div>
      <div className="cs">
        <div style={{ background: 'var(--neon-lt)', border: '1px solid var(--border-glow)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--neon2)', marginBottom: 4, fontFamily: 'JetBrains Mono,monospace', textTransform: 'uppercase', letterSpacing: 1 }}>✦ How sharing works</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>
            Share a link to your closet group. Anyone can browse items, select multiple, and send you a request — you get notified instantly and receive an email.
          </div>
        </div>

        {!gToken && (
          <div style={{ background: 'var(--gold-lt)', border: '1px solid rgba(255,181,71,.2)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>⚠ Sign in to enable email notifications for requests</div>
          </div>
        )}

        {groups.map(g => {
          const cnt  = items.filter(i => i.group === g.id).length
          const link = shortLinks[g.id] || null
          const isShortening = shortening[g.id]
          return (
            <div key={g.id} className="share-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--neon-lt)', border: '1px solid var(--border-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {g.emoji}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace' }}>{cnt} item{cnt !== 1 ? 's' : ''}</div>
                </div>
              </div>

              {/* Short link display */}
              <div className="share-link-box" style={{ fontSize: 11, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 }}>
                {isShortening ? (
                  <span style={{ color: 'var(--ink3)', fontStyle: 'italic' }}>Generating short link...</span>
                ) : link ? (
                  <span style={{ color: 'var(--neon2)', fontWeight: 600 }}>{link}</span>
                ) : (
                  <span style={{ color: 'var(--ink3)', fontSize: 9 }}>Click Copy or Share to generate a short link</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copyLink(g.id)} disabled={isShortening}>
                  {isShortening ? '...' : '📋 Copy'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  const l = await getShareLink(g.id)
                  window.open(l, '_blank')
                }} disabled={isShortening}>🔗 Open</button>
                <button className="btn btn-cyan btn-sm" onClick={() => textLink(g.id, g.name)} disabled={isShortening}>💬 Text</button>
                <button className="btn btn-secondary btn-sm" onClick={() => whatsappLink(g.id, g.name)} disabled={isShortening}>📱 WhatsApp</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
