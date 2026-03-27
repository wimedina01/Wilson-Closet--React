import { useState } from 'react'
import { pushSettings, pullSettings } from '../../lib/sheets.js'
import { ls } from '../../lib/storage.js'

export default function SettingsPage({
  gToken, gUser, sheetId,
  groups, setGroups,
  locations, setLocations,
  items,
  onDisconnect, onOpenPicker, onPushAll, onPullNow,
  toast,
}) {
  const [newLoc, setNewLoc] = useState('')

  function addLocation() {
    const v = newLoc.trim()
    if (!v) return
    if (locations.includes(v)) { toast('Already exists', 'error'); return }
    const updated = [...locations, v]
    setLocations(updated)
    ls.setJ('wc_locs', updated)
    setNewLoc('')
    toast('Location added')
  }

  function removeLocation(i) {
    const updated = locations.filter((_, idx) => idx !== i)
    setLocations(updated)
    ls.setJ('wc_locs', updated)
  }

  function deleteGroup(gid) {
    if (items.some(i => i.group === gid)) { toast('Move or delete items in this group first', 'error'); return }
    if (!confirm('Delete this group?')) return
    const updated = groups.filter(g => g.id !== gid)
    setGroups(updated)
    ls.setJ('wc_groups', updated)
    toast('Group deleted')
  }

  async function pushSettingsHandler() {
    if (!gToken || !sheetId) { toast('Connect Google and select a sheet first', 'error'); return }
    try {
      await pushSettings(sheetId, groups, locations, gToken)
      toast('✓ Settings synced to sheet', 'success')
    } catch (e) { toast('Sync failed: ' + e.message, 'error') }
  }

  async function pullSettingsHandler() {
    if (!gToken || !sheetId) { toast('Connect Google and select a sheet first', 'error'); return }
    try {
      const s = await pullSettings(sheetId, gToken)
      if (s.groups    && Array.isArray(s.groups))    { setGroups(s.groups);       ls.setJ('wc_groups', s.groups) }
      if (s.locations && Array.isArray(s.locations)) { setLocations(s.locations); ls.setJ('wc_locs',   s.locations) }
      toast('✓ Settings pulled from sheet', 'success')
    } catch (e) { toast('Pull failed: ' + e.message, 'error') }
  }

  function clearAll() {
    if (!confirm('Delete ALL local items? This cannot be undone.')) return
    toast('Local items cleared')
    // Trigger through prop — App handles this
    window.dispatchEvent(new CustomEvent('wc-clear-all'))
  }

  function exportCSV() {
    if (!items.length) { toast('No items', 'error'); return }
    const h = ['Name','Category','Group','Brand','Size','Location','Colors','Tags','Description','Date Added']
    const rows = items.map(i => {
      const g = groups.find(x => x.id === i.group)
      return [
        i.name, i.category, g?.name || '—', i.brand||'', i.size||'',
        i.location||'', i.colors.join('; '), i.tags.join('; '),
        (i.description||'').replace(/,/g,';'),
        new Date(i.addedAt).toLocaleDateString(),
      ].map(v => `"${String(v).replace(/"/g,'""')}"`)
    })
    const csv = [h.join(','), ...rows.map(r => r.join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'wilson-closet.csv'; a.click()
    toast('CSV downloaded!', 'success')
  }

  function exportJSON() {
    const data = items.map(({ photo, ...rest }) => rest)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = 'wilson-closet.json'; a.click()
    toast('JSON downloaded!', 'success')
  }

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Settings</div>
          <div className="ph-sub">Account, groups, locations and data</div>
        </div>
      </div>
      <div className="cs">
        <div style={{ maxWidth: 540 }}>

          {/* Google Account */}
          <div className="ss">
            <div className="ss-title">Google Account</div>
            {gToken && gUser ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div className="sb-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
                    {gUser.picture
                      ? <img src={gUser.picture} alt="avatar" />
                      : (gUser.name?.[0] || 'W').toUpperCase()
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{gUser.name || 'Connected'}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{gUser.email}</div>
                  </div>
                  <span className="pill pill-green" style={{ marginLeft: 'auto' }}>✓ Connected</span>
                </div>
                {sheetId && (
                  <div style={{ marginBottom: 12 }}>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                      target="_blank" rel="noreferrer"
                      className="pill pill-blue"
                    >📊 Open Google Sheet ↗</a>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm"    onClick={onOpenPicker}>📂 {sheetId ? 'Change Sheet' : 'Select Sheet'}</button>
                  <button className="btn btn-secondary btn-sm"  onClick={onPullNow}>⬇️ Pull Latest</button>
                  <button className="btn btn-secondary btn-sm"  onClick={onPushAll}>⬆️ Push All Items</button>
                  <button className="btn btn-danger btn-sm"     onClick={onDisconnect}>🔌 Disconnect</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 12 }}>
                  Connect to sync your wardrobe across all devices in real-time.
                </p>
                <button className="btn btn-primary btn-sm" onClick={onOpenPicker}>Connect Google Account</button>
              </>
            )}
          </div>

          {/* Settings Sync */}
          {gToken && sheetId && (
            <div className="ss">
              <div className="ss-title">⚙️ Settings Sync (Groups &amp; Locations)</div>
              <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 10 }}>
                Push your closet groups and locations to the sheet so all devices stay in sync.
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm"   onClick={pushSettingsHandler}>⬆️ Push Settings</button>
                <button className="btn btn-secondary btn-sm" onClick={pullSettingsHandler}>⬇️ Pull Settings</button>
              </div>
            </div>
          )}

          {/* Closet Groups */}
          <div className="ss">
            <div className="ss-title">Closet Groups</div>
            {groups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div className={`gdot ${g.color}`} />
                <span style={{ fontSize: 18 }}>{g.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{g.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{items.filter(i => i.group === g.id).length} items</span>
                {groups.length > 1 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', padding: '3px 7px' }}
                    onClick={() => deleteGroup(g.id)}
                  >✕</button>
                )}
              </div>
            ))}
          </div>

          {/* Locations */}
          <div className="ss">
            <div className="ss-title">Locations</div>
            {locations.map((l, i) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12 }}>📍 {l}</span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '3px 7px' }} onClick={() => removeLocation(i)}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <input
                className="fi"
                style={{ flex: 1 }}
                value={newLoc}
                onChange={e => setNewLoc(e.target.value)}
                placeholder="Add location…"
                onKeyDown={e => e.key === 'Enter' && addLocation()}
              />
              <button className="btn btn-primary btn-sm" onClick={addLocation}>Add</button>
            </div>
          </div>

          {/* Export */}
          <div className="ss">
            <div className="ss-title">Export</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={exportCSV}>📊 CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={exportJSON}>📄 JSON</button>
            </div>
          </div>

          {/* Danger */}
          <div className="ss" style={{ borderColor: 'rgba(248,113,113,.15)', background: 'var(--danger-lt)' }}>
            <div className="ss-title" style={{ color: 'var(--danger)' }}>Danger Zone</div>
            <button className="btn btn-danger btn-sm" onClick={clearAll}>🗑 Clear All Local Items</button>
          </div>

        </div>
      </div>
    </div>
  )
}
