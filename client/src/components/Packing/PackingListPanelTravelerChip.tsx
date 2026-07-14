import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { TravelerAvatar } from '../Travelers/TravelerAvatar'
import type { TripTraveler } from '../../types'

interface TravelerQtyChipProps {
  traveler: TripTraveler
  quantity: number
  checked: boolean
  canEdit: boolean
  onToggleChecked: () => void
  onQtyChange: (qty: number) => void
  onRemove?: () => void
}

// Shared by MergedRow (one chip per traveler on a shared item) and ArtikelZeile
// (one chip for the item's single assigned traveler) so both hover the same way:
// avatar toggles checked, quantity reveals +/- on hover, and a remove-x appears
// on chip hover (only if onRemove is provided).
export function TravelerQtyChip({ traveler, quantity, checked, canEdit, onToggleChecked, onQtyChange, onRemove }: TravelerQtyChipProps) {
  const [chipHovered, setChipHovered] = useState(false)
  const { t } = useTranslation()

  return (
    <div
      onMouseEnter={() => setChipHovered(true)}
      onMouseLeave={() => setChipHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', borderRadius: 99,
        border: `1.5px solid ${checked ? (traveler.color || '#10b981') : 'var(--border-primary)'}`,
        background: checked ? `${traveler.color || '#10b981'}20` : 'transparent',
        transition: 'all 0.15s',
      }}
    >
      <button
        onClick={onToggleChecked}
        title={traveler.name}
        style={{
          display: 'flex', alignItems: 'center', padding: '2px 4px 2px 3px', borderRadius: 99,
          border: 'none', background: 'none', cursor: 'pointer', gap: 4,
        }}
      >
        <TravelerAvatar traveler={traveler} size={18} />
        {checked && <span style={{ fontSize: 11, color: traveler.color || '#10b981', fontWeight: 700 }}>✓</span>}
      </button>

      {/* Quantity — number always visible, +/- appear while any part of the chip is
          hovered (not a narrower inner region — a smaller hover target here would
          collapse the buttons mid-move as the cursor crosses toward the avatar). */}
      {canEdit ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 5 }}>
          {chipHovered && (
            <button
              onClick={() => onQtyChange(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              title={t('packing.decreaseQuantity')}
              style={{
                width: 18, height: 18, borderRadius: 5, border: 'none',
                background: 'var(--bg-tertiary)', color: quantity <= 1 ? 'var(--text-faint)' : 'var(--text-secondary)',
                cursor: quantity <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, padding: 0, lineHeight: 1,
              }}
            >
              −
            </button>
          )}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 14, textAlign: 'center' }}>{quantity}</span>
          {chipHovered && (
            <button
              onClick={() => onQtyChange(Math.min(999, quantity + 1))}
              disabled={quantity >= 999}
              title={t('packing.increaseQuantity')}
              style={{
                width: 18, height: 18, borderRadius: 5, border: 'none',
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, padding: 0, lineHeight: 1,
              }}
            >
              +
            </button>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-faint)', paddingRight: 7 }}>{quantity}</span>
      )}

      {/* Remove — appears on chip hover */}
      {canEdit && onRemove && chipHovered && (
        <button
          onClick={onRemove}
          title={t('common.delete')}
          style={{
            width: 16, height: 16, borderRadius: '50%', border: 'none', marginRight: 3,
            background: 'none', color: 'var(--text-faint)', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
        >
          <X size={11} />
        </button>
      )}
    </div>
  )
}
