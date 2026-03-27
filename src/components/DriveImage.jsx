import { useState, useEffect, useRef } from 'react'
import { fetchDrivePhoto, getCachedPhoto } from '../lib/drive.js'
import { CAT_EMOJI } from '../lib/constants.js'

/**
 * DriveImage — renders item photos with 4-tier fallback:
 * 1. item.photo       — local base64, instant (same device only)
 * 2. memory cache     — already fetched this session
 * 3a. token available — fetch via Drive API (authenticated, any device owner logged in)
 * 3b. no token        — use item.driveThumb (Netlify proxy URL, works publicly for guests)
 * 4. emoji fallback   — never a black box
 */
export default function DriveImage({ item, token, className, style }) {
  const getInitialSrc = () => {
    if (item.photo) return item.photo
    if (item.fileId) {
      const cached = getCachedPhoto(item.fileId)
      if (cached) return cached
    }
    // For guests (no token): use the public proxy URL directly
    if (!token && item.driveThumb) return item.driveThumb
    return null
  }

  const [src,    setSrc]    = useState(getInitialSrc)
  const [failed, setFailed] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    // Priority 1: local photo
    if (item.photo) { setSrc(item.photo); setFailed(false); return }

    // Priority 2: memory cache
    if (item.fileId) {
      const cached = getCachedPhoto(item.fileId)
      if (cached) { setSrc(cached); setFailed(false); return }
    }

    // Priority 3a: authenticated fetch (owner signed in)
    // Show proxy thumb immediately while auth fetch runs (avoids blank flash)
    if (token && item.fileId) {
      if (item.driveThumb) { setSrc(item.driveThumb); setFailed(false) }
      fetchDrivePhoto(item.fileId, token).then(url => {
        if (mounted.current && url) { setSrc(url); setFailed(false) }
        // If auth fetch fails, proxy thumb is already showing — no action needed
      })
      return
    }

    // Priority 3b: guest — use public proxy URL
    if (!token && item.driveThumb) {
      setSrc(item.driveThumb); setFailed(false); return
    }

    setSrc(null)
  }, [item.id, item.photo, item.fileId, item.driveThumb, token])

  const emoji = CAT_EMOJI[item.category] || '👔'

  if (!src || failed) {
    // If proxy failed, try it once more via img tag — could be a transient error
    return (
      <div className={className} style={style}>
        <span style={{ fontSize: 'inherit' }}>{emoji}</span>
      </div>
    )
  }

  return (
    <div className={className} style={style}>
      <img
        src={src}
        alt={item.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => {
          // If proxy URL failed, show emoji rather than broken image
          setFailed(true)
        }}
      />
    </div>
  )
}
