import { useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import {
  Trash2, Plus, Package, GripVertical,
} from 'lucide-react'
import type { PackingItem, PackingBag } from '../../types'
import { PACKING_PLACEHOLDER_NAME } from './packingListPanel.constants'
import { QuantityInput } from './PackingListPanelQuantityInput'
import { TravelerAvatar } from '../Travelers/TravelerAvatar'
import { TravelerQtyChip } from './PackingListPanelTravelerChip'

interface ArtikelZeileProps {
  item: PackingItem
  tripId: number
  onDelete?: (item: PackingItem) => Promise<void>
  bagTrackingEnabled?: boolean
  bags?: PackingBag[]
  onCreateBag: (name: string) => Promise<PackingBag | undefined>
  canEdit?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  isDragging?: boolean
  isDropTarget?: boolean
}

export function ArtikelZeile({ item, tripId, onDelete, bagTrackingEnabled, bags = [], onCreateBag, canEdit = true, draggable: isDraggable, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDropTarget }: ArtikelZeileProps) {
  const isPlaceholder = item.name === PACKING_PLACEHOLDER_NAME
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(isPlaceholder ? '' : item.name)
  const [hovered, setHovered] = useState(false)
  const [showBagPicker, setShowBagPicker] = useState(false)
  const [showTravelerPicker, setShowTravelerPicker] = useState(false)
  const [bagInlineCreate, setBagInlineCreate] = useState(false)
  const [bagInlineName, setBagInlineName] = useState('')
  const { togglePackingItem, updatePackingItem, deletePackingItem, addPackingItem } = useTripStore()
  const tripTravelers = useTripStore(s => s.tripTravelers)
  const toast = useToast()
  const { t } = useTranslation()

  const itemTraveler = (item as any).traveler_id
    ? tripTravelers.find(t => t.id === (item as any).traveler_id)
    : null

  const availableTravelers = itemTraveler ? tripTravelers.filter(tr => tr.id !== itemTraveler.id) : tripTravelers

  const handleToggle = () => togglePackingItem(tripId, item.id, !item.checked)

  const handleSaveName = async () => {
    if (!editName.trim()) { setEditing(false); setEditName(isPlaceholder ? '' : item.name); return }
    try { await updatePackingItem(tripId, item.id, { name: editName.trim() }); setEditing(false) }
    catch { toast.error(t('packing.toast.saveError')) }
  }

  const handleDelete = async () => {
    // The panel routes deletion through onDelete so an emptied custom category
    // keeps its placeholder; fall back to a plain delete when used standalone.
    if (onDelete) { await onDelete(item); return }
    try { await deletePackingItem(tripId, item.id) }
    catch { toast.error(t('packing.toast.deleteError')) }
  }

  // Unassigned item: pick a traveler directly. Already-assigned item: add a second
  // traveler by creating a duplicate item, matching MergedRow's "+" semantics —
  // the two same-named items then render as a merged slot.
  const handleAddTraveler = async (travelerId: number) => {
    setShowTravelerPicker(false)
    try {
      if (!itemTraveler) {
        await updatePackingItem(tripId, item.id, { traveler_id: travelerId } as any)
      } else {
        const newItem = await addPackingItem(tripId, { name: item.name, category: item.category || '' })
        if (newItem) await updatePackingItem(tripId, newItem.id, { traveler_id: travelerId } as any)
      }
    } catch {
      toast.error(t('packing.toast.saveError'))
    }
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
      onMouseLeave={() => { setHovered(false); setShowBagPicker(false); setShowTravelerPicker(false) }}
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
      {editing && canEdit ? (
        <input
          type="text" value={editName} autoFocus
          placeholder={isPlaceholder ? '...' : undefined}
          onChange={e => setEditName(e.target.value)}
          onBlur={handleSaveName}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditing(false); setEditName(isPlaceholder ? '' : item.name) } }}
          style={{ flex: 1, fontSize: 13.5, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border-primary)', outline: 'none', fontFamily: 'inherit' }}
        />
      ) : (
        <span
          onClick={() => canEdit && !item.checked && setEditing(true)}
          style={{
            flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: 13.5,
            cursor: !canEdit || item.checked ? 'default' : 'text',
            color: isPlaceholder ? 'var(--text-faint)' : (item.checked ? 'var(--text-faint)' : 'var(--text-primary)'),
            transition: 'color 200ms cubic-bezier(0.23,1,0.32,1)',
            textDecoration: item.checked ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </span>
      )}

      {/* Spacer — pushes traveler chip, quantity, and actions to the right, matching MergedRow */}
      <span style={{ flex: 1 }} />

      {/* Traveler + quantity — same interactive chip as MergedRow (hover for +/-, hover for remove) */}
      {itemTraveler ? (
        <TravelerQtyChip
          traveler={itemTraveler}
          quantity={item.quantity || 1}
          checked={!!item.checked}
          canEdit={canEdit}
          onToggleChecked={handleToggle}
          onQtyChange={qty => updatePackingItem(tripId, item.id, { quantity: qty })}
          onRemove={() => updatePackingItem(tripId, item.id, { traveler_id: null } as any)}
        />
      ) : (
        canEdit && <QuantityInput value={item.quantity || 1} onSave={qty => updatePackingItem(tripId, item.id, { quantity: qty })} />
      )}

      {/* Weight + Bag (when enabled) */}
      {bagTrackingEnabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, border: '1px solid var(--border-primary)', borderRadius: 8, padding: '3px 6px', background: 'transparent' }}>
            <input
              type="text" inputMode="numeric"
              value={item.weight_grams ?? ''}
              readOnly={!canEdit}
              onChange={async e => {
                if (!canEdit) return
                const raw = e.target.value.replace(/[^0-9]/g, '')
                const v = raw === '' ? null : parseInt(raw)
                try { await updatePackingItem(tripId, item.id, { weight_grams: v }) } catch { toast.error(t('packing.toast.saveError')) }
              }}
              placeholder="—"
              style={{ width: 36, border: 'none', fontSize: 12, textAlign: 'right', fontFamily: 'inherit', outline: 'none', color: 'var(--text-secondary)', background: 'transparent', padding: 0 }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-faint)', userSelect: 'none' }}>g</span>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => canEdit && setShowBagPicker(p => !p)}
              style={{
                width: 22, height: 22, borderRadius: '50%', cursor: canEdit ? 'pointer' : 'default', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: item.bag_id ? `2.5px solid ${bags.find(b => b.id === item.bag_id)?.color || 'var(--border-primary)'}` : '2px dashed var(--border-primary)',
                background: item.bag_id ? `${bags.find(b => b.id === item.bag_id)?.color || 'var(--border-primary)'}30` : 'transparent',
              }}
            >
              {!item.bag_id && <Package size={9} className="text-content-faint" />}
            </button>
            {showBagPicker && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
                background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 4, minWidth: 160,
              }}>
                {item.bag_id && (
                  <button onClick={async () => { setShowBagPicker(false); try { await updatePackingItem(tripId, item.id, { bag_id: null }) } catch { toast.error(t('packing.toast.saveError')) } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-faint)', borderRadius: 7 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px dashed var(--border-primary)' }} />
                    {t('packing.noBag')}
                  </button>
                )}
                {bags.map(b => (
                  <button key={b.id} onClick={async () => { setShowBagPicker(false); try { await updatePackingItem(tripId, item.id, { bag_id: b.id }) } catch { toast.error(t('packing.toast.saveError')) } }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '6px 10px',
                      background: item.bag_id === b.id ? 'var(--bg-tertiary)' : 'none',
                      border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-secondary)', borderRadius: 7,
                    }}
                    onMouseEnter={e => { if (item.bag_id !== b.id) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                    onMouseLeave={e => { if (item.bag_id !== b.id) e.currentTarget.style.background = 'none' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                    {b.name}
                  </button>
                ))}
                {bags.length > 0 && <div style={{ height: 1, background: 'var(--bg-tertiary)', margin: '4px 0' }} />}
                <div style={{ padding: '4px 6px' }}>
                  {bagInlineCreate ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input autoFocus value={bagInlineName} onChange={e => setBagInlineName(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Enter' && bagInlineName.trim()) {
                            const newBag = await onCreateBag(bagInlineName.trim())
                            if (newBag) { try { await updatePackingItem(tripId, item.id, { bag_id: newBag.id }) } catch { toast.error(t('packing.toast.saveError')) } }
                            setBagInlineName(''); setBagInlineCreate(false); setShowBagPicker(false)
                          }
                          if (e.key === 'Escape') { setBagInlineCreate(false); setBagInlineName('') }
                        }}
                        placeholder={t('packing.bagName')}
                        style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-primary)', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
                      <button onClick={async () => {
                        if (bagInlineName.trim()) {
                          const newBag = await onCreateBag(bagInlineName.trim())
                          if (newBag) { try { await updatePackingItem(tripId, item.id, { bag_id: newBag.id }) } catch { toast.error(t('packing.toast.saveError')) } }
                          setBagInlineName(''); setBagInlineCreate(false); setShowBagPicker(false)
                        }
                      }}
                        style={{ padding: '3px 6px', borderRadius: 6, border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Plus size={11} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setBagInlineCreate(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '5px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--text-faint)', borderRadius: 7 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
                      <Plus size={11} /> {t('packing.addBag')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {canEdit && (
      <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
        {/* Add traveler — same "+" as MergedRow */}
        {availableTravelers.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setShowTravelerPicker(v => !v) }}
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
            {showTravelerPicker && (
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

        <button onClick={handleDelete} title={t('common.delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 6, display: 'flex', color: 'var(--text-faint)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
          <Trash2 size={13} />
        </button>
      </div>
      )}
    </div>
  )
}
