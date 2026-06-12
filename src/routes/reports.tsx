import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertCircleIcon,
  BarChartIcon,
  Calendar01Icon,
  DollarCircleIcon,
  Download05Icon,
  RefreshIcon,
  UserGroupIcon,
  Target02Icon,
  ZapIcon,
  TradeUpIcon,
  CheckmarkCircle02Icon,
  ChartHistogramIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { listDeals, type DealStage } from '../lib/deals-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/reports')({ component: ReportsScreen })

// ── Types ─────────────────────────────────────────────────────────────────────
type ReportsData = {
  totals: {
    contacts: number; customers: number; revenue_paid: number; revenue_outstanding: number
    appointments_completed: number; campaigns_sent: number; posts_published: number; conversion_rate: number
  }
  pipelineFunnel:   { stage: string; count: number; pct: number }[]
  contactsByMonth:  { month: string; count: number }[]
  revenueByMonth:   { month: string; amount: number }[]
  revenueMax:       number
  apptsByMonth:     { month: string; count: number }[]
  campaignStats:    { name: string; recipients: number; sent: number; opens: number; rate: number }[]
  convsByChannel:   { channel: string; count: number }[]
  convsByMonth:     { month: string; count: number }[]
  automationStats:  { total: number; thisWeek: number; successRate: number }
}

type DateRange = { label: string; days: number | null }

const DATE_RANGES: DateRange[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: 'All time', days: null },
]

// ── CSV export helpers ────────────────────────────────────────────────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n')
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

async function exportContacts(brandId?: string) {
  const url = new URL('/api/contacts', location.origin)
  if (brandId && brandId !== 'default') url.searchParams.set('brand', brandId)
  const res = await fetch(url)
  const { contacts } = await res.json()
  const rows = (contacts as Record<string, unknown>[]).map(c => ({
    name: c.name, email: c.email ?? '', phone: c.phone ?? '',
    company: c.company ?? '', stage: c.stage, source: c.source,
    tags: Array.isArray(c.tags) ? (c.tags as string[]).join('; ') : '',
    notes: c.notes ?? '', created_at: (c.created_at as string)?.slice(0, 10) ?? '',
  }))
  downloadCsv(`contacts-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
}

async function exportDeals(brandId?: string) {
  const url = new URL('/api/deals', location.origin)
  if (brandId && brandId !== 'default') url.searchParams.set('brand', brandId)
  const res = await fetch(url)
  const deals = await res.json()
  const rows = (deals as Record<string, unknown>[]).map(d => ({
    title: d.title, contact_name: d.contact_name ?? '', stage: d.stage,
    value_usd: (((d.value as number) ?? 0) / 100).toFixed(2),
    probability: d.probability ?? '', expected_close: d.expected_close ?? '',
    notes: d.notes ?? '', created_at: (d.created_at as string)?.slice(0, 10) ?? '',
  }))
  downloadCsv(`deals-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
}

async function exportInvoices(brandId?: string) {
  const url = new URL('/api/invoices', location.origin)
  if (brandId && brandId !== 'default') url.searchParams.set('brand', brandId)
  const res = await fetch(url)
  const invoices = await res.json()
  const rows = (invoices as Record<string, unknown>[]).map(iv => ({
    number: iv.number ?? '', contact_name: iv.contact_name ?? '',
    status: iv.status, amount_usd: (((iv.amount_cents as number) ?? 0) / 100).toFixed(2),
    due_date: iv.due_date ?? '', paid_at: iv.paid_at ?? '',
    created_at: (iv.created_at as string)?.slice(0, 10) ?? '',
  }))
  downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
}

// ── Reports API ───────────────────────────────────────────────────────────────

async function fetchReports(brand?: string, since?: string): Promise<ReportsData> {
  const url = new URL('/api/reports', location.origin)
  if (brand) url.searchParams.set('brand', brand)
  if (since) url.searchParams.set('since', since)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load reports')
  return res.json()
}

// ── Shared design tokens ──────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

// horizontal gradient fill for bars
const barGradient = (c: string) => `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 65%, #000))`
const vertGradient = (c: string) => `linear-gradient(180deg, color-mix(in srgb, ${c} 75%, #000), ${c})`

// ── Chart primitives ──────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8', contacted: '#3b82f6', qualified: '#f59e0b', customer: '#22c55e', lost: '#ef4444',
}

const CHANNEL_COLORS: Record<string, string> = {
  manual: '#6366f1', email: '#0ea5e9', sms: '#22c55e', whatsapp: '#25d366',
  instagram: '#e1306c', twitter: '#1da1f2', phone: '#f59e0b',
}

function BarChart({ data, valueKey, labelKey, color, formatVal }: {
  data: Record<string, number | string>[]
  valueKey: string
  labelKey: string
  color?: string | ((d: Record<string, number | string>) => string)
  formatVal?: (v: number) => string
}) {
  const values = data.map(d => Number(d[valueKey]))
  const max = Math.max(...values, 1)
  const getColor = typeof color === 'function' ? color : () => color ?? 'var(--theme-accent)'
  return (
    <div className="flex h-36 items-end gap-1.5">
      {data.map((d, i) => {
        const v = values[i]
        const pct = Math.round((v / max) * 100)
        return (
          <div key={i} className="group flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-[var(--theme-muted)] opacity-0 transition-opacity group-hover:opacity-100">
              {formatVal ? formatVal(v) : v}
            </span>
            <div
              className="w-full min-h-[4px] rounded-t-md transition-all duration-700"
              style={{ height: `${Math.max(pct, v > 0 ? 4 : 1)}%`, background: vertGradient(getColor(d)) }}
            />
            <span className="truncate text-center text-[9px] text-[var(--theme-muted)]">{String(d[labelKey])}</span>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const radius = 42
  const circ = 2 * Math.PI * radius
  let offset = 0
  const slices = data.map(d => {
    const pct = total > 0 ? d.value / total : 0
    const slice = { ...d, pct, dashOffset: offset }
    offset += pct
    return slice
  })

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--theme-hover)" strokeWidth="14" />
        {slices.map((s, i) => (
          <circle
            key={i}
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.pct * circ} ${circ}`}
            strokeDashoffset={-s.dashOffset * circ}
            className="transition-all duration-700"
          />
        ))}
      </svg>
      <div className="min-w-0 space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-[11px] capitalize text-[var(--theme-text)]">{s.label}</span>
            <span className="ml-auto pl-3 text-[11px] font-semibold tabular-nums text-[var(--theme-muted)]">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Stat card: left accent bar + gradient icon chip
function KpiCard({ label, value, sub, color, icon }: {
  label: string
  value: string | number
  sub?: string
  color: string
  icon: typeof BarChartIcon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{ backdropFilter: 'blur(10px)' }}
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
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// Framed chart card with section label
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 transition-all duration-150 hover:shadow-sm"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
        <span className="h-3 w-[3px] rounded-full" style={{ background: ACCENT_GRADIENT }} />
        {title}
      </h2>
      {children}
    </div>
  )
}

// Segmented control for the date-range selector
function DateRangeControl({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
      {DATE_RANGES.map(r => (
        <button
          key={r.label}
          onClick={() => onChange(r)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
            r.label === range.label ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
          )}
          style={r.label === range.label ? {
            background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
            color: 'var(--theme-accent)',
          } : undefined}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ── Deals analytics tab ───────────────────────────────────────────────────────

const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  lead: '#94a3b8', qualified: '#3b82f6', proposal: '#a855f7',
  negotiation: '#f59e0b', won: '#22c55e', lost: '#ef4444',
}

function DealsTab({ brandId }: { brandId: string }) {
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', brandId],
    queryFn: () => listDeals(brandId !== 'default' ? brandId : undefined),
    refetchInterval: 60_000,
  })

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />

  const stages: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
  const byStage = stages.map(s => ({
    stage: s,
    count: deals.filter(d => d.stage === s).length,
    value: deals.filter(d => d.stage === s).reduce((sum, d) => sum + d.value, 0),
  }))

  const pipelineDeals = deals.filter(d => !['won', 'lost'].includes(d.stage))
  const pipelineValue = pipelineDeals.reduce((s, d) => s + d.value, 0)
  const forecastValue = pipelineDeals.reduce((s, d) => s + d.value * ((d.probability ?? 50) / 100), 0)
  const wonValue = deals.filter(d => d.stage === 'won').reduce((s, d) => s + d.value, 0)
  const lostValue = deals.filter(d => d.stage === 'lost').reduce((s, d) => s + d.value, 0)
  const winRate = deals.filter(d => ['won', 'lost'].includes(d.stage)).length > 0
    ? Math.round((deals.filter(d => d.stage === 'won').length / deals.filter(d => ['won', 'lost'].includes(d.stage)).length) * 100)
    : 0
  const avgDealValue = deals.length > 0 ? Math.round(deals.reduce((s, d) => s + d.value, 0) / deals.length) : 0

  const fmt = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Pipeline value" value={fmt(pipelineValue)} sub={`${pipelineDeals.length} open deals`} color="#0ea5e9" icon={DollarCircleIcon} />
        <KpiCard label="Weighted forecast" value={fmt(Math.round(forecastValue))} sub="by probability" color="#a855f7" icon={TradeUpIcon} />
        <KpiCard label="Won" value={fmt(wonValue)} sub={`${deals.filter(d => d.stage === 'won').length} deals · ${winRate}% win rate`} color="#22c55e" icon={CheckmarkCircle02Icon} />
        <KpiCard label="Avg deal size" value={fmt(avgDealValue)} sub={`${deals.length} total deals`} color="#f97316" icon={ChartHistogramIcon} />
      </div>

      {/* Pipeline by stage */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Pipeline by Stage (value)">
          {byStage.every(s => s.value === 0) ? (
            <p className="py-8 text-center text-xs text-[var(--theme-muted)]">No deals yet</p>
          ) : (
            <div className="space-y-2.5">
              {byStage.map(row => {
                const maxVal = Math.max(...byStage.map(s => s.value), 1)
                const pct = Math.round((row.value / maxVal) * 100)
                return (
                  <div key={row.stage} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-right text-[11px] font-medium capitalize text-[var(--theme-muted)]">{row.stage}</span>
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[var(--theme-hover)]">
                      <div
                        className="flex h-full items-center rounded-lg px-2 transition-all duration-700"
                        style={{ width: `${Math.max(pct, row.value > 0 ? 6 : 0)}%`, background: barGradient(DEAL_STAGE_COLORS[row.stage]) }}
                      >
                        {row.value > 0 && <span className="text-[11px] font-bold tabular-nums text-white">{fmt(row.value)}</span>}
                      </div>
                    </div>
                    <span className="w-6 text-right text-[11px] tabular-nums text-[var(--theme-muted)]">{row.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Won vs Lost">
          {wonValue === 0 && lostValue === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--theme-muted)]">No closed deals yet</p>
          ) : (
            <DonutChart
              total={wonValue + lostValue}
              data={[
                { label: 'Won', value: wonValue / 100, color: '#22c55e' },
                { label: 'Lost', value: lostValue / 100, color: '#ef4444' },
              ]}
            />
          )}
        </ChartCard>
      </div>

      {/* Deals list */}
      <ChartCard title={`All deals (${deals.length})`}>
        {deals.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--theme-muted)]">No deals created yet</p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {deals.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--theme-hover)]">
                <div>
                  <p className="text-sm font-medium text-[var(--theme-text)]">{d.title}</p>
                  {d.contact_name && <p className="text-[11px] text-[var(--theme-muted)]">{d.contact_name}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {d.value > 0 && <span className="text-sm font-semibold tabular-nums text-[var(--theme-text)]">{fmt(d.value)}</span>}
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                    style={{
                      background: `color-mix(in srgb, ${DEAL_STAGE_COLORS[d.stage]} 12%, var(--theme-card))`,
                      color: DEAL_STAGE_COLORS[d.stage],
                      border: `1px solid color-mix(in srgb, ${DEAL_STAGE_COLORS[d.stage]} 30%, transparent)`,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: DEAL_STAGE_COLORS[d.stage] }} />
                    {d.stage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  )
}

// ── Export dropdown ───────────────────────────────────────────────────────────
function ExportMenu({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false)

  async function run(fn: (id?: string) => Promise<void>, label: string) {
    setOpen(false)
    try {
      await fn(brandId)
      toast(`${label} exported`)
    } catch {
      toast(`Export failed`, { type: 'error' })
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-1.5 text-[11px] font-medium text-[var(--theme-text)] transition-colors hover:border-[var(--theme-accent)]"
      >
        <HugeiconsIcon icon={Download05Icon} size={13} />
        Export CSV
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-1 shadow-xl">
            {[
              { label: 'Contacts', fn: exportContacts },
              { label: 'Deals', fn: exportDeals },
              { label: 'Invoices', fn: exportInvoices },
            ].map(({ label, fn }) => (
              <button
                key={label}
                onClick={() => run(fn, label)}
                className="w-full px-4 py-2 text-left text-[12px] text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-hover)]"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
function ReportsScreen() {
  const brand = useBrand()
  const [range, setRange] = useState<DateRange>(DATE_RANGES[3]) // default 6 months
  const [tab, setTab] = useState<'overview' | 'deals'>('overview')

  const since = range.days != null
    ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString()
    : undefined

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', brand.id, range.days],
    queryFn: () => fetchReports(brand.id !== 'default' ? brand.id : undefined, since),
    refetchInterval: 120_000,
  })

  return (
    <div className="min-h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={BarChartIcon} size={17} className="text-white" />
              </div>
              <div>
                <h1 className="text-[18px] font-bold text-[var(--theme-text)]">Reports</h1>
                <p className="text-[11px] text-[var(--theme-muted)]">Business performance at a glance</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            {/* Export */}
            <ExportMenu brandId={brand.id} />
            {/* Tab switcher — segmented control */}
            <div className="flex gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
              {(['overview', 'deals'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold capitalize transition-all',
                    tab === t ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  style={tab === t ? {
                    background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                    color: 'var(--theme-accent)',
                  } : undefined}
                >
                  <HugeiconsIcon icon={t === 'deals' ? DollarCircleIcon : BarChartIcon} size={11} />
                  {t}
                </button>
              ))}
            </div>
            {/* Date range selector — only for overview tab */}
            {tab === 'overview' && <DateRangeControl range={range} onChange={setRange} />}
            </div>
          </div>
        </header>

        {/* Deals tab */}
        {tab === 'deals' && <DealsTab brandId={brand.id} />}

        {/* Overview tab */}
        {tab === 'overview' && isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />)}
            </div>
            <div className="h-48 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-48 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
              <div className="h-48 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
            </div>
          </div>
        )}

        {tab === 'overview' && isError && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-16 text-center">
            <span
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in srgb, #ef4444 12%, var(--theme-card))',
                color: '#ef4444',
              }}
            >
              <HugeiconsIcon icon={AlertCircleIcon} size={22} />
            </span>
            <p className="text-[13px] font-semibold text-[var(--theme-text)]">Couldn't load report data</p>
            <p className="mb-4 mt-1 text-[11px] text-[var(--theme-muted)]">
              {error instanceof Error ? error.message : 'An error occurred loading the reports'}
            </p>
            <button
              onClick={() => void refetch()}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={RefreshIcon} size={14} />
              Retry
            </button>
          </div>
        )}

        {tab === 'overview' && data && data.totals.contacts === 0 && data.totals.revenue_paid === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                color: 'var(--theme-accent)',
              }}
            >
              <HugeiconsIcon icon={Calendar01Icon} size={22} />
            </span>
            <p className="text-[13px] font-semibold text-[var(--theme-text)]">No data for this period</p>
            <p className="mb-4 mt-1 text-[11px] text-[var(--theme-muted)]">
              Try selecting a wider date range or check back after adding contacts and activity.
            </p>
            <DateRangeControl range={range} onChange={setRange} />
          </div>
        )}

        {tab === 'overview' && data && !(data.totals.contacts === 0 && data.totals.revenue_paid === 0) && (
          <div className="space-y-5">

            {/* ── KPI strip ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                label="Total contacts"
                value={data.totals.contacts}
                sub={`${data.totals.customers} customers`}
                color="#0ea5e9"
                icon={UserGroupIcon}
              />
              <KpiCard
                label="Conversion rate"
                value={`${data.totals.conversion_rate}%`}
                sub="lead → customer"
                color="#22c55e"
                icon={Target02Icon}
              />
              <KpiCard
                label="Revenue collected"
                value={`$${data.totals.revenue_paid.toLocaleString()}`}
                sub={`$${data.totals.revenue_outstanding.toLocaleString()} outstanding`}
                color="#10b981"
                icon={DollarCircleIcon}
              />
              <KpiCard
                label="Automations"
                value={data.automationStats.thisWeek}
                sub={`${data.automationStats.successRate}% success · ${data.automationStats.total} total`}
                color="#f97316"
                icon={ZapIcon}
              />
            </div>

            {/* ── Pipeline funnel ─────────────────────────────────── */}
            <ChartCard title="Pipeline Funnel">
              <div className="space-y-2.5">
                {data.pipelineFunnel.map(row => (
                  <div key={row.stage} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-right text-[11px] font-medium capitalize text-[var(--theme-muted)]">
                      {row.stage}
                    </span>
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[var(--theme-hover)]">
                      <div
                        className="flex h-full items-center rounded-lg px-2 transition-all duration-700"
                        style={{ width: `${Math.max(row.pct, row.count > 0 ? 6 : 0)}%`, background: barGradient(STAGE_COLORS[row.stage] ?? '#6366f1') }}
                      >
                        {row.count > 0 && <span className="text-[11px] font-bold tabular-nums text-white">{row.count}</span>}
                      </div>
                    </div>
                    <span className="w-8 text-right text-[11px] tabular-nums text-[var(--theme-muted)]">{row.pct}%</span>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* ── Row: contacts + conversations monthly ───────────── */}
            <div className="grid gap-4 md:grid-cols-2">
              <ChartCard title="New Contacts (6 months)">
                <BarChart data={data.contactsByMonth} valueKey="count" labelKey="month" />
              </ChartCard>
              <ChartCard title="Conversations (6 months)">
                <BarChart data={data.convsByMonth} valueKey="count" labelKey="month" color="#0ea5e9" />
              </ChartCard>
            </div>

            {/* ── Row: channel breakdown + revenue ────────────────── */}
            <div className="grid gap-4 md:grid-cols-2">
              <ChartCard title="Conversations by Channel">
                {data.convsByChannel.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[var(--theme-muted)]">No conversation data yet</p>
                ) : (
                  <DonutChart
                    total={data.convsByChannel.reduce((s, d) => s + d.count, 0)}
                    data={data.convsByChannel.map(d => ({
                      label: d.channel,
                      value: d.count,
                      color: CHANNEL_COLORS[d.channel] ?? '#94a3b8',
                    }))}
                  />
                )}
              </ChartCard>

              <ChartCard title="Revenue Collected (6 months)">
                <BarChart
                  data={data.revenueByMonth}
                  valueKey="amount"
                  labelKey="month"
                  color="#22c55e"
                  formatVal={v => `$${v.toFixed(0)}`}
                />
              </ChartCard>
            </div>

            {/* ── Row: appointments + campaigns ───────────────────── */}
            <div className="grid gap-4 md:grid-cols-2">
              <ChartCard title="Appointments (6 months)">
                <BarChart data={data.apptsByMonth} valueKey="count" labelKey="month" color="#f59e0b" />
              </ChartCard>

              <ChartCard title="Campaigns Sent">
                {data.campaignStats.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[var(--theme-muted)]">No sent campaigns yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.campaignStats.map((cp, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] px-3 py-2.5 transition-colors hover:border-[var(--theme-accent)]"
                        style={{ background: 'color-mix(in srgb, var(--theme-hover) 60%, var(--theme-card))' }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-[var(--theme-text)]">{cp.name}</p>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--theme-border)]">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${cp.rate}%`, background: barGradient('var(--theme-accent)') }}
                            />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums" style={{ color: cp.rate >= 80 ? '#22c55e' : 'var(--theme-text)' }}>
                            {cp.rate}%
                          </p>
                          <p className="text-[10px] tabular-nums text-[var(--theme-muted)]">{cp.recipients} recipients</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
