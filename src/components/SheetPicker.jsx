import { useState, useEffect } from 'react'
import { listSpreadsheets, createSpreadsheet, deleteSpreadsheet } from '../lib/sheets.js'
import { SHEET_HDR } from '../lib/constants.js'

function sheetName(gUser) {
  if (gUser?.name) {
    const f = gUser.name.trim().split(' ')[0]
    return f.toLowerCase().endsWith('s') ? `${f}' Closet` : `${f}'s Closet`
  }
  return 'Wilson Closet'
}

export default function SheetPicker({ token, gUser, onSelect, onClose, toast }) {
  const [sheets,   setSheets]   = useState(null)   // null = loading
  const [selected, setSelected] = useState(null)   // { id, name }
  const [deleting, setDeleting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setSheets(null); setError(null); setSelected(null)
    try {
      const files = await listSpreadsheets(token)
      setSheets(files)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const name = sheetName(gUser)
      const id = await createSpreadsheet(name, token)
      // Write headers
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent('All Items!A1')}?valueInputOption=USER_ENTERED`,
        { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [SHEET_HDR] }) }
      )
      toast(`"${name}" created!`, 'success')
      onSelect({ id, name })
    } catch (e) {
      toast('Create failed: ' + e.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm(`Permanently delete "${selected.name}" from Google Drive?\n\nThis cannot be undone and will erase all data in it.`)) return
    setDeleting(true)
    try {
      const ok = await deleteSpreadsheet(selected.id, token)
      if (ok) {
        toast(`"${selected.name}" deleted`, 'success')
        setSelected(null)
        await load()
      } else {
        toast('Delete failed', 'error')
      }
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function handleApply() {
    if (!selected) return
    setApplying(true)
    try {
      onSelect(selected)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '80vh' }}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">Choose Your Google Sheet</div>
          <button className="ib" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--danger)' }}>
              <p style={{ marginBottom: 14 }}>Failed to load sheets: {error}</p>
              <button className="btn btn-secondary btn-sm" onClick={load}>Try Again</button>
            </div>
          ) : sheets === null ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink3)' }}>
              <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5, margin: '0 auto 10px' }} />
              Loading your spreadsheets…
            </div>
          ) : sheets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink3)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <p style={{ marginBottom: 16, lineHeight: 1.6 }}>No spreadsheets found in your Drive.</p>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : `＋ Create "${sheetName(gUser)}"`}
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 14, lineHeight: 1.6 }}>
                Select your Wilson Closet spreadsheet. Every device should pick the{' '}
                <strong style={{ color: 'var(--ink)' }}>same file</strong> to stay in sync.
              </p>
              <div>
                {sheets.map(sheet => {
                  const isSel = selected?.id === sheet.id
                  const mod   = new Date(sheet.modifiedTime)
                  const modStr = mod.toLocaleDateString() + ' ' +
                    mod.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div
                      key={sheet.id}
                      className={`sheet-row ${isSel ? 'selected' : ''}`}
                      onClick={() => setSelected(isSel ? null : { id: sheet.id, name: sheet.name })}
                    >
                      <span style={{ fontSize: 22, flexShrink: 0 }}>📊</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sheet.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Modified {modStr}</div>
                      </div>
                      {isSel && <div style={{ color: 'var(--success)', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>✓</div>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary btn-sm" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : '＋ Create New'}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            disabled={!selected || deleting}
          >
            {deleting ? 'Deleting…' : '🗑 Delete'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={!selected || applying}
          >
            {applying ? 'Connecting…' : '✓ Use This Sheet'}
          </button>
        </div>
      </div>
    </div>
  )
}
