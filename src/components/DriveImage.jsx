import { useState, useEffect, useRef } from 'react'
import { fetchDrivePhoto, getCachedPhoto } from '../lib/drive.js'
import { CAT_EMOJI } from '../lib/constants.js'

/**
 * DriveImage — the cross-device image solution.
 *
 * Priority order:
 * 1. item.photo  (local compressed base64) — instant, no network, same device
 * 2. memory cache (getCachedPhoto)         — already fetched this session
 * 3. Drive API authenticated fetch         — cross-device, uses user's token
 * 4. Emoji fallback                        — never a black box
 *
 * Why not <img src={driveUrl}>?
 * Drive URLs require auth cookies. On a different device/browser where the user
 * isn't signed into drive.google.com, the image returns a blank/error page.
 * The Drive Files API (?alt=media) respects the OAuth token in the header,
 * so it works on any device as long as the user is signed in to the app.
 */
export default function DriveImage({ item, token, className, style }) {
  const getInitialSrc = () => {
    if (item.photo) return item.photo
    if (item.fileId) return getCachedPhoto(item.fileId) || null
    return null
  }

  const [src,    setSrc]    = useState(getInitialSrc)
  const [failed, setFailed] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Re-evaluate when item changes (e.g. after edit or sheet pull)
  useEffect(() => {
    if (item.photo) {
      setSrc(item.photo)
      setFailed(false)
      return
    }
    if (!item.fileId) {
      setSrc(null)
      return
    }
    const cached = getCachedPhoto(item.fileId)
    if (cached) {
      setSrc(cached)
      setFailed(false)
      return
    }
    // Fetch from Drive API with auth token
    if (token) {
      setSrc(null)  // show emoji while loading
      fetchDrivePhoto(item.fileId, token).then(url => {
        if (mounted.current && url) {
          setSrc(url)
          setFailed(false)
        }
      })
    }
  }, [item.id, item.photo, item.fileId, token])

  const emoji = CAT_EMOJI[item.category] || '👔'

  // No source, or image failed to load → show emoji
  if (!src || failed) {
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
        onError={() => setFailed(true)}
      />
    </div>
  )
}
