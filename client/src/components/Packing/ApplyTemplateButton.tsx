import React, { useEffect, useRef, useState } from 'react'
import { Package, X } from 'lucide-react'
import { packingApi } from '../../api/client'
import { useTripStore } from '../../store/tripStore'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import { TravelerSelector } from '../Travelers/TravelerSelector'

interface Template {
  id: number
  name: string
  item_count: number
  is_personal?: number
  traveler_type?: string | null
}

interface ApplyTemplateButtonProps {
  tripId: number
  style: React.CSSProperties
  className?: string
}

export default function ApplyTemplateButton({ tripId, style, className }: ApplyTemplateButtonProps): React.ReactElement | null {
  const [templates, setTemplates] = useState<Template[]>([])
  const [open, setOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null)
  const [selectedTravelerIds, setSelectedTravelerIds] = useState<number[]>([])
  const dropRef = useRef<HTMLDivElement>(null)
  const toast = useToast()
  const { t } = useTranslation()
  const tripTravelers = useTripStore(s => s.tripTravelers)

  useEffect(() => {
    packingApi.listTemplates(tripId).then(d => setTemplates(d.templates || [])).catch(() => {})
  }, [tripId])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const openTravelerPicker = (tmpl: Template) => {
    setPendingTemplate(tmpl)
    // Templates tagged with an age band (e.g. a "Baby bag" list) pre-select only
    // matching travelers so applying it doesn't dump baby items onto everyone;
    // untagged/general templates still default to the whole trip roster.
    const matching = tmpl.traveler_type ? tripTravelers.filter(tr => tr.type === tmpl.traveler_type) : []
    setSelectedTravelerIds((matching.length > 0 ? matching : tripTravelers).map(tr => tr.id))
    setOpen(false)
  }

  const confirmApply = async () => {
    if (!pendingTemplate || selectedTravelerIds.length === 0) return
    setApplying(true)
    try {
      const data = await packingApi.applyTemplate(tripId, pendingTemplate.id, selectedTravelerIds)
      useTripStore.setState(s => ({ packingItems: [...s.packingItems, ...(data.items || [])] }))
      toast.success(t('packing.templateApplied', { count: data.count }))
      setPendingTemplate(null)
      setSelectedTravelerIds([])
    } catch {
      toast.error(t('packing.templateError'))
    } finally {
      setApplying(false)
    }
  }

  if (templates.length === 0) return null

  return (
    <>
      <div ref={dropRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(v => !v)}
          disabled={applying}
          className={className ?? 'hover:opacity-[0.88]'}
          style={style}
        >
          <Package size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">{t('packing.applyTemplate')}</span>
        </button>
        {open && (
          <div
            className="trek-menu-enter"
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 50,
              background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 4, minWidth: 220,
              transformOrigin: 'top right',
            }}
          >
            {templates.filter(t => !t.is_personal).length > 0 && (
              <>
                <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Global
                </div>
                {templates.filter(t => !t.is_personal).map(tmpl => (
                  <TemplateRow key={tmpl.id} tmpl={tmpl} onClick={openTravelerPicker} t={t} />
                ))}
              </>
            )}
            {templates.filter(t => t.is_personal).length > 0 && (
              <>
                <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                  {t('packing.myTemplates')}
                </div>
                {templates.filter(t => t.is_personal).map(tmpl => (
                  <TemplateRow key={tmpl.id} tmpl={tmpl} onClick={openTravelerPicker} t={t} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Step-2 traveler picker modal */}
      {pendingTemplate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card, #fff)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{pendingTemplate.name}</div>
              <button onClick={() => setPendingTemplate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-secondary, #555)' }}>
                {t('travelers.selectTravelers')}
              </div>
              <TravelerSelector
                tripId={tripId}
                value={selectedTravelerIds}
                onChange={setSelectedTravelerIds}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingTemplate(null)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-primary, #e5e7eb)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                {t('travelers.cancel')}
              </button>
              <button
                onClick={confirmApply}
                disabled={applying || selectedTravelerIds.length === 0}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: selectedTravelerIds.length === 0 ? 'not-allowed' : 'pointer', opacity: selectedTravelerIds.length === 0 ? 0.5 : 1, fontSize: 13, fontWeight: 600 }}
              >
                {t('packing.applyTemplate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function TemplateRow({ tmpl, onClick, t }: { tmpl: Template; onClick: (t: Template) => void; t: (k: string, p?: any) => string }) {
  return (
    <button key={tmpl.id} onClick={() => onClick(tmpl)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: 'var(--text-primary)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <Package size={13} className="text-content-faint" />
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{tmpl.name}</span>
          {tmpl.traveler_type && (
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--text-faint)', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 999 }}>
              {t(`travelers.type.${tmpl.traveler_type}`)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
          {tmpl.item_count} {t('admin.packingTemplates.items')}
        </div>
      </div>
    </button>
  )
}
