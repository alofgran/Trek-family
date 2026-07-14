import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import {
  Trash2, Plus, ChevronDown, ChevronRight,
  X, Pencil, MoreHorizontal, CheckCheck, RotateCcw, GripVertical,
} from 'lucide-react'
import type { PackingItem, PackingBag } from '../../types'
import { katColor } from './packingListPanel.helpers'
import type { TripMember, CategoryAssignee } from './usePackingListPanel'
import { ArtikelZeile } from './PackingListPanelItemRow'
import { MergedRow } from './PackingListPanelMergedRow'

interface KategorieGruppeProps {
  kategorie: string
  items: PackingItem[]
  tripId: number
  allCategories: string[]
  onRename: (oldName: string, newName: string) => Promise<void>
  onDeleteAll: (items: PackingItem[]) => Promise<void>
  onDeleteItem: (item: PackingItem) => Promise<void>
  onAddItem: (category: string, name: string) => Promise<void>
  assignees: CategoryAssignee[]
  tripMembers: TripMember[]
  onSetAssignees: (category: string, userIds: number[]) => Promise<void>
  bagTrackingEnabled?: boolean
  bags?: PackingBag[]
  onCreateBag: (name: string) => Promise<PackingBag | undefined>
  canEdit?: boolean
  canDragItems?: boolean
  headerColor?: string
  onReceiveExternalSlot?: (itemIds: number[]) => void
  onCardDragStart?: () => void
  onCardDragOver?: () => void
  onCardDrop?: () => void
  onCardDragEnd?: () => void
  isCardDragging?: boolean
  isCardDropTarget?: boolean
}

export function KategorieGruppe({ kategorie, items, tripId, allCategories, onRename, onDeleteAll, onDeleteItem, onAddItem, assignees, tripMembers, onSetAssignees, bagTrackingEnabled, bags, onCreateBag, canEdit = true, canDragItems, headerColor, onReceiveExternalSlot, onCardDragStart, onCardDragOver, onCardDrop, onCardDragEnd, isCardDragging, isCardDropTarget }: KategorieGruppeProps) {
  const [offen, setOffen] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [editKatName, setEditKatName] = useState(kategorie)
  const [showMenu, setShowMenu] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [dragSlot, setDragSlot] = useState<number | null>(null)
  const [dropSlot, setDropSlot] = useState<number | null>(null)
  const addItemRef = useRef<HTMLInputElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const { togglePackingItem, reorderPackingItems } = useTripStore()
  const toast = useToast()
  const { t } = useTranslation()

  // Build "slots" — groups of items that share the same name (case-insensitive).
  // Each slot is either a single item or multiple same-named items across travelers.
  const slots = useCallback(() => {
    const map = new Map<string, PackingItem[]>()
    for (const item of items) {
      const key = item.name.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.values())
  }, [items])()

  const handleDrop = async (targetSlot: number) => {
    if (dragSlot === null || dragSlot === targetSlot) { setDragSlot(null); setDropSlot(null); return }
    const reordered = [...slots]
    const [moved] = reordered.splice(dragSlot, 1)
    reordered.splice(targetSlot, 0, moved)
    const orderedIds = reordered.flatMap(slot => slot.map(i => i.id))
    setDragSlot(null); setDropSlot(null)
    await reorderPackingItems(tripId, orderedIds)
  }
  const abgehakt = items.filter(i => i.checked).length
  const alleAbgehakt = abgehakt === items.length
  const dot = headerColor || katColor(kategorie, allCategories)

  const handleSaveKatName = async () => {
    const neu = editKatName.trim()
    if (!neu || neu === kategorie) { setEditingName(false); setEditKatName(kategorie); return }
    try { await onRename(kategorie, neu); setEditingName(false) }
    catch { toast.error(t('packing.toast.renameError')) }
  }

  const handleCheckAll = async () => {
    try {
      for (const item of Array.from(items)) {
        if (!item.checked) await togglePackingItem(tripId, item.id, true)
      }
    } catch { toast.error(t('packing.toast.saveError')) }
  }
  const handleUncheckAll = async () => {
    try {
      for (const item of Array.from(items)) {
        if (item.checked) await togglePackingItem(tripId, item.id, false)
      }
    } catch { toast.error(t('packing.toast.saveError')) }
  }
  const handleDeleteAll = async () => {
    await onDeleteAll(items)
    setShowMenu(false)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        // Only signal card-drop-target when a card (not an item slot) is being dragged
        if (Array.from(e.dataTransfer.types).includes('trek-card')) onCardDragOver?.()
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer truly leaves the card, not when it moves
        // between child elements (which also fires dragleave on each of them).
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropSlot(null)
      }}
      onDrop={(e) => {
        const slotRaw = e.dataTransfer.getData('trek-slot')
        if (slotRaw) {
          e.preventDefault()
          try {
            const { fromGroup, itemIds } = JSON.parse(slotRaw)
            if (fromGroup !== kategorie && onReceiveExternalSlot) onReceiveExternalSlot(itemIds)
          } catch {}
          setDragSlot(null); setDropSlot(null)
          return
        }
        const cardFrom = e.dataTransfer.getData('trek-card')
        if (cardFrom && cardFrom !== kategorie) { e.preventDefault(); onCardDrop?.() }
      }}
      style={{
        marginBottom: 6, background: 'var(--bg-card)', borderRadius: 14,
        border: `1px solid ${isCardDropTarget ? 'var(--accent)' : 'var(--border-secondary)'}`,
        overflow: 'visible', opacity: isCardDragging ? 0.5 : 1,
        transition: 'border-color 0.1s, opacity 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: offen ? '1px solid var(--border-secondary)' : 'none' }}>
        {onCardDragStart && (
          <span
            draggable
            onDragStart={(e) => {
              e.stopPropagation()
              e.dataTransfer.setData('trek-card', kategorie)
              e.dataTransfer.effectAllowed = 'move'
              onCardDragStart()
            }}
            onDragEnd={() => onCardDragEnd?.()}
            style={{ flexShrink: 0, color: 'var(--text-faint)', cursor: 'grab', display: 'flex', opacity: 0.5, transition: 'opacity 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
          >
            <GripVertical size={13} />
          </span>
        )}
        <button onClick={() => setOffen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-faint)', flexShrink: 0 }}>
          {offen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />

        {editingName && canEdit ? (
          <input
            autoFocus value={editKatName}
            onChange={e => setEditKatName(e.target.value)}
            onBlur={handleSaveKatName}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveKatName(); if (e.key === 'Escape') { setEditingName(false); setEditKatName(kategorie) } }}
            style={{ flex: 1, fontSize: 12.5, fontWeight: 600, border: 'none', borderBottom: '2px solid var(--text-primary)', outline: 'none', background: 'transparent', fontFamily: 'inherit', color: 'var(--text-primary)', padding: '0 2px' }}
          />
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {kategorie}
          </span>
        )}

        {/* Spacer — pushes assignee chips + count + menu to the right */}
        <span style={{ flex: 1, minWidth: 0 }} />

        {/* Assignee chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 4 }}>
          {assignees.map(a => (
            <div key={a.user_id} style={{ position: 'relative' }}
              onClick={e => { e.stopPropagation(); if (canEdit) onSetAssignees(kategorie, assignees.filter(x => x.user_id !== a.user_id).map(x => x.user_id)) }}
            >
              <div className="assignee-chip"
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: canEdit ? 'pointer' : 'default',
                  background: `hsl(${a.username.charCodeAt(0) * 37 % 360}, 55%, 55%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'white', textTransform: 'uppercase',
                  border: '2px solid var(--bg-card)', transition: 'opacity 0.15s',
                }}
              >
                {a.username[0]}
              </div>
              <div className="assignee-tooltip" style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                marginTop: 6, padding: '3px 8px', borderRadius: 6, zIndex: 60,
                background: 'var(--text-primary)', color: 'var(--bg-primary)',
                fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
              }}>
                {a.username}
              </div>
            </div>
          ))}
        </div>


        <span style={{
          fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99,
          background: alleAbgehakt ? 'rgba(22,163,74,0.12)' : 'var(--bg-tertiary)',
          color: alleAbgehakt ? '#16a34a' : 'var(--text-muted)',
        }}>
          {abgehakt}/{items.length}
        </span>

        <div style={{ position: 'relative' }}>
          <button ref={menuBtnRef} onClick={() => setShowMenu(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, display: 'flex', color: 'var(--text-faint)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
            <MoreHorizontal size={15} />
          </button>
          {showMenu && (() => {
            const rect = menuBtnRef.current?.getBoundingClientRect();
            return (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowMenu(false)} />
              <div style={{ position: 'fixed', right: rect ? window.innerWidth - rect.right : 0, top: rect ? rect.bottom + 4 : 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: 4, minWidth: 170 }}>
                {canEdit && <MenuItem icon={<Pencil size={13} />} label={t('packing.menuRename')} onClick={() => { setEditingName(true); setShowMenu(false) }} />}
                <MenuItem icon={<CheckCheck size={13} />} label={t('packing.menuCheckAll')} onClick={() => { handleCheckAll(); setShowMenu(false) }} />
                <MenuItem icon={<RotateCcw size={13} />} label={t('packing.menuUncheckAll')} onClick={() => { handleUncheckAll(); setShowMenu(false) }} />
                {canEdit && <>
                <div style={{ height: 1, background: 'var(--bg-tertiary)', margin: '4px 0' }} />
                <MenuItem icon={<Trash2 size={13} />} label={t('packing.menuDeleteCat')} danger onClick={handleDeleteAll} />
                </>}
              </div>
            </>
            );
          })()}
        </div>
      </div>

      {offen && (
        <div style={{ padding: '4px 4px 6px' }}>
          {slots.map((slot, idx) => {
            const isMerged = slot.length > 1 && slot.every(i => (i as any).traveler_id)
            const effectiveCanDrag = canDragItems !== undefined ? canDragItems : canEdit
          const dndProps = effectiveCanDrag ? {
              draggable: true as const,
              onDragStart: (e: React.DragEvent) => {
                e.stopPropagation()
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('trek-slot', JSON.stringify({ fromGroup: kategorie, itemIds: slot.flatMap(i => i.id) }))
                setDragSlot(idx)
              },
              onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropSlot(idx) },
              onDrop: (e: React.DragEvent) => {
                e.preventDefault()
                e.stopPropagation()
                const cardData = e.dataTransfer.getData('trek-card')
                if (cardData) return
                const slotRaw = e.dataTransfer.getData('trek-slot')
                if (slotRaw) {
                  try {
                    const { fromGroup, itemIds } = JSON.parse(slotRaw)
                    if (fromGroup === kategorie) {
                      handleDrop(idx)
                    } else if (onReceiveExternalSlot) {
                      onReceiveExternalSlot(itemIds)
                      setDragSlot(null); setDropSlot(null)
                    }
                  } catch { handleDrop(idx) }
                }
              },
              onDragEnd: () => { setDragSlot(null); setDropSlot(null) },
              isDragging: dragSlot === idx,
              isDropTarget: dropSlot === idx && dragSlot !== idx,
            } : {}
            if (isMerged) {
              return (
                <MergedRow
                  key={slot[0].name.toLowerCase()}
                  name={slot[0].name}
                  items={slot}
                  tripId={tripId}
                  onDelete={onDeleteAll}
                  onDeleteItem={onDeleteItem}
                  canEdit={canEdit}
                  {...dndProps}
                />
              )
            }
            return slot.map(item => (
              <ArtikelZeile key={item.id} item={item} tripId={tripId} onDelete={onDeleteItem} bagTrackingEnabled={bagTrackingEnabled} bags={bags} onCreateBag={onCreateBag} canEdit={canEdit} {...dndProps} />
            ))
          })}
          {/* Inline add item */}
          {canEdit && (showAddItem ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
              <input
                ref={addItemRef}
                autoFocus
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newItemName.trim()) {
                    onAddItem(kategorie, newItemName.trim())
                    setNewItemName('')
                    setTimeout(() => addItemRef.current?.focus(), 30)
                  }
                  if (e.key === 'Escape') { setShowAddItem(false); setNewItemName('') }
                }}
                placeholder={t('packing.addItemPlaceholder')}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: 'var(--text-primary)', background: 'var(--bg-input)' }}
              />
              <button onClick={() => { if (newItemName.trim()) { onAddItem(kategorie, newItemName.trim()); setNewItemName(''); setTimeout(() => addItemRef.current?.focus(), 30) } }}
                disabled={!newItemName.trim()}
                style={{ padding: '5px 8px', borderRadius: 8, border: 'none', background: newItemName.trim() ? 'var(--text-primary)' : 'var(--border-primary)', color: 'var(--bg-primary)', cursor: newItemName.trim() ? 'pointer' : 'default', display: 'flex' }}>
                <Plus size={14} />
              </button>
              <button onClick={() => { setShowAddItem(false); setNewItemName('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-faint)' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button onClick={() => { setShowAddItem(true); setTimeout(() => addItemRef.current?.focus(), 30) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', margin: '2px 4px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-faint)', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
              <Plus size={12} /> {t('packing.addItem')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

function MenuItem({ icon, label, onClick, danger = false }: MenuItemProps) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 12.5, fontFamily: 'inherit', borderRadius: 7, textAlign: 'left',
      color: danger ? '#ef4444' : 'var(--text-secondary)',
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? '#fef2f2' : 'var(--bg-tertiary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {icon}{label}
    </button>
  )
}
