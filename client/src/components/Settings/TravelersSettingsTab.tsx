import { useState, useEffect } from 'react'
import { travelersApi } from '../../api/client'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import { TravelerAvatar } from '../Travelers/TravelerAvatar'
import { Pencil, Check, X, Trash2, Plus, HeartPulse } from 'lucide-react'
import type { Traveler } from '../../types'
import { ageFromDob } from '@trek-family/shared'

const TYPE_OPTIONS = ['adult', 'teen', 'child', 'infant'] as const

export default function TravelersSettingsTab() {
  const { t } = useTranslation()
  const toast = useToast()
  const [travelers, setTravelers] = useState<Traveler[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<typeof TYPE_OPTIONS[number]>('adult')
  const [editColor, setEditColor] = useState('#6366f1')
  const [editDob, setEditDob] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<typeof TYPE_OPTIONS[number]>('adult')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newDob, setNewDob] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await travelersApi.list()
      setTravelers(data.travelers || [])
    } catch {
      toast.error('Failed to load travelers')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(t: Traveler) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditType(t.type)
    setEditColor(t.color || '#6366f1')
    setEditDob(t.date_of_birth || '')
    setEditNotes(t.notes || '')
  }

  async function saveEdit() {
    if (!editName.trim() || editingId == null) return
    setSaving(true)
    try {
      const result = await travelersApi.update(editingId, {
        name: editName.trim(), type: editType, color: editColor,
        date_of_birth: editDob || null, notes: editNotes.trim() || null,
      })
      setTravelers(prev => prev.map(t => t.id === editingId ? { ...t, ...result.traveler } : t))
      setEditingId(null)
    } catch {
      toast.error('Failed to update traveler')
    } finally {
      setSaving(false)
    }
  }

  async function createTraveler() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const result = await travelersApi.create({
        name: newName.trim(), type: newType, color: newColor,
        date_of_birth: newDob || null, notes: newNotes.trim() || null,
      })
      setTravelers(prev => [...prev, result.traveler])
      setNewName('')
      setNewType('adult')
      setNewColor('#6366f1')
      setNewDob('')
      setNewNotes('')
      setShowCreate(false)
    } catch {
      toast.error('Failed to create traveler')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTraveler(traveler: Traveler) {
    if (traveler.linked_user_id) {
      toast.error(t('travelers.deleteLinkedError'))
      return
    }
    if (!window.confirm(t('travelers.deleteConfirm').replace('{name}', traveler.name))) return
    try {
      const result = await travelersApi.delete(traveler.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setTravelers(prev => prev.filter(t => t.id !== traveler.id))
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Failed to delete traveler'
      toast.error(msg)
    }
  }

  if (loading) return <div style={{ padding: 24, color: '#888' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('travelers.title')}</h2>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          <Plus size={14} /> {t('travelers.createNew')}
        </button>
      </div>

      {showCreate && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: '1px solid #6366f1', background: '#6366f111' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t('travelers.name')}
              style={{ flex: 1, minWidth: 120, fontSize: 14, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}
              autoFocus
            />
            <select value={newType} onChange={e => setNewType(e.target.value as typeof newType)}
              style={{ fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}>
              {TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{t(`travelers.type.${opt}`)}</option>)}
            </select>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 32, height: 34, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
            <input type="date" value={newDob} onChange={e => setNewDob(e.target.value)} title={t('travelers.dateOfBirth')}
              style={{ fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }} />
            <button onClick={createTraveler} disabled={saving || !newName.trim()}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              {t('travelers.save')}
            </button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
              {t('travelers.cancel')}
            </button>
          </div>
          <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder={t('travelers.notesPlaceholder')} rows={2}
            style={{ marginTop: 8, width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
      )}

      {travelers.length === 0 ? (
        <p style={{ color: '#888', fontSize: 14 }}>{t('travelers.empty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {travelers.map(traveler => (
            <div key={traveler.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--color-bg-card, #fff)',
              border: '1px solid var(--color-border, #e5e7eb)',
            }}>
              <TravelerAvatar
                traveler={editingId === traveler.id ? { name: editName, avatar: traveler.avatar, color: editColor } : traveler}
                size={36}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === traveler.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        style={{ flex: 1, minWidth: 100, fontSize: 14, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }} autoFocus />
                      <select value={editType} onChange={e => setEditType(e.target.value as typeof editType)}
                        style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }}>
                        {TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{t(`travelers.type.${opt}`)}</option>)}
                      </select>
                      <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 28, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                      <input type="date" value={editDob} onChange={e => setEditDob(e.target.value)} title={t('travelers.dateOfBirth')}
                        style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)' }} />
                    </div>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder={t('travelers.notesPlaceholder')} rows={2}
                      style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)', width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{traveler.name}</span>
                      {traveler.notes && (
                        <span title={traveler.notes} style={{ color: '#ef4444', display: 'flex' }}>
                          <HeartPulse size={12} />
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {t(`travelers.type.${traveler.type}`)}
                      {(() => { const age = ageFromDob(traveler.date_of_birth); return age !== null ? ` · ${t('travelers.age', { age })}` : null })()}
                      {traveler.linked_user_id && <span style={{ marginLeft: 6, color: '#6366f1' }}>· {t('travelers.linkedAccount')}</span>}
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {editingId === traveler.id ? (
                  <>
                    <button onClick={saveEdit} disabled={saving} title={t('travelers.save')} style={{ padding: 6, borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer' }}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingId(null)} title={t('travelers.cancel')} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(traveler)} title={t('travelers.save')} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}>
                      <Pencil size={14} />
                    </button>
                    {!traveler.linked_user_id && (
                      <button onClick={() => deleteTraveler(traveler)} title={t('travelers.delete')} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6, color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
