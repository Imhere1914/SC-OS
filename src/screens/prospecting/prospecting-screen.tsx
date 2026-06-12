import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  UserSearch01Icon,
  MagnetIcon,
  Target02Icon,
  CheckmarkCircle01Icon,
  Calendar01Icon,
  BriefcaseDollarIcon,
  Cancel01Icon,
  EyeIcon,
  Copy01Icon,
  CodeIcon,
  AlertCircleIcon,
  Mail01Icon,
  Call02Icon,
  Building06Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  listProspects,
  getProspectStats,
  updateProspect,
  convertProspect,
  listApiKeyPrefixes,
  type Prospect,
  type ProspectTier,
} from '@/lib/prospecting-api'

// ── Style helpers ───────────────────────────────────────────────────────────

const ACCENT_GRADIENT = (accent: string) =>
  `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, #000))`
const ACCENT_GLOW = (accent: string) =>
  `0 2px 8px color-mix(in srgb, ${accent} 38%, transparent)`

const TIER_COLOR: Record<ProspectTier, string> = {
  hot: '#ef4444',
  warm: '#f59e0b',
  cold: '#94a3b8',
}
const TIER_LABEL: Record<ProspectTier, string> = { hot: 'Hot', warm: 'Warm', cold: 'Cold' }

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TIER_FILTERS: { id: 'all' | ProspectTier; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hot', label: 'Hot' },
  { id: 'warm', label: 'Warm' },
  { id: 'cold', label: 'Cold' },
]
const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'converted', label: 'Converted' },
  { id: 'dismissed', label: 'Dismissed' },
]

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sublabel, color, icon,
}: {
  label: string; value: string; sublabel?: string; color: string; icon: typeof Target02Icon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px"
      style={{ backdropFilter: 'blur(10px)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 45%, var(--theme-border))` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
    >
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">{label}</span>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: ACCENT_GRADIENT(color), boxShadow: ACCENT_GLOW(color) }}
        >
          <HugeiconsIcon icon={icon} size={14} className="text-white" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--theme-text)]">{value}</p>
      {sublabel && <p className="text-[11px] text-[var(--theme-muted)]">{sublabel}</p>}
    </div>
  )
}

// ── Connect panel ───────────────────────────────────────────────────────────

function ConnectPanel({ onClose }: { onClose: () => void }) {
  const brand = useBrand()
  const { data: keys = [] } = useQuery({ queryKey: ['api-key-prefixes'], queryFn: listApiKeyPrefixes })
  const keyHint = keys[0]?.key_prefix ? `${keys[0].key_prefix}…` : 'aios_sk_<your key>'

  const curl = `curl -X POST ${window.location.origin}/api/prospecting/inbound \\
  -H "x-api-key: ${keyHint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Doe",
    "email": "jane@acmehvac.com",
    "phone": "+1 555 0100",
    "company": "Acme HVAC",
    "title": "Owner",
    "website": "acmehvac.com",
    "industry": "HVAC",
    "location": "Austin, TX",
    "employee_count": 24,
    "source": "codex-prospecting",
    "campaign": "q3-outbound"
  }'`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}
            >
              <HugeiconsIcon icon={CodeIcon} size={17} className="text-white" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">How to connect</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Send leads from your prospecting engine</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Endpoint</p>
            <code className="block rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-[12px] text-[var(--theme-text)]">
              POST /api/prospecting/inbound
            </code>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Auth header</p>
            <code className="block rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-[12px] text-[var(--theme-text)]">
              x-api-key: {keyHint}
            </code>
            <p className="mt-1.5 text-[11px] text-[var(--theme-muted)]">
              {keys.length === 0 ? (
                <>No API keys yet. <Link to="/settings" className="font-medium" style={{ color: brand.accentColor }}>Create one in Settings → API Keys</Link>.</>
              ) : (
                <>Use any of your <Link to="/settings" className="font-medium" style={{ color: brand.accentColor }}>API keys</Link>. Only the prefix is shown for safety.</>
              )}
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">curl example</p>
              <button
                onClick={() => { void navigator.clipboard.writeText(curl); toast('Copied curl') }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
              >
                <HugeiconsIcon icon={Copy01Icon} size={11} /> Copy
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] p-3 text-[11px] leading-relaxed text-[var(--theme-text)]">{curl}</pre>
          </div>
          <p className="text-[11px] text-[var(--theme-muted)]">
            <strong className="text-[var(--theme-text)]">name</strong> is required. All other fields (email, phone, company, title,
            website, industry, location, employee_count, source, campaign, notes, custom) are optional. Each lead is scored,
            a contact is created, and high-scoring leads (≥60) auto-open a deal.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailModal({ prospect, onClose }: { prospect: Prospect; onClose: () => void }) {
  const brand = useBrand()
  const tierColor = TIER_COLOR[prospect.tier]
  const rows: { label: string; value?: string }[] = [
    { label: 'Email', value: prospect.email },
    { label: 'Phone', value: prospect.phone },
    { label: 'Company', value: prospect.company },
    { label: 'Title', value: prospect.title },
    { label: 'Website', value: prospect.website },
    { label: 'Industry', value: prospect.industry },
    { label: 'Location', value: prospect.location },
    { label: 'Employees', value: prospect.employee_count != null ? String(prospect.employee_count) : undefined },
    { label: 'Source', value: prospect.source },
    { label: 'Campaign', value: prospect.campaign },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}>
              <HugeiconsIcon icon={UserSearch01Icon} size={17} className="text-white" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">{prospect.company || prospect.name}</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">{prospect.name}{prospect.title ? ` · ${prospect.title}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]" />
          </button>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl font-bold tabular-nums" style={{ color: tierColor }}>{prospect.score}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: tierColor, background: `color-mix(in srgb, ${tierColor} 12%, var(--theme-card))` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tierColor }} />
              {TIER_LABEL[prospect.tier]}
            </span>
            <span className="text-[11px] text-[var(--theme-muted)]">score / 100</span>
          </div>
          <dl className="space-y-1.5">
            {rows.filter(r => r.value).map(r => (
              <div key={r.label} className="flex items-start justify-between gap-3 text-[13px]">
                <dt className="text-[var(--theme-muted)]">{r.label}</dt>
                <dd className="text-right font-medium text-[var(--theme-text)]">{r.value}</dd>
              </div>
            ))}
          </dl>
          {prospect.notes && (
            <div className="mt-4 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] p-3 text-[12px] text-[var(--theme-text)]">{prospect.notes}</div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {prospect.contact_id && (
              <Link to="/contacts" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium" style={{ color: brand.accentColor, background: `color-mix(in srgb, ${brand.accentColor} 10%, var(--theme-card))` }}>
                <HugeiconsIcon icon={ArrowRight01Icon} size={11} /> View contact
              </Link>
            )}
            {prospect.deal_id && (
              <Link to="/deals" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium" style={{ color: '#10b981', background: 'color-mix(in srgb, #10b981 10%, var(--theme-card))' }}>
                <HugeiconsIcon icon={BriefcaseDollarIcon} size={11} /> View deal
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

function ProspectRow({
  prospect, onView, onConvert, onDismiss,
}: {
  prospect: Prospect
  onView: () => void
  onConvert: () => void
  onDismiss: () => void
}) {
  const tierColor = TIER_COLOR[prospect.tier]
  return (
    <div
      className="group flex items-center gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
      style={{ backdropFilter: 'blur(10px)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${tierColor} 40%, var(--theme-border))` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
    >
      {/* Score */}
      <div className="flex w-12 shrink-0 flex-col items-center">
        <span className="text-xl font-bold leading-none tabular-nums" style={{ color: tierColor }}>{prospect.score}</span>
        <span className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ color: tierColor, background: `color-mix(in srgb, ${tierColor} 12%, var(--theme-card))` }}>
          <span className="h-1 w-1 rounded-full" style={{ background: tierColor }} />
          {TIER_LABEL[prospect.tier]}
        </span>
      </div>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--theme-text)]">
          {prospect.company || prospect.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--theme-muted)]">
          <span className="truncate">{prospect.name}{prospect.title ? ` · ${prospect.title}` : ''}</span>
          {prospect.email && <span className="inline-flex items-center gap-0.5"><HugeiconsIcon icon={Mail01Icon} size={10} /> {prospect.email}</span>}
          {prospect.phone && <span className="inline-flex items-center gap-0.5"><HugeiconsIcon icon={Call02Icon} size={10} /> {prospect.phone}</span>}
        </div>
      </div>

      {/* Meta chips */}
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <span className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[10px] text-[var(--theme-muted)]">{prospect.source}</span>
        {prospect.contact_id && (
          <span title="Contact created" className="flex h-5 w-5 items-center justify-center rounded-full" style={{ color: '#3b82f6', background: 'color-mix(in srgb, #3b82f6 12%, var(--theme-card))' }}>
            <HugeiconsIcon icon={Building06Icon} size={11} />
          </span>
        )}
        {prospect.deal_id && (
          <span title="Deal created" className="flex h-5 w-5 items-center justify-center rounded-full" style={{ color: '#10b981', background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))' }}>
            <HugeiconsIcon icon={BriefcaseDollarIcon} size={11} />
          </span>
        )}
        <span className="w-16 text-right text-[10px] tabular-nums text-[var(--theme-muted)]">{relTime(prospect.created_at)}</span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
        <button onClick={onView} title="View" className="rounded-md p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]">
          <HugeiconsIcon icon={EyeIcon} size={14} className="text-[var(--theme-muted)]" />
        </button>
        {!prospect.deal_id && prospect.status !== 'dismissed' && (
          <button onClick={onConvert} title="Convert to deal" className="rounded-md p-1.5 transition-all duration-150" style={{ color: '#10b981' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #10b981 12%, var(--theme-card))' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}>
            <HugeiconsIcon icon={BriefcaseDollarIcon} size={14} />
          </button>
        )}
        {prospect.status !== 'dismissed' && (
          <button onClick={onDismiss} title="Dismiss" className="rounded-md p-1.5 transition-all duration-150" style={{ color: '#ef4444' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}>
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ProspectingScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [tier, setTier] = useState<'all' | ProspectTier>('all')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState<Prospect | null>(null)
  const [showConnect, setShowConnect] = useState(false)

  const filters = useMemo(
    () => ({ tier: tier === 'all' ? undefined : tier, status: status === 'all' ? undefined : status }),
    [tier, status],
  )

  const { data: prospects = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['prospects', brand.id, filters],
    queryFn: () => listProspects(brand.id, filters),
  })
  const { data: stats } = useQuery({
    queryKey: ['prospect-stats', brand.id],
    queryFn: () => getProspectStats(brand.id),
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['prospects', brand.id] })
    void qc.invalidateQueries({ queryKey: ['prospect-stats', brand.id] })
  }

  const convertMut = useMutation({
    mutationFn: (id: string) => convertProspect(brand.id, id),
    onSuccess: () => { invalidate(); toast('Deal created') },
    onError: () => toast('Could not convert prospect', { type: 'error' }),
  })
  const dismissMut = useMutation({
    mutationFn: (id: string) => updateProspect(brand.id, id, { status: 'dismissed' }),
    onSuccess: () => { invalidate(); toast('Prospect dismissed') },
  })

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}>
            <HugeiconsIcon icon={UserSearch01Icon} size={19} className="text-white" />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Prospecting</h1>
            <p className="text-xs text-[var(--theme-muted)]">Inbound leads from your prospecting engine</p>
          </div>
        </div>
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
          style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}
        >
          <HugeiconsIcon icon={CodeIcon} size={16} /> How to connect
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New Leads" value={String(stats?.new_count ?? 0)} sublabel="awaiting review" color={brand.accentColor} icon={MagnetIcon} />
        <StatCard label="Hot" value={String(stats?.by_tier.hot ?? 0)} sublabel="high-intent" color={TIER_COLOR.hot} icon={Target02Icon} />
        <StatCard label="Conversion Rate" value={`${stats?.conversion_rate ?? 0}%`} sublabel={`${stats?.converted_count ?? 0} converted`} color="#10b981" icon={CheckmarkCircle01Icon} />
        <StatCard label="This Week" value={String(stats?.this_week_count ?? 0)} sublabel="new prospects" color="#3b82f6" icon={Calendar01Icon} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[var(--theme-border)] p-0.5">
          {TIER_FILTERS.map(f => {
            const active = tier === f.id
            return (
              <button
                key={f.id}
                onClick={() => setTier(f.id)}
                className="rounded-md px-3 py-1 text-[12px] font-medium transition-all duration-150"
                style={active
                  ? { color: brand.accentColor, background: `color-mix(in srgb, ${brand.accentColor} 12%, var(--theme-card))` }
                  : { color: 'var(--theme-muted)' }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <div className="inline-flex rounded-lg border border-[var(--theme-border)] p-0.5">
          {STATUS_FILTERS.map(f => {
            const active = status === f.id
            return (
              <button
                key={f.id}
                onClick={() => setStatus(f.id)}
                className="rounded-md px-3 py-1 text-[12px] font-medium transition-all duration-150"
                style={active
                  ? { color: brand.accentColor, background: `color-mix(in srgb, ${brand.accentColor} 12%, var(--theme-card))` }
                  : { color: 'var(--theme-muted)' }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, #ef4444 14%, var(--theme-card)), color-mix(in srgb, #ef4444 6%, var(--theme-card)))' }}>
            <HugeiconsIcon icon={AlertCircleIcon} size={26} style={{ color: '#ef4444' }} />
          </span>
          <p className="font-semibold text-[var(--theme-text)]">Couldn't load prospects</p>
          <button onClick={() => void refetch()} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md" style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}>
            Try again
          </button>
        </div>
      ) : prospects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${brand.accentColor} 16%, var(--theme-card)), color-mix(in srgb, ${brand.accentColor} 6%, var(--theme-card)))` }}>
            <HugeiconsIcon icon={MagnetIcon} size={26} style={{ color: brand.accentColor }} />
          </span>
          <p className="font-semibold text-[var(--theme-text)]">No prospects yet</p>
          <p className="mt-1 mb-4 text-sm text-[var(--theme-muted)]">Connect your prospecting engine to start receiving leads.</p>
          <button onClick={() => setShowConnect(true)} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md" style={{ background: ACCENT_GRADIENT(brand.accentColor), boxShadow: ACCENT_GLOW(brand.accentColor) }}>
            <HugeiconsIcon icon={CodeIcon} size={15} /> How to connect
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {prospects.map(p => (
            <ProspectRow
              key={p.id}
              prospect={p}
              onView={() => setDetail(p)}
              onConvert={() => convertMut.mutate(p.id)}
              onDismiss={() => dismissMut.mutate(p.id)}
            />
          ))}
        </div>
      )}

      {detail && <DetailModal prospect={detail} onClose={() => setDetail(null)} />}
      {showConnect && <ConnectPanel onClose={() => setShowConnect(false)} />}
    </div>
  )
}
