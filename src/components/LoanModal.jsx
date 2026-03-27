import { useState } from 'react'

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function buildLoanLog(existingLog, action, person) {
  // action: 'out' | 'in'
  const ts  = fmtDateTime(new Date().toISOString())
  const entry = action === 'out'
    ? `LoanOut: ${ts} → ${person}`
    : `LoanIn: ${ts}`
  if (!existingLog) return entry
  return existingLog + ' | ' + entry
}

export default function LoanModal({ item, onSave, onClose }) {
  const [person, setPerson] = useState(item.loanedTo || '')

  function handleLoan() {
    if (!person.trim()) return
    const loanLog = buildLoanLog(item.loanLog || '', 'out', person.trim())
    onSave({
      ...item,
      loanedTo:    person.trim(),
      loanLog,
      loanedAt:    new Date().toISOString(),
      sheetSynced: false,
    })
    onClose()
  }

  function handleReturn() {
    const loanLog = buildLoanLog(item.loanLog || '', 'in', '')
    onSave({
      ...item,
      loanedTo:     '',
      loanLog,
      returnedAt:   new Date().toISOString(),
      sheetSynced:  false,
    })
    onClose()
  }

  // Parse loan log for display
  const logEntries = (item.loanLog || '').split(' | ').filter(Boolean)

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '70vh' }}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">📤 Loan Tracker</div>
          <button className="ib" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Item info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
            padding: '10px 12px', background: 'var(--glass)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 20 }}>👔</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
              {item.location && <div style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace' }}>📍 {item.location}</div>}
            </div>
          </div>

          {/* Currently on loan */}
          {item.loanedTo ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ background: 'var(--gold-lt)', border: '1px solid rgba(255,181,71,.2)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontFamily: 'JetBrains Mono,monospace' }}>Currently On Loan</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>📤 {item.loanedTo}</div>
                {item.loanedAt && (
                  <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3, fontFamily: 'JetBrains Mono,monospace' }}>
                    Since {fmtDateTime(item.loanedAt)}
                  </div>
                )}
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleReturn}>
                ✓ Mark as Returned
              </button>
            </div>
          ) : null}

          {/* Loan to someone */}
          <div className="fg">
            <label className="fl">{item.loanedTo ? 'Transfer to someone else' : 'Loan to'}</label>
            <input
              className="fi"
              value={person}
              onChange={e => setPerson(e.target.value)}
              placeholder="Person's name…"
              autoFocus={!item.loanedTo}
              onKeyDown={e => e.key === 'Enter' && handleLoan()}
            />
          </div>

          {/* Loan history log */}
          {logEntries.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div className="fl" style={{ marginBottom: 7 }}>Loan History</div>
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '8px 11px', border: '1px solid var(--border)' }}>
                {logEntries.map((entry, i) => {
                  const isOut = entry.startsWith('LoanOut')
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '4px 0',
                      borderBottom: i < logEntries.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>{isOut ? '📤' : '✅'}</span>
                      <span style={{ fontSize: 10, color: isOut ? 'var(--gold)' : 'var(--success)', fontFamily: 'JetBrains Mono,monospace', lineHeight: 1.5 }}>
                        {entry}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-gold"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleLoan}
            disabled={!person.trim()}
          >
            📤 {item.loanedTo ? 'Transfer Loan' : 'Mark as Loaned'}
          </button>
        </div>
      </div>
    </div>
  )
}
