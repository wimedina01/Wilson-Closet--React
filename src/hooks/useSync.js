import { useEffect, useRef, useCallback } from 'react'
import { checkForChanges, pullAllItems } from '../lib/sheets.js'
import { POLL_MS } from '../lib/constants.js'

export function useSync({ gToken, sheetId, items, groups, onUpdate, onStatus, toast }) {
  const syncing = useRef(false)
  const timer   = useRef(null)

  const bgSync = useCallback(async () => {
    if (!gToken || !sheetId || syncing.current) return
    syncing.current = true
    try {
      const changed = await checkForChanges(sheetId, items, gToken)
      if (changed) {
        const updated = await pullAllItems(sheetId, groups, items, gToken)
        onUpdate(updated)
        onStatus('synced', '✓ Updated — ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        setTimeout(() => onStatus(null, ''), 3000)
      }
    } catch (e) {
      console.warn('bgSync', e)
    } finally {
      syncing.current = false
    }
  }, [gToken, sheetId, items, groups, onUpdate, onStatus])

  // Start / restart poll when dependencies change
  useEffect(() => {
    if (!gToken || !sheetId) return
    timer.current = setInterval(bgSync, POLL_MS)
    return () => clearInterval(timer.current)
  }, [gToken, sheetId, bgSync])

  // Re-sync when tab becomes visible
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') bgSync() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [bgSync])

  return { bgSync }
}
