import { useState } from 'react'
import { pushSettings, pullSettings, formatSheet } from '../../lib/sheets.js'
import { ls } from '../../lib/storage.js'

export default function SettingsPage({
  gToken, gUser, sheetId,
  groups, setGroups,
  locations, setLocations,
  items,
  onDisconnect, onOpenPicker, onPushAll, onPullNow,
  toast,
}) {
  const [newLoc,     setNewLoc]     = useState('')
  const [formatting, setFormatting] = useState(false)

  function addLocation() {
    const v = newLoc.trim(); if (!v) return
    if (locations.includes(v)) { toast('Already exists', 'error'); return }
    const updated = [...locations, v]
    setLocations(updated); ls.setJ('wc_locs', updated)
    setNewLoc(''); toast('Location added')
  }
  function removeLocation(i) {
    const updated = locations.filter((_, idx) => idx !== i)
    setLocations(updated); ls.setJ('wc_locs', updated)
  }
  function deleteGroup(gid) {
    if (items.some(i => i.group === gid)) { toast('Move or delete items first', 'error'); return }
    if (!confirm('Delete this group?')) return
    const updated = groups.filter(g => g.id !== gid)
    setGroups(updated); ls.setJ('wc_groups', updated); toast('Group deleted')
  }
  async function pushSettingsHandler() {
    if (!gToken || !sheetId) { toast('Connect Google first', 'error'); return }
    try { await pushSettings(sheetId, groups, locations, gToken); toast('✓ Settings synced', 'success') }
    catch (e) { toast('Sync failed: ' + e.message, 'error') }
  }
  async function pullSettingsHandler() {
    if (!gToken || !sheetId) { toast('Connect Google first', 'error'); return }
    try {
      const s = await pullSettings(sheetId, gToken)
      if (s.groups    && Array.isArray(s.groups))    { setGroups(s.groups);       ls.setJ('wc_groups', s.groups) }
      if (s.locations && Array.isArray(s.locations)) { setLocations(s.locations); ls.setJ('wc_locs',   s.locations) }
      toast('✓ Settings pulled', 'success')
    } catch (e) { toast('Pull failed: ' + e.message, 'error') }
  }
  async function applyFormatting() {
    if (!gToken || !sheetId) { toast('Connect Google first', 'error'); return }
    setFormatting(true)
    try { await formatSheet(sheetId, gToken); toast('✓ Sheet formatted!', 'success') }
    catch (e) { toast('Format failed: ' + e.message, 'error') }
    finally { setFormatting(false) }
  }
  function exportCSV() {
    if (!items.length) { toast('No items', 'error'); return }
    const h = ['Name','Category','Group','Brand','Size','Location','Colors','Tags','Description','On Loan To','Date Added']
    const rows = items.map(i => {
      const g = groups.find(x => x.id === i.group)
      return [i.name,i.category,g?.name||'—',i.brand||'',i.size||'',i.location||'',
        i.colors.join('; '),i.tags.join('; '),(i.description||'').replace(/,/g,';'),
        i.loanedTo||'',new Date(i.addedAt).toLocaleDateString()
      ].map(v=>`"${String(v).replace(/"/g,'""')}"`)
    })
    const csv = [h.join(','), ...rows.map(r=>r.join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'wilson-closet.csv'; a.click()
    toast('CSV downloaded!', 'success')
  }
  function exportJSON() {
    const data = items.map(({photo,...rest})=>rest)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
    a.download = 'wilson-closet.json'; a.click()
    toast('JSON downloaded!', 'success')
  }
  function clearAll() {
    if (!confirm('Delete ALL local items? This cannot be undone.')) return
    window.dispatchEvent(new CustomEvent('wc-clear-all'))
  }

  const loanedCount = items.filter(i=>i.loanedTo).length

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Settings</div>
          <div className="ph-sub">Account, sync &amp; preferences</div>
        </div>
      </div>
      <div className="cs">

        {/* Stats overview */}
        {loanedCount > 0 && (
          <div className="ss" style={{ borderColor: 'rgba(255,181,71,.2)', background: 'var(--gold-lt)' }}>
            <div className="ss-title" style={{ color: 'var(--gold)' }}>📤 Items on loan</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.filter(i=>i.loanedTo).map(i => (
                <div key={i.id} style={{ display:'flex', justifyContent:'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid rgba(255,181,71,.1)' }}>
                  <span style={{ fontWeight: 600 }}>{i.name}</span>
                  <span style={{ color: 'var(--gold)' }}>📤 {i.loanedTo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Google Account */}
        <div className="ss">
          <div className="ss-title">Google Account</div>
          {gToken && gUser ? (
            <>
              <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 14 }}>
                <div className="sb-avatar" style={{ width: 42, height: 42, fontSize: 17 }}>
                  {gUser.picture ? <img src={gUser.picture} alt="avatar" /> : (gUser.name?.[0]||'W').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{gUser.name||'Connected'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace' }}>{gUser.email}</div>
                </div>
                <span className="pill pill-green" style={{ marginLeft: 'auto' }}>✓ Live</span>
              </div>
              {sheetId && (
                <div style={{ marginBottom: 12 }}>
                  <a href={`https://docs.google.com/spreadsheets/d/${sheetId}`} target="_blank" rel="noreferrer" className="pill pill-blue">📊 Open Sheet ↗</a>
                </div>
              )}
              <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                <button className="btn btn-primary btn-sm"   onClick={onOpenPicker}>📂 {sheetId?'Change Sheet':'Select Sheet'}</button>
                <button className="btn btn-secondary btn-sm" onClick={onPullNow}>⬇️ Pull</button>
                <button className="btn btn-secondary btn-sm" onClick={onPushAll}>⬆️ Push All</button>
                <button className="btn btn-danger btn-sm"    onClick={onDisconnect}>🔌 Disconnect</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 12, lineHeight: 1.6 }}>Connect Google to sync your wardrobe across all devices.</p>
              <button className="btn btn-primary btn-sm" onClick={onOpenPicker}>Connect Google Account</button>
            </>
          )}
        </div>

        {/* Sheet Formatting */}
        {gToken && sheetId && (
          <div className="ss">
            <div className="ss-title">Google Sheet</div>
            <p style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 10, lineHeight: 1.6 }}>
              Format the sheet with the app's dark futuristic theme — includes column widths, filters, frozen headers, and hides the Settings tab.
            </p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={applyFormatting} disabled={formatting}>
                {formatting ? '⏳ Formatting…' : '✦ Apply Formatting'}
              </button>
              <a href={`https://docs.google.com/spreadsheets/d/${sheetId}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">📊 Open Sheet ↗</a>
            </div>
          </div>
        )}

        {/* Settings Sync */}
        {gToken && sheetId && (
          <div className="ss">
            <div className="ss-title">Settings Sync</div>
            <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 10 }}>
              Push your groups and locations to the sheet so all devices stay in sync.
            </p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <button className="btn btn-primary btn-sm"   onClick={pushSettingsHandler}>⬆️ Push Settings</button>
              <button className="btn btn-secondary btn-sm" onClick={pullSettingsHandler}>⬇️ Pull Settings</button>
            </div>
          </div>
        )}

        {/* Drive folder info */}
        <div className="ss">
          <div className="ss-title">Google Drive Structure</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: 'var(--ink2)', lineHeight: 2 }}>
            <div>📁 Wilson Closet/</div>
            <div>&nbsp;&nbsp;📁 Pictures/ &nbsp;<span style={{color:'var(--ink3)'}}>← photos stored here</span></div>
            <div>&nbsp;&nbsp;📁 Sheets/ &nbsp;&nbsp;<span style={{color:'var(--ink3)'}}>← spreadsheets stored here</span></div>
          </div>
        </div>

        {/* Groups */}
        <div className="ss">
          <div className="ss-title">Closet Groups</div>
          {groups.map(g => (
            <div key={g.id} style={{ display:'flex', alignItems:'center', gap: 9, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
              <div className={`gdot ${g.color}`} />
              <span style={{ fontSize: 17 }}>{g.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{g.name}</span>
              <span style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace' }}>{items.filter(i=>i.group===g.id).length}</span>
              {groups.length > 1 && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '2px 6px' }} onClick={() => deleteGroup(g.id)}>✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Locations */}
        <div className="ss">
          <div className="ss-title">Locations</div>
          {locations.map((l, i) => (
            <div key={l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono,monospace' }}>📍 {l}</span>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '2px 6px' }} onClick={() => removeLocation(i)}>✕</button>
            </div>
          ))}
          <div style={{ display:'flex', gap: 7, marginTop: 10 }}>
            <input className="fi" style={{ flex: 1 }} value={newLoc} onChange={e=>setNewLoc(e.target.value)} placeholder="Add location…" onKeyDown={e=>e.key==='Enter'&&addLocation()} />
            <button className="btn btn-primary btn-sm" onClick={addLocation}>Add</button>
          </div>
        </div>

        {/* Export */}
        <div className="ss">
          <div className="ss-title">Export Data</div>
          <div style={{ display:'flex', gap: 7, flexWrap:'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={exportCSV}>📊 CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={exportJSON}>📄 JSON</button>
          </div>
        </div>

        {/* Danger */}
        <div className="ss" style={{ borderColor: 'rgba(255,92,138,.15)', background: 'var(--danger-lt)' }}>
          <div className="ss-title" style={{ color: 'var(--danger)' }}>Danger Zone</div>
          <button className="btn btn-danger btn-sm" onClick={clearAll}>🗑 Clear All Local Items</button>
        </div>

        {/* Credits */}
        <div style={{
          textAlign: 'center', padding: '20px 0 8px',
          borderTop: '1px solid var(--border)', marginTop: 4,
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono,monospace', fontSize: 11,
            background: 'linear-gradient(135deg,var(--neon2),var(--cyan))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontWeight: 700, marginBottom: 4,
          }}>Wilson Closet</div>
          <div style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace', lineHeight: 1.8 }}>
            Version 2.0 · © 2025<br/>
            Developed by <span style={{ color: 'var(--neon2)' }}>Wilson Medina</span><br/>
            <span style={{ opacity: .6 }}>Powered by Claude AI · Anthropic</span>
          </div>
        </div>

      </div>
    </div>
  )
}
