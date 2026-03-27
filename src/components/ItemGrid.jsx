import { useState, useMemo } from 'react'
import ItemCard from './ItemCard.jsx'
import { CATEGORIES, CAT_EMOJI, SIZES_ADULT_CLOTHES } from '../lib/constants.js'

export default function ItemGrid({ items, groups, token, activeGroup, onSelectItem }) {
  const [query,      setQuery]      = useState('')
  const [activeCat,  setActiveCat]  = useState('all')
  const [activeSize, setActiveSize] = useState('all')
  const [view,       setView]       = useState('grid')

  // Collect all unique sizes from items for dynamic filter
  const availableSizes = useMemo(() => {
    const sizeSet = new Set()
    items.forEach(item => {
      if (item.size) sizeSet.add(item.size)
    })
    // Sort: common clothing sizes first, then numeric, then rest
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size']
    return Array.from(sizeSet).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      const na = parseFloat(a), nb = parseFloat(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b)
    })
  }, [items])

  const filtered = useMemo(() => items.filter(item => {
    const gm = activeGroup === 'all' || item.group === activeGroup
    const cm = activeCat  === 'all' || item.category === activeCat
    const sz = activeSize === 'all' || item.size === activeSize
    const q  = query.toLowerCase()
    const sm = !q
      || item.name.toLowerCase().includes(q)
      || (item.brand || '').toLowerCase().includes(q)
      || item.category.toLowerCase().includes(q)
      || item.colors.some(c => c.toLowerCase().includes(q))
      || item.tags.some(t => t.toLowerCase().includes(q))
    return gm && cm && sz && sm
  }), [items, activeGroup, activeCat, activeSize, query])

  const hasActiveFilters = query || activeCat !== 'all' || activeSize !== 'all'

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

        {/* Size filter row */}
        {availableSizes.length > 0 && (
          <div className="filter-row" style={{ marginTop: 2 }}>
            <button
              className={`chip ${activeSize === 'all' ? 'active' : ''}`}
              onClick={() => setActiveSize('all')}
              style={{ fontSize: 10 }}
            >
              All Sizes
            </button>
            {availableSizes.map(sz => (
              <button
                key={sz}
                className={`chip ${activeSize === sz ? 'active' : ''}`}
                onClick={() => setActiveSize(prev => prev === sz ? 'all' : sz)}
                style={{ fontSize: 10 }}
              >
                {sz}
              </button>
            ))}
          </div>
        )}

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
            {hasActiveFilters && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => { setQuery(''); setActiveCat('all'); setActiveSize('all') }}
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
