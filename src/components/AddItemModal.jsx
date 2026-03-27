import { useState, useRef, useEffect } from 'react'
import { COLORS, TAGS_SUGGEST, CATEGORIES } from '../lib/constants.js'
import { compressPhoto, uploadToDrive } from '../lib/drive.js'

const SIZES_CLOTHES = ['XS','S','M','L','XL','XXL','XXXL','One Size']
const SIZES_SHOES   = ['6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11','12','13']

export default function AddItemModal({ item: editItem, groups, locations, token, onSave, onClose, toast }) {
  const isEdit = !!editItem

  // ── Form state
  const [name,     setName]     = useState(editItem?.name        || '')
  const [cat,      setCat]      = useState(editItem?.category    || '')
  const [group,    setGroup]    = useState(editItem?.group       || groups[0]?.id || '')
  const [brand,    setBrand]    = useState(editItem?.brand       || '')
  const [location, setLocation] = useState(editItem?.location    || '')
  const [size,     setSize]     = useState(editItem?.size        || '')
  const [colors,   setColors]   = useState(editItem?.colors      || [])
  const [tags,     setTags]     = useState(editItem?.tags        || [])
  const [desc,     setDesc]     = useState(editItem?.description || '')
  const [tagInput, setTagInput] = useState('')

  // ── Photo state
  const [photo,    setPhoto]    = useState(editItem?.photo || null)
  const [photoB64, setPhotoB64] = useState(null)
  const [photoMime,setPhotoMime]= useState('image/jpeg')
  const [analyzing,setAnalyzing]= useState(false)
  const [aiText,   setAiText]   = useState(editItem?.description || '')
  const [showAI,   setShowAI]   = useState(!!editItem?.description)

  // ── Upload state
  const [saving,   setSaving]   = useState(false)
  const camRef = useRef(); const galRef = useRef()

  // ── Handle photo selection → compress → auto-analyze
  async function onPhotoSelected(e) {
    const file = e.target.files[0]; if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async evt => {
      const { dataUrl, b64, mime } = await compressPhoto(evt.target.result)
      setPhoto(dataUrl); setPhotoB64(b64); setPhotoMime(mime)
      setShowAI(true)
      setAiText('')
      analyze(b64, mime)
    }
    reader.readAsDataURL(file)
  }

  // ── AI Analysis
  async function analyze(b64, mime) {
    setAnalyzing(true)
    setAiText('Analyzing…')
    try {
      const res = await fetch('/.netlify/functions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: 'Analyze this clothing or shoe item. Respond with ONLY a raw JSON object — no other text, no markdown:\n{"name":"4-6 word item name","category":"Tops","brand":"","colors":["Black"],"description":"brief description","tags":["Casual"],"notes":""}' },
        ]}] }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const d = await res.json()
      if (d.error) throw new Error(d.error.message)
      const raw = d.content.map(i => i.text || '').join('').trim()
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in response')
      const p = JSON.parse(match[0])

      if (p.name && !name)        setName(p.name)
      if (p.category)             setCat(p.category)
      if (p.brand && !brand)      setBrand(p.brand)
      if (p.notes && !desc)       setDesc(p.notes)
      if (p.description)          setAiText(p.description)
      if (p.colors?.length) {
        const matched = p.colors
          .map(ac => COLORS.find(c =>
            c.n.toLowerCase() === ac.toLowerCase() ||
            ac.toLowerCase().includes(c.n.toLowerCase())
          ))
          .filter(Boolean)
          .map(c => c.n)
        setColors(prev => [...new Set([...prev, ...matched])])
      }
      if (p.tags?.length) {
        setTags(prev => [...new Set([...prev, ...p.tags])])
      }
      toast('AI analysis complete!', 'success')
    } catch (e) {
      setAiText('Analysis failed — fill in manually. (' + e.message.slice(0, 80) + ')')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Save
  async function handleSave() {
    if (!name.trim()) { toast('Please enter a name', 'error'); return }
    if (!cat)         { toast('Please select a category', 'error'); return }
    setSaving(true)

    let drivePhotoUrl = editItem?.drivePhotoUrl || null
    let driveThumb    = editItem?.driveThumb    || null
    let fileId        = editItem?.fileId        || null

    if (photoB64 && token) {
      const dr = await uploadToDrive(photoB64, photoMime, name.trim(), token)
      if (dr) { drivePhotoUrl = dr.viewUrl; driveThumb = dr.directUrl; fileId = dr.fileId }
    }

    const saved = {
      id:          editItem?.id || 'wc' + Date.now(),
      name:        name.trim(),
      category:    cat,
      group, brand, location, size,
      colors, tags,
      description: desc,
      photo,
      drivePhotoUrl, driveThumb, fileId,
      sheetSynced: false,
      addedAt:     editItem?.addedAt || new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    }
    setSaving(false)
    onSave(saved)
  }

  // ── Tag input
  function onTagKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const v = tagInput.trim().replace(',', '')
      if (v && !tags.includes(v)) setTags(prev => [...prev, v])
      setTagInput('')
    }
  }
  function removeTag(t)   { setTags(prev => prev.filter(x => x !== t)) }
  function toggleColor(n) { setColors(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]) }

  const showShoes = cat === 'Shoes'

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Item' : 'Add New Item'}</div>
          <button className="ib" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Photo */}
          <div className="fg">
            <label className="fl">Photo</label>
            <div
              className={`pzone ${photo ? 'has-photo' : ''}`}
              onClick={!photo ? () => galRef.current.click() : undefined}
            >
              {photo ? (
                <>
                  <img src={photo} alt="item" />
                  {analyzing && (
                    <div className="pzone-loading">
                      <div className="big-spin" />
                      <p style={{ fontSize: 12, color: 'var(--ink2)' }}>Analyzing with AI…</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, opacity: .35 }}>📷</div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)' }}>Tap to choose a photo — AI fills details automatically</div>
                </>
              )}
            </div>
            <div className="pa" style={{ marginTop: 8, display: 'flex', gap: 7 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => camRef.current.click()}>📷 Camera</button>
              <button className="btn btn-secondary btn-sm" onClick={() => galRef.current.click()}>🖼 Gallery</button>
              {photo && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setPhoto(null); setPhotoB64(null) }}>✕ Remove</button>
              )}
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onPhotoSelected} />
            <input ref={galRef} type="file" accept="image/*"                       onChange={onPhotoSelected} />
          </div>

          {/* AI result */}
          {showAI && (
            <div className="fg">
              <div className="ai-box">
                <div className="ai-label">✦ AI Analysis</div>
                <div className="ai-text">
                  {analyzing
                    ? <div className="ai-loading"><div className="spinner" />&nbsp;Analyzing your item…</div>
                    : aiText || 'Analysis complete.'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Group + Category */}
          <div className="form-row">
            <div className="fg">
              <label className="fl">Closet Group</label>
              <select className="fi" value={group} onChange={e => setGroup(e.target.value)}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Category</label>
              <select className="fi" value={cat} onChange={e => setCat(e.target.value)}>
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Name */}
          <div className="fg">
            <label className="fl">Item Name</label>
            <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. White Oxford Shirt" />
          </div>

          {/* Brand + Location */}
          <div className="form-row">
            <div className="fg">
              <label className="fl">Brand</label>
              <input className="fi" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Nike, Zara…" />
            </div>
            <div className="fg">
              <label className="fl">Location</label>
              <select className="fi" value={location} onChange={e => setLocation(e.target.value)}>
                <option value="">Select location…</option>
                {locations.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Size */}
          <div className="fg">
            <label className="fl">Size</label>
            <div className="size-wrap">
              {(showShoes ? SIZES_SHOES : SIZES_CLOTHES).map(s => (
                <button
                  key={s}
                  className={`sp ${size === s ? 'sel' : ''}`}
                  onClick={() => setSize(prev => prev === s ? '' : s)}
                >{s}</button>
              ))}
            </div>
            <input
              className="fi"
              style={{ marginTop: 7 }}
              value={!SIZES_CLOTHES.includes(size) && !SIZES_SHOES.includes(size) ? size : ''}
              onChange={e => setSize(e.target.value)}
              placeholder="Or type custom size…"
            />
          </div>

          {/* Colors */}
          <div className="fg">
            <label className="fl">Colors</label>
            <div className="color-wrap">
              {COLORS.map(c => (
                <div
                  key={c.n}
                  className={`csw ${colors.includes(c.n) ? 'sel' : ''}`}
                  title={c.n}
                  style={{ background: c.h }}
                  onClick={() => toggleColor(c.n)}
                />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="fg">
            <label className="fl">Tags</label>
            <div className="tags-wrap" onClick={() => document.getElementById('tag-input-field').focus()}>
              {tags.map(t => (
                <div key={t} className="tag-item">
                  {t}
                  <button className="tag-rm" onClick={() => removeTag(t)}>×</button>
                </div>
              ))}
              <input
                id="tag-input-field"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={onTagKey}
                placeholder="Type tag, press Enter…"
              />
            </div>
            <div className="sug-tags" style={{ marginTop: 5 }}>
              {TAGS_SUGGEST.filter(t => !tags.includes(t)).map(t => (
                <button
                  key={t}
                  className="chip"
                  style={{ fontSize: 10, cursor: 'pointer' }}
                  onClick={() => setTags(prev => [...prev, t])}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="fg">
            <label className="fl">Notes / Description</label>
            <textarea
              className="fi"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Brand, condition, styling notes…"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
