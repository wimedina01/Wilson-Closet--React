import { useState, useEffect, useCallback, useRef } from 'react'

// Lib
import { ls }                          from './lib/storage.js'
import { CLIENT_ID, DEFAULT_GROUPS, DEFAULT_LOCATIONS, SHEET_HDR } from './lib/constants.js'
import { setExpiredCallback, resetFolderCache } from './lib/drive.js'
import {
  ensureSheetHeader, ensureSettingsTab, pullSettings, pushSettings,
  pullAllItems, upsertItem, deleteItem as deleteSheetItem,
  pushAllItems, listSpreadsheets, createSpreadsheet, checkForChanges, formatSheet,
} from './lib/sheets.js'

// Hooks
import { useToast }  from './hooks/useToast.js'
import { useSync }   from './hooks/useSync.js'

// Components
import ToastContainer      from './components/Toast.jsx'
import SyncBar             from './components/SyncBar.jsx'
import Sidebar             from './components/Sidebar.jsx'
import ItemGrid            from './components/ItemGrid.jsx'
import ItemDetail          from './components/ItemDetail.jsx'
import AddItemModal        from './components/AddItemModal.jsx'
import SheetPicker         from './components/SheetPicker.jsx'
import GroupModal          from './components/GroupModal.jsx'
import LoanModal           from './components/LoanModal.jsx'
import SharePage           from './components/pages/SharePage.jsx'
import NotificationsPage   from './components/pages/NotificationsPage.jsx'
import SettingsPage        from './components/pages/SettingsPage.jsx'
import GalleryPage         from './components/pages/GalleryPage.jsx'

// ── Helpers
function tryParse(s, fb) { try { return s ? JSON.parse(s) : fb } catch { return fb } }

function sheetNameFor(gUser) {
  if (gUser?.name) {
    const f = gUser.name.trim().split(' ')[0]
    return f.toLowerCase().endsWith('s') ? `${f}' Closet` : `${f}'s Closet`
  }
  return 'Wilson Closet'
}

// ── Parse shared gallery URL
// Format: #gallery/{groupId}/{sheetId}/{ownerToken}/{ownerEmail}
function parseGalleryHash() {
  const h = location.hash
  if (!h.startsWith('#gallery/')) return {}
  const parts = h.replace('#gallery/', '').split('/')
  return {
    groupId:    parts[0] || null,
    sheetId:    parts[1] || null,
    ownerToken: parts[2] || null,
    ownerEmail: decodeURIComponent(parts[3] || ''),
  }
}
function getGalleryId()      { return parseGalleryHash().groupId }
function getGallerySheetId() { return parseGalleryHash().sheetId }

export default function App() {
  // ── Persistent state (localStorage-backed)
  const [items,         setItems]         = useState(() => tryParse(ls.get('wc_items'),  []))
  const [groups,        setGroups]        = useState(() => tryParse(ls.get('wc_groups'), null) || DEFAULT_GROUPS)
  const [notifications, setNotifications] = useState(() => tryParse(ls.get('wc_notifs'), []))
  const [locations,     setLocations]     = useState(() => tryParse(ls.get('wc_locs'),   null) || DEFAULT_LOCATIONS)
  const [gToken,        setGToken]        = useState(() => ls.get('wc_token')   || null)
  const [gUser,         setGUser]         = useState(() => tryParse(ls.get('wc_user'),   null))
  const [sheetId,       setSheetId]       = useState(() => ls.get('wc_sheetid') || null)
  const [clientId]                        = useState(() => ls.get('wc_clientid') || CLIENT_ID)

  // ── UI state
  const [page,          setPage]          = useState(() => getGalleryId() ? 'gallery' : 'wardrobe')
  const [activeGroup,   setActiveGroup]   = useState('all')
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [syncState,     setSyncState]     = useState(null)   // 'syncing' | 'synced' | 'error' | null
  const [syncText,      setSyncText]      = useState('')
  const [lastSync,      setLastSync]      = useState('')

  // ── Modal state
  const [detailItem,    setDetailItem]    = useState(null)
  const [editItem,      setEditItem]      = useState(null)    // null = add, item = edit
  const [showAddModal,  setShowAddModal]  = useState(false)
  const [showPicker,    setShowPicker]    = useState(false)
  const [showGroup,     setShowGroup]     = useState(false)
  const [loanItem,      setLoanItem]      = useState(null)
  const [galleryId]                       = useState(getGalleryId)
  const [gallerySheetId]                  = useState(getGallerySheetId)
  const [galleryOwnerToken]               = useState(() => parseGalleryHash().ownerToken)
  const [galleryOwnerEmail]               = useState(() => parseGalleryHash().ownerEmail)

  const { toasts, toast } = useToast()
  const pendingItems = useRef(tryParse(ls.get('wc_pending'), []))  // items saved offline

  // Keep pending items in localStorage so they survive page reloads
  function addPendingItem(item) {
    pendingItems.current = [...pendingItems.current, item]
    ls.setJ('wc_pending', pendingItems.current)
  }
  function clearPendingItems() {
    pendingItems.current = []
    ls.rm('wc_pending')
  }

  // ── Force sync offline items + photos
  async function syncOfflineItems() {
    if (!gToken || !sheetId) return
    // Gather unsynced items: from pendingItems ref + items not marked sheetSynced
    const pending = [...pendingItems.current]
    const unsynced = items.filter(i => !i.sheetSynced && !pending.find(p => p.id === i.id))
    const all = [...pending, ...unsynced]
    if (!all.length) return

    showSync('syncing', `Syncing ${all.length} offline items…`)
    let syncedCount = 0
    for (const it of all) {
      try {
        // If item has a local photo but no drivePhotoUrl, upload the photo first
        if (it.photo && !it.drivePhotoUrl && gToken) {
          try {
            const { compressPhoto, uploadToDrive } = await import('./lib/drive.js')
            const { b64, mime } = await compressPhoto(it.photo)
            const dr = await uploadToDrive(b64, mime, it.name, gToken)
            if (dr) {
              it.drivePhotoUrl = dr.viewUrl
              it.driveThumb = dr.directUrl
              it.fileId = dr.fileId
            }
          } catch {}
        }
        await upsertItem(sheetId, it, groups, gToken)
        it.sheetSynced = true
        syncedCount++
      } catch (e) {
        console.warn('syncOfflineItems: failed for', it.id, e)
      }
    }
    if (syncedCount > 0) {
      setItems(prev => prev.map(i => {
        const synced = all.find(s => s.id === i.id && s.sheetSynced)
        return synced ? { ...i, sheetSynced: true, drivePhotoUrl: synced.drivePhotoUrl || i.drivePhotoUrl, driveThumb: synced.driveThumb || i.driveThumb, fileId: synced.fileId || i.fileId } : i
      }))
      clearPendingItems()
      toast(`✓ ${syncedCount} offline item${syncedCount > 1 ? 's' : ''} synced`, 'success')
      showSync('synced', `✓ ${syncedCount} items synced`)
      setTimeout(hideSync, 3000)
    } else {
      showSync('error', 'Sync failed — try again')
      setTimeout(hideSync, 3000)
    }
  }

  // ── Sync status helpers
  const showSync = useCallback((state, text) => { setSyncState(state); setSyncText(text) }, [])
  const hideSync = useCallback(() => setSyncState(null), [])

  // ── Persist whenever state changes
  useEffect(() => { ls.setJ('wc_items',  items)         }, [items])
  useEffect(() => { ls.setJ('wc_groups', groups)        }, [groups])
  useEffect(() => { ls.setJ('wc_notifs', notifications) }, [notifications])
  useEffect(() => { ls.setJ('wc_locs',   locations)     }, [locations])

  // ── Unread badge
  const unreadCount = notifications.filter(n => !n.read).length

  // ── PWA state
  const [isOnline,      setIsOnline]      = useState(() => navigator.onLine)
  const [installReady,  setInstallReady]  = useState(() => !!window._installPrompt)
  const [installed,     setInstalled]     = useState(false)
  const [showInstall,   setShowInstall]   = useState(false)

  // ── Connection / session status: 'connected' | 'disconnected' | 'expired'
  const [connStatus, setConnStatus] = useState(() => gToken ? 'connected' : 'disconnected')
  const tokenHealthRef = useRef(null)

  // ── Handle token expiry (called by drive.js when 401 received)
  // Instead of immediately clearing the token (which forces re-login),
  // mark session as expired and let user decide when to re-auth
  useEffect(() => {
    setExpiredCallback(() => {
      setConnStatus('expired')
      toast('Session expired — tap the status indicator to reconnect', 'error')
    })
  }, [toast])

  // ── Proactive token health check — validate token every 10 minutes
  // This prevents the jarring "constant timeout → re-login" cycle
  useEffect(() => {
    if (!gToken) { setConnStatus('disconnected'); return }
    async function checkToken() {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + gToken)
        if (res.ok) {
          const info = await res.json()
          // If token expires in less than 5 minutes, mark as expiring
          if (info.expires_in && info.expires_in < 300) {
            setConnStatus('expired')
          } else {
            setConnStatus('connected')
          }
        } else {
          setConnStatus('expired')
        }
      } catch {
        // Network error — don't mark as expired, just offline
        if (!navigator.onLine) setConnStatus('disconnected')
      }
    }
    checkToken()
    tokenHealthRef.current = setInterval(checkToken, 10 * 60 * 1000) // every 10 min
    return () => clearInterval(tokenHealthRef.current)
  }, [gToken])

  // ── Handle clear-all event from SettingsPage
  useEffect(() => {
    const handler = () => { setItems([]); toast('All local items cleared') }
    window.addEventListener('wc-clear-all', handler)
    return () => window.removeEventListener('wc-clear-all', handler)
  }, [toast])

  // ── OAuth return handler (runs once on mount)
  useEffect(() => {
    const hash = location.hash
    if (!hash.includes('access_token')) return
    const p = new URLSearchParams(hash.slice(1))
    const t = p.get('access_token')
    if (!t) return
    setGToken(t); ls.set('wc_token', t)
    setSheetId(null); ls.rm('wc_sheetid')  // always search fresh on new login
    resetFolderCache()
    history.replaceState(null, '', location.pathname)
    fetchGoogleUser(t)
  }, []) // eslint-disable-line

  // ── On load with existing token — connect to sheet
  useEffect(() => {
    if (!gToken || !sheetId) return
    // Validate token optimistically — errors handled by setExpiredCallback
    loadSheet(gToken, sheetId)
  }, []) // eslint-disable-line

  // ── Background sync hook
  // ── PWA: online/offline detection + install prompt
  useEffect(() => {
    const goOnline  = () => {
      setIsOnline(true)
      if (gToken) setConnStatus('connected')
      toast('Back online', 'success')
      // Auto-sync pending items when reconnecting
      syncOfflineItems()
    }
    const goOffline = () => { setIsOnline(false); setConnStatus('disconnected'); toast("You're offline — changes saved locally", "info") }
    const onInstall = () => { setInstallReady(true); setShowInstall(true) }
    const onInstalled = () => { setInstalled(true); setInstallReady(false); setShowInstall(false); toast('✓ Wilson Closet installed!', 'success') }
    const onSyncNow = () => bgSync()

    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('wc-install-available', onInstall)
    window.addEventListener('wc-installed', onInstalled)
    window.addEventListener('wc-sync-now',  onSyncNow)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('wc-install-available', onInstall)
      window.removeEventListener('wc-installed', onInstalled)
      window.removeEventListener('wc-sync-now',  onSyncNow)
    }
  }, [bgSync, toast])

  async function triggerInstall() {
    if (!window._installPrompt) return
    window._installPrompt.prompt()
    const { outcome } = await window._installPrompt.userChoice
    if (outcome === 'accepted') { window._installPrompt = null; setInstallReady(false) }
    setShowInstall(false)
  }

  // ── Real-time notification polling via Netlify poll function
  const lastNotifCheck = useRef(new Date(Date.now() - 24*60*60*1000).toISOString())
  useEffect(() => {
    if (!gToken || !sheetId) return
    const pollNotifs = async () => {
      try {
        const since = encodeURIComponent(lastNotifCheck.current)
        const res = await fetch(`/.netlify/functions/poll?sheet=${sheetId}&token=${gToken}&since=${since}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.notifications?.length) {
          lastNotifCheck.current = new Date().toISOString()
          const newNotifs = data.notifications.map(n => ({
            id:        n.id,
            itemId:    n.itemIds?.[0] || '',
            itemIds:   n.itemIds || [],
            itemName:  n.itemName,
            from:      n.from,
            fromEmail: n.fromEmail,
            message:   n.message,
            read:      false,
            at:        n.at,
          }))
          setNotifications(prev => {
            const existingIds = new Set(prev.map(x => x.id))
            const fresh = newNotifs.filter(n => !existingIds.has(n.id))
            if (!fresh.length) return prev
            toast(`📨 ${fresh.length} new request${fresh.length > 1 ? 's' : ''}!`, 'info')
            return [...fresh, ...prev]
          })
        }
      } catch {}
    }
    const interval = setInterval(pollNotifs, 15000)
    pollNotifs() // immediate first check
    return () => clearInterval(interval)
  }, [gToken, sheetId, toast])

  const { bgSync } = useSync({
    gToken, sheetId, items, groups,
    onUpdateItems: newItems => {
      setItems(newItems)
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    },
    onUpdateSettings: settings => {
      // Apply settings pulled during background sync
      if (settings.groups    && Array.isArray(settings.groups)    && settings.groups.length)    {
        setGroups(settings.groups); ls.setJ('wc_groups', settings.groups)
      }
      if (settings.locations && Array.isArray(settings.locations) && settings.locations.length) {
        setLocations(settings.locations); ls.setJ('wc_locs', settings.locations)
      }
    },
    onStatus: showSync,
  })

  // ── Fetch Google user info
  async function fetchGoogleUser(token) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Auth failed')
      const u = await res.json()
      if (u.error) throw new Error(u.error.message)
      const user = { email: u.email, name: u.name, picture: u.picture }
      setGUser(user); ls.setJ('wc_user', user)
      toast('Signed in as ' + (u.name || u.email), 'success')
      // Always show picker on fresh sign-in — no auto-detection
      setShowPicker(true)
    } catch (e) {
      toast('Sign-in failed: ' + e.message, 'error')
    }
  }

  // ── Load data from selected sheet
  async function loadSheet(token, sid) {
    showSync('syncing', 'Loading wardrobe…')
    try {
      await ensureSheetHeader(sid, token)
      await ensureSettingsTab(sid, token)
      const settings = await pullSettings(sid, token)

      // Capture resolved groups/locations BEFORE calling pullAllItems
      // so group names resolve correctly (React state updates are async)
      let resolvedGroups    = groups
      let resolvedLocations = locations
      if (settings.groups    && Array.isArray(settings.groups)    && settings.groups.length)    {
        resolvedGroups = settings.groups
        setGroups(settings.groups); ls.setJ('wc_groups', settings.groups)
      }
      if (settings.locations && Array.isArray(settings.locations) && settings.locations.length) {
        resolvedLocations = settings.locations
        setLocations(settings.locations); ls.setJ('wc_locs', settings.locations)
      }

      // Use resolvedGroups (not stale state) for group name resolution
      const loaded = await pullAllItems(sid, resolvedGroups, items, token)
      setItems(loaded)
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      showSync('synced', `✓ ${loaded.length} items loaded`)
      setTimeout(hideSync, 2500)
      // Format sheet in background (non-blocking)
      formatSheet(sid, token).catch(() => {})
      // Flush offline items
      if (pendingItems.current.length) {
        for (const it of pendingItems.current) await upsertItem(sid, it, groups, token)
        toast(`✓ ${pendingItems.current.length} offline items synced`, 'success')
        clearPendingItems()
      }
    } catch (e) {
      showSync('error', 'Load failed: ' + e.message)
      setTimeout(hideSync, 3000)
    }
  }

  // ── Sheet selected from picker
  async function onSheetSelected({ id, name }) {
    setSheetId(id); ls.set('wc_sheetid', id)
    setShowPicker(false)
    toast(`✓ Connected to "${name}"`, 'success')
    await loadSheet(gToken, id)
  }

  // ── Google auth
  function launchOAuth() {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
    ].join(' ')
    const uri = location.origin + location.pathname
    const p = new URLSearchParams({ client_id: clientId, redirect_uri: uri, response_type: 'token', scope: scopes, prompt: 'consent' })
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p
  }

  function disconnectGoogle() {
    if (!confirm('Disconnect Google? Items stay saved locally.')) return
    setGToken(null); setGUser(null); setSheetId(null)
    ls.rm('wc_token'); ls.rm('wc_user'); ls.rm('wc_sheetid'); ls.rm('wc_folderid')
    resetFolderCache()
    toast('Disconnected from Google')
  }

  function toggleGoogleAuth() {
    if (gToken) { disconnectGoogle(); return }
    launchOAuth()
  }

  // ── Save item (add or edit)
  async function handleSaveItem(item) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id)
      return idx >= 0 ? prev.map(i => i.id === item.id ? item : i) : [item, ...prev]
    })
    setShowAddModal(false)
    setDetailItem(null)
    setEditItem(null)
    toast(editItem ? 'Item updated!' : 'Item added!', 'success')

    if (gToken) {
      const sid = sheetId
      if (sid) {
        showSync('syncing', 'Saving to sheet…')
        try {
          await upsertItem(sid, item, groups, gToken)
          item.sheetSynced = true
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, sheetSynced: true } : i))
          showSync('synced', '✓ Saved & synced')
          setTimeout(hideSync, 2500)
        } catch {
          showSync('error', 'Saved locally — sync failed')
          setTimeout(hideSync, 3000)
          addPendingItem(item)
        }
      } else {
        addPendingItem(item)
        setShowPicker(true)
      }
    } else {
      addPendingItem(item)
    }
  }

  // ── Delete item
  async function handleDeleteItem(id) {
    if (!confirm('Remove this item?')) return
    if (gToken && sheetId) {
      showSync('syncing', 'Deleting…')
      try {
        await deleteSheetItem(sheetId, id, gToken)
        hideSync()
      } catch {
        showSync('error', 'Delete failed — try again')
        setTimeout(hideSync, 3000)
        return
      }
    }
    setItems(prev => prev.filter(i => i.id !== id))
    setDetailItem(null)
    toast('Item removed')
  }

  // ── Pull now
  async function pullNow() {
    if (!gToken)  { toast('Connect Google to sync', 'error'); return }
    if (!sheetId) { setShowPicker(true); return }
    await loadSheet(gToken, sheetId)
  }

  // ── Push all
  async function pushAll() {
    if (!gToken || !sheetId) { toast('Connect Google and select a sheet first', 'error'); return }
    showSync('syncing', `Syncing ${items.length} items…`)
    try {
      await pushAllItems(sheetId, items, groups, gToken)
      setItems(prev => prev.map(i => ({ ...i, sheetSynced: true })))
      showSync('synced', `✓ ${items.length} items synced!`)
      setTimeout(hideSync, 3000)
    } catch (e) {
      showSync('error', 'Sync failed: ' + e.message)
      setTimeout(hideSync, 3000)
    }
  }

  // ── Navigation helpers
  function goGroup(gid) {
    setActiveGroup(gid)
    setPage('wardrobe')
    setSidebarOpen(false)
  }
  function goPage(p) {
    setPage(p)
    setSidebarOpen(false)
  }
  function goCat(cat) {
    // Handled inside ItemGrid — just navigate to wardrobe
    setPage('wardrobe')
    setSidebarOpen(false)
  }

  // ── If viewing a shared gallery, render just that
  if (page === 'gallery' && galleryId) {
    return (
      <>
        <ToastContainer toasts={toasts} />

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 600,
          background: 'rgba(255,92,138,.15)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,92,138,.3)',
          padding: '8px 16px', textAlign: 'center',
          fontSize: 11, fontWeight: 600, color: 'var(--danger)',
          fontFamily: 'JetBrains Mono,monospace', letterSpacing: '.5px',
        }}>
          ◉ Offline — your changes are saved locally and will sync when you reconnect
        </div>
      )}

      {/* Install prompt banner */}
      {showInstall && !installed && (
        <div style={{
          position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 500,
          background: 'rgba(10,10,16,.97)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-glow)', borderRadius: 'var(--r-lg)',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: 'var(--sh-neon)',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/icon-192.png" alt="icon" style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Install Wilson Closet</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Add to your home screen for the full app experience</div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowInstall(false)} style={{ padding: '5px 8px' }}>Later</button>
            <button className="btn btn-primary btn-sm" onClick={triggerInstall}>Install</button>
          </div>
        </div>
      )}
        <GalleryPage
          groupId={galleryId}
          sheetId={gallerySheetId || sheetId}
          ownerToken={galleryOwnerToken}
          ownerEmail={galleryOwnerEmail}
          groups={groups}
          items={items}
          token={gToken} gToken={gToken} gUser={gUser}
        />
      </>
    )
  }

  const activeGroupObj = groups.find(g => g.id === activeGroup)

  return (
    <>
      <ToastContainer toasts={toasts} />

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 600,
          background: 'rgba(255,92,138,.15)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,92,138,.3)',
          padding: '8px 16px', textAlign: 'center',
          fontSize: 11, fontWeight: 600, color: 'var(--danger)',
          fontFamily: 'JetBrains Mono,monospace', letterSpacing: '.5px',
        }}>
          ◉ Offline — your changes are saved locally and will sync when you reconnect
        </div>
      )}

      {/* Install prompt banner */}
      {showInstall && !installed && (
        <div style={{
          position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 500,
          background: 'rgba(10,10,16,.97)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-glow)', borderRadius: 'var(--r-lg)',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: 'var(--sh-neon)',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/icon-192.png" alt="icon" style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Install Wilson Closet</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Add to your home screen for the full app experience</div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowInstall(false)} style={{ padding: '5px 8px' }}>Later</button>
            <button className="btn btn-primary btn-sm" onClick={triggerInstall}>Install</button>
          </div>
        </div>
      )}

      <div className="shell">
        {/* Sidebar */}
        <Sidebar
          groups={groups} items={items}
          gToken={gToken} gUser={gUser}
          activePage={page} activeGroup={activeGroup}
          onPage={goPage} onGroup={goGroup} onCat={goCat}
          onGoogleAuth={toggleGoogleAuth}
          onAddGroup={() => setShowGroup(true)}
          isOpen={sidebarOpen}
          unreadCount={unreadCount}
        />

        {/* Mobile overlay */}
        <div
          className={`mob-overlay ${sidebarOpen ? 'show' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        <main className="main">
          {/* Mobile topbar */}
          <div className="topbar">
            <button className="ib" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="tb-logo">
              Wilson <em>Closet</em>
              {/* Connection status indicator */}
              {gToken && (
                <button
                  onClick={connStatus === 'expired' ? launchOAuth : undefined}
                  title={
                    connStatus === 'connected' ? 'Connected to Google' :
                    connStatus === 'expired' ? 'Session expired — tap to reconnect' :
                    'Offline'
                  }
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    marginLeft: 8, padding: '2px 8px', borderRadius: 99,
                    border: 'none', cursor: connStatus === 'expired' ? 'pointer' : 'default',
                    fontSize: 9, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace',
                    verticalAlign: 'middle',
                    background: connStatus === 'connected' ? 'var(--success-lt)' :
                               connStatus === 'expired' ? 'var(--danger-lt)' : 'var(--gold-lt)',
                    color: connStatus === 'connected' ? 'var(--success)' :
                           connStatus === 'expired' ? 'var(--danger)' : 'var(--gold)',
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: connStatus === 'connected' ? 'var(--success)' :
                               connStatus === 'expired' ? 'var(--danger)' : 'var(--gold)',
                    animation: connStatus === 'connected' ? 'none' : 'pulse 2s infinite',
                  }} />
                  {connStatus === 'connected' ? 'Live' :
                   connStatus === 'expired' ? 'Reconnect' : 'Offline'}
                </button>
              )}
            </div>
            <button className="ib" onClick={() => goPage('notifications')} style={{ position: 'relative' }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, background: 'var(--danger)', borderRadius: '50%', border: '2px solid var(--surface)' }} />
              )}
            </button>
          </div>

          {/* Sync bar */}
          <SyncBar state={syncState} text={syncText} />

          {/* ── WARDROBE PAGE */}
          {page === 'wardrobe' && (
            <div className="page">
              <div className="ph">
                <div>
                  <div className="ph-title">
                    {activeGroup === 'all' ? 'All Items' : `${activeGroupObj?.emoji} ${activeGroupObj?.name}`}
                  </div>
                  <div className="ph-sub">Your complete wardrobe inventory</div>
                </div>
                <div className="ph-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    id="sync-btn"
                    onClick={gToken && !sheetId ? () => setShowPicker(true) : pullNow}
                  >🔄 Sync</button>
                  {lastSync && <span className="hide-mobile" style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'JetBrains Mono,monospace' }}>Synced {lastSync}</span>}
                  <button className="btn btn-secondary btn-sm hide-mobile" onClick={() => goPage('share')}>🔗 Share</button>
                  <button className="btn btn-primary btn-sm hide-mobile" onClick={() => { setEditItem(null); setShowAddModal(true) }}>＋ Add Item</button>
                </div>
              </div>

              {/* Stats */}
              <div className="stats-row">
                {[
                  { val: items.length,                             lbl: 'Items',   color: 'var(--accent)' },
                  { val: groups.length,                            lbl: 'Groups',  color: 'var(--accent)' },
                  { val: items.filter(i => i.sheetSynced).length, lbl: 'Synced',  color: 'var(--success)' },
                ].map(s => (
                  <div key={s.lbl} className="stat-card">
                    <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
                    <div className="stat-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>

              {/* Force sync banner for unsynced items */}
              {items.some(i => !i.sheetSynced) && gToken && sheetId && (
                <div style={{
                  margin: '0 16px 12px', padding: '10px 14px',
                  background: 'var(--gold-lt)', border: '1px solid rgba(255,181,71,.2)',
                  borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>
                      {items.filter(i => !i.sheetSynced).length} item{items.filter(i => !i.sheetSynced).length > 1 ? 's' : ''} not synced
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink3)' }}>Items and photos saved locally will be uploaded</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={syncOfflineItems} style={{ flexShrink: 0 }}>
                    ⬆ Force Sync
                  </button>
                </div>
              )}

              <ItemGrid
                items={items} groups={groups} token={gToken}
                activeGroup={activeGroup}
                onSelectItem={setDetailItem}
              />
            </div>
          )}

          {/* ── SHARE PAGE */}
          {page === 'share' && (
            <SharePage groups={groups} items={items} toast={toast} sheetId={sheetId} gToken={gToken} gUser={gUser} />
          )}

          {/* ── NOTIFICATIONS PAGE */}
          {page === 'notifications' && (
            <NotificationsPage
            notifications={notifications}
            onUpdate={setNotifications}
            items={items}
            token={gToken}
            onViewItem={item => { setDetailItem(item); setPage('wardrobe') }}
          />
          )}

          {/* ── SETTINGS PAGE */}
          {page === 'settings' && (
            <SettingsPage
              gToken={gToken} gUser={gUser} sheetId={sheetId}
              isInstalled={installed}
              onInstall={installReady ? triggerInstall : null}
              groups={groups} setGroups={async updated => {
                setGroups(updated)
                ls.setJ('wc_groups', updated)
                if (gToken && sheetId) {
                  try { await pushSettings(sheetId, updated, locations, gToken); bgSync() } catch {}
                }
              }}
              locations={locations} setLocations={setLocations}
              items={items}
              onDisconnect={disconnectGoogle}
              onOpenPicker={() => setShowPicker(true)}
              onPushAll={pushAll}
              onPullNow={pullNow}
              toast={toast}
            />
          )}
        </main>
      </div>

      {/* FAB */}
      {page === 'wardrobe' && (
        <button className="fab" onClick={() => { setEditItem(null); setShowAddModal(true) }}>＋</button>
      )}

      {/* Bottom Nav */}
      <nav className="bnav">
        <div className="bnav-inner">
          {[
            { id: 'wardrobe',      icon: '👗', label: 'Closet' },
            { id: 'share',         icon: '🔗', label: 'Share' },
            { id: 'notifications', icon: '🔔', label: 'Alerts' },
            { id: 'settings',      icon: '⚙️', label: 'Settings' },
          ].map(({ id, icon, label }) => (
            <button key={id} className={`bni ${page === id ? 'active' : ''}`} onClick={() => goPage(id)}>
              <div className="bni-icon">{icon}</div>
              {label}
              {id === 'notifications' && unreadCount > 0 && (
                <span style={{ fontSize: 8, background: 'var(--danger)', color: '#fff', borderRadius: 99, padding: '1px 4px', position: 'absolute' }}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── MODALS */}

      {/* Item Detail */}
      {detailItem && (
        <ItemDetail
          item={detailItem} groups={groups} token={gToken}
          onClose={() => setDetailItem(null)}
          onEdit={item => { setEditItem(item); setDetailItem(null); setShowAddModal(true) }}
          onDelete={handleDeleteItem}
          onLoan={item => { setDetailItem(null); setLoanItem(item) }}
        />
      )}

      {/* Add / Edit Item */}
      {showAddModal && (
        <AddItemModal
          item={editItem} groups={groups} locations={locations} token={gToken}
          onSave={handleSaveItem}
          onClose={() => { setShowAddModal(false); setEditItem(null) }}
          toast={toast}
        />
      )}

      {/* Sheet Picker */}
      {showPicker && (
        <SheetPicker
          token={gToken} gUser={gUser}
          onSelect={onSheetSelected}
          onClose={() => setShowPicker(false)}
          toast={toast}
        />
      )}

      {/* Group Modal */}
      {showGroup && (
        <GroupModal
          onSave={async g => {
            const updated = [...groups, g]
            setGroups(updated)
            ls.setJ('wc_groups', updated)
            toast(`"${g.name}" created!`, 'success')
            // Immediately push settings + trigger sync so other devices see the new group
            if (gToken && sheetId) {
              try {
                await pushSettings(sheetId, updated, locations, gToken)
                bgSync()
              } catch {}
            }
          }}
          onClose={() => setShowGroup(false)}
        />
      )}

      {/* Loan Modal */}
      {loanItem && (
        <LoanModal
          item={loanItem}
          onSave={item => {
            handleSaveItem(item)
            toast(item.loanedTo ? `📤 Loaned to ${item.loanedTo}` : '✓ Marked as returned', 'success')
          }}
          onClose={() => setLoanItem(null)}
        />
      )}
    </>
  )
}
