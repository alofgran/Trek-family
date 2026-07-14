import { TravelerAvatar } from '../Travelers/TravelerAvatar'
import type { PackingState } from './usePackingListPanel'

export function PackingFilterTabs({ items, filter, setFilter, travelerFilter, setTravelerFilter, groupBy, setGroupBy, tripTravelers, t }: PackingState) {
  if (items.length === 0) return null
  const btnStyle = (active: boolean, color?: string) => ({
    padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
    fontSize: 12, fontFamily: 'inherit', fontWeight: active ? 600 : 400,
    background: active ? (color || 'var(--text-primary)') : 'transparent',
    color: active ? (color ? '#fff' : 'var(--bg-primary)') : 'var(--text-muted)',
  })
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 4, padding: '10px 0 0', flexWrap: 'wrap', alignItems: 'center' }}>
        {[['alle', t('packing.filterAllStatuses')], ['offen', t('packing.filterOpen')], ['erledigt', t('packing.filterDone')]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={btnStyle(filter === id)}>{label}</button>
        ))}
        {tripTravelers.length > 0 && (
          <>
            <span style={{ width: 1, height: 16, background: 'var(--border-secondary)', margin: '0 4px', flexShrink: 0 }} />
            {(['category', 'traveler'] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)} style={btnStyle(groupBy === g)}>
                {g === 'category' ? t('packing.groupByCategory') : t('packing.groupByTraveler')}
              </button>
            ))}
          </>
        )}
      </div>
      {tripTravelers.length > 0 && groupBy === 'category' && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 0 0', flexWrap: 'wrap' }}>
          <button
            onClick={() => setTravelerFilter(null)}
            style={btnStyle(travelerFilter === null)}
          >
            {t('packing.filterAllTravelers')}
          </button>
          {tripTravelers.map(traveler => (
            <button
              key={traveler.id}
              onClick={() => setTravelerFilter(travelerFilter === traveler.id ? null : traveler.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px 3px 4px', borderRadius: 99, border: 'none', cursor: 'pointer',
                fontSize: 11, fontFamily: 'inherit',
                background: travelerFilter === traveler.id ? (traveler.color || '#6366f1') : 'transparent',
                color: travelerFilter === traveler.id ? '#fff' : 'var(--text-muted)',
              }}
            >
              <TravelerAvatar traveler={traveler} size={16} />
              {traveler.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
