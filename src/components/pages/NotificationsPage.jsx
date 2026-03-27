import { useEffect } from 'react'
import { ls } from '../../lib/storage.js'

function fmtTime(iso) {
  const d = new Date(iso), now = new Date(), diff = Math.round((now - d) / 60000)
  if (diff < 1)    return 'just now'
  if (diff < 60)   return diff + 'm ago'
  if (diff < 1440) return Math.round(diff / 60) + 'h ago'
  return d.toLocaleDateString()
}

export default function NotificationsPage({ notifications, onUpdate, items, onViewItem }) {
  // Real-time: re-check localStorage every 10 seconds for new notifications
  // (guest submits → writes to ls on same device, or owner sees via pull)
  useEffect(() => {
    const interval = setInterval(() => {
      const fresh = ls.getJ('wc_notifs', [])
      // Only update if something changed
      if (fresh.length !== notifications.length) {
        onUpdate(fresh)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [notifications, onUpdate])

  function markRead(id) {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n)
    onUpdate(updated); ls.setJ('wc_notifs', updated)
  }
  function markAllRead() {
    const updated = notifications.map(n => ({ ...n, read: true }))
    onUpdate(updated); ls.setJ('wc_notifs', updated)
  }
  function dismiss(id) {
    const updated = notifications.filter(n => n.id !== id)
    onUpdate(updated); ls.setJ('wc_notifs', updated)
  }
  function reply(nid) {
    const n = notifications.find(x => x.id === nid)
    if (n?.fromEmail) location.href = `mailto:${n.fromEmail}?subject=Re: Wilson Closet — ${n.itemName}`
  }
  function viewItem(n) {
    markRead(n.id)
    const item = items?.find(i => i.id === n.itemId)
    if (item && onViewItem) onViewItem(item)
  }

  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Notifications</div>
          <div className="ph-sub" style={{ fontFamily: 'JetBrains Mono,monospace' }}>
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </div>
        </div>
        <div className="ph-actions">
          {unread > 0 && <button className="btn btn-secondary btn-sm" onClick={markAllRead}>Mark all read</button>}
        </div>
      </div>
      <div className="cs">
        {notifications.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔔</div>
            <div className="empty-title">No notifications</div>
            <div className="empty-sub">Item requests will appear here in real time.</div>
          </div>
        ) : notifications.map(n => (
          <div
            key={n.id}
            className={`notif-item ${n.read ? '' : 'unread'}`}
            onClick={() => viewItem(n)}
          >
            <div className="notif-av">📨</div>
            <div className="notif-body">
              <div className="notif-text">
                <strong>{n.from}</strong> requested{' '}
                <strong style={{ color: 'var(--neon2)', cursor: 'pointer' }}>{n.itemName}</strong>
              </div>
              {n.message && (
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2, fontStyle: 'italic' }}>"{n.message}"</div>
              )}
              {n.itemLocation && (
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2, fontFamily: 'JetBrains Mono,monospace' }}>
                  📍 {n.itemLocation}
                </div>
              )}
              <div className="notif-time">{fmtTime(n.at)} · {n.fromEmail}</div>
              <div className="notif-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-primary btn-sm"    onClick={() => viewItem(n)}>View Item</button>
                <button className="btn btn-secondary btn-sm"  onClick={() => reply(n.id)}>✉️ Reply</button>
                <button className="btn btn-danger btn-sm"     onClick={() => dismiss(n.id)}>Dismiss</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
