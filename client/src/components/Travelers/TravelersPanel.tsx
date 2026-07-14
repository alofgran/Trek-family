import { useState, useMemo } from 'react'
import { useTripStore } from '../../store/tripStore'
import { travelersApi } from '../../api/client'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import { TravelerCard } from './TravelerCard'
import { TravelerAvatar } from './TravelerAvatar'
import { Plus, Users2 } from 'lucide-react'
import type { TripTraveler } from '../../types'
import { useCanDo } from '../../store/permissionsStore'

const TYPE_OPTIONS = ['adult', 'teen', 'child', 'infant'] as const

export default function TravelersPanel({ tripId }: { tripId: number }) {
  const { t } = useTranslation()
  const toast = useToast()
  const trip = useTripStore(s => s.trip)
  const can = useCanDo()
  const canEdit = can('packing_edit', trip)
  const tripTravelers = useTripStore(s => s.tripTravelers)
  const addTripTravelerLocal = useTripStore(s => s.addTripTravelerLocal)
  const removeTripTravelerLocal = useTripStore(s => s.removeTripTravelerLocal)
  const packingItems = useTripStore(s => s.packingItems)
  const todoItems = useTripStore(s => s.todoItems)

  const [rosterOpen, setRosterOpen] = useState(false)
  const [roster, setRoster] = useState<TripTraveler[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [selectedRosterIds, setSelectedRosterIds] = useState<Set<number>>(new Set())
  const [addingRoster, setAddingRoster] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<typeof TYPE_OPTIONS[number]>('adult')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newDob, setNewDob] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const tripTravelerIds = new Set(tripTravelers.map(t => t.id))

  async function openRoster() {
    setLoadingRoster(true)
    setSelectedRosterIds(new Set())
    try {
      const data = await travelersApi.list()
      setRoster(data.travelers || [])
    } catch {
      toast.error('Failed to load traveler roster')
    } finally {
      setLoadingRoster(false)
      setRosterOpen(true)
    }
  }

  function toggleRosterSelection(id: number) {
    setSelectedRosterIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function addSelectedFromRoster() {
    if (selectedRosterIds.size === 0) return
    setAddingRoster(true)
    const toAdd = roster.filter(t => selectedRosterIds.has(t.id))
    try {
      for (const traveler of toAdd) {
        await travelersApi.addToTrip(tripId, traveler.id)
        addTripTravelerLocal({ ...traveler, added_at: new Date().toISOString(), added_by_user_id: null })
      }
      setRosterOpen(false)
      setSelectedRosterIds(new Set())
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to add travelers')
    } finally {
      setAddingRoster(false)
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await travelersApi.create({
        name: newName.trim(), type: newType, color: newColor,
        date_of_birth: newDob || null,
        notes: newNotes.trim() || null,
      })
      const traveler = created.traveler
      await travelersApi.addToTrip(tripId, traveler.id)
      addTripTravelerLocal({ ...traveler, added_at: new Date().toISOString(), added_by_user_id: null })
      setNewName('')
      setNewType('adult')
      setNewColor('#6366f1')
      setNewDob('')
      setNewNotes('')
      setShowCreate(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to create traveler')
    } finally {
      setCreating(false)
    }
  }

  async function removeFromTrip(travelerId: number) {
    try {
      await travelersApi.removeFromTrip(tripId, travelerId)
      removeTripTravelerLocal(travelerId)
    } catch {
      toast.error('Failed to remove traveler')
    }
  }

  function handleUpdated(updated: TripTraveler) {
    useTripStore.setState(state => ({
      tripTravelers: state.tripTravelers.map(t => t.id === updated.id ? updated : t)
    }))
  }

  const packingCountByTraveler = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const item of packingItems) {
      if ((item as any).traveler_id) {
        counts[(item as any).traveler_id] = (counts[(item as any).traveler_id] || 0) + 1
      }
    }
    return counts
  }, [packingItems])

  const todoCountByTraveler = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const item of todoItems) {
      if ((item as any).assigned_traveler_id) {
        counts[(item as any).assigned_traveler_id] = (counts[(item as any).assigned_traveler_id] || 0) + 1
      }
    }
    return counts
  }, [todoItems])

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users2 size={20} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('travelers.title')}</h2>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={openRoster}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border, #e5e7eb)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
            >
              <Plus size={14} /> {t('travelers.addFromRoster')}
            </button>
            <button
              onClick={() => setShowCreate(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13 }}
            >
              <Plus size={14} /> {t('travelers.createNew')}
            </button>
          </div>
        )}
      </div>

      {/* Create new traveler form */}
      {showCreate && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: '1px solid #6366f1', background: '#6366f111' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t('travelers.name')}
              style={{ flex: 1, minWidth: 120, fontSize: 14, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}
              autoFocus
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as typeof newType)}
              style={{ fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}
            >
              {TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{t(`travelers.type.${opt}`)}</option>)}
            </select>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 32, height: 34, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
            <input
              type="date"
              value={newDob}
              onChange={e => setNewDob(e.target.value)}
              title={t('travelers.dateOfBirth')}
              style={{ fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}
            />
            <button onClick={createAndAdd} disabled={creating || !newName.trim()} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              {t('travelers.save')}
            </button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
              {t('travelers.cancel')}
            </button>
          </div>
          <textarea
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            placeholder={t('travelers.notesPlaceholder')}
            rows={2}
            style={{ marginTop: 8, width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      )}

      {/* Roster picker */}
      {rosterOpen && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: '1px solid var(--color-border, #e5e7eb)', background: 'var(--color-bg-subtle, #f9fafb)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('travelers.addFromRoster')}</div>
          {loadingRoster ? (
            <div style={{ fontSize: 13, color: '#888' }}>Loading...</div>
          ) : roster.filter(t => !tripTravelerIds.has(t.id)).length === 0 ? (
            <div style={{ fontSize: 13, color: '#888' }}>All travelers already on this trip.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {roster.filter(t => !tripTravelerIds.has(t.id)).map(traveler => {
                const selected = selectedRosterIds.has(traveler.id)
                return (
                  <button
                    key={traveler.id}
                    onClick={() => toggleRosterSelection(traveler.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6,
                      border: selected ? '1px solid #6366f1' : '1px solid var(--color-border, #e5e7eb)',
                      background: selected ? '#6366f111' : '#fff', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, border: selected ? '2px solid #6366f1' : '2px solid #d1d5db',
                      background: selected ? '#6366f1' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && <span style={{ width: 8, height: 8, background: '#fff', borderRadius: 2, display: 'block' }} />}
                    </span>
                    <TravelerAvatar traveler={traveler as any} size={28} />
                    <span style={{ fontSize: 13 }}>{traveler.name}</span>
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>{traveler.type}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button
              onClick={addSelectedFromRoster}
              disabled={selectedRosterIds.size === 0 || addingRoster}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none',
                background: selectedRosterIds.size > 0 ? '#6366f1' : '#d1d5db',
                color: selectedRosterIds.size > 0 ? '#fff' : '#9ca3af',
                cursor: selectedRosterIds.size > 0 ? 'pointer' : 'default', fontSize: 13,
              }}
            >
              {t('travelers.addSelected', { count: selectedRosterIds.size })}
            </button>
            <button onClick={() => { setRosterOpen(false); setSelectedRosterIds(new Set()) }} style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
              {t('travelers.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Trip travelers list */}
      {tripTravelers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: '#888', fontSize: 14 }}>
          <Users2 size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>{t('travelers.emptyTrip')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tripTravelers.map(traveler => (
            <TravelerCard
              key={traveler.id}
              traveler={traveler}
              canEdit={canEdit}
              onUpdated={handleUpdated}
              onRemove={removeFromTrip}
              packingCount={packingCountByTraveler[traveler.id]}
              todoCount={todoCountByTraveler[traveler.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
