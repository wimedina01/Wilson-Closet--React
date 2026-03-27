import DriveImage from './DriveImage.jsx'
import { COLORS } from '../lib/constants.js'

export default function ItemDetail({ item, groups, token, onClose, onEdit, onDelete, onLoan }) {
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
          <DriveImage item={item} token={token} className="d-hero" style={{ fontSize: 64 }} />

          <div className="d-cat">{item.category}{item.brand ? ` · ${item.brand}` : ''}</div>
          <div className="d-name">{item.name}</div>
          {item.description && <div className="d-desc">{item.description}</div>}
          {g && <div style={{ marginBottom: 8 }}><span className="group-badge">{g.emoji} {g.name}</span></div>}
          {item.loanedTo && (
            <div style={{ marginBottom: 10 }}>
              <span className="loan-info">📤 On loan to: {item.loanedTo}</span>
            </div>
          )}

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
            <div style={{ marginBottom: 10 }}>
              <div className="d-field-lbl" style={{ marginBottom: 6 }}>Colors</div>
              <div className="d-colors">
                {item.colors.map(name => {
                  const col = COLORS.find(c => c.n === name)
                  return col ? <div key={name} className="d-clr" title={name} style={{ background: col.h }} /> : null
                })}
              </div>
            </div>
          )}
          {item.tags.length > 0 && <div className="d-tags">{item.tags.map(t => <span key={t} className="tp">{t}</span>)}</div>}

          {item.drivePhotoUrl && (
            <div style={{ marginBottom: 8 }}>
              <a href={item.drivePhotoUrl} target="_blank" rel="noreferrer" className="pill pill-blue">🖼 View in Drive ↗</a>
            </div>
          )}
          <div>{item.sheetSynced ? <span className="synced-yes">✓ Synced</span> : <span className="synced-no">⚠ Not synced</span>}</div>
        </div>
        <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(item)}>✏️ Edit</button>
          <button className="btn btn-gold btn-sm"      onClick={() => onLoan(item)}>📤 Loan</button>
          <button className="btn btn-danger btn-sm"    onClick={() => onDelete(item.id)}>🗑 Remove</button>
        </div>
      </div>
    </div>
  )
}
