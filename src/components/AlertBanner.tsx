import { useQuery } from '@tanstack/react-query'
import { useBrand } from '@/contexts/BrandContext'
import { useNavigate } from '@tanstack/react-router'

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  body: string
  action_label?: string
  action_url?: string
}

const SEVERITY_STYLES = {
  critical: { bg: 'color-mix(in srgb, #ef4444 10%, var(--theme-card))', border: '#ef4444', dot: '#ef4444' },
  warning: { bg: 'color-mix(in srgb, #f59e0b 10%, var(--theme-card))', border: '#f59e0b', dot: '#f59e0b' },
  info: { bg: 'color-mix(in srgb, #3b82f6 8%, var(--theme-card))', border: '#3b82f6', dot: '#3b82f6' },
}

export function AlertBanner() {
  const brand = useBrand()
  const navigate = useNavigate()
  const { data } = useQuery<{ alerts: Alert[]; count: number }>({
    queryKey: ['alerts', brand.id],
    queryFn: () => fetch(`/api/alerts?brand=${brand.id}`).then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })

  const alerts = data?.alerts ?? []
  if (alerts.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {alerts.map(alert => {
        const styles = SEVERITY_STYLES[alert.severity]
        return (
          <div
            key={alert.id}
            className="flex items-start gap-3 rounded-xl border px-4 py-3"
            style={{ background: styles.bg, borderColor: styles.border + '40' }}
          >
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: styles.dot }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: styles.dot }}>
                  {alert.category}
                </span>
                <span className="text-[13px] font-medium text-[var(--theme-text)]">{alert.title}</span>
              </div>
              <p className="text-[12px] text-[var(--theme-muted)] mt-0.5 truncate">{alert.body}</p>
            </div>
            {alert.action_label && alert.action_url && (
              <button
                onClick={() => void navigate({ to: alert.action_url as '/' })}
                className="shrink-0 rounded-lg px-3 py-1 text-[12px] font-medium text-white transition-opacity hover:opacity-80"
                style={{ background: styles.dot }}
              >
                {alert.action_label}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
