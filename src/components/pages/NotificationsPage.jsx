import { useState, useEffect } from 'react'
import { ls } from '../../lib/storage.js'
import DriveImage from '../DriveImage.jsx'
import { CAT_EMOJI } from '../../lib/constants.js'

function fmtTime(iso) {
  const d = new Date(iso), now = new Date(), diff = Math.round((now - d) / 60000)
  if (diff < 1)    return 'just now'
  if (diff < 60)   return diff + 'm ago'
  if (diff < 1440) return Math.round(diff / 60) + 'h ago'
  return d.toLocaleDateString()
}

// Detail panel showing ALL items in a notification
function NotifDetailModal({ notif, items, token, onClose, onViewItem }) {
  // Get all requested items — match by itemIds array first, fall back to itemId
  const ids = notif.itemIds?.length ? notif.itemIds : (notif.itemId ? [notif.itemId] : [])
  const requestedItems = ids.map(id => items?.find(i => i.id === id)).filter(Boolean)

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-title" style={{ fontSize: 16 }}>
              📨 Request from {notif.from}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace', marginTop: 2 }}>
              {fmtTime(notif.at)} · {notif.fromEmail}
            </div>
          </div>
          <button className="ib" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Message */}
          {notif.message && (
            <div style={{
              background: 'var(--neon-lt)', border: '1px solid var(--border-glow)',
              borderRadius: 'var(--r)', padding: '10px 13px', marginBottom: 14,
              fontSize: 13, color: 'var(--ink2)', fontStyle: 'italic',
            }}>
              "{notif.message}"
            </div>
          )}

          {/* Items */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontFamily: 'JetBrains Mono,monospace' }}>
            {ids.length} Item{ids.length !== 1 ? 's' : ''} Requested
          </div>

          {requestedItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requestedItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => { onViewItem(item); onClose() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    background: 'var(--glass)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r)', cursor: 'pointer', transition: 'var(--t)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--neon)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {/* Thumbnail */}
                  <DriveImage
                    item={item} token={token}
                    className="lt"
                    style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, fontSize: 24 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--neon2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2, fontFamily: 'JetBrains Mono,monospace' }}>
                      {item.category}{item.brand ? ` · ${item.brand}` : ''}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace', display: 'flex', gap: 8 }}>
                      {item.size && <span>Size {item.size}</span>}
                      {item.location && <span>📍 {item.location}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--neon2)', flexShrink: 0 }}>View →</div>
                </div>
              ))}
            </div>
          ) : (
            // Items may have been deleted — show names from notification
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notif.itemName?.split(', ').map((name, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: 'var(--glass)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r)',
                }}>
                  <div style={{ fontSize: 24 }}>{CAT_EMOJI['Other']}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', marginLeft: 'auto' }}>Deleted</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (notif.fromEmail) location.href = `mailto:${notif.fromEmail}?subject=Re: Wilson Closet Request`
            }}
          >✉️ Reply</button>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsPage({ notifications, onUpdate, items, token, onViewItem }) {
  const [activeNotif, setActiveNotif] = useState(null)

  // Poll localStorage every 10s for new notifications (fallback / same-device)
  useEffect(() => {
    const interval = setInterval(() => {
      const fresh = ls.getJ('wc_notifs', [])
      if (fresh.length !== notifications.length) onUpdate(fresh)
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
  function openNotif(n) {
    markRead(n.id)
    setActiveNotif(n)
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
        ) : notifications.map(n => {
          // Count items in this notification
          const itemCount = n.itemIds?.length || (n.itemId ? 1 : 0)

          return (
            <div
              key={n.id}
              className={`notif-item ${n.read ? '' : 'unread'}`}
              onClick={() => openNotif(n)}
            >
              <div className="notif-av">📨</div>
              <div className="notif-body">
                <div className="notif-text">
                  <strong>{n.from}</strong> requested{' '}
                  <strong style={{ color: 'var(--neon2)' }}>
                    {itemCount > 1 ? `${itemCount} items` : n.itemName || 'an item'}
                  </strong>
                </div>
                {n.message && (
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2, fontStyle: 'italic' }}>"{n.message}"</div>
                )}
                <div className="notif-time">{fmtTime(n.at)} · {n.fromEmail}</div>

                {/* Item previews */}
                {itemCount > 0 && (() => {
                  const ids = n.itemIds?.length ? n.itemIds : (n.itemId ? [n.itemId] : [])
                  const previewItems = ids.slice(0, 3).map(id => items?.find(i => i.id === id)).filter(Boolean)
                  return previewItems.length > 0 ? (
                    <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                      {previewItems.map(item => (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: 'var(--glass)', border: '1px solid var(--border)',
                          borderRadius: 'var(--r-sm)', padding: '3px 8px',
                          fontSize: 10, fontWeight: 600, color: 'var(--ink2)',
                        }}>
                          <span>{CAT_EMOJI[item.category] || '📦'}</span>
                          <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        </div>
                      ))}
                      {ids.length > 3 && (
                        <div style={{ padding: '3px 8px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 10, color: 'var(--ink3)' }}>
                          +{ids.length - 3} more
                        </div>
                      )}
                    </div>
                  ) : null
                })()}

                <div className="notif-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-primary btn-sm"   onClick={() => openNotif(n)}>View All Items</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { if (n.fromEmail) location.href = `mailto:${n.fromEmail}` }}>✉️ Reply</button>
                  <button className="btn btn-danger btn-sm"    onClick={() => dismiss(n.id)}>Dismiss</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Notification detail modal */}
      {activeNotif && (
        <NotifDetailModal
          notif={activeNotif}
          items={items}
          token={token}
          onClose={() => setActiveNotif(null)}
          onViewItem={item => { setActiveNotif(null); onViewItem(item) }}
        />
      )}
    </div>
  )
}
