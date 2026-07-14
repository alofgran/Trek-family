import { useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import type { PackingItem } from '../../types'
import { TravelerAvatar } from '../Travelers/TravelerAvatar'
import { TravelerQtyChip } from './PackingListPanelTravelerChip'

interface MergedRowProps {
  name: string
  items: PackingItem[]
  tripId: number
  onDelete: (items: PackingItem[]) => Promise<void>
  onDeleteItem?: (item: PackingItem) => Promise<void>
  canEdit?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  isDragging?: boolean
  isDropTarget?: boolean
}

export function MergedRow({ name, items, tripId, onDelete, onDeleteItem, canEdit = true, draggable: isDraggable, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDropTarget }: MergedRowProps) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(name)
  const [showAddTraveler, setShowAddTraveler] = useState(false)
  const { togglePackingItem, updatePackingItem, addPackingItem } = useTripStore()
  const tripTravelers = useTripStore(s => s.tripTravelers)
  const toast = useToast()
  const { t } = useTranslation()

  const setQty = async (item: PackingItem, qty: number) => {
    const clamped = Math.max(1, Math.min(999, qty))
    if (clamped === (item.quantity || 1)) return
    try { await updatePackingItem(tripId, item.id, { quantity: clamped }) } catch { toast.error(t('packing.toast.saveError')) }
  }

  const assignedTravelerIds = new Set(items.map(i => (i as any).traveler_id).filter(Boolean))
  const availableTravelers = tripTravelers.filter(tr => !assignedTravelerIds.has(tr.id))

  const handleAddTraveler = async (travelerId: number) => {
    setShowAddTraveler(false)
    try {
      const newItem = await addPackingItem(tripId, { name: items[0].name, category: items[0].category || '' })
      if (newItem) await updatePackingItem(tripId, newItem.id, { traveler_id: travelerId } as any)
    } catch {
      toast.error(t('packing.toast.saveError'))
    }
  }

  const handleSaveName = async () => {
    const newName = editName.trim()
    if (!newName || newName === name) { setEditing(false); setEditName(name); return }
    for (const item of items) {
      try { await updatePackingItem(tripId, item.id, { name: newName }) } catch {}
    }
    setEditing(false)
  }

  return (
    <div
      className="group"
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowAddTraveler(false) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', borderRadius: 10, position: 'relative',
        background: isDragging ? 'var(--bg-tertiary)' : hovered ? 'var(--bg-secondary)' : 'transparent',
        opacity: isDragging ? 0.35 : 1,
        transition: 'background 0.1s, opacity 0.1s',
        borderTop: isDropTarget ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      {isDraggable && (
        <span style={{ flexShrink: 0, color: 'var(--text-faint)', cursor: 'grab', display: 'flex', opacity: hovered ? 1 : 0, transition: 'opacity 0.1s' }}>
          <GripVertical size={14} />
        </span>
      )}

      {/* Item name — left-aligned, shrinks before chips */}
      {editing && canEdit ? (
        <input
          type="text" value={editName} autoFocus
          onChange={e => setEditName(e.target.value)}
          onBlur={handleSaveName}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditing(false); setEditName(name) } }}
          style={{ flex: '0 1 auto', minWidth: 80, fontSize: 13.5, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border-primary)', outline: 'none', fontFamily: 'inherit' }}
        />
      ) : (
        <span
          onClick={() => canEdit && setEditing(true)}
          style={{
            flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: 13.5, cursor: canEdit ? 'text' : 'default',
            color: 'var(--text-primary)', transition: 'color 200ms',
          }}
        >
          {name}
        </span>
      )}

      {/* Spacer — pushes chips to the right */}
      <span style={{ flex: 1 }} />

      {/* Per-traveler chips + add-traveler button — right-aligned */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
        {items.map(item => {
          const traveler = tripTravelers.find(tr => tr.id === (item as any).traveler_id)
          if (!traveler) return null
          return (
            <TravelerQtyChip
              key={item.id}
              traveler={traveler}
              quantity={item.quantity || 1}
              checked={!!item.checked}
              canEdit={canEdit}
              onToggleChecked={async () => { try { await togglePackingItem(tripId, item.id, !item.checked) } catch { toast.error(t('packing.toast.saveError')) } }}
              onQtyChange={qty => setQty(item, qty)}
              onRemove={onDeleteItem ? () => onDeleteItem(item) : undefined}
            />
          )
        })}

        {/* Add traveler to this item */}
        {canEdit && availableTravelers.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setShowAddTraveler(v => !v) }}
              title={t('travelers.assign')}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                border: '1.5px dashed var(--border-primary)',
                background: 'none', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-faint)', padding: 0, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-faint)' }}
            >
              <Plus size={11} />
            </button>
            {showAddTraveler && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 60,
                background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 4, minWidth: 150,
              }}>
                {availableTravelers.map(traveler => (
                  <button
                    key={traveler.id}
                    onClick={() => handleAddTraveler(traveler.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                      padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontFamily: 'inherit', color: 'var(--text-secondary)', borderRadius: 7,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <TravelerAvatar traveler={traveler} size={14} />
                    {traveler.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete all */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => onDelete(items)}
            title={t('common.deleteAll') || 'Delete all'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 6, display: 'flex', alignItems: 'center', color: 'var(--text-faint)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
