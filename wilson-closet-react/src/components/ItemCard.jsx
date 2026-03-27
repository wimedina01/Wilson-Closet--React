import DriveImage from './DriveImage.jsx'
import { COLORS, CAT_EMOJI } from '../lib/constants.js'

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

export default function ItemCard({ item, onSelect, view, index, token }) {
  if (view === 'list') {
    return (
      <div
        className="lcard"
        style={{ animationDelay: `${index * 0.03}s` }}
        onClick={() => onSelect(item)}
      >
        {/* List thumbnail — 48×48 */}
        <DriveImage
          item={item}
          token={token}
          className="lt"
          style={{ fontSize: 22 }}
        />
        <div className="lb">
          <div className="ln">{item.name}</div>
          <div className="lm">
            <span>{item.category}</span>
            {item.brand    && <span>· {item.brand}</span>}
            {item.size     && <span>· Size {item.size}</span>}
            {item.location && <span>· {item.location}</span>}
          </div>
        </div>
        <ColorPips colors={item.colors} max={3} />
        {!item.sheetSynced && (
          <div
            title="Not yet synced to Google Sheets"
            style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className="card"
      style={{ animationDelay: `${index * 0.035}s` }}
      onClick={() => onSelect(item)}
    >
      {/* Square photo — aspect-ratio:1 */}
      <DriveImage
        item={item}
        token={token}
        className="card-img"
        style={{ fontSize: 44 }}
      />

      {/* Synced dot */}
      {item.drivePhotoUrl && (
        <div className="cdot" title="Photo synced to Drive" />
      )}

      <div className="card-body">
        <div className="ccat">
          {item.category}{item.brand ? ` · ${item.brand}` : ''}
        </div>
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
}
