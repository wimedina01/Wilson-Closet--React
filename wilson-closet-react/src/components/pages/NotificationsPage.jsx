import { ls } from '../../lib/storage.js'

function fmtTime(iso) {
  const d = new Date(iso), now = new Date(), diff = Math.round((now - d) / 60000)
  if (diff < 1)    return 'just now'
  if (diff < 60)   return diff + 'm ago'
  if (diff < 1440) return Math.round(diff / 60) + 'h ago'
  return d.toLocaleDateString()
}

export default function NotificationsPage({ notifications, onUpdate }) {
  function markRead(id) {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n)
    onUpdate(updated)
    ls.setJ('wc_notifs', updated)
  }
  function markAllRead() {
    const updated = notifications.map(n => ({ ...n, read: true }))
    onUpdate(updated)
    ls.setJ('wc_notifs', updated)
  }
  function dismiss(id) {
    const updated = notifications.filter(n => n.id !== id)
    onUpdate(updated)
    ls.setJ('wc_notifs', updated)
  }
  function reply(nid) {
    const n = notifications.find(x => x.id === nid)
    if (n?.fromEmail) location.href = `mailto:${n.fromEmail}?subject=Re: Wilson Closet — ${n.itemName}`
  }

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Notifications</div>
          <div className="ph-sub">Item requests and activity</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}>Mark all read</button>
        </div>
      </div>
      <div className="cs">
        {notifications.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔔</div>
            <div className="empty-title">No notifications</div>
            <div className="empty-sub">Item requests will appear here.</div>
          </div>
        ) : notifications.map(n => (
          <div
            key={n.id}
            className={`notif-item ${n.read ? '' : 'unread'}`}
            onClick={() => markRead(n.id)}
          >
            <div className="notif-av">📨</div>
            <div className="notif-body">
              <div className="notif-text">
                <strong>{n.from}</strong> requested <strong>{n.itemName}</strong>
              </div>
              {n.message && (
                <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>"{n.message}"</div>
              )}
              <div className="notif-time">{fmtTime(n.at)} · {n.fromEmail}</div>
              <div className="notif-actions">
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); reply(n.id) }}>✉️ Reply</button>
                <button className="btn btn-danger btn-sm"    onClick={e => { e.stopPropagation(); dismiss(n.id) }}>Dismiss</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
