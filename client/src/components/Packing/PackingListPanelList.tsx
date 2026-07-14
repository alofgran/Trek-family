import { useState, useEffect, useRef } from 'react'
import { Luggage } from 'lucide-react'
import type { PackingState } from './usePackingListPanel'
import { KategorieGruppe } from './PackingListPanelCategoryGroup'
import { useTripStore } from '../../store/tripStore'
import { packingApi } from '../../api/client'
import { useToast } from '../shared/Toast'

export function PackingList(S: PackingState) {
  const {
    items, gruppiert, t, tripId, allCategories, handleRenameCategory, handleDeleteCategory, handleDeleteItem,
    handleAddItemToCategory, categoryAssignees, tripMembers, handleSetAssignees,
    bagTrackingEnabled, bags, handleCreateBagByName, canEdit, groupBy, tripTravelers,
  } = S

  const { updatePackingItem } = useTripStore()
  const toast = useToast()

  const [cardOrder, setCardOrder] = useState<string[]>([])
  const [dragCard, setDragCard] = useState<string | null>(null)
  const [dropCard, setDropCard] = useState<string | null>(null)
  const dragCardRef = useRef<string | null>(null)

  // Sync card order when group keys change (new categories/travelers appear or disappear)
  useEffect(() => {
    const keys = Object.keys(gruppiert)
    setCardOrder(prev => {
      const existing = prev.filter(k => keys.includes(k))
      const newKeys = keys.filter(k => !prev.includes(k))
      if (existing.length === prev.length && newKeys.length === 0) return prev
      return [...existing, ...newKeys]
    })
  }, [gruppiert])

  const handleCardDrop = async (fromKey: string, toKey: string) => {
    setDragCard(null); setDropCard(null); dragCardRef.current = null
    if (fromKey === toKey) return
    const newOrder = [...cardOrder]
    const fromIdx = newOrder.indexOf(fromKey)
    const toIdx = newOrder.indexOf(toKey)
    if (fromIdx === -1 || toIdx === -1) return
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, fromKey)
    setCardOrder(newOrder)
    if (groupBy === 'category') {
      const orderedIds = newOrder.flatMap(kat => (gruppiert[kat] || []).map(i => i.id))
      try { await packingApi.reorder(tripId, orderedIds) } catch { toast.error(t('packing.toast.saveError')) }
    }
  }

  const handleReceiveExternalSlot = async (itemIds: number[], toGroupKey: string) => {
    if (groupBy === 'traveler') {
      const traveler = tripTravelers.find(tr => tr.name === toGroupKey)
      if (!traveler) return
      for (const itemId of itemIds) {
        try { await updatePackingItem(tripId, itemId, { traveler_id: traveler.id } as any) } catch {}
      }
    } else {
      for (const itemId of itemIds) {
        try { await updatePackingItem(tripId, itemId, { category: toGroupKey }) } catch {}
      }
    }
  }

  const orderedGroups = cardOrder.filter(k => !!gruppiert[k])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0 16px' }}>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Luggage size={40} style={{ color: 'var(--text-faint)', display: 'block', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{t('packing.emptyTitle')}</p>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>{t('packing.emptyHint')}</p>
        </div>
      ) : orderedGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)' }}>
          <p style={{ fontSize: 13, margin: 0 }}>{t('packing.emptyFiltered')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {orderedGroups.map((kat) => {
            const katItems = gruppiert[kat] || []
            const travelerColor = groupBy === 'traveler'
              ? tripTravelers.find(tr => tr.name === kat)?.color
              : undefined
            return (
              <KategorieGruppe
                key={kat}
                kategorie={kat}
                items={katItems}
                tripId={tripId}
                allCategories={allCategories}
                onRename={groupBy === 'category' ? handleRenameCategory : async () => {}}
                onDeleteAll={groupBy === 'category' ? handleDeleteCategory : async () => {}}
                onDeleteItem={handleDeleteItem}
                onAddItem={groupBy === 'category' ? handleAddItemToCategory : async () => {}}
                assignees={groupBy === 'category' ? (categoryAssignees[kat] || []) : []}
                tripMembers={tripMembers}
                onSetAssignees={groupBy === 'category' ? handleSetAssignees : async () => {}}
                bagTrackingEnabled={bagTrackingEnabled}
                bags={bags}
                onCreateBag={handleCreateBagByName}
                canEdit={canEdit && groupBy === 'category'}
                canDragItems={canEdit}
                headerColor={travelerColor}
                onReceiveExternalSlot={(itemIds) => handleReceiveExternalSlot(itemIds, kat)}
                onCardDragStart={() => { dragCardRef.current = kat; setDragCard(kat) }}
                onCardDragOver={() => { if (dragCardRef.current && dragCardRef.current !== kat) setDropCard(kat) }}
                onCardDrop={() => { if (dragCardRef.current) handleCardDrop(dragCardRef.current, kat) }}
                onCardDragEnd={() => { dragCardRef.current = null; setDragCard(null); setDropCard(null) }}
                isCardDragging={dragCard === kat}
                isCardDropTarget={dropCard === kat && dragCard !== kat}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
