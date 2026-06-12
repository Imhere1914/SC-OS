import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useBrand } from '@/contexts/BrandContext'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AnalyticsUpIcon,
  Clock01Icon,
  MoneyBag02Icon,
  Target02Icon,
  TradeUpIcon,
} from '@hugeicons/core-free-icons'

export const Route = createFileRoute('/pipeline')({ component: PipelineScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelStage {
  stage: string
  label: string
  count: number
  value_cents: number
}

interface MonthlyCreated {
  month: string
  count: number
  value_cents: number
}

interface TopDeal {
  id: string
  title: string
  value: number
  stage: string
  contact_name?: string
  probability?: number
}

interface Analytics {
  funnel: FunnelStage[]
  won_count: number
  lost_count: number
  win_rate: number
  avg_days_to_close: number
  total_pipeline_value: number
  weighted_pipeline: number
  total_won_value: number
  monthly_created: MonthlyCreated[]
  top_deals: TopDeal[]
  forecast_30: number
  forecast_60: number
  forecast_90: number
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtK(cents: number): string {
  const val = cents / 100
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(1) + 'M'
  if (val >= 1_000) return '$' + (val / 1_000).toFixed(1) + 'K'
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// ── Stage colors (consistent across CRM screens) ──────────────────────────────

const STAGE_HEX: Record<string, string> = {
  lead: '#94a3b8',
  qualified: '#0ea5e9',
  proposal: '#3b82f6',
  negotiation: '#f59e0b',
  won: '#10b981',
  lost: '#ef4444',
}

const stageColor = (stage: string) => STAGE_HEX[stage] ?? '#94a3b8'

const stageGradient = (color: string) =>
  `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`

// ── Shared card chrome ────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--theme-card)',
  borderColor: 'var(--theme-border)',
  backdropFilter: 'blur(10px)',
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-muted)' }}>
        {children}
      </h2>
      {sub && (
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--theme-muted)', opacity: 0.8 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string
  value: string
  sub?: string
  color: string
  icon: typeof MoneyBag02Icon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      style={cardStyle}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
      />
      <div className="pl-1.5">
        <span
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 38%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-muted)' }}>
          {label}
        </p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums" style={{ color: 'var(--theme-text)' }}>
          {value}
        </p>
        {sub && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--theme-muted)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Deal Funnel ───────────────────────────────────────────────────────────────

function DealFunnel({ funnel }: { funnel: FunnelStage[] }) {
  const maxCount = Math.max(...funnel.map(f => f.count), 1)
  return (
    <div className="rounded-xl border p-5" style={cardStyle}>
      <SectionTitle>Deal Funnel</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {funnel.map(stage => {
          const color = stageColor(stage.stage)
          const pct = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 4 : 0)
          return (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="flex w-24 shrink-0 items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--theme-muted)' }}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                {stage.label}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md" style={{ background: 'var(--theme-hover)' }}>
                <div
                  className="h-full rounded-md transition-all duration-150"
                  style={{ width: `${pct}%`, background: stageGradient(color) }}
                  title={`${stage.label}: ${stage.count} deals`}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color }}>
                {stage.count}
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color: 'var(--theme-muted)' }}>
                {fmtK(stage.value_cents)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Revenue Forecast ──────────────────────────────────────────────────────────

function ForecastSection({
  forecast_30,
  forecast_60,
  forecast_90,
}: {
  forecast_30: number
  forecast_60: number
  forecast_90: number
}) {
  return (
    <div className="rounded-xl border p-5" style={cardStyle}>
      <SectionTitle sub="Based on deal probability × close date">Revenue Forecast</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Next 30 days', value: forecast_30 },
          { label: 'Next 60 days', value: forecast_60 },
          { label: 'Next 90 days', value: forecast_90 },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border p-4 text-center transition-all duration-150 hover:-translate-y-px hover:shadow-md"
            style={{
              background: 'color-mix(in srgb, var(--theme-accent) 5%, var(--theme-card))',
              borderColor: 'color-mix(in srgb, var(--theme-accent) 18%, var(--theme-border))',
            }}
          >
            <p className="text-2xl font-bold leading-none tabular-nums" style={{ color: 'var(--theme-accent)' }}>
              {fmtCents(value)}
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-muted)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Monthly Trend ─────────────────────────────────────────────────────────────

function MonthlyTrend({ data }: { data: MonthlyCreated[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="rounded-xl border p-5" style={cardStyle}>
      <SectionTitle>Monthly Created (Last 6 Months)</SectionTitle>
      <div className="flex items-end gap-2 h-28">
        {data.map(item => {
          const heightPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0
          return (
            <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'var(--theme-accent)' }}>
                {item.count > 0 ? item.count : ''}
              </span>
              <div className="w-full rounded-t-md transition-all duration-150" style={{
                height: `${Math.max(heightPct, item.count > 0 ? 8 : 2)}%`,
                background: item.count > 0
                  ? 'linear-gradient(180deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 55%, #000))'
                  : 'var(--theme-border)',
                opacity: item.count > 0 ? 1 : 0.4,
                minHeight: '4px',
              }} />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map(item => (
          <div key={item.month} className="flex flex-1 justify-center">
            <span className="text-[9px]" style={{ color: 'var(--theme-muted)' }}>
              {item.month.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Top Deals Table ───────────────────────────────────────────────────────────

function TopDealsTable({ deals }: { deals: TopDeal[] }) {
  const navigate = useNavigate()
  return (
    <div className="rounded-xl border overflow-hidden" style={cardStyle}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-muted)' }}>
          Top Deals (Open)
        </h2>
      </div>
      {deals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--theme-muted)' }}>
          No open deals yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--theme-hover)' }}>
              {['Title', 'Contact', 'Stage', 'Probability', 'Value'].map(h => (
                <th
                  key={h}
                  className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider ${h === 'Value' ? 'text-right' : 'text-left'}`}
                  style={{ color: 'var(--theme-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map((deal, i) => {
              const color = stageColor(deal.stage)
              return (
                <tr
                  key={deal.id}
                  onClick={() => void navigate({ to: '/deals' })}
                  className="cursor-pointer transition-colors hover:bg-[var(--theme-hover)]"
                  style={i !== deals.length - 1 ? { borderBottom: '1px solid var(--theme-border)' } : undefined}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--theme-text)' }}>
                    {deal.title}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--theme-muted)' }}>
                    {deal.contact_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                      style={{
                        color,
                        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
                        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                      {deal.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums" style={{ color: 'var(--theme-muted)' }}>
                    {deal.probability != null ? `${deal.probability}%` : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-right tabular-nums" style={{ color: 'var(--theme-accent)' }}>
                    {fmtCents(deal.value)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Win/Loss Donut ────────────────────────────────────────────────────────────

function WinLossDonut({
  won_count,
  lost_count,
  total,
}: {
  won_count: number
  lost_count: number
  total: number
}) {
  const open = Math.max(total - won_count - lost_count, 0)
  const safeTotal = total || 1
  const wonPct = (won_count / safeTotal) * 100
  const lostPct = (lost_count / safeTotal) * 100

  // conic-gradient: green won, red lost, blue open
  const conicStr = total > 0
    ? `conic-gradient(
        #10b981 0% ${wonPct}%,
        #ef4444 ${wonPct}% ${wonPct + lostPct}%,
        #3b82f6 ${wonPct + lostPct}% 100%
      )`
    : 'conic-gradient(var(--theme-border) 0% 100%)'

  return (
    <div className="rounded-xl border p-5 flex flex-col items-center gap-4" style={cardStyle}>
      <h2 className="self-start text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-muted)' }}>
        Win / Loss Breakdown
      </h2>
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div
          className="h-full w-full rounded-full"
          style={{ background: conicStr, boxShadow: '0 2px 12px color-mix(in srgb, #10b981 20%, transparent)' }}
        />
        <div
          className="absolute h-20 w-20 rounded-full flex flex-col items-center justify-center"
          style={{ background: 'var(--theme-card)' }}
        >
          <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--theme-text)' }}>
            {total > 0 ? `${wonPct.toFixed(0)}%` : '—'}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--theme-muted)' }}>won</span>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        {[
          { label: 'Won', count: won_count, color: '#10b981' },
          { label: 'Lost', count: lost_count, color: '#ef4444' },
          { label: 'Open', count: open, color: '#3b82f6' },
        ].map(({ label, count, color }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              color,
              background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {label} <strong className="tabular-nums">{count}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

function PipelineScreen() {
  const brand = useBrand()

  const { data, isLoading, error } = useQuery<Analytics>({
    queryKey: ['pipeline-analytics', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/deals/analytics?brand=${brand.id}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json() as Promise<Analytics>
    },
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl opacity-60" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }} />
          <div className="space-y-2">
            <div className="h-4 w-44 rounded opacity-60" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }} />
            <div className="h-3 w-64 rounded opacity-60" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-xl opacity-60" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }} />
          ))}
        </div>
        <div className="h-56 rounded-xl opacity-60" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }} />
        <div className="h-36 rounded-xl opacity-60" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm" style={{ color: '#ef4444' }}>Failed to load analytics.</p>
      </div>
    )
  }

  const totalDeals = data.funnel.reduce((s, f) => s + f.count, 0)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${brand.accentColor} 38%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={AnalyticsUpIcon} size={19} className="text-white" />
        </span>
        <div>
          <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--theme-text)' }}>
            Pipeline Analytics
          </h1>
          <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
            Win rate, velocity, deal funnel &amp; revenue forecast
          </p>
        </div>
      </div>

      {/* Section 1 — KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Pipeline" value={fmtK(data.total_pipeline_value)} color="#3b82f6" icon={MoneyBag02Icon} />
        <KpiCard label="Weighted Pipeline" value={fmtK(data.weighted_pipeline)} sub="by probability" color="#8b5cf6" icon={Target02Icon} />
        <KpiCard label="Win Rate" value={`${data.win_rate}%`} color="#10b981" icon={TradeUpIcon} />
        <KpiCard label="Avg Days to Close" value={`${data.avg_days_to_close} days`} color="#f59e0b" icon={Clock01Icon} />
      </div>

      {/* Section 2 — Deal Funnel */}
      <DealFunnel funnel={data.funnel} />

      {/* Section 3 — Revenue Forecast */}
      <ForecastSection
        forecast_30={data.forecast_30}
        forecast_60={data.forecast_60}
        forecast_90={data.forecast_90}
      />

      {/* Sections 4 + 6 — Monthly Trend + Win/Loss side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyTrend data={data.monthly_created} />
        <WinLossDonut
          won_count={data.won_count}
          lost_count={data.lost_count}
          total={totalDeals}
        />
      </div>

      {/* Section 5 — Top Deals */}
      <TopDealsTable deals={data.top_deals} />
    </div>
  )
}
