import React, { useRef, useState, useEffect } from 'react'
import { CloudRain, X, Check } from 'lucide-react'
import { packingApi } from '../../api/client'
import { useTripStore } from '../../store/tripStore'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'

interface WeatherSuggestion {
  reason: 'rain' | 'cold' | 'hot'
  name: string
}

interface WeatherSuggestButtonProps {
  tripId: number
  style: React.CSSProperties
  className?: string
}

export default function WeatherSuggestButton({ tripId, style, className }: WeatherSuggestButtonProps): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [suggestions, setSuggestions] = useState<WeatherSuggestion[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const dropRef = useRef<HTMLDivElement>(null)
  const toast = useToast()
  const { t } = useTranslation()

  useEffect(() => {
    if (suggestions === null) return
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setSuggestions(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [suggestions])

  const openSuggestions = async () => {
    setLoading(true)
    try {
      const data = await packingApi.weatherSuggestions(tripId)
      const items: WeatherSuggestion[] = data.suggestions || []
      setSuggestions(items)
      setSelected(new Set(items.map(i => i.name)))
    } catch {
      toast.error(t('packing.weatherSuggestError'))
    } finally {
      setLoading(false)
    }
  }

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const confirmAdd = async () => {
    if (!suggestions || selected.size === 0) return
    setAdding(true)
    try {
      const items = suggestions.filter(s => selected.has(s.name)).map(s => ({ name: s.name }))
      const data = await packingApi.bulkImport(tripId, items)
      useTripStore.setState(s => ({ packingItems: [...s.packingItems, ...(data.items || [])] }))
      toast.success(t('packing.weatherSuggestAdded', { count: items.length }))
      setSuggestions(null)
    } catch {
      toast.error(t('packing.weatherSuggestError'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button
        onClick={() => (suggestions === null ? openSuggestions() : setSuggestions(null))}
        disabled={loading}
        className={className ?? 'hover:opacity-[0.88]'}
        style={style}
      >
        <CloudRain size={14} strokeWidth={2.5} />
        <span className="hidden sm:inline">{loading ? '…' : t('packing.weatherSuggest')}</span>
      </button>

      {suggestions !== null && (
        <div
          className="trek-menu-enter"
          style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 50,
            background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 10, minWidth: 260,
            transformOrigin: 'top right',
          }}
        >
          {suggestions.length === 0 ? (
            <div style={{ padding: '8px 6px', fontSize: 12.5, color: 'var(--text-faint)' }}>
              {t('packing.weatherSuggestNone')}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 6px 8px' }}>
                {t('packing.weatherSuggestTitle')}
              </div>
              {suggestions.map(s => (
                <label key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={selected.has(s.name)} onChange={() => toggle(s.name)} />
                  {s.name}
                </label>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-primary)' }}>
                <button onClick={() => setSuggestions(null)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', fontSize: 12.5 }}>
                  {t('travelers.cancel')}
                </button>
                <button
                  onClick={confirmAdd}
                  disabled={adding || selected.size === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: selected.size === 0 ? 'not-allowed' : 'pointer', opacity: selected.size === 0 ? 0.5 : 1, fontSize: 12.5, fontWeight: 600 }}
                >
                  <Check size={13} /> {adding ? '…' : t('packing.weatherSuggestAdd')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
