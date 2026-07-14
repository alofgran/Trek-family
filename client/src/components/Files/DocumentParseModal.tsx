import ReactDOM from 'react-dom'
import { useState, useEffect } from 'react'
import { X, Loader2, Plane, Train, Hotel, UtensilsCrossed, Car, Anchor, Calendar } from 'lucide-react'
import { useTripStore } from '../../store/tripStore'
import { TravelerAvatar } from '../Travelers/TravelerAvatar'
import type { FileManagerState } from './useFileManager'
import type { BookingImportPreviewItem } from '@trek-family/shared'

const TYPE_ICONS: Record<string, React.FC<{ size?: number }>> = {
  flight: Plane, train: Train, hotel: Hotel, restaurant: UtensilsCrossed, car: Car, cruise: Anchor, event: Calendar,
}

export function DocumentParseModal(S: FileManagerState) {
  const { t, files, parseFileId, parseResult, parsing, closeParse, confirmItineraryParse, confirmDocumentParse, toast } = S
  const tripTravelers = useTripStore(s => s.tripTravelers)
  const file = files.find(f => f.id === parseFileId)

  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [fields, setFields] = useState<Record<string, string>>({})
  const [expiryDate, setExpiryDate] = useState('')
  const [travelerId, setTravelerId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setExcluded(new Set())
    if (parseResult?.kind === 'pii') {
      setFields(parseResult.fields)
      const derivedExpiry = parseResult.fields.expiry_date || parseResult.fields.valid_until || ''
      setExpiryDate(derivedExpiry || file?.expiry_date || '')
      setTravelerId(file?.traveler_id ?? null)
    }
  }, [parseResult, file])

  if (!parseFileId) return null

  const toggleExclude = (idx: number) => {
    setExcluded(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next })
  }

  const handleConfirmItinerary = async () => {
    if (parseResult?.kind !== 'itinerary') return
    const items = parseResult.items.filter((_, i) => !excluded.has(i))
    if (items.length === 0) return
    setSaving(true)
    try {
      const result = await confirmItineraryParse(items)
      toast.success(t('files.parse.itineraryCreated', { count: result?.created?.length ?? items.length }))
      closeParse()
    } catch {
      toast.error(t('files.parse.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDocument = async () => {
    setSaving(true)
    try {
      await confirmDocumentParse({ fields, expiry_date: expiryDate || null, traveler_id: travelerId })
      toast.success(t('files.parse.documentSaved'))
      closeParse()
    } catch {
      toast.error(t('files.parse.error'))
    } finally {
      setSaving(false)
    }
  }

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={closeParse}>
      <div
        style={{ background: 'var(--bg-card, #fff)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{t('files.parse.title')}</div>
          <button onClick={closeParse} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {parsing && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0', color: 'var(--text-faint)' }}>
              <Loader2 size={22} className="animate-spin" />
              {t('files.parse.parsing')}
            </div>
          )}

          {!parsing && parseResult?.kind === 'itinerary' && (
            <>
              {parseResult.items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-faint)', fontSize: 13 }}>
                  {t('files.parse.noItineraryFound')}
                </div>
              )}
              {(parseResult.items as BookingImportPreviewItem[]).map((item: any, idx: number) => {
                const Icon = TYPE_ICONS[item.type] ?? Calendar
                const isExcluded = excluded.has(idx)
                const fromEp = item.endpoints?.find((e: any) => e.role === 'from')
                const toEp = item.endpoints?.find((e: any) => e.role === 'to')
                return (
                  <div key={idx} style={{ borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: '1px solid var(--border-primary)', opacity: isExcluded ? 0.5 : 1, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}><Icon size={15} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                      {fromEp && toEp && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fromEp.code ?? fromEp.name} → {toEp.code ?? toEp.name}</div>
                      )}
                      {item.reservation_time && (
                        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{String(item.reservation_time).slice(0, 16).replace('T', ' ')}</div>
                      )}
                    </div>
                    <button onClick={() => toggleExclude(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>
                      {isExcluded ? '+' : <X size={12} />}
                    </button>
                  </div>
                )
              })}
              {parseResult.warnings.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#92400e', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                  {parseResult.warnings.join('\n')}
                </div>
              )}
            </>
          )}

          {!parsing && parseResult?.kind === 'pii' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>{t('files.parse.reviewHint')}</div>
              {Object.keys(fields).map(key => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {t(`files.parse.field.${key}`)}
                  </label>
                  <input
                    value={fields[key] || ''}
                    onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', boxSizing: 'border-box', marginTop: 2 }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {t('files.expiryDate')}
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', boxSizing: 'border-box', marginTop: 2 }}
                />
              </div>
              {tripTravelers.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {t('files.owner')}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {tripTravelers.map(tr => (
                      <button
                        key={tr.id}
                        onClick={() => setTravelerId(travelerId === tr.id ? null : tr.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 999,
                          border: travelerId === tr.id ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border-primary)',
                          background: travelerId === tr.id ? 'var(--bg-hover)' : 'transparent', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        <TravelerAvatar traveler={tr} size={16} />
                        {tr.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {parseResult.warnings.length > 0 && (
                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#92400e', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                  {parseResult.warnings.join('\n')}
                </div>
              )}
            </>
          )}
        </div>

        {!parsing && parseResult && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-primary)' }}>
            <button onClick={closeParse} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'none', cursor: 'pointer', fontSize: 13 }}>
              {t('travelers.cancel')}
            </button>
            {parseResult.kind === 'itinerary' ? (
              <button
                onClick={handleConfirmItinerary}
                disabled={saving || parseResult.items.length === 0}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || parseResult.items.length === 0 ? 0.6 : 1 }}
              >
                {saving ? t('common.loading') : t('files.parse.createReservations')}
              </button>
            ) : (
              <button
                onClick={handleSaveDocument}
                disabled={saving}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? t('common.loading') : t('travelers.save')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
