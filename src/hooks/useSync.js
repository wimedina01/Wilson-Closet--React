import { useEffect, useRef, useCallback } from 'react'
import { checkForChanges, pullAllItems, pullSettings } from '../lib/sheets.js'
import { POLL_MS } from '../lib/constants.js'

export function useSync({ gToken, sheetId, items, groups, onUpdateItems, onUpdateSettings, onStatus }) {
  const syncing  = useRef(false)
  const timer    = useRef(null)

  // Use refs for items/groups so bgSync always has latest values
  // without needing to be recreated when they change
  const itemsRef  = useRef(items)
  const groupsRef = useRef(groups)
  const tokenRef  = useRef(gToken)
  const sheetRef  = useRef(sheetId)

  // Keep refs current on every render — no stale closure issues
  useEffect(() => { itemsRef.current  = items  }, [items])
  useEffect(() => { groupsRef.current = groups }, [groups])
  useEffect(() => { tokenRef.current  = gToken }, [gToken])
  useEffect(() => { sheetRef.current  = sheetId }, [sheetId])

  const bgSync = useCallback(async () => {
    const token = tokenRef.current
    const sid   = sheetRef.current
    if (!token || !sid || syncing.current) return
    syncing.current = true

    try {
      // Always pull settings on every cycle — catches group/location changes from other devices
      const settings = await pullSettings(sid, token)
      onUpdateSettings(settings)

      // Check if items changed in sheet
      const changed = await checkForChanges(sid, itemsRef.current, token)
      if (changed) {
        // Brief pause so React can flush settings state before we resolve group IDs
        await new Promise(r => setTimeout(r, 30))
        const updated = await pullAllItems(sid, groupsRef.current, itemsRef.current, token)
        onUpdateItems(updated)
        onStatus('synced', '✓ ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        setTimeout(() => onStatus(null, ''), 2000)
      }
    } catch (e) {
      console.warn('bgSync error:', e)
    } finally {
      syncing.current = false
    }
  }, [onUpdateItems, onUpdateSettings, onStatus]) // stable deps only — no items/groups/token/sheetId

  // Start poll — only restarts when token or sheetId changes (not on every item change)
  useEffect(() => {
    if (!gToken || !sheetId) return
    // Run immediately on connect
    bgSync()
    timer.current = setInterval(bgSync, POLL_MS)
    return () => { clearInterval(timer.current); timer.current = null }
  }, [gToken, sheetId]) // intentionally NOT including bgSync to avoid restart loop

  // Re-sync when tab becomes visible
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') bgSync() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [bgSync])

  return { bgSync }
}
