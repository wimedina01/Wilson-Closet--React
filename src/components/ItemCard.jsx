import { memo } from 'react'
import DriveImage from './DriveImage.jsx'
import { COLORS } from '../lib/constants.js'

function ColorPips({ colors, max = 4 }) {
  return (
    <div className="cpips">
      {colors.slice(0, max).map(name => {
        const col = COLORS.find(c => c.n === name)
        return col ? <div key={name} className="pip" title={name} style={{ background: col.h }} /> : null
      })}
    </div>
  )
}

export default memo(function ItemCard({ item, onSelect, view, index, token }) {
  if (view === 'list') {
    return (
      <div className="lcard" style={{ animationDelay: `${Math.min(index * .03, .6)}s` }} onClick={() => onSelect(item)}>
        <DriveImage item={item} token={token} className="lt" style={{ fontSize: 20 }} />
        <div className="lb">
          <div className="ln">{item.name}</div>
          <div className="lm">
            <span>{item.category}</span>
            {item.brand    && <span>· {item.brand}</span>}
            {item.size     && <span>· {item.size}</span>}
            {item.loanedTo && <span style={{ color: 'var(--gold)' }}>· 📤 {item.loanedTo}</span>}
          </div>
        </div>
        <ColorPips colors={item.colors} max={3} />
        {!item.sheetSynced && (
          <div title="Not synced" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ animationDelay: `${Math.min(index * .035, .6)}s` }} onClick={() => onSelect(item)}>
      <DriveImage item={item} token={token} className="card-img" style={{ fontSize: 44 }} />
      {item.loanedTo && <div className="loan-badge">📤 On Loan</div>}
      {item.drivePhotoUrl && <div className="cdot" title="Synced to Drive" />}
      <div className="card-body">
        <div className="ccat">{item.category}{item.brand ? ` · ${item.brand}` : ''}</div>
        <div className="cname">{item.name}</div>
        <div className="cmeta">
          <div className="csz">{item.size || '—'}</div>
          <ColorPips colors={item.colors} />
        </div>
        {item.tags.length > 0 && (
          <div className="ctags">
            {item.tags.slice(0, 2).map(t => <span key={t} className="tp">{t}</span>)}
          </div>
        )}
      </div>
    </div>
  )
})
