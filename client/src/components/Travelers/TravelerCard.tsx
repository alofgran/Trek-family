import { useState } from 'react'
import { travelersApi } from '../../api/client'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import { TravelerAvatar } from './TravelerAvatar'
import { Pencil, Check, X, Link, HeartPulse } from 'lucide-react'
import type { TripTraveler } from '../../types'
import { ageFromDob } from '@trek-family/shared'

const TYPE_OPTIONS = ['adult', 'teen', 'child', 'infant'] as const

interface TravelerCardProps {
  traveler: TripTraveler
  canEdit: boolean
  onUpdated: (updated: TripTraveler) => void
  onRemove: (id: number) => void
  packingCount?: number
  todoCount?: number
}

export function TravelerCard({ traveler, canEdit, onUpdated, onRemove, packingCount = 0, todoCount = 0 }: TravelerCardProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(traveler.name)
  const [type, setType] = useState(traveler.type)
  const [color, setColor] = useState(traveler.color || '#6366f1')
  const [dob, setDob] = useState(traveler.date_of_birth || '')
  const [notes, setNotes] = useState(traveler.notes || '')
  const [saving, setSaving] = useState(false)

  const age = ageFromDob(traveler.date_of_birth)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const result = await travelersApi.update(traveler.id, {
        name: name.trim(), type, color,
        date_of_birth: dob || null,
        notes: notes.trim() || null,
      })
      onUpdated({ ...traveler, ...result.traveler })
      setEditing(false)
    } catch {
      toast.error('Failed to update traveler')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setName(traveler.name)
    setType(traveler.type)
    setColor(traveler.color || '#6366f1')
    setDob(traveler.date_of_birth || '')
    setNotes(traveler.notes || '')
    setEditing(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 8,
      background: 'var(--color-bg-card, #fff)',
      border: '1px solid var(--color-border, #e5e7eb)',
    }}>
      <TravelerAvatar traveler={editing ? { name, avatar: traveler.avatar, color } : traveler} size={40} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('travelers.name')}
              style={{ fontSize: 14, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)', width: '100%' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={type}
                onChange={e => setType(e.target.value as typeof type)}
                style={{ fontSize: 13, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}
              >
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{t(`travelers.type.${opt}`)}</option>
                ))}
              </select>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 32, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                title={t('travelers.dateOfBirth')}
                style={{ fontSize: 13, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}
              />
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('travelers.notesPlaceholder')}
              rows={2}
              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)', width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{traveler.name}</span>
              {traveler.linked_user_id && (
                <span title={t('travelers.linkedAccount')} style={{ color: '#6366f1' }}>
                  <Link size={12} />
                </span>
              )}
              {traveler.notes && (
                <span title={traveler.notes} style={{ color: '#ef4444', display: 'flex' }}>
                  <HeartPulse size={12} />
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted, #888)', marginTop: 2 }}>
              {t(`travelers.type.${traveler.type}`)}
              {age !== null && ` · ${t('travelers.age', { age })}`}
              {(packingCount > 0 || todoCount > 0) && (
                <span style={{ marginLeft: 8 }}>
                  {packingCount > 0 && `${packingCount} ${t('travelers.packingItems').toLowerCase()}`}
                  {packingCount > 0 && todoCount > 0 && ' · '}
                  {todoCount > 0 && `${todoCount} ${t('travelers.todos').toLowerCase()}`}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', gap: 4 }}>
          {editing ? (
            <>
              <button onClick={save} disabled={saving} title={t('travelers.save')} style={{ padding: 6, borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer' }}>
                <Check size={14} />
              </button>
              <button onClick={cancel} title={t('travelers.cancel')} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} title={t('travelers.save')} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}>
                <Pencil size={14} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t('travelers.removeFromTripConfirm').replace('{name}', traveler.name))) {
                    onRemove(traveler.id)
                  }
                }}
                title={t('travelers.removeFromTrip')}
                style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
