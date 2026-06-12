import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Activity01Icon,
  UserGroupIcon,
  DollarCircleIcon,
  Money01Icon,
  Download01Icon,
  FilterHorizontalIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { ScreenShell } from '@/components/screen-shell'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/activity')({ component: ActivityFeedPage })

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityType =
  | 'contact.created'
  | 'deal.won'
  | 'deal.created'
  | 'deal.lost'
  | 'invoice.paid'
  | 'invoice.created'
  | 'appointment.booked'
  | 'appointment.completed'
  | 'form.submitted'
  | 'campaign.sent'
  | 'note.added'
  | 'task.completed'
  | 'payment.received'
  | 'review.received'
  | 'sequence.enrolled'
  | 'ticket.created'
  | 'ticket.resolved'
  | 'proposal.accepted'
  | 'custom'

interface ActivityRecord {
  id: string
  brand: string
  type: ActivityType
  entity_type?: string
  entity_id?: string
  entity_name?: string
  actor: string
  message: string
  metadata?: Record<string, unknown>
  icon?: string
  created_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

type FilterCategory = 'all' | 'contacts' | 'deals' | 'invoices' | 'appointments' | 'forms' | 'campaigns'

const FILTER_LABELS: { id: FilterCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'deals', label: 'Deals' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'forms', label: 'Forms' },
  { id: 'campaigns', label: 'Campaigns' },
]

const ENTITY_TYPE_MAP: Record<FilterCategory, string[]> = {
  all: [],
  contacts: ['contact'],
  deals: ['deal'],
  invoices: ['invoice'],
  appointments: ['appointment'],
  forms: ['form'],
  campaigns: ['campaign'],
}

type DateRange = 'today' | 'week' | 'month' | 'all'

const DATE_RANGE_LABELS: { id: DateRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
]

const TYPE_EMOJI: Record<string, string> = {
  'contact.created': '👤',
  'deal.won': '🏆',
  'deal.created': '💼',
  'deal.lost': '📉',
  'invoice.paid': '💳',
  'invoice.created': '🧾',
  'appointment.booked': '📅',
  'appointment.completed': '✅',
  'form.submitted': '📋',
  'campaign.sent': '📧',
  'note.added': '📝',
  'task.completed': '☑️',
  'payment.received': '💰',
  'review.received': '⭐',
  'sequence.enrolled': '🔄',
  'ticket.created': '🎫',
  'ticket.resolved': '✔️',
  'proposal.accepted': '🤝',
  'custom': '🔔',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr: string): string {
  const now = Date.now()
  const then = new Date(isoStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 172800) return 'Yesterday'
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayLabel(isoStr: string): string {
  const d = new Date(isoStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(d)
  that.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function getDateFrom(range: DateRange): string | undefined {
  if (range === 'all') return undefined
  const d = new Date()
  if (range === 'today') {
    d.setHours(0, 0, 0, 0)
  } else if (range === 'week') {
    d.setDate(d.getDate() - 7)
  } else if (range === 'month') {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}

function entityLink(record: ActivityRecord): string | null {
  if (!record.entity_type || !record.entity_id) return null
  const map: Record<string, string> = {
    contact: '/contacts',
    deal: '/deals',
    invoice: '/payments',
    appointment: '/appointments',
    form: '/forms',
    campaign: '/campaigns',
    ticket: '/tickets',
    proposal: '/proposals',
  }
  const base = map[record.entity_type]
  return base ? `${base}/${record.entity_id}` : null
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchActivities(brand: string, opts: {
  entity_types?: string[]
  from?: string
  limit?: number
}): Promise<{ activities: ActivityRecord[]; total: number }> {
  const params = new URLSearchParams()
  if (brand !== 'default') params.set('brand', brand)
  if (opts.from) params.set('from', opts.from)
  if (opts.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  const res = await fetch(`/api/activity${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to load activity feed')
  return res.json()
}

async function fetchActivityStats(brand: string): Promise<{ stats: Record<string, number> }> {
  const qs = brand !== 'default' ? `?brand=${brand}` : ''
  const res = await fetch(`/api/activity/stats${qs}`)
  if (!res.ok) throw new Error('Failed to load stats')
  return res.json()
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({ brand }: { brand: { id: string } }) {
  const { data } = useQuery({
    queryKey: ['activity-stats', brand.id],
    queryFn: () => fetchActivityStats(brand.id),
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const stats = data?.stats ?? {}
  const todayActivities = useQuery({
    queryKey: ['activity-today', brand.id],
    queryFn: () => fetchActivities(brand.id, { from: getDateFrom('today'), limit: 1000 }),
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const weekActivities = useQuery({
    queryKey: ['activity-week', brand.id],
    queryFn: () => fetchActivities(brand.id, { from: getDateFrom('week'), limit: 1000 }),
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const todayTotal = todayActivities.data?.total ?? 0
  const weekContacts = (weekActivities.data?.activities ?? []).filter(a => a.type === 'contact.created').length
  const monthDealsWon = (stats['deal.won'] ?? 0)
  const monthInvoicesPaid = (stats['invoice.paid'] ?? 0)

  const tiles = [
    { label: 'Events Today', value: todayTotal, icon: Activity01Icon, color: '#6366f1' },
    { label: 'Contacts This Week', value: weekContacts, icon: UserGroupIcon, color: '#22c55e' },
    { label: 'Deals Won (30d)', value: monthDealsWon, icon: DollarCircleIcon, color: '#f59e0b' },
    { label: 'Invoices Paid (30d)', value: monthInvoicesPaid, icon: Money01Icon, color: '#3b82f6' },
  ]

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map(tile => (
        <div
          key={tile.label}
          className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
            style={{ background: `linear-gradient(180deg, ${tile.color}, color-mix(in srgb, ${tile.color} 40%, transparent))` }}
          />
          <div className="pl-1.5">
            <span
              className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${tile.color}, color-mix(in srgb, ${tile.color} 65%, #000))`,
                boxShadow: `0 2px 8px color-mix(in srgb, ${tile.color} 35%, transparent)`,
              }}
            >
              <HugeiconsIcon icon={tile.icon} size={15} className="text-white" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{tile.label}</p>
            <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{tile.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Activity item ─────────────────────────────────────────────────────────────

function ActivityItem({ record }: { record: ActivityRecord }) {
  const emoji = record.icon ?? TYPE_EMOJI[record.type] ?? '🔔'
  const link = entityLink(record)

  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-3.5 transition-colors hover:bg-[var(--theme-hover)]"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]"
        style={{
          background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
          border: '1px solid color-mix(in srgb, var(--theme-accent) 25%, transparent)',
        }}
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-[450] text-[var(--theme-text)] leading-snug">
          {record.message}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {record.entity_name && link ? (
            <a
              href={link}
              className="text-[11px] font-medium hover:underline"
              style={{ color: 'var(--theme-accent)' }}
            >
              {record.entity_name}
            </a>
          ) : record.entity_name ? (
            <span className="text-[11px] text-[var(--theme-muted)]">{record.entity_name}</span>
          ) : null}
          {record.actor && record.actor !== 'system' && (
            <span className="text-[11px] text-[var(--theme-muted)]">by {record.actor}</span>
          )}
          <span className="text-[11px] text-[var(--theme-muted)]">{timeAgo(record.created_at)}</span>
          <span
            className="rounded border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }}
          >
            {record.type}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(activities: ActivityRecord[]) {
  const headers = ['id', 'type', 'entity_type', 'entity_name', 'actor', 'message', 'created_at']
  const rows = activities.map(a =>
    headers.map(h => {
      const val = (a as unknown as Record<string, unknown>)[h] ?? ''
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `activity-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ActivityFeedPage() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')

  const from = getDateFrom(dateRange)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activity-feed', brand.id, dateRange],
    queryFn: () => fetchActivities(brand.id, { from, limit: 500 }),
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const filtered = useMemo(() => {
    const activities = data?.activities ?? []
    if (filterCategory === 'all') return activities
    const entityTypes = ENTITY_TYPE_MAP[filterCategory]
    return activities.filter(a => a.entity_type && entityTypes.includes(a.entity_type))
  }, [data, filterCategory])

  const categoryCounts = useMemo(() => {
    const activities = data?.activities ?? []
    const counts: Record<FilterCategory, number> = {
      all: activities.length, contacts: 0, deals: 0, invoices: 0, appointments: 0, forms: 0, campaigns: 0,
    }
    for (const a of activities) {
      if (!a.entity_type) continue
      for (const { id } of FILTER_LABELS) {
        if (id !== 'all' && ENTITY_TYPE_MAP[id].includes(a.entity_type)) counts[id] += 1
      }
    }
    return counts
  }, [data])

  const grouped = useMemo(() => {
    const groups: { label: string; records: ActivityRecord[] }[] = []
    for (const record of filtered) {
      const label = dayLabel(record.created_at)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.records.push(record)
      else groups.push({ label, records: [record] })
    }
    return groups
  }, [filtered])

  return (
    <ScreenShell
      icon={Activity01Icon}
      title="Activity Feed"
      subtitle="Unified event timeline across all modules"
      onRefresh={() => {
        void qc.invalidateQueries({ queryKey: ['activity-feed'] })
        void qc.invalidateQueries({ queryKey: ['activity-stats'] })
        void qc.invalidateQueries({ queryKey: ['activity-today'] })
        void qc.invalidateQueries({ queryKey: ['activity-week'] })
        void refetch()
      }}
      action={
        <button
          onClick={() => exportCsv(filtered)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <HugeiconsIcon icon={Download01Icon} size={13} />
          Export CSV
        </button>
      }
    >
      {/* Stats strip */}
      <StatsStrip brand={brand} />

      <div className="flex gap-5">
        {/* Left sidebar filter */}
        <aside className="hidden shrink-0 md:block" style={{ width: 160 }}>
          <div
            className="sticky top-0 rounded-xl border p-2"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
          >
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
              Filter
            </p>
            {FILTER_LABELS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterCategory(id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-left transition-all duration-150',
                  filterCategory === id
                    ? 'text-[var(--theme-accent)]'
                    : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-hover)]',
                )}
                style={filterCategory === id
                  ? { background: 'color-mix(in srgb, var(--theme-accent) 12%, transparent)', boxShadow: 'inset 2px 0 0 var(--theme-accent)' }
                  : undefined}
              >
                <span>{label}</span>
                <span className={cn('text-[10px] tabular-nums', filterCategory === id ? 'opacity-80' : 'text-[var(--theme-muted)] opacity-70')}>
                  {categoryCounts[id]}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main feed */}
        <div className="min-w-0 flex-1">
          {/* Date range filter + mobile category filter */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <HugeiconsIcon icon={FilterHorizontalIcon} size={13} className="text-[var(--theme-muted)]" />
            {DATE_RANGE_LABELS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setDateRange(id)}
                className={cn(
                  'rounded-lg border px-3 py-1 text-[11px] font-medium transition-colors',
                  dateRange === id
                    ? 'text-[var(--theme-accent)]'
                    : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={
                  dateRange === id
                    ? { borderColor: 'var(--theme-accent)', background: 'var(--theme-accent-soft)' }
                    : { borderColor: 'var(--theme-border)' }
                }
              >
                {label}
              </button>
            ))}

            {/* Mobile category selector */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as FilterCategory)}
              className="ml-auto rounded-lg border px-2 py-1 text-[11px] text-[var(--theme-text)] md:hidden"
              style={{
                background: 'var(--theme-card)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            >
              {FILTER_LABELS.map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>

            <span className="ml-auto hidden text-[11px] text-[var(--theme-muted)] md:inline">
              {filtered.length} events
            </span>
          </div>

          {/* Feed */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl border"
                  style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-xl border py-16 text-center"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            >
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                style={{ background: 'var(--theme-accent-soft)' }}
              >
                🔔
              </div>
              <p className="text-[14px] font-medium text-[var(--theme-text)]">No activity yet</p>
              <p className="mt-1 text-[12px] text-[var(--theme-muted)]">
                Events from all modules will appear here as they happen.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(group => (
                <section key={group.label}>
                  <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                    {group.label}
                  </h3>
                  <div className="space-y-2">
                    {group.records.map(record => (
                      <ActivityItem key={record.id} record={record} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScreenShell>
  )
}
