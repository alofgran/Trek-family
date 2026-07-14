import { useTripStore } from '../../store/tripStore'
import { TravelerAvatar } from './TravelerAvatar'
import { useTranslation } from '../../i18n'

interface TravelerSelectorProps {
  tripId: number
  value: number[]
  onChange: (ids: number[]) => void
  required?: boolean
  singleSelect?: boolean
}

export function TravelerSelector({ value, onChange, required, singleSelect }: TravelerSelectorProps) {
  const { t } = useTranslation()
  const tripTravelers = useTripStore(s => s.tripTravelers)

  function toggle(id: number) {
    if (singleSelect) {
      onChange(value.includes(id) ? [] : [id])
      return
    }
    if (value.includes(id)) {
      if (required && value.length === 1) return
      onChange(value.filter(v => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  if (tripTravelers.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-text-muted, #888)', margin: '8px 0' }}>
        {t('travelers.noTravelersOnTrip')}
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {tripTravelers.map(traveler => {
        const selected = value.includes(traveler.id)
        return (
          <button
            key={traveler.id}
            type="button"
            onClick={() => toggle(traveler.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px 4px 6px', borderRadius: 999,
              border: `2px solid ${selected ? (traveler.color || '#6366f1') : 'transparent'}`,
              background: selected ? `${traveler.color || '#6366f1'}22` : 'var(--color-bg-subtle, #f3f4f6)',
              cursor: 'pointer', fontSize: 13, fontWeight: selected ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            <TravelerAvatar traveler={traveler} size={22} />
            {traveler.name}
          </button>
        )
      })}
    </div>
  )
}
