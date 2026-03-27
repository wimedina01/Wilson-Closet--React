export default function SharePage({ groups, items, toast }) {
  const base = location.origin + location.pathname

  function copyLink(link) {
    navigator.clipboard.writeText(link)
      .then(() => toast('Link copied!', 'success'))
      .catch(() => toast('Copy failed', 'error'))
  }

  function textLink(link, groupName) {
    // Use SMS URI — works on mobile, opens Messages app
    const msg = encodeURIComponent(`Check out my ${groupName} on Wilson Closet: ${link}`)
    window.open(`sms:?body=${msg}`, '_blank')
  }

  function whatsappLink(link, groupName) {
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
        {/* How it works */}
        <div style={{ background: 'var(--neon-lt)', border: '1px solid var(--border-glow)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--neon2)', marginBottom: 4, fontFamily: 'JetBrains Mono,monospace', textTransform: 'uppercase', letterSpacing: 1 }}>✦ How sharing works</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>
            Each closet group gets a gallery link. Anyone with it can browse all items and request multiple at once — you get one email per request.
          </div>
        </div>

        {groups.map(g => {
          const cnt  = items.filter(i => i.group === g.id).length
          const link = `${base}#gallery/${g.id}`
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
              <div className="share-link-box">{link}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copyLink(link)}>📋 Copy</button>
                <button className="btn btn-primary btn-sm"   onClick={() => window.open(link, '_blank')}>🔗 Open</button>
                <button className="btn btn-cyan btn-sm"      onClick={() => textLink(link, g.name)}>💬 Text</button>
                <button className="btn btn-secondary btn-sm" onClick={() => whatsappLink(link, g.name)}>📱 WhatsApp</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
