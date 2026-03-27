import { useState } from 'react'
import { GROUP_EMOJIS, GROUP_COLORS } from '../lib/constants.js'

const COLOR_HEX = { gc1:'#8B7CF6',gc2:'#34D399',gc3:'#F0B429',gc4:'#F87171',gc5:'#60A5FA',gc6:'#FB923C',gc7:'#A78BFA' }

export default function GroupModal({ onSave, onClose }) {
  const [name,  setName]  = useState('')
  const [emoji, setEmoji] = useState('👔')
  const [color, setColor] = useState('gc1')

  function handleSave() {
    if (!name.trim()) return
    onSave({ id: 'g' + Date.now(), name: name.trim(), emoji, color })
    onClose()
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '70vh' }}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">New Closet Group</div>
          <button className="ib" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="fg">
            <label className="fl">Group Name</label>
            <input
              className="fi"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My Closet, Son's Closet…"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <div className="fg">
            <label className="fl">Emoji</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {GROUP_EMOJIS.map(e => (
                <button
                  key={e}
                  className={`sp ${emoji === e ? 'sel' : ''}`}
                  onClick={() => setEmoji(e)}
                >{e}</button>
              ))}
            </div>
          </div>
          <div className="fg">
            <label className="fl">Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GROUP_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: COLOR_HEX[c], border: 'none', cursor: 'pointer',
                    outline: color === c ? '3px solid var(--ink)' : '3px solid transparent',
                    outlineOffset: 2, transition: 'outline .15s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleSave}
            disabled={!name.trim()}
          >Create Group</button>
        </div>
      </div>
    </div>
  )
}
