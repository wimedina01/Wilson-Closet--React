import { useState, useMemo } from 'react'
import ItemCard from './ItemCard.jsx'
import { CATEGORIES, CAT_EMOJI } from '../lib/constants.js'

export default function ItemGrid({ items, groups, token, activeGroup, onSelectItem }) {
  const [query,     setQuery]     = useState('')
  const [activeCat, setActiveCat] = useState('all')
  const [view,      setView]      = useState('grid')

  const filtered = useMemo(() => items.filter(item => {
    const gm = activeGroup === 'all' || item.group === activeGroup
    const cm = activeCat  === 'all' || item.category === activeCat
    const q  = query.toLowerCase()
    const sm = !q
      || item.name.toLowerCase().includes(q)
      || (item.brand || '').toLowerCase().includes(q)
      || item.category.toLowerCase().includes(q)
      || (item.colors || []).some(c => c.toLowerCase().includes(q))
      || (item.tags || []).some(t => t.toLowerCase().includes(q))
    return gm && cm && sm
  }), [items, activeGroup, activeCat, query])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <span className="si" style={{ color: 'var(--ink3)', fontSize: 14 }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search items, brands, colors…"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: 16 }}
            >×</button>
          )}
        </div>

        <div className="filter-row">
          {['all', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              className={`chip ${activeCat === cat ? 'active' : ''}`}
              onClick={() => setActiveCat(cat)}
            >
              {cat === 'all' ? '✦ All' : `${CAT_EMOJI[cat]} ${cat}`}
            </button>
          ))}
        </div>

        <div className="view-toggle">
          <button className={`vb ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>⊞</button>
          <button className={`vb ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>≡</button>
        </div>
      </div>

      {/* Content */}
      <div className="cs">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👗</div>
            <div className="empty-title">
              {items.length === 0 ? 'Your wardrobe is empty' : 'No items found'}
            </div>
            <div className="empty-sub">
              {items.length === 0
                ? 'Add your first item. Take a photo — AI fills everything automatically.'
                : 'Try a different search or category.'}
            </div>
            {(query || activeCat !== 'all') && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => { setQuery(''); setActiveCat('all') }}
              >Clear filters</button>
            )}
          </div>
        ) : (
          <div className={view === 'grid' ? 'item-grid' : 'item-list'}>
            {filtered.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelectItem}
                view={view}
                index={i}
                token={token}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
