import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { tripsApi } from '../../api/client'
import { useTranslation } from '../../i18n'

interface ReadinessIssue {
  key: 'passport' | 'missing_transport' | 'packing'
  count: number
  detail: string[]
}

interface TripReadinessBannerProps {
  tripId: number
  onNavigateTab: (tab: string) => void
}

const ISSUE_TAB: Record<ReadinessIssue['key'], string> = {
  passport: 'dateien', // Files tab — where documents live
  missing_transport: 'transports',
  packing: 'listen', // Lists tab — where packing lives
}

export function TripReadinessBanner({ tripId, onNavigateTab }: TripReadinessBannerProps) {
  const { t } = useTranslation()
  const [issues, setIssues] = useState<ReadinessIssue[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(`trek-readiness-dismissed-${tripId}`) === 'true')
    tripsApi.getReadiness(tripId).then(data => setIssues(data.issues || [])).catch(() => setIssues([]))
  }, [tripId])

  if (dismissed || issues.length === 0) return null

  const handleDismiss = () => {
    sessionStorage.setItem(`trek-readiness-dismissed-${tripId}`, 'true')
    setDismissed(true)
  }

  const lineFor = (issue: ReadinessIssue): string => {
    const names = issue.detail.join(', ')
    if (issue.key === 'passport') return t('planner.readinessPassport', { names })
    if (issue.key === 'missing_transport') return t('planner.readinessMissingTransport', { names })
    return t('planner.readinessPacking', { detail: issue.detail[0] || '' })
  }

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', background: 'var(--amber-bg, #fffbeb)',
        borderBottom: '1px solid var(--amber-border, #f59e0b)',
        fontSize: 12.5, color: 'var(--amber-text, #92400e)',
        flexShrink: 0,
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
        <span style={{ fontWeight: 600, flexShrink: 0 }}>
          {t('planner.readinessTitle', { count: String(issues.length) })}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
          {issues.map(lineFor).join(' · ')}
        </span>
      </div>
      <button
        onClick={() => onNavigateTab(ISSUE_TAB[issues[0].key])}
        style={{ fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', flexShrink: 0, padding: 0, fontSize: 12.5 }}
      >
        {t('planner.readinessView')}
      </button>
      <button
        onClick={handleDismiss}
        title={t('common.close')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'inherit', opacity: 0.7, flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
