import DriveImage from './DriveImage.jsx'
import { COLORS } from '../lib/constants.js'

function esc(s) {
  return String(s || '')
}

export default function ItemDetail({ item, groups, token, onClose, onEdit, onDelete }) {
  if (!item) return null
  const g = groups.find(x => x.id === item.group)

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">Item Details</div>
          <button className="ib" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Hero image */}
          <DriveImage
            item={item}
            token={token}
            className="d-hero"
            style={{ fontSize: 64 }}
          />

          <div className="d-cat">{item.category}{item.brand ? ` · ${item.brand}` : ''}</div>
          <div className="d-name">{item.name}</div>
          {item.description && <div className="d-desc">{item.description}</div>}
          {g && <div><span className="group-badge">{g.emoji} {g.name}</span></div>}

          <div className="d-grid">
            {[
              ['Size',     item.size     || '—'],
              ['Location', item.location || '—'],
              ['Group',    g ? `${g.emoji} ${g.name}` : '—'],
              ['Added',    new Date(item.addedAt).toLocaleDateString()],
            ].map(([label, val]) => (
              <div key={label} className="d-field">
                <div className="d-field-lbl">{label}</div>
                <div className="d-field-val">{val}</div>
              </div>
            ))}
          </div>

          {item.colors.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="d-field-lbl" style={{ fontSize: 9, marginBottom: 7 }}>Colors</div>
              <div className="d-colors">
                {item.colors.map(name => {
                  const col = COLORS.find(c => c.n === name)
                  return col
                    ? <div key={name} className="d-clr" title={name} style={{ background: col.h }} />
                    : null
                })}
              </div>
            </div>
          )}

          {item.tags.length > 0 && (
            <div className="d-tags">
              {item.tags.map(t => <span key={t} className="tp">{t}</span>)}
            </div>
          )}

          {item.drivePhotoUrl && (
            <div style={{ marginBottom: 9 }}>
              <a href={item.drivePhotoUrl} target="_blank" rel="noreferrer" className="pill pill-green">
                🖼 View Photo in Drive ↗
              </a>
            </div>
          )}

          <div className={item.sheetSynced ? 'synced-yes' : 'synced-no'}>
            {item.sheetSynced ? '✓ Synced to Google Sheets' : '⚠ Not yet synced'}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => onEdit(item)}>✏️ Edit</button>
          <button className="btn btn-danger"    onClick={() => onDelete(item.id)}>🗑 Remove</button>
        </div>
      </div>
    </div>
  )
}
