import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon,
  Coins01Icon,
  GiftIcon,
  Search01Icon,
  UserGroupIcon,
  ChartHistogramIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  getLoyaltyProgram,
  upsertLoyaltyProgram,
  listLoyaltyAccounts,
  listLoyaltyTransactions,
  awardPoints,
  redeemPoints,
  adjustPoints,
  type LoyaltyProgram,
  type LoyaltyTier,
  type LoyaltyAccount,
  type LoyaltyTransaction,
} from '@/lib/loyalty-api'

export const Route = createFileRoute('/loyalty')({ component: LoyaltyScreen })

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPts(n: number) {
  return n.toLocaleString('en-US') + ' pts'
}

const accentGradient = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const accentGlow = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

// Metal-feel palette for tier cards — matched by tier name, falls back to tier color
const METALS: { match: RegExp; color: string }[] = [
  { match: /bronze/i, color: '#b45309' },
  { match: /silver/i, color: '#9ca3af' },
  { match: /gold/i, color: '#eab308' },
  { match: /plat/i, color: '#8b5cf6' },
]

function metalColor(tier: LoyaltyTier): string {
  return METALS.find(m => m.match.test(tier.name))?.color ?? tier.color
}

function tierCardStyle(tier: LoyaltyTier): React.CSSProperties {
  const c = metalColor(tier)
  return {
    background: `linear-gradient(135deg, color-mix(in srgb, ${c} 14%, var(--theme-card)), color-mix(in srgb, ${c} 4%, var(--theme-card)))`,
    borderColor: `color-mix(in srgb, ${c} 35%, var(--theme-border))`,
  }
}

// Transaction type → status color
const TX_COLORS: Record<LoyaltyTransaction['type'], string> = {
  earn: '#10b981',
  redeem: '#f97316',
  adjust: '#3b82f6',
  expire: '#9ca3af',
}

function TxTypeBadge({ type }: { type: LoyaltyTransaction['type'] }) {
  const c = TX_COLORS[type]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
      style={{ background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {type}
    </span>
  )
}

function TxPoints({ points }: { points: number }) {
  return (
    <span
      className="shrink-0 text-[13px] font-semibold tabular-nums"
      style={{ color: points >= 0 ? '#10b981' : '#ef4444' }}
    >
      {points >= 0 ? '+' : ''}{points.toLocaleString('en-US')}
    </span>
  )
}

// Timeline row used in member history + transactions tab
function TxTimelineRow({ tx, name, isLast }: { tx: LoyaltyTransaction; name?: string; isLast: boolean }) {
  const c = TX_COLORS[tx.type]
  return (
    <div className="relative flex items-center gap-3 pl-6 py-2">
      {/* timeline rail */}
      {!isLast && (
        <span className="absolute left-[7px] top-[26px] bottom-[-8px] w-px" style={{ background: 'var(--theme-border)' }} />
      )}
      <span
        className="absolute left-0 top-[14px] h-[15px] w-[15px] rounded-full border-2"
        style={{
          borderColor: c,
          background: `color-mix(in srgb, ${c} 18%, var(--theme-card))`,
        }}
      />
      <span className="w-24 shrink-0 text-[11px] tabular-nums text-[var(--theme-muted)]">{fmtDate(tx.created_at)}</span>
      {name != null && <span className="w-36 shrink-0 truncate text-[12px] font-medium text-[var(--theme-text)]">{name}</span>}
      <TxTypeBadge type={tx.type} />
      <TxPoints points={tx.points} />
      <span className="min-w-0 truncate text-[11px] text-[var(--theme-muted)]">{tx.description}</span>
    </div>
  )
}

// ── Tier badge ────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier?: LoyaltyTier | null }) {
  if (!tier) return <span className="text-xs text-[var(--theme-muted)]">—</span>
  const c = metalColor(tier)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${c} 18%, var(--theme-card)), color-mix(in srgb, ${c} 6%, var(--theme-card)))`,
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 40%, var(--theme-border))`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {tier.name}
    </span>
  )
}

// ── Points modal (shared for award / redeem / adjust) ─────────────────────────

interface PointsModalProps {
  mode: 'award' | 'redeem' | 'adjust'
  account: LoyaltyAccount
  onClose: () => void
  onSubmit: (pts: number, desc: string) => void
  isSaving: boolean
}

function PointsModal({ mode, account, onClose, onSubmit, isSaving }: PointsModalProps) {
  const [pts, setPts] = useState('')
  const [desc, setDesc] = useState(mode === 'award' ? 'Manual award' : mode === 'redeem' ? 'Redemption' : 'Adjustment')

  const titles = { award: 'Award Points', redeem: 'Redeem Points', adjust: 'Adjust Points' }
  const canSave = Number(pts) > 0 && desc.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGradient, boxShadow: accentGlow }}
            >
              <HugeiconsIcon icon={Coins01Icon} size={16} />
            </span>
            <div>
              <h2 className="font-semibold text-[var(--theme-text)]">{titles[mode]}</h2>
              <p className="text-xs text-[var(--theme-muted)]">{account.contact_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          {mode === 'redeem' && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--theme-hover)] px-3 py-2 text-xs text-[var(--theme-muted)]">
              <span>Current balance:</span>
              <span className="font-semibold tabular-nums text-[var(--theme-text)]">{fmtPts(account.points_balance)}</span>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Points *</label>
            <input
              type="number"
              min={1}
              value={pts}
              onChange={e => setPts(e.target.value)}
              placeholder="100"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm tabular-nums text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Description *</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Reason…"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            disabled={!canSave || isSaving}
            onClick={() => onSubmit(Number(pts), desc.trim())}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-150 disabled:opacity-50"
            style={{ background: accentGradient, boxShadow: accentGlow }}
          >
            {isSaving ? 'Saving…' : titles[mode]}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Program tab ───────────────────────────────────────────────────────────────

function ProgramTab({ program, brand, onRefresh }: { program: LoyaltyProgram; brand: string; onRefresh: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(program.name)
  const [ppd, setPpd] = useState(String(program.points_per_dollar))
  const [enabled, setEnabled] = useState(program.enabled)
  const [tiers, setTiers] = useState<LoyaltyTier[]>(program.tiers.map(t => ({ ...t, perks: [...t.perks] })))

  const saveMut = useMutation({
    mutationFn: () => upsertLoyaltyProgram(brand, {
      name: name.trim(),
      points_per_dollar: Number(ppd) || 10,
      enabled,
      tiers,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-program', brand] })
      toast('Program saved')
      onRefresh()
    },
    onError: () => toast('Failed to save program', { type: 'error' }),
  })

  const updateTier = (idx: number, patch: Partial<LoyaltyTier>) => {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t))
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Toggle */}
      <div
        className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <div className="flex-1">
          <p className="font-medium text-[var(--theme-text)]">Program status</p>
          <p className="text-xs text-[var(--theme-muted)]">Enable or disable the loyalty program for this brand</p>
        </div>
        <button
          onClick={() => setEnabled(v => !v)}
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-150"
          style={{
            background: enabled ? accentGradient : 'var(--theme-border)',
            boxShadow: enabled ? accentGlow : 'none',
          }}
        >
          <span
            className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform"
            style={{ transform: enabled ? 'translateX(20px)' : 'translateX(4px)' }}
          />
        </button>
        <span className="w-16 text-xs text-[var(--theme-muted)]">{enabled ? 'Enabled' : 'Disabled'}</span>
      </div>

      {/* Program settings */}
      <div
        className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 space-y-4"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Program settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Program name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Rewards Club"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Points per $1 spent</label>
            <input
              type="number"
              min={1}
              value={ppd}
              onChange={e => setPpd(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>
        </div>
      </div>

      {/* Tier editor */}
      <div
        className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 space-y-4"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Tiers</h3>
        <div className="space-y-4">
          {tiers.map((tier, idx) => {
            const metal = metalColor(tier)
            return (
              <div
                key={tier.id}
                className="rounded-xl border p-4 space-y-3 transition-all duration-150"
                style={tierCardStyle(tier)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{
                      background: `linear-gradient(135deg, ${metal}, color-mix(in srgb, ${metal} 65%, #1f2937))`,
                      boxShadow: `0 2px 8px color-mix(in srgb, ${metal} 38%, transparent)`,
                    }}
                  >
                    <HugeiconsIcon icon={GiftIcon} size={13} />
                  </span>
                  <span className="font-semibold text-sm text-[var(--theme-text)]">{tier.name}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-[var(--theme-muted)]">
                    {tier.min_points.toLocaleString('en-US')}+ lifetime pts
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Name</label>
                    <input
                      value={tier.name}
                      onChange={e => updateTier(idx, { name: e.target.value })}
                      className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Min lifetime pts</label>
                    <input
                      type="number"
                      min={0}
                      value={tier.min_points}
                      onChange={e => updateTier(idx, { min_points: Number(e.target.value) })}
                      className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1.5 text-xs tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Color</label>
                    <input
                      type="color"
                      value={tier.color}
                      onChange={e => updateTier(idx, { color: e.target.value })}
                      className="h-[30px] w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-0.5 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-[var(--theme-muted)]">Perks (comma-separated)</label>
                  <textarea
                    rows={2}
                    value={tier.perks.join(', ')}
                    onChange={e => updateTier(idx, { perks: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="5% discount, Free shipping"
                    className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1.5 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] resize-none"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rounded-lg px-5 py-2 text-sm font-medium text-white transition-all duration-150 disabled:opacity-50"
          style={{ background: accentGradient, boxShadow: accentGlow }}
        >
          {saveMut.isPending ? 'Saving…' : 'Save Program'}
        </button>
      </div>
    </div>
  )
}

// ── Members tab ───────────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'award' | 'redeem' | 'adjust'; account: LoyaltyAccount }
  | null

function MembersTab({
  accounts,
  brand,
  onRefresh,
}: {
  accounts: LoyaltyAccount[]
  brand: string
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = accounts.filter(a =>
    !search || a.contact_name.toLowerCase().includes(search.toLowerCase()),
  )

  const totalMembers = accounts.length
  const totalIssued = accounts.reduce((s, a) => s + a.lifetime_points, 0)

  const txQuery = useQuery({
    queryKey: ['loyalty-tx-member', brand, expandedId],
    queryFn: () => expandedId ? listLoyaltyTransactions(brand, expandedId) : Promise.resolve([]),
    enabled: !!expandedId,
  })

  const awardMut = useMutation({
    mutationFn: ({ contactId, pts, desc, name }: { contactId: string; pts: number; desc: string; name: string }) =>
      awardPoints(brand, contactId, { points: pts, description: desc, contact_name: name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-accounts', brand] })
      qc.invalidateQueries({ queryKey: ['loyalty-tx-member', brand] })
      setModal(null)
      toast('Points awarded')
      onRefresh()
    },
    onError: () => toast('Failed to award points', { type: 'error' }),
  })

  const redeemMut = useMutation({
    mutationFn: ({ contactId, pts, desc }: { contactId: string; pts: number; desc: string }) =>
      redeemPoints(brand, contactId, { points: pts, description: desc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-accounts', brand] })
      qc.invalidateQueries({ queryKey: ['loyalty-tx-member', brand] })
      setModal(null)
      toast('Points redeemed')
      onRefresh()
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to redeem', { type: 'error' }),
  })

  const adjustMut = useMutation({
    mutationFn: ({ contactId, pts, desc }: { contactId: string; pts: number; desc: string }) =>
      adjustPoints(brand, contactId, { points: pts, description: desc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-accounts', brand] })
      qc.invalidateQueries({ queryKey: ['loyalty-tx-member', brand] })
      setModal(null)
      toast('Points adjusted')
      onRefresh()
    },
    onError: () => toast('Failed to adjust points', { type: 'error' }),
  })

  const isMutating = awardMut.isPending || redeemMut.isPending || adjustMut.isPending

  const handleSubmit = (pts: number, desc: string) => {
    if (!modal) return
    const { mode, account } = modal
    if (mode === 'award') awardMut.mutate({ contactId: account.contact_id, pts, desc, name: account.contact_name })
    else if (mode === 'redeem') redeemMut.mutate({ contactId: account.contact_id, pts, desc })
    else adjustMut.mutate({ contactId: account.contact_id, pts, desc })
  }

  const stats = [
    { label: 'Total Members', value: totalMembers.toLocaleString('en-US'), sub: 'enrolled in program', color: '#3b82f6', icon: UserGroupIcon },
    { label: 'Total Points Issued', value: totalIssued.toLocaleString('en-US'), sub: 'lifetime points', color: '#f59e0b', icon: Coins01Icon },
    { label: 'Active Members', value: accounts.filter(a => a.points_balance > 0).length.toLocaleString('en-US'), sub: 'with a positive balance', color: '#10b981', icon: GiftIcon },
  ]

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(s => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3 transition-all duration-150 hover:-translate-y-[1px]"
            style={{ backdropFilter: 'blur(10px)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${s.color} 40%, var(--theme-border))` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
          >
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: s.color }} />
            <div className="mb-2 flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                style={{
                  background: `linear-gradient(135deg, ${s.color}, color-mix(in srgb, ${s.color} 65%, #000))`,
                  boxShadow: `0 2px 8px color-mix(in srgb, ${s.color} 38%, transparent)`,
                }}
              >
                <HugeiconsIcon icon={s.icon} size={13} />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{s.label}</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-[var(--theme-text)]">{s.value}</p>
            <p className="text-[10px] text-[var(--theme-muted)]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-xs">
        <HugeiconsIcon icon={Search01Icon} size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search members…"
          className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] py-2 pl-9 pr-3 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--theme-border)] py-16">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))', color: 'var(--theme-accent)' }}
          >
            <HugeiconsIcon icon={UserGroupIcon} size={26} />
          </span>
          <p className="text-sm font-semibold text-[var(--theme-text)]">
            {accounts.length === 0 ? 'No members yet' : 'No matches'}
          </p>
          <p className="-mt-2 text-xs text-[var(--theme-muted)]">
            {accounts.length === 0 ? 'Members appear here once they earn points.' : 'No members match your search.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--theme-border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-hover)]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Contact</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Tier</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Balance</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Lifetime</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border)] bg-[var(--theme-card)]">
              {filtered.map(a => (
                <>
                  <tr key={a.id} className="group transition-all duration-150 hover:bg-[var(--theme-hover)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--theme-text)]">{a.contact_name}</p>
                      <p className="text-[10px] text-[var(--theme-muted)]">{a.contact_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={a.tier} />
                    </td>
                    <td className="px-4 py-3 text-right text-[15px] font-bold tabular-nums" style={{ color: 'var(--theme-accent)' }}>
                      {fmtPts(a.points_balance)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--theme-text)]">
                      {fmtPts(a.lifetime_points)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-all duration-150 focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          onClick={() => setModal({ mode: 'award', account: a })}
                          className="rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150"
                          style={{ color: '#10b981', background: 'color-mix(in srgb, #10b981 10%, transparent)' }}
                        >
                          Award
                        </button>
                        <button
                          onClick={() => setModal({ mode: 'redeem', account: a })}
                          className="rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150"
                          style={{ color: '#f97316', background: 'color-mix(in srgb, #f97316 10%, transparent)' }}
                        >
                          Redeem
                        </button>
                        <button
                          onClick={() => setModal({ mode: 'adjust', account: a })}
                          className="rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150"
                          style={{ color: '#3b82f6', background: 'color-mix(in srgb, #3b82f6 10%, transparent)' }}
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === a.contact_id ? null : a.contact_id)}
                          className="rounded-md px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
                        >
                          {expandedId === a.contact_id ? 'Hide' : 'History'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === a.contact_id && (
                    <tr key={`${a.id}-history`}>
                      <td colSpan={5} className="bg-[var(--theme-hover)] px-6 py-3">
                        {txQuery.isLoading ? (
                          <div className="space-y-2">
                            {[0, 1, 2].map(i => (
                              <div key={i} className="h-5 animate-pulse rounded bg-[var(--theme-card)] opacity-60" style={{ width: `${70 - i * 12}%` }} />
                            ))}
                          </div>
                        ) : (txQuery.data ?? []).length === 0 ? (
                          <p className="text-xs text-[var(--theme-muted)]">No transactions yet.</p>
                        ) : (
                          <div>
                            {(txQuery.data ?? []).slice().reverse().map((tx, i, arr) => (
                              <TxTimelineRow key={tx.id} tx={tx} isLast={i === arr.length - 1} />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PointsModal
          mode={modal.mode}
          account={modal.account}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
          isSaving={isMutating}
        />
      )}
    </div>
  )
}

// ── Transactions tab ──────────────────────────────────────────────────────────

function TransactionsTab({
  transactions,
  accounts,
}: {
  transactions: LoyaltyTransaction[]
  accounts: LoyaltyAccount[]
}) {
  const [search, setSearch] = useState('')

  const accountMap = Object.fromEntries(accounts.map(a => [a.contact_id, a.contact_name]))

  const filtered = transactions.filter(tx => {
    if (!search) return true
    const name = accountMap[tx.contact_id] ?? tx.contact_id
    return name.toLowerCase().includes(search.toLowerCase())
  })

  // Sort newest first
  const sorted = filtered.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-xs">
        <HugeiconsIcon icon={Search01Icon} size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by contact name…"
          className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] py-2 pl-9 pr-3 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--theme-border)] py-16">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))', color: 'var(--theme-accent)' }}
          >
            <HugeiconsIcon icon={ChartHistogramIcon} size={26} />
          </span>
          <p className="text-sm font-semibold text-[var(--theme-text)]">
            {transactions.length === 0 ? 'No transactions yet' : 'No matches'}
          </p>
          <p className="-mt-2 text-xs text-[var(--theme-muted)]">
            {transactions.length === 0 ? 'Point activity will show up here.' : 'No transactions match your filter.'}
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-4"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Activity timeline
          </p>
          <div>
            {sorted.map((tx, i) => (
              <TxTimelineRow
                key={tx.id}
                tx={tx}
                name={accountMap[tx.contact_id] ?? tx.contact_id}
                isLast={i === sorted.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Tab = 'program' | 'members' | 'transactions'

function LoyaltyScreen() {
  const brand = useBrand()
  const [tab, setTab] = useState<Tab>('program')

  const programQuery = useQuery({
    queryKey: ['loyalty-program', brand.id],
    queryFn: () => getLoyaltyProgram(brand.id),
  })

  const accountsQuery = useQuery({
    queryKey: ['loyalty-accounts', brand.id],
    queryFn: () => listLoyaltyAccounts(brand.id),
  })

  const txQuery = useQuery({
    queryKey: ['loyalty-transactions', brand.id],
    queryFn: () => listLoyaltyTransactions(brand.id),
  })

  const program = programQuery.data
  const accounts = accountsQuery.data ?? []
  const transactions = txQuery.data ?? []

  const refresh = () => {
    void programQuery.refetch()
    void accountsQuery.refetch()
    void txQuery.refetch()
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'program', label: 'Program' },
    { id: 'members', label: 'Members', count: accounts.length },
    { id: 'transactions', label: 'Transactions', count: transactions.length },
  ]

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: accentGradient, boxShadow: accentGlow }}
          >
            <HugeiconsIcon icon={GiftIcon} size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[var(--theme-text)]">
              {program?.name ?? 'Loyalty & Rewards'}
            </h1>
            <p className="text-xs text-[var(--theme-muted)]">Manage points, tiers, and member rewards</p>
          </div>
          {program && (
            <span
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
              style={
                program.enabled
                  ? { background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))', color: '#10b981' }
                  : { background: 'var(--theme-hover)', color: 'var(--theme-muted)' }
              }
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: program.enabled ? '#10b981' : 'var(--theme-muted)' }} />
              {program.enabled ? 'Active' : 'Disabled'}
            </span>
          )}
        </div>

        {/* Segmented control */}
        <div className="flex w-fit gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150"
              style={
                tab === t.id
                  ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' }
                  : { color: 'var(--theme-muted)' }
              }
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1.5 text-[11px] tabular-nums text-[var(--theme-muted)]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'program' && program && (
          <ProgramTab program={program} brand={brand.id} onRefresh={refresh} />
        )}
        {tab === 'program' && !program && (
          <div className="max-w-2xl space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--theme-card)] opacity-60" />
            ))}
          </div>
        )}
        {tab === 'members' && (
          <MembersTab accounts={accounts} brand={brand.id} onRefresh={refresh} />
        )}
        {tab === 'transactions' && (
          <TransactionsTab transactions={transactions} accounts={accounts} />
        )}
      </div>
    </div>
  )
}
