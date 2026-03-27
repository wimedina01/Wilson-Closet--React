// Categories removed from sidebar — handled by ItemGrid chips

export default function Sidebar({ groups, items, gToken, gUser, activePage, activeGroup, onPage, onGroup, onGoogleAuth, onAddGroup, isOpen }) {
  return (
    <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sb-logo">
        <div className="sb-logo-text">Wilson Closet</div>
        <div className="sb-logo-sub">Wardrobe OS v2.0</div>
      </div>

      <div className="sb-user" onClick={onGoogleAuth}>
        <div className="sb-avatar">
          {gUser?.picture ? <img src={gUser.picture} alt="avatar" /> : (gUser?.name?.[0] || 'W').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-uname">{gUser?.name || 'Connect Account'}</div>
          <div className="sb-uemail">{gUser?.email || 'Sign in with Google'}</div>
        </div>
        <div className={`sb-status ${gToken ? 'on' : ''}`} />
      </div>

      <div className="sb-scroll">
        <div className="sb-section">Navigation</div>
        {[
          { id: 'wardrobe',      icon: '⬡', label: 'My Wardrobe' },
          { id: 'share',         icon: '◈', label: 'Share Closet' },
          { id: 'notifications', icon: '◉', label: 'Notifications' },
          { id: 'settings',      icon: '◎', label: 'Settings' },
        ].map(({ id, icon, label }) => (
          <button key={id} className={`nav-btn ${activePage === id ? 'active' : ''}`} onClick={() => onPage(id)}>
            <span className="ni" style={{ fontFamily: 'monospace', fontSize: 13 }}>{icon}</span>
            {label}
          </button>
        ))}

        <hr className="sb-divider" />

        <div className="sb-section">Closet Groups</div>
        <button className={`group-btn ${activeGroup === 'all' ? 'active' : ''}`} onClick={() => onGroup('all')}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon)', flexShrink: 0 }} />
          All Groups
          <div className="gcnt">{items.length}</div>
        </button>
        {groups.map(g => (
          <button key={g.id} className={`group-btn ${activeGroup === g.id ? 'active' : ''}`} onClick={() => onGroup(g.id)}>
            <div className={`gdot ${g.color}`} />
            {g.emoji} {g.name}
            <div className="gcnt">{items.filter(i => i.group === g.id).length}</div>
          </button>
        ))}
        <button className="sb-add-group" onClick={onAddGroup}>
          <span style={{ fontSize: 14 }}>＋</span> Add Group
        </button>
      </div>

      <div className="sb-footer">
        <div className={`g-btn ${gToken ? 'connected' : ''}`} onClick={onGoogleAuth}>
          <svg width="15" height="15" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span style={{ fontSize: 11 }}>{gToken ? '✓ ' + (gUser?.email?.split('@')[0] || 'Connected') : 'Connect Google'}</span>
        </div>
      </div>
    </nav>
  )
}
