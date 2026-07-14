import type { TripTraveler, Traveler } from '../../types'

interface TravelerAvatarProps {
  traveler: Pick<Traveler | TripTraveler, 'name' | 'avatar' | 'color'>
  size?: number
}

export function TravelerAvatar({ traveler, size = 32 }: TravelerAvatarProps) {
  const bg = traveler.color || '#6366f1'
  const initial = traveler.name?.charAt(0)?.toUpperCase() || '?'

  return (
    <div
      title={traveler.name}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: bg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.45, fontWeight: 600, flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {traveler.avatar || initial}
    </div>
  )
}
