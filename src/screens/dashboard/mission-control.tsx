import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiMagicIcon,
  Calendar01Icon,
  CalendarAdd01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  DollarCircleIcon,
  InvoiceIcon,
  Mail01Icon,
  Money01Icon,
  PipelineIcon,
  Refresh01Icon,
  UserAdd01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'

// ── Types ────────────────────────────────────────────────────────────────────

interface OverdueInvoiceItem {
  id: string
  contact_name: string
  amount: number
  days_overdue: number
}

interface ColdDealItem {
  id: string
  title: string
  stage: string
  days_since_update: number
}

interface AppointmentItem {
  id: string
  title: string
  contact_name: string | null
  start_time: string
  status: string
}

interface MissionControlData {
  urgent: {
    overdue_invoices: { count: number; total_cents: number; items: OverdueInvoiceItem[] }
    bills_due_this_week: { count: number; total_cents: number }
    cold_deals: { count: number; items: ColdDealItem[] }
    unread_conversations: number
  }
  today: {
    appointments: AppointmentItem[]
    tasks_due: number
  }
  momentum: {
    new_contacts_this_week: number
    revenue_this_month_cents: number
    deals_won_this_month: number
    invoices_paid_this_month: number
  }
  pipeline: {
    total_open_deals: number
    total_pipeline_value_cents: number
    by_stage: { stage: string; count: number; value_cents: number }[]
  }
  brand: string
  generated_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const STAGE_COLORS: Record<string, string> = {
  lead: '#6366f1',
  qualified: '#0ea5e9',
  proposal: '#f59e0b',
  negotiation: '#f97316',
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6366f1',
  confirmed: '#22c55e',
  completed: '#94a3b8',
  no_show: '#ef4444',
  cancelled: '#94a3b8',
}

// ── UrgentCard ───────────────────────────────────────────────────────────────

interface UrgentCardProps {
  icon: string
  title: string
  subtitle: string
  action: string
  href: string
}

function UrgentCard({ icon, title, subtitle, action, href }: UrgentCardProps) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: 'color-mix(in srgb, #ef4444 5%, var(--theme-card))',
        borderColor: 'color-mix(in srgb, #ef4444 25%, var(--theme-border))',
        borderLeftColor: '#ef4444',
        borderLeftWidth: '4px',
      }}
    >
      <span className="shrink-0 text-2xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--theme-text)]">{title}</p>
        <p className="truncate text-[11px] text-[var(--theme-muted)]">{subtitle}</p>
      </div>
      <Link
        to={href as '/'}
        className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:opacity-90"
        style={{ background: '#ef4444' }}
      >
        {action} →
      </Link>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub: string
  color: string
  icon: typeof Money01Icon
  href: string
  skeleton?: boolean
}

function KpiCard({ label, value, sub, color, icon, href, skeleton }: KpiCardProps) {
  return (
    <Link
      to={href as '/'}
      className="group relative flex flex-col overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: color }}
      />
      <div className="mb-3 flex items-center justify-between pl-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${color}18`, color }}
        >
          <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
        </span>
      </div>
      <div className="pl-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
          {label}
        </p>
        {skeleton ? (
          <div className="mt-1.5 h-7 w-20 animate-pulse rounded-md bg-[var(--theme-hover)]" />
        ) : (
          <p className="mt-1 text-[24px] font-bold leading-none text-[var(--theme-text)]">
            {value}
          </p>
        )}
        {!skeleton && (
          <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>
        )}
      </div>
    </Link>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border bg-[var(--theme-card)]"
            style={{ borderColor: 'var(--theme-border)' }}
          />
        ))}
      </div>
      <div
        className="h-40 animate-pulse rounded-xl border bg-[var(--theme-card)]"
        style={{ borderColor: 'var(--theme-border)' }}
      />
      <div
        className="h-48 animate-pulse rounded-xl border bg-[var(--theme-card)]"
        style={{ borderColor: 'var(--theme-border)' }}
      />
      <div className="grid grid-cols-3 gap-4 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border bg-[var(--theme-card)]"
            style={{ borderColor: 'var(--theme-border)' }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Hermes Ops widget ─────────────────────────────────────────────────────────

interface OrchestratorStatusData {
  config: { enabled: boolean; interval_hours: number; last_run_at?: string }
  last_run: { started_at: string } | null
  pending_count: number
}

function relTime(iso?: string | null): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const mins = Math.floor((Date.now() - then) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function HermesOpsCard() {
  const brand = useBrand()

  const { data } = useQuery<OrchestratorStatusData | null>({
    queryKey: ['orchestrator', 'status', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/orchestrator/status?brand=${brand.id}`)
      if (!res.ok) return null // backend not deployed yet — render nothing
      return res.json() as Promise<OrchestratorStatusData>
    },
    refetchInterval: 30_000,
  })

  if (!data) return null

  const pending = data.pending_count
  const lastRun = data.config.last_run_at ?? data.last_run?.started_at

  return (
    <Link
      to="/orchestrator"
      className="flex items-center gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
          boxShadow: `0 2px 8px color-mix(in srgb, ${brand.accentColor} 35%, transparent)`,
        }}
      >
        <HugeiconsIcon icon={AiMagicIcon} size={16} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--theme-text)]">Hermes Ops</p>
        {pending > 0 ? (
          <p className="text-[11px] font-medium text-[var(--theme-accent)]">
            {pending} proposal{pending !== 1 ? 's' : ''} awaiting review
          </p>
        ) : (
          <p className="text-[11px] text-[var(--theme-muted)]">
            All clear — no pending proposals
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {pending > 0 && (
          <span
            className="mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
            style={{ background: 'var(--theme-accent)' }}
          >
            {pending}
          </span>
        )}
        <p className="text-[10px] text-[var(--theme-muted)]">Last run {relTime(lastRun)}</p>
      </div>
    </Link>
  )
}

// ── Quick actions data ────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'New Contact',   emoji: '👤', href: '/contacts'     },
  { label: 'New Deal',      emoji: '💰', href: '/deals'        },
  { label: 'New Invoice',   emoji: '🧾', href: '/payments'     },
  { label: 'Schedule Appt', emoji: '📅', href: '/appointments' },
  { label: 'Send Campaign', emoji: '📧', href: '/campaigns'    },
  { label: 'Ask Hermes',    emoji: '🤖', href: '/chat'         },
] as const

// ── MissionControl ────────────────────────────────────────────────────────────

export function MissionControl() {
  const brand = useBrand()
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())

  // Tick every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { data, isLoading, refetch, isFetching } = useQuery<MissionControlData>({
    queryKey: ['mission-control', brand.id],
    queryFn: () =>
      fetch(`/api/mission-control?brand=${brand.id}`).then(
        (r) => r.json() as Promise<MissionControlData>,
      ),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  // Pulse color: red if urgent items, yellow if warnings, green if all clear
  const urgentCount = data
    ? data.urgent.overdue_invoices.count +
      data.urgent.bills_due_this_week.count +
      data.urgent.cold_deals.count
    : 0
  const pulseColor =
    urgentCount >= 3 ? '#ef4444' : urgentCount >= 1 ? '#f59e0b' : '#22c55e'

  // Max stage value for bar scaling
  const maxStageValue = data
    ? Math.max(...data.pipeline.by_stage.map((s) => s.value_cents), 1)
    : 1

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: pulseColor }}
              />
              <span
                className="relative inline-flex h-3 w-3 rounded-full"
                style={{ background: pulseColor }}
              />
            </span>
            <div>
              <h1 className="text-[24px] font-bold leading-tight text-[var(--theme-text)]">
                Mission Control
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                  style={{ background: brand.accentColor }}
                >
                  {brand.name}
                </span>
                <span className="text-[12px] text-[var(--theme-muted)]">
                  {fmtDate(now)}
                </span>
                <span className="text-[12px] text-[var(--theme-muted)]">
                  {now.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <HugeiconsIcon
                icon={Refresh01Icon}
                size={13}
                className={isFetching ? 'animate-spin' : ''}
              />
              Refresh
            </button>
            <Link
              to="/chat"
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 hover:shadow-md"
              style={{ background: brand.accentColor }}
            >
              <HugeiconsIcon icon={AiMagicIcon} size={15} />
              Ask Hermes
            </Link>
          </div>
        </div>

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {isLoading ? (
          <Skeleton />
        ) : data ? (
          <div className="space-y-6">

            {/* ── URGENT ──────────────────────────────────────────────────── */}
            {urgentCount > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#ef4444]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                  Needs Attention
                </h2>
                <div className="space-y-2">
                  {data.urgent.overdue_invoices.count > 0 && (
                    <UrgentCard
                      icon="🔴"
                      title={`${data.urgent.overdue_invoices.count} overdue invoice${data.urgent.overdue_invoices.count !== 1 ? 's' : ''}`}
                      subtitle={`$${fmtCents(data.urgent.overdue_invoices.total_cents)} outstanding`}
                      action="Review Invoices"
                      href="/payments"
                    />
                  )}
                  {data.urgent.cold_deals.count > 0 && (
                    <UrgentCard
                      icon="🧊"
                      title={`${data.urgent.cold_deals.count} deal${data.urgent.cold_deals.count !== 1 ? 's' : ''} going cold`}
                      subtitle={
                        data.urgent.cold_deals.items
                          .slice(0, 2)
                          .map((d) => d.title)
                          .join(', ') || 'No recent activity'
                      }
                      action="View Pipeline"
                      href="/deals"
                    />
                  )}
                  {data.urgent.bills_due_this_week.count > 0 && (
                    <UrgentCard
                      icon="📋"
                      title={`${data.urgent.bills_due_this_week.count} bill${data.urgent.bills_due_this_week.count !== 1 ? 's' : ''} due this week`}
                      subtitle={`$${fmtCents(data.urgent.bills_due_this_week.total_cents)}`}
                      action="Pay Bills"
                      href="/bills"
                    />
                  )}
                </div>
              </section>
            )}

            {/* ── HERMES OPS ──────────────────────────────────────────────── */}
            <HermesOpsCard />

            {/* ── MOMENTUM KPIs ───────────────────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-75">
                Momentum
              </h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                  label="Revenue This Month"
                  value={`$${fmtCents(data.momentum.revenue_this_month_cents)}`}
                  sub={`${data.momentum.invoices_paid_this_month} paid invoice${data.momentum.invoices_paid_this_month !== 1 ? 's' : ''}`}
                  color="#22c55e"
                  icon={Money01Icon}
                  href="/payments"
                />
                <KpiCard
                  label="New Contacts"
                  value={String(data.momentum.new_contacts_this_week)}
                  sub="added this week"
                  color="#0ea5e9"
                  icon={UserGroupIcon}
                  href="/contacts"
                />
                <KpiCard
                  label="Deals Won"
                  value={String(data.momentum.deals_won_this_month)}
                  sub="this month"
                  color="#8b5cf6"
                  icon={DollarCircleIcon}
                  href="/deals"
                />
                <KpiCard
                  label="Open Pipeline"
                  value={`$${fmtCents(data.pipeline.total_pipeline_value_cents)}`}
                  sub={`${data.pipeline.total_open_deals} active deal${data.pipeline.total_open_deals !== 1 ? 's' : ''}`}
                  color="#f97316"
                  icon={PipelineIcon}
                  href="/deals"
                />
              </div>
            </section>

            {/* ── TODAY'S SCHEDULE ────────────────────────────────────────── */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-75">
                  Today's Schedule
                </h2>
                <Link
                  to="/appointments"
                  className="text-[11px] text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                >
                  View all →
                </Link>
              </div>
              <div
                className="rounded-xl border p-4"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
              >
                {data.today.appointments.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: '#22c55e18', color: '#22c55e' }}
                    >
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} />
                    </span>
                    <p className="text-[13px] font-medium text-[var(--theme-text)]">
                      Clear day — no appointments scheduled
                    </p>
                    <p className="text-[11px] text-[var(--theme-muted)]">
                      Enjoy the breathing room!
                    </p>
                    <button
                      onClick={() => void navigate({ to: '/appointments' })}
                      className="mt-2 rounded-lg border px-4 py-1.5 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      + Schedule Appointment
                    </button>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {data.today.appointments.map((appt) => {
                      const statusColor = STATUS_COLORS[appt.status] ?? '#6366f1'
                      return (
                        <div
                          key={appt.id}
                          className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--theme-hover)]"
                        >
                          <span
                            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg text-white"
                            style={{ background: statusColor }}
                          >
                            <HugeiconsIcon icon={Clock01Icon} size={12} />
                            <span className="mt-0.5 text-[10px] font-bold leading-tight">
                              {fmtTime(appt.start_time)}
                            </span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[var(--theme-text)]">
                              {appt.title}
                            </p>
                            {appt.contact_name && (
                              <p className="truncate text-[11px] text-[var(--theme-muted)]">
                                {appt.contact_name}
                              </p>
                            )}
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: `${statusColor}18`,
                              color: statusColor,
                            }}
                          >
                            {capitalize(appt.status.replace('_', ' '))}
                          </span>
                        </div>
                      )
                    })}
                    <div className="pt-2">
                      <button
                        onClick={() => void navigate({ to: '/appointments' })}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <HugeiconsIcon icon={CalendarAdd01Icon} size={13} />
                        Schedule Appointment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── PIPELINE SNAPSHOT ───────────────────────────────────────── */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-75">
                  Pipeline Snapshot
                </h2>
                <Link
                  to="/deals"
                  className="text-[11px] text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                >
                  View full pipeline →
                </Link>
              </div>
              <div
                className="rounded-xl border p-4"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
              >
                {data.pipeline.total_open_deals === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: '#f9731618', color: '#f97316' }}
                    >
                      <HugeiconsIcon icon={PipelineIcon} size={20} />
                    </span>
                    <p className="text-[13px] font-medium text-[var(--theme-text)]">
                      No open deals
                    </p>
                    <button
                      onClick={() => void navigate({ to: '/deals' })}
                      className="mt-1 rounded-lg border px-4 py-1.5 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      + Add Deal
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.pipeline.by_stage.map((s) => {
                      const pct = Math.round((s.value_cents / maxStageValue) * 100)
                      const stageColor = STAGE_COLORS[s.stage] ?? '#94a3b8'
                      return (
                        <div key={s.stage}>
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: stageColor }}
                              />
                              <span className="text-[12px] font-medium text-[var(--theme-text)]">
                                {capitalize(s.stage)}
                              </span>
                              <span className="text-[11px] text-[var(--theme-muted)]">
                                {s.count} deal{s.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <span className="text-[12px] font-semibold text-[var(--theme-text)]">
                              ${fmtCents(s.value_cents)}
                            </span>
                          </div>
                          <div
                            className="h-2 w-full overflow-hidden rounded-full"
                            style={{ background: 'var(--theme-hover)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: stageColor }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* ── QUICK ACTIONS ───────────────────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-75">
                Quick Actions
              </h2>
              <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => void navigate({ to: qa.href as '/' })}
                    className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-150 hover:-translate-y-1 hover:shadow-lg"
                    style={{
                      background: 'var(--theme-card)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <span className="text-2xl">{qa.emoji}</span>
                    <span className="text-[11px] font-medium leading-tight text-[var(--theme-text)]">
                      {qa.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>

          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-[14px] font-medium text-[var(--theme-text)]">
              Could not load Mission Control data
            </p>
            <button
              onClick={() => void refetch()}
              className="rounded-lg border px-4 py-2 text-[13px] font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// Suppress unused icon imports — these are valid exports for consumers
export { UserAdd01Icon, InvoiceIcon, Mail01Icon, Calendar01Icon }
