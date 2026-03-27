export default function SharePage({ groups, items, toast }) {
  const base = location.origin + location.pathname

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Share Closet</div>
          <div className="ph-sub">Shareable gallery links for each group</div>
        </div>
      </div>
      <div className="cs">
        <div style={{
          background: 'rgba(240,180,41,.08)', border: '1px solid rgba(240,180,41,.15)',
          borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 18,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>🔗 How sharing works</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>
            Each closet group gets a unique gallery link. Anyone with it can browse and request items — you get notified.
          </div>
        </div>

        {groups.map(g => {
          const cnt  = items.filter(i => i.group === g.id).length
          const link = `${base}#gallery/${g.id}`
          return (
            <div key={g.id} className="share-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{g.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{cnt} item{cnt !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="share-link-box">{link}</div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigator.clipboard.writeText(link).then(() => toast('Link copied!', 'success')).catch(() => toast('Copy failed', 'error'))}
                >📋 Copy</button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => window.open(link, '_blank')}
                >🔗 Open Gallery</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
