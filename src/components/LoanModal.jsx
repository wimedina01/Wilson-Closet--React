import { useState } from 'react'

export default function LoanModal({ item, onSave, onClose }) {
  const [person, setPerson] = useState(item.loanedTo || '')

  function handleSave() {
    onSave({ ...item, loanedTo: person.trim(), sheetSynced: false })
    onClose()
  }
  function handleReturn() {
    onSave({ ...item, loanedTo: '', sheetSynced: false })
    onClose()
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '60vh' }}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">📤 Loan Item</div>
          <button className="ib" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
            padding: '10px 12px', background: 'var(--glass)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 20 }}>👔</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
              {item.location && <div style={{ fontSize: 10, color: 'var(--ink3)' }}>📍 {item.location}</div>}
            </div>
          </div>

          {item.loanedTo ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ background: 'var(--gold-lt)', border: '1px solid rgba(255,181,71,.2)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700, marginBottom: 3 }}>CURRENTLY ON LOAN</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>📤 {item.loanedTo}</div>
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleReturn}>
                ✓ Mark as Returned
              </button>
            </div>
          ) : null}

          <div className="fg">
            <label className="fl">{item.loanedTo ? 'Update Borrower' : 'Loaned to'}</label>
            <input
              className="fi"
              value={person}
              onChange={e => setPerson(e.target.value)}
              placeholder="Person's name…"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave}>
            📤 {item.loanedTo ? 'Update Loan' : 'Mark as Loaned'}
          </button>
        </div>
      </div>
    </div>
  )
}
