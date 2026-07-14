import React from 'react'
import { authApi } from '../../api/client'
import type { TranslationFn } from '../../types'
import type { useAdmin } from './useAdmin'

interface AdminAiSettingsTabProps {
  admin: ReturnType<typeof useAdmin>
  t: TranslationFn
}

const PROVIDERS = [
  { value: '', labelKey: 'admin.ai.providerNone' },
  { value: 'anthropic', labelKey: 'admin.ai.providerAnthropic' },
  { value: 'openai_compatible', labelKey: 'admin.ai.providerOpenaiCompatible' },
]

// "AI Document Parsing" admin tab: BYO API key/endpoint used by the Files
// feature to parse passport/ID/visa/vaccination uploads (itinerary parsing is
// separate — it uses the local KItinerary binary, no key needed).
export default function AdminAiSettingsTab({ admin, t }: AdminAiSettingsTabProps): React.ReactElement {
  const { toast, smtpValues, setSmtpValues, smtpLoaded } = admin

  const provider = smtpValues.ai_provider || ''
  const apiKey = smtpValues.ai_api_key || ''
  const baseUrl = smtpValues.ai_base_url || ''
  const model = smtpValues.ai_model || ''

  const save = async (partial: Record<string, string>) => {
    setSmtpValues(prev => ({ ...prev, ...partial }))
    try {
      await authApi.updateAppSettings(partial)
      toast.success(t('admin.ai.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{t('admin.ai.title')}</h2>
          <p className="text-xs text-slate-400 mt-1">{t('admin.ai.subtitle')}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t('admin.ai.disclosure')}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.ai.provider')}</label>
            <select
              value={provider}
              onChange={e => save({ ai_provider: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
            >
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{t(p.labelKey)}</option>)}
            </select>
          </div>

          {provider && smtpLoaded && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.ai.apiKey')}</label>
                <input
                  type="password"
                  value={apiKey === '••••••••' ? '' : apiKey}
                  onChange={e => setSmtpValues(prev => ({ ...prev, ai_api_key: e.target.value }))}
                  onBlur={() => {
                    const val = smtpValues.ai_api_key
                    if (val === undefined || val === '••••••••') return
                    save({ ai_api_key: val })
                  }}
                  placeholder={apiKey === '••••••••' ? '••••••••' : (provider === 'anthropic' ? 'sk-ant-...' : 'sk-...')}
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">{t('admin.ai.apiKeyHint')}</p>
              </div>

              {provider === 'openai_compatible' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.ai.baseUrl')}</label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={e => setSmtpValues(prev => ({ ...prev, ai_base_url: e.target.value }))}
                    onBlur={() => save({ ai_base_url: smtpValues.ai_base_url || '' })}
                    placeholder="https://api.openai.com/v1"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">{t('admin.ai.baseUrlHint')}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.ai.model')}</label>
                <input
                  type="text"
                  value={model}
                  onChange={e => setSmtpValues(prev => ({ ...prev, ai_model: e.target.value }))}
                  onBlur={() => save({ ai_model: smtpValues.ai_model || '' })}
                  placeholder={provider === 'anthropic' ? 'claude-sonnet-4-5' : 'gpt-4o'}
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">{t('admin.ai.modelHint')}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
