import { useState, useRef } from 'react'
import { COLORS, TAGS_SUGGEST, CATEGORIES,
         SIZES_ADULT_CLOTHES, SIZES_KIDS_CLOTHES,
         SIZES_ADULT_SHOES,   SIZES_KIDS_SHOES } from '../lib/constants.js'
import { compressPhoto, uploadToDrive } from '../lib/drive.js'

export default function AddItemModal({ item: editItem, groups, locations, token, onSave, onClose, toast }) {
  const isEdit = !!editItem

  const [name,     setName]     = useState(editItem?.name        || '')
  const [cat,      setCat]      = useState(editItem?.category    || '')
  const [group,    setGroup]    = useState(editItem?.group       || groups[0]?.id || '')
  const [brand,    setBrand]    = useState(editItem?.brand       || '')
  const [location, setLocation] = useState(editItem?.location    || '')
  const [size,     setSize]     = useState(editItem?.size        || '')
  const [sizeType, setSizeType] = useState('adult')  // 'adult' | 'kids' | 'infant'
  const [colors,   setColors]   = useState(editItem?.colors      || [])
  const [tags,     setTags]     = useState(editItem?.tags        || [])
  const [desc,     setDesc]     = useState(editItem?.description || '')
  const [tagInput, setTagInput] = useState('')
  const [loanedTo, setLoanedTo] = useState(editItem?.loanedTo   || '')

  const [photo,    setPhoto]    = useState(editItem?.photo || null)
  const [photoB64, setPhotoB64] = useState(null)
  const [photoMime,setPhotoMime]= useState('image/jpeg')
  const [analyzing,setAnalyzing]= useState(false)
  const [aiText,   setAiText]   = useState(editItem?.description || '')
  const [showAI,   setShowAI]   = useState(!!editItem?.description)
  const [saving,   setSaving]   = useState(false)
  const [aiFailed, setAiFailed] = useState(false)

  const camRef = useRef(); const galRef = useRef()

  async function onPhotoSelected(e) {
    const file = e.target.files[0]; if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async evt => {
      const { dataUrl, b64, mime } = await compressPhoto(evt.target.result)
      setPhoto(dataUrl); setPhotoB64(b64); setPhotoMime(mime)
      setShowAI(true); setAiText(''); setAiFailed(false)
      analyze(b64, mime)
    }
    reader.readAsDataURL(file)
  }

  async function analyze(b64, mime) {
    setAnalyzing(true); setAiText('Analyzing…'); setAiFailed(false)
    try {
      const res = await fetch('/.netlify/functions/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text',  text: 'Analyze this clothing or shoe item. Also try to identify the brand by examining logos, tags, or distinctive design elements. Respond with ONLY a raw JSON object:\n{"name":"4-6 word name","category":"Tops","brand":"identified brand or empty string","colors":["Black"],"description":"brief description","tags":["Casual"],"notes":""}' },
        ]}] }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const d = await res.json()
      if (d.error) throw new Error(d.error.message)
      const raw = d.content.map(i => i.text || '').join('').trim()
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON')
      const p = JSON.parse(match[0])

      if (p.name && !name)        setName(p.name)
      if (p.category)             setCat(p.category)
      if (p.brand && !brand)      setBrand(p.brand)
      if (p.notes && !desc)       setDesc(p.notes)
      if (p.description)          setAiText(p.description)
      if (p.colors?.length) {
        const matched = p.colors
          .map(ac => COLORS.find(c => c.n.toLowerCase() === ac.toLowerCase() || ac.toLowerCase().includes(c.n.toLowerCase())))
          .filter(Boolean).map(c => c.n)
        setColors(prev => [...new Set([...prev, ...matched])])
      }
      if (p.tags?.length) setTags(prev => [...new Set([...prev, ...p.tags])])

      toast('AI analysis complete!', 'success')
    } catch (e) {
      setAiFailed(true)
      setAiText('Analysis failed — fill in manually. (' + e.message.slice(0, 80) + ')')
    } finally { setAnalyzing(false) }
  }

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

    onSave({
      id: editItem?.id || 'wc' + Date.now(),
      name: name.trim(), category: cat,
      group, brand, location, size, loanedTo,
      colors, tags, description: desc,
      photo, drivePhotoUrl, driveThumb, fileId,
      sheetSynced: false,
      addedAt:   editItem?.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
  }

  function onTagKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const v = tagInput.trim().replace(',', '')
      if (v && !tags.includes(v)) setTags(prev => [...prev, v])
      setTagInput('')
    }
  }

  const isShoes = cat === 'Shoes'
  const sizeOptions = isShoes
    ? (sizeType === 'adult' ? SIZES_ADULT_SHOES : SIZES_KIDS_SHOES)
    : (sizeType === 'adult' ? SIZES_ADULT_CLOTHES : SIZES_KIDS_CLOTHES)

  const predefinedSizes = [...SIZES_ADULT_CLOTHES, ...SIZES_KIDS_CLOTHES, ...SIZES_ADULT_SHOES, ...SIZES_KIDS_SHOES]

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">{isEdit ? '✏️ Edit Item' : '＋ Add Item'}</div>
          <button className="ib" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Photo */}
          <div className="fg">
            <label className="fl">Photo</label>
            <div className={`pzone ${photo ? 'has-photo' : ''}`} onClick={!photo ? () => galRef.current.click() : undefined}>
              {photo ? (
                <>
                  <img src={photo} alt="item" />
                  {analyzing && <div className="pzone-loading"><div className="big-spin" /><p style={{ fontSize: 11, color: 'var(--ink2)' }}>AI analyzing…</p></div>}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, opacity: .3 }}>📷</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Tap to choose photo — AI fills details</div>
                </>
              )}
            </div>
            <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => camRef.current.click()}>📷 Camera</button>
              <button className="btn btn-secondary btn-sm" onClick={() => galRef.current.click()}>🖼 Gallery</button>
              {photo && <button className="btn btn-ghost btn-sm" onClick={() => { setPhoto(null); setPhotoB64(null) }}>✕ Remove</button>}
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onPhotoSelected} />
            <input ref={galRef} type="file" accept="image/*" onChange={onPhotoSelected} />
          </div>

          {/* AI result */}
          {showAI && (
            <div className="fg">
              <div className="ai-box">
                <div className="ai-label">✦ AI Analysis</div>
                <div className="ai-text">
                  {analyzing ? <div className="ai-loading"><div className="spinner" />&nbsp;Analyzing…</div> : (aiText || 'Analysis complete.')}
                </div>
                {aiFailed && !analyzing && photoB64 && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}
                    onClick={() => analyze(photoB64, photoMime)}>
                    🔄 Retry AI Analysis
                  </button>
                )}
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
                <option value="">Select…</option>
                {locations.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Size — adult / kids toggle */}
          <div className="fg">
            <label className="fl">Size</label>
            {/* Size type toggle */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
              {['adult','kids'].map(t => (
                <button key={t} className={`btn btn-sm ${sizeType===t?'btn-primary':'btn-secondary'}`}
                  onClick={() => { setSizeType(t); setSize('') }}>
                  {t === 'adult' ? '👤 Adult' : '👶 Kids / Toddler'}
                </button>
              ))}
            </div>
            <div className="size-wrap">
              {sizeOptions.map(s => (
                <button key={s} className={`sp ${size===s?'sel':''}`}
                  onClick={() => setSize(prev => prev===s?'':s)}>{s}</button>
              ))}
            </div>
            <input className="fi" style={{ marginTop: 7 }}
              value={!predefinedSizes.includes(size) ? size : ''}
              onChange={e => setSize(e.target.value)}
              placeholder="Or type custom size…" />
          </div>

          {/* Colors */}
          <div className="fg">
            <label className="fl">Colors</label>
            <div className="color-wrap">
              {COLORS.map(c => (
                <div key={c.n} className={`csw ${colors.includes(c.n)?'sel':''}`}
                  title={c.n} style={{ background: c.h }}
                  onClick={() => setColors(prev => prev.includes(c.n) ? prev.filter(x=>x!==c.n) : [...prev, c.n])} />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="fg">
            <label className="fl">Tags</label>
            <div className="tags-wrap" onClick={() => document.getElementById('tag-input').focus()}>
              {tags.map(t => (
                <div key={t} className="tag-item">{t}
                  <button className="tag-rm" onClick={() => setTags(p=>p.filter(x=>x!==t))}>×</button>
                </div>
              ))}
              <input id="tag-input" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={onTagKey} placeholder="Type, press Enter…" />
            </div>
            <div className="sug-tags">
              {TAGS_SUGGEST.filter(t=>!tags.includes(t)).map(t=>(
                <button key={t} className="chip" style={{ fontSize: 9 }} onClick={()=>setTags(p=>[...p,t])}>{t}</button>
              ))}
            </div>
          </div>

          {/* Loaned to */}
          <div className="fg">
            <label className="fl">On Loan To (optional)</label>
            <input className="fi" value={loanedTo} onChange={e=>setLoanedTo(e.target.value)} placeholder="Name of person borrowing this item…" />
          </div>

          {/* Description */}
          <div className="fg">
            <label className="fl">Notes / Description</label>
            <textarea className="fi" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Condition, styling notes…" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
