import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Analytics01Icon,
  ArrowLeft01Icon,
  Award01Icon,
  Briefcase01Icon,
  Building01Icon,
  CheckmarkCircle01Icon,
  File01Icon,
  Layers01Icon,
  Mail01Icon,
  Money01Icon,
  PencilEdit02Icon,
  SmartPhone01Icon,
  Tag01Icon,
  Task01Icon,
  Time01Icon,
  UserCircleIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'
import { formatCurrency, STATUS_LABELS, STATUS_COLORS, STATUS_BG } from '@/lib/invoices-api'
import { STAGE_LABELS } from '@/lib/contacts-api'

// ── Types from API response ───────────────────────────────────────────────────

type IntelContact = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  stage: string
  tags: string[]
  notes: string
  last_contacted_at: string | null
  created_at: string
}

type IntelDeal = {
  id: string
  title: string
  value: number
  stage: string
  close_date?: string
  updated_at: string
}

type IntelInvoice = {
  id: string
  invoice_number: string
  total: number
  status: string
  due_date?: string
  created_at: string
}

type IntelAppointment = {
  id: string
  title: string
  starts_at: string
  status: string
}

type IntelProposal = {
  id: string
  title: string
  status: string
  sent_at?: string
  created_at: string
}

type IntelProject = {
  id: string
  name: string
  status: string
  progress: number
  due_date: string | null
  updated_at: string
}

type IntelDocument = {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

type IntelLoyalty = {
  points_balance: number
  lifetime_points: number
  tier_id: string
}

type TimelineItem = {
  id: string
  type: string
  title: string
  date: string
  meta?: string
  amount_cents?: number
  status?: string
}

type IntelStats = {
  total_deals: number
  open_deals: number
  total_invoices: number
  total_revenue_cents: number
  upcoming_appointments: number
  total_projects: number
  open_proposals: number
}

type IntelData = {
  contact: IntelContact | null
  stats: IntelStats
  deals: IntelDeal[]
  invoices: IntelInvoice[]
  appointments: IntelAppointment[]
  proposals: IntelProposal[]
  projects: IntelProject[]
  loyalty: IntelLoyalty | null
  documents: IntelDocument[]
  timeline: TimelineItem[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const TIMELINE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  deal:                  { emoji: '💼', color: '#6366f1', label: 'Deal created' },
  deal_won:              { emoji: '🏆', color: '#22c55e', label: 'Deal won' },
  deal_lost:             { emoji: '❌', color: '#ef4444', label: 'Deal lost' },
  invoice_created:       { emoji: '🧾', color: '#8b5cf6', label: 'Invoice created' },
  invoice_paid:          { emoji: '💰', color: '#10b981', label: 'Invoice paid' },
  appointment_scheduled: { emoji: '📅', color: '#0ea5e9', label: 'Appointment booked' },
  appointment_completed: { emoji: '✅', color: '#10b981', label: 'Appointment completed' },
  proposal_sent:         { emoji: '📄', color: '#f59e0b', label: 'Proposal sent' },
  proposal_signed:       { emoji: '✍️', color: '#22c55e', label: 'Proposal signed' },
  project_created:       { emoji: '📂', color: '#ec4899', label: 'Project created' },
}

const DEAL_STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8',
  qualified: '#f59e0b',
  proposal: '#8b5cf6',
  negotiation: '#f97316',
  won: '#22c55e',
  lost: '#ef4444',
}

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#0ea5e9',
  viewed: '#f59e0b',
  accepted: '#22c55e',
  declined: '#ef4444',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function groupTimelineByMonth(items: TimelineItem[]): { label: string; items: TimelineItem[] }[] {
  const groups: Record<string, TimelineItem[]> = {}
  for (const item of items) {
    const d = new Date(item.date)
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Analytics01Icon
  color: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${color}18` }}>
          <HugeiconsIcon icon={icon} size={14} style={{ color }} />
        </div>
        <span className="text-[11px] font-medium text-[var(--theme-muted)]">{label}</span>
      </div>
      <p className="text-xl font-bold text-[var(--theme-text)]">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-[var(--theme-muted)]">{sub}</p>}
    </div>
  )
}

// ── Tab content components ────────────────────────────────────────────────────

function TimelineTab({ timeline }: { timeline: TimelineItem[] }) {
  if (timeline.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--theme-muted)]">No activity recorded yet.</p>
  }
  const groups = groupTimelineByMonth(timeline)
  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.label}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{group.label}</p>
          <div className="space-y-0">
            {group.items.map((item, i) => {
              const cfg = TIMELINE_CONFIG[item.type] ?? { emoji: '•', color: '#94a3b8', label: item.type }
              const isLast = i === group.items.length - 1
              return (
                <div key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center pt-0.5">
                    <span
                      className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                      style={{ background: `${cfg.color}18` }}
                    >
                      {cfg.emoji}
                    </span>
                    {!isLast && <span className="my-0.5 w-px flex-1 bg-[var(--theme-border)]" />}
                  </div>
                  <div className={cn('min-w-0 pb-3', isLast && 'pb-0')}>
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                        style={{ background: `${cfg.color}18`, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      {item.status && (
                        <span className="text-[9px] capitalize text-[var(--theme-muted)]">{item.status}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] font-medium text-[var(--theme-text)]">{item.title}</p>
                    <div className="mt-0.5 flex items-center gap-3">
                      <span className="text-[10px] text-[var(--theme-muted)]">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {item.amount_cents !== undefined && item.amount_cents > 0 && (
                        <span className="text-[10px] font-medium text-[var(--theme-text)]">
                          {formatCurrency(item.amount_cents / 100)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function DealsTab({ deals }: { deals: IntelDeal[] }) {
  if (deals.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--theme-muted)]">No deals yet.</p>
  }
  return (
    <div className="space-y-2">
      {deals.map(d => (
        <Link
          key={d.id}
          to="/deals"
          className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 hover:bg-[var(--theme-hover)]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--theme-text)]">{d.title}</p>
            <p className="mt-0.5 text-[10px] text-[var(--theme-muted)]">
              Updated {new Date(d.updated_at).toLocaleDateString()}
              {d.close_date && ` · Close ${new Date(d.close_date).toLocaleDateString()}`}
            </p>
          </div>
          <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize"
              style={{ background: `${DEAL_STAGE_COLORS[d.stage] ?? '#94a3b8'}18`, color: DEAL_STAGE_COLORS[d.stage] ?? '#94a3b8' }}
            >
              {STAGE_LABELS[d.stage as keyof typeof STAGE_LABELS] ?? d.stage}
            </span>
            {d.value > 0 && (
              <span className="text-[11px] font-bold text-[var(--theme-text)]">{formatCurrency(d.value / 100)}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function InvoicesTab({ invoices }: { invoices: IntelInvoice[] }) {
  const paid = invoices.filter(i => i.status === 'paid')
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'void')
  const paidTotal = paid.reduce((s, i) => s + i.total, 0)
  const outstandingTotal = outstanding.reduce((s, i) => s + i.total, 0)

  if (invoices.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--theme-muted)]">No invoices yet.</p>
  }
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
          <p className="text-[10px] font-medium text-[var(--theme-muted)]">Total paid</p>
          <p className="mt-0.5 text-base font-bold text-green-500">{formatCurrency(paidTotal)}</p>
        </div>
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
          <p className="text-[10px] font-medium text-[var(--theme-muted)]">Outstanding</p>
          <p className="mt-0.5 text-base font-bold text-[var(--theme-text)]">{formatCurrency(outstandingTotal)}</p>
        </div>
      </div>
      <div className="space-y-2">
        {invoices.map(inv => (
          <Link
            key={inv.id}
            to="/invoices/$id"
            params={{ id: inv.id }}
            className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 hover:bg-[var(--theme-hover)]"
          >
            <div>
              <p className="font-mono text-[11px] text-[var(--theme-muted)]">{inv.invoice_number}</p>
              <p className="text-sm font-bold text-[var(--theme-text)]">{formatCurrency(inv.total)}</p>
            </div>
            <div className="text-right">
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{
                  background: STATUS_BG[inv.status as keyof typeof STATUS_BG] ?? '#94a3b818',
                  color: STATUS_COLORS[inv.status as keyof typeof STATUS_COLORS] ?? '#94a3b8',
                }}
              >
                {STATUS_LABELS[inv.status as keyof typeof STATUS_LABELS] ?? inv.status}
              </span>
              {inv.due_date && (
                <p className="mt-0.5 text-[10px] text-[var(--theme-muted)]">
                  Due {new Date(inv.due_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function AppointmentsTab({ appointments }: { appointments: IntelAppointment[] }) {
  if (appointments.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--theme-muted)]">No appointments yet.</p>
  }
  const now = new Date().toISOString()
  return (
    <div className="space-y-2">
      {appointments.map(a => {
        const isUpcoming = a.starts_at >= now
        return (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-[var(--theme-text)]">{a.title}</p>
              <p className="mt-0.5 text-[10px] text-[var(--theme-muted)]">
                {new Date(a.starts_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize',
                a.status === 'completed' ? 'bg-green-500/15 text-green-600' :
                a.status === 'cancelled' ? 'bg-red-500/15 text-red-500' :
                isUpcoming ? 'bg-blue-500/15 text-blue-600' : 'bg-slate-500/15 text-slate-500',
              )}
            >
              {isUpcoming && a.status === 'scheduled' ? 'Upcoming' : a.status}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ProposalsTab({ proposals }: { proposals: IntelProposal[] }) {
  if (proposals.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--theme-muted)]">No proposals yet.</p>
  }
  return (
    <div className="space-y-2">
      {proposals.map(p => (
        <Link
          key={p.id}
          to="/proposals"
          className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 hover:bg-[var(--theme-hover)]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--theme-text)]">{p.title}</p>
            <p className="mt-0.5 text-[10px] text-[var(--theme-muted)]">
              {p.sent_at ? `Sent ${new Date(p.sent_at).toLocaleDateString()}` : `Created ${new Date(p.created_at).toLocaleDateString()}`}
            </p>
          </div>
          <span
            className="ml-3 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize"
            style={{
              background: `${PROPOSAL_STATUS_COLORS[p.status] ?? '#94a3b8'}18`,
              color: PROPOSAL_STATUS_COLORS[p.status] ?? '#94a3b8',
            }}
          >
            {p.status}
          </span>
        </Link>
      ))}
    </div>
  )
}

function DocsTab({ documents }: { documents: IntelDocument[] }) {
  if (documents.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--theme-muted)]">No documents linked to this contact.</p>
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {documents.map(doc => (
        <div
          key={doc.id}
          className="flex flex-col gap-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={File01Icon} size={16} className="text-[var(--theme-accent)]" />
          </div>
          <p className="truncate text-[11px] font-medium text-[var(--theme-text)]">{doc.name}</p>
          <p className="text-[9px] text-[var(--theme-muted)]">
            {formatBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Main 360 Screen ───────────────────────────────────────────────────────────

type Tab = 'timeline' | 'deals' | 'invoices' | 'appointments' | 'proposals' | 'docs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'deals', label: 'Deals' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'docs', label: 'Docs' },
]

export function Contact360Screen() {
  const { id } = useParams({ from: '/contact/$id' })
  const navigate = useNavigate()
  const brand = useBrand()
  const [activeTab, setActiveTab] = useState<Tab>('timeline')

  const { data, isLoading } = useQuery<IntelData>({
    queryKey: ['contact-intelligence', id, brand.id],
    queryFn: () =>
      fetch(`/api/contacts/${id}/intelligence?brand=${brand.id}`)
        .then(r => r.json()) as Promise<IntelData>,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-[var(--theme-muted)]">
        Loading contact intelligence…
      </div>
    )
  }

  const contact = data?.contact
  if (!contact) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-red-400">
        Contact not found.
      </div>
    )
  }

  const stats = data?.stats ?? {
    total_deals: 0, open_deals: 0, total_invoices: 0,
    total_revenue_cents: 0, upcoming_appointments: 0,
    total_projects: 0, open_proposals: 0,
  }
  const deals = data?.deals ?? []
  const invoices = data?.invoices ?? []
  const appointments = data?.appointments ?? []
  const proposals = data?.proposals ?? []
  const projects = data?.projects ?? []
  const loyalty = data?.loyalty ?? null
  const documents = data?.documents ?? []
  const timeline = data?.timeline ?? []

  const initials = contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const accentColor = brand.accentColor
  const daysSince = Math.floor((Date.now() - new Date(contact.created_at).getTime()) / 86400000)

  const pipelineValue = deals
    .filter(d => !['won', 'lost'].includes(d.stage))
    .reduce((s, d) => s + d.value, 0)

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">

        {/* Back */}
        <Link
          to="/contacts"
          className="mb-4 flex items-center gap-1.5 text-xs text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={13} /> Contacts
        </Link>

        {/* ── Header card ──────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6">
          <div className="flex flex-wrap items-start gap-4">
            {/* Avatar */}
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow"
              style={{ background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 60%, #000))` }}
            >
              {initials || <HugeiconsIcon icon={UserCircleIcon} size={28} />}
            </div>

            {/* Name/meta */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--theme-text)]">{contact.name}</h1>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                  style={{ background: `${accentColor}20`, color: accentColor }}
                >
                  {STAGE_LABELS[contact.stage as keyof typeof STAGE_LABELS] ?? contact.stage}
                </span>
              </div>
              {contact.company && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--theme-muted)]">
                  <HugeiconsIcon icon={Building01Icon} size={12} /> {contact.company}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1 text-xs text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                  >
                    <HugeiconsIcon icon={Mail01Icon} size={12} className="text-[var(--theme-accent)]" />
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-1 text-xs text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                  >
                    <HugeiconsIcon icon={SmartPhone01Icon} size={12} className="text-[var(--theme-accent)]" />
                    {contact.phone}
                  </a>
                )}
                {contact.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[10px] text-[var(--theme-muted)]">
                    <HugeiconsIcon icon={Tag01Icon} size={9} /> {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void navigate({ to: '/conversations' })}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
              >
                <HugeiconsIcon icon={Mail01Icon} size={12} /> Message
              </button>
              <button
                onClick={() => void navigate({ to: '/deals' })}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
              >
                <HugeiconsIcon icon={Briefcase01Icon} size={12} /> New Deal
              </button>
              <button
                onClick={() => void navigate({ to: '/payments' })}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
              >
                <HugeiconsIcon icon={Money01Icon} size={12} /> New Invoice
              </button>
              <button
                onClick={() => void navigate({ to: '/appointments' })}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
              >
                <HugeiconsIcon icon={Add01Icon} size={12} /> Book Appointment
              </button>
              <Link
                to="/contacts/$id"
                params={{ id: contact.id }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                style={{ background: accentColor }}
              >
                <HugeiconsIcon icon={PencilEdit02Icon} size={12} /> Edit Contact
              </Link>
            </div>
          </div>
        </div>

        {/* ── Two-column grid ───────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">

          {/* ── Left column ── */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total Revenue"
                value={formatCurrency(stats.total_revenue_cents / 100)}
                sub={`${stats.total_invoices} invoice${stats.total_invoices !== 1 ? 's' : ''}`}
                icon={Money01Icon}
                color="#10b981"
              />
              <StatCard
                label="Open Deals"
                value={String(stats.open_deals)}
                sub={pipelineValue > 0 ? `${formatCurrency(pipelineValue / 100)} pipeline` : `${stats.total_deals} total`}
                icon={Briefcase01Icon}
                color="#6366f1"
              />
              <StatCard
                label="Relationship"
                value={`${daysSince}d`}
                sub={`Since ${new Date(contact.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                icon={Time01Icon}
                color="#f59e0b"
              />
              {loyalty ? (
                <StatCard
                  label="Loyalty Points"
                  value={loyalty.points_balance.toLocaleString()}
                  sub={`Lifetime: ${loyalty.lifetime_points.toLocaleString()}`}
                  icon={Award01Icon}
                  color="#ec4899"
                />
              ) : (
                <StatCard
                  label="Projects"
                  value={String(stats.total_projects)}
                  sub={`${stats.open_proposals} open proposal${stats.open_proposals !== 1 ? 's' : ''}`}
                  icon={Layers01Icon}
                  color="#0ea5e9"
                />
              )}
            </div>

            {/* Quick info */}
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Quick Info</h3>
              <dl className="space-y-2.5">
                <div className="flex items-baseline gap-2">
                  <dt className="w-32 shrink-0 text-[10px] font-medium text-[var(--theme-muted)]">Last contacted</dt>
                  <dd className="text-xs text-[var(--theme-text)]">
                    {contact.last_contacted_at
                      ? new Date(contact.last_contacted_at).toLocaleDateString()
                      : '—'}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="w-32 shrink-0 text-[10px] font-medium text-[var(--theme-muted)]">Stage</dt>
                  <dd className="text-xs capitalize text-[var(--theme-text)]">
                    {STAGE_LABELS[contact.stage as keyof typeof STAGE_LABELS] ?? contact.stage}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="w-32 shrink-0 text-[10px] font-medium text-[var(--theme-muted)]">Upcoming appts</dt>
                  <dd className="text-xs text-[var(--theme-text)]">{stats.upcoming_appointments}</dd>
                </div>
                {projects.length > 0 && (
                  <div className="flex items-baseline gap-2">
                    <dt className="w-32 shrink-0 text-[10px] font-medium text-[var(--theme-muted)]">Active projects</dt>
                    <dd className="text-xs text-[var(--theme-text)]">
                      {projects.filter(p => p.status === 'active').length}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Notes */}
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Notes</h3>
                <Link
                  to="/contacts/$id"
                  params={{ id: contact.id }}
                  className="text-[10px] text-[var(--theme-accent)] hover:underline"
                >
                  Edit
                </Link>
              </div>
              <p className={cn('text-xs', contact.notes ? 'text-[var(--theme-text)]' : 'text-[var(--theme-muted)]')}>
                {contact.notes || 'No notes yet — click Edit to add.'}
              </p>
            </div>

            {/* Active projects sidebar */}
            {projects.length > 0 && (
              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <HugeiconsIcon icon={Task01Icon} size={13} className="text-[var(--theme-accent)]" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Projects</h3>
                </div>
                <div className="space-y-2">
                  {projects.slice(0, 3).map(proj => (
                    <div key={proj.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2">
                      <p className="truncate text-xs font-medium text-[var(--theme-text)]">{proj.name}</p>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--theme-hover)]">
                        <div className="h-full rounded-full" style={{ width: `${proj.progress}%`, background: accentColor }} />
                      </div>
                      <p className="mt-0.5 text-[9px] text-[var(--theme-muted)]">{proj.progress}% · {proj.status}</p>
                    </div>
                  ))}
                  {projects.length > 3 && (
                    <Link to="/projects" className="block text-center text-[10px] text-[var(--theme-accent)] hover:underline">
                      +{projects.length - 3} more
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="min-w-0 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
            {/* Tabs */}
            <div className="flex gap-0 overflow-x-auto border-b border-[var(--theme-border)] px-4">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'shrink-0 border-b-2 px-3 py-3 text-xs font-medium transition-colors',
                    activeTab === tab.id
                      ? 'border-[var(--theme-accent)] text-[var(--theme-text)]'
                      : 'border-transparent text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                >
                  {tab.label}
                  {tab.id === 'deals' && deals.length > 0 && (
                    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: `${accentColor}20`, color: accentColor }}>
                      {deals.length}
                    </span>
                  )}
                  {tab.id === 'invoices' && invoices.length > 0 && (
                    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: `${accentColor}20`, color: accentColor }}>
                      {invoices.length}
                    </span>
                  )}
                  {tab.id === 'appointments' && appointments.length > 0 && (
                    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: `${accentColor}20`, color: accentColor }}>
                      {appointments.length}
                    </span>
                  )}
                  {tab.id === 'proposals' && proposals.length > 0 && (
                    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: `${accentColor}20`, color: accentColor }}>
                      {proposals.length}
                    </span>
                  )}
                  {tab.id === 'docs' && documents.length > 0 && (
                    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: `${accentColor}20`, color: accentColor }}>
                      {documents.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="p-5">
              {activeTab === 'timeline' && <TimelineTab timeline={timeline} />}
              {activeTab === 'deals' && <DealsTab deals={deals} />}
              {activeTab === 'invoices' && <InvoicesTab invoices={invoices} />}
              {activeTab === 'appointments' && <AppointmentsTab appointments={appointments} />}
              {activeTab === 'proposals' && <ProposalsTab proposals={proposals} />}
              {activeTab === 'docs' && <DocsTab documents={documents} />}
            </div>
          </div>
        </div>

        {/* ── Header analytics strip ────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
            <HugeiconsIcon icon={Analytics01Icon} size={18} style={{ color: accentColor }} />
            <div>
              <p className="text-[10px] text-[var(--theme-muted)]">Timeline events</p>
              <p className="text-sm font-bold text-[var(--theme-text)]">{timeline.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} style={{ color: '#22c55e' }} />
            <div>
              <p className="text-[10px] text-[var(--theme-muted)]">Upcoming appts</p>
              <p className="text-sm font-bold text-[var(--theme-text)]">{stats.upcoming_appointments}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
            <HugeiconsIcon icon={ViewIcon} size={18} style={{ color: '#f59e0b' }} />
            <div>
              <p className="text-[10px] text-[var(--theme-muted)]">Open proposals</p>
              <p className="text-sm font-bold text-[var(--theme-text)]">{stats.open_proposals}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
            <HugeiconsIcon icon={Layers01Icon} size={18} style={{ color: '#ec4899' }} />
            <div>
              <p className="text-[10px] text-[var(--theme-muted)]">Active projects</p>
              <p className="text-sm font-bold text-[var(--theme-text)]">
                {projects.filter(p => p.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
