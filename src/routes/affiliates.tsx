import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Cancel01Icon,
  Copy01Icon,
  DollarCircleIcon,
  PencilEdit02Icon,
  UserGroupIcon,
  UserSharingIcon,
  CheckmarkCircle02Icon,
  Money01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  listAffiliates,
  createAffiliate,
  updateAffiliate,
  listReferrals,
  createReferral,
  updateReferral,
  type AffiliateRecord,
  type ReferralRecord,
} from '@/lib/affiliates-api'

export const Route = createFileRoute('/affiliates')({ component: AffiliatesScreen })

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function autoCode(name: string) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

// ── Status badges ─────────────────────────────────────────────────────────────

const AFFILIATE_STATUS_COLORS: Record<AffiliateRecord['status'], string> = {
  active: '#10b981',
  paused: '#f59e0b',
  inactive: '#94a3b8',
}

const REFERRAL_STATUS_COLORS: Record<ReferralRecord['status'], string> = {
  pending: '#94a3b8',
  converted: '#3b82f6',
  paid: '#10b981',
  cancelled: '#ef4444',
}

function DotBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

// ── Affiliate Modal ───────────────────────────────────────────────────────────

interface AffiliateModalProps {
  initial?: AffiliateRecord
  onClose: () => void
  onSave: (data: Partial<AffiliateRecord>) => void
  isSaving: boolean
}

function AffiliateModal({ initial, onClose, onSave, isSaving }: AffiliateModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [commission, setCommission] = useState(String(initial?.commission_pct ?? 10))
  const [status, setStatus] = useState<AffiliateRecord['status']>(initial?.status ?? 'active')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const canSave = name.trim().length > 0

  const handleNameBlur = () => {
    if (!code.trim() && !initial) {
      setCode(autoCode(name))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={UserSharingIcon} size={16} className="text-white" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">
                {initial ? 'Edit affiliate' : 'Add affiliate'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {initial ? initial.name : 'Add a referral partner'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="John Smith"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Phone</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Referral code</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="JOHN25"
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 font-mono text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Commission %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={commission}
                onChange={e => setCommission(e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as AffiliateRecord['status'])}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            disabled={!canSave || isSaving}
            onClick={() =>
              onSave({
                name: name.trim(),
                email: email.trim() || null,
                phone: phone.trim() || null,
                code: code.trim() || undefined,
                commission_pct: Number(commission) || 10,
                status,
                notes: notes.trim(),
              })
            }
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {isSaving ? 'Saving…' : initial ? 'Save changes' : 'Add affiliate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Referral Modal ────────────────────────────────────────────────────────────

interface ReferralModalProps {
  affiliates: AffiliateRecord[]
  onClose: () => void
  onSave: (data: {
    affiliate_id: string
    contact_name: string
    contact_email: string | null
    deal_value_cents: number
  }) => void
  isSaving: boolean
}

function ReferralModal({ affiliates, onClose, onSave, isSaving }: ReferralModalProps) {
  const activeAffiliates = affiliates.filter(a => a.status === 'active')
  const [affiliateId, setAffiliateId] = useState(activeAffiliates[0]?.id ?? '')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [dealValueDollars, setDealValueDollars] = useState('')

  const selectedAffiliate = affiliates.find(a => a.id === affiliateId)
  const canSave = affiliateId && contactName.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-white" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">Add referral</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Log a referred deal for an affiliate</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Affiliate *</label>
            <select
              value={affiliateId}
              onChange={e => setAffiliateId(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            >
              {activeAffiliates.length === 0 && <option value="">No active affiliates</option>}
              {activeAffiliates.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
              ))}
            </select>
          </div>
          {selectedAffiliate && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--theme-accent-soft)] px-3 py-2 text-xs text-[var(--theme-muted)]">
              <span>Source code:</span>
              <code className="font-mono font-semibold text-[var(--theme-accent)]">{selectedAffiliate.code}</code>
              <span className="ml-auto">{selectedAffiliate.commission_pct}% commission</span>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Contact name *</label>
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Contact email</label>
            <input
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--theme-muted)]">Deal value ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={dealValueDollars}
              onChange={e => setDealValueDollars(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
            />
            {dealValueDollars && selectedAffiliate && (
              <p className="mt-1 text-xs text-[var(--theme-muted)]">
                Commission: {fmtMoney(Math.round(parseFloat(dealValueDollars) * 100 * (selectedAffiliate.commission_pct / 100)))}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            disabled={!canSave || isSaving}
            onClick={() =>
              onSave({
                affiliate_id: affiliateId,
                contact_name: contactName.trim(),
                contact_email: contactEmail.trim() || null,
                deal_value_cents: Math.round((parseFloat(dealValueDollars) || 0) * 100),
              })
            }
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {isSaving ? 'Saving…' : 'Add referral'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({ affiliates, referrals }: { affiliates: AffiliateRecord[]; referrals: ReferralRecord[] }) {
  const totalAffiliates = affiliates.length
  const totalReferrals = referrals.length
  const totalRevenue = referrals.reduce((s, r) => s + r.deal_value_cents, 0)
  const totalCommission = referrals.reduce((s, r) => s + r.commission_cents, 0)

  const stats = [
    { label: 'Total affiliates', value: String(totalAffiliates), icon: UserSharingIcon, color: '#8b5cf6' },
    { label: 'Total referrals', value: String(totalReferrals), icon: UserGroupIcon, color: '#3b82f6' },
    { label: 'Revenue referred', value: fmtMoney(totalRevenue), icon: DollarCircleIcon, color: '#10b981' },
    { label: 'Commissions owed', value: fmtMoney(totalCommission), icon: Money01Icon, color: '#f59e0b' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(s => (
        <div
          key={s.label}
          className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
            style={{ background: `linear-gradient(180deg, ${s.color}, color-mix(in srgb, ${s.color} 40%, transparent))` }}
          />
          <div className="flex items-center gap-3 pl-1.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${s.color}, color-mix(in srgb, ${s.color} 65%, #000))`,
                boxShadow: `0 2px 8px color-mix(in srgb, ${s.color} 35%, transparent)`,
              }}
            >
              <HugeiconsIcon icon={s.icon} size={15} className="text-white" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{s.label}</p>
              <p className="mt-0.5 text-[18px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{s.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Affiliate card ────────────────────────────────────────────────────────────

function AffiliateCard({
  affiliate,
  onEdit,
  onCopy,
}: {
  affiliate: AffiliateRecord
  onEdit: () => void
  onCopy: () => void
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--theme-text)]">{affiliate.name}</p>
          {affiliate.email && (
            <p className="truncate text-xs text-[var(--theme-muted)]">{affiliate.email}</p>
          )}
        </div>
        <DotBadge label={affiliate.status} color={AFFILIATE_STATUS_COLORS[affiliate.status]} />
      </div>

      {/* Code + commission */}
      <div className="flex items-center gap-2">
        <code
          className="rounded-md px-2 py-1 font-mono text-xs font-bold"
          style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}
        >
          {affiliate.code}
        </code>
        <span className="text-xs text-[var(--theme-muted)]">{affiliate.commission_pct}% commission</span>
      </div>

      {/* Metric chips */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: 'Referrals', value: String(affiliate.total_referrals), color: '#3b82f6' },
          { label: 'Revenue', value: fmtMoney(affiliate.total_revenue_cents), color: '#10b981' },
          { label: 'Commission', value: fmtMoney(affiliate.total_commission_cents), color: '#f59e0b' },
        ]).map(m => (
          <div
            key={m.label}
            className="rounded-lg px-2 py-1.5 text-center"
            style={{
              background: `color-mix(in srgb, ${m.color} 8%, var(--theme-card))`,
              border: `1px solid color-mix(in srgb, ${m.color} 20%, transparent)`,
            }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{m.label}</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCopy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--theme-border)] py-1.5 text-xs text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
        >
          <HugeiconsIcon icon={Copy01Icon} size={12} />
          Copy link
        </button>
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--theme-border)] py-1.5 text-xs text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
        >
          <HugeiconsIcon icon={PencilEdit02Icon} size={12} />
          Edit
        </button>
      </div>
    </div>
  )
}

// ── Affiliates tab ─────────────────────────────────────────────────────────────

function AffiliatesTab({
  affiliates,
  referrals,
  brand,
  onRefresh,
}: {
  affiliates: AffiliateRecord[]
  referrals: ReferralRecord[]
  brand: string
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'create' | AffiliateRecord | null>(null)

  const createMut = useMutation({
    mutationFn: (data: Partial<AffiliateRecord>) => createAffiliate({ ...data, brand }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affiliates', brand] })
      setModal(null)
      toast('Affiliate added')
      onRefresh()
    },
    onError: () => toast('Failed to save affiliate', { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AffiliateRecord> }) =>
      updateAffiliate(id, { ...data, brand }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affiliates', brand] })
      setModal(null)
      toast('Affiliate updated')
      onRefresh()
    },
    onError: () => toast('Failed to update affiliate', { type: 'error' }),
  })

  const handleCopy = (affiliate: AffiliateRecord) => {
    const url = `https://yourdomain.com/?ref=${affiliate.code}`
    navigator.clipboard.writeText(url).then(
      () => toast(`Copied: ${url}`),
      () => toast('Failed to copy', { type: 'error' }),
    )
  }

  return (
    <div className="space-y-4">
      <StatsStrip affiliates={affiliates} referrals={referrals} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--theme-text)]">
          {affiliates.length} affiliate{affiliates.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setModal('create')} className={primaryBtnCls} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={14} />
          Add affiliate
        </button>
      </div>

      {affiliates.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-16 text-center"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={UserSharingIcon} size={22} />
          </span>
          <p className="text-[13px] font-semibold text-[var(--theme-text)]">No affiliates yet</p>
          <p className="text-[11px] text-[var(--theme-muted)]">Add your first referral partner to start tracking commissions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {affiliates.map(a => (
            <AffiliateCard
              key={a.id}
              affiliate={a}
              onEdit={() => setModal(a)}
              onCopy={() => handleCopy(a)}
            />
          ))}
        </div>
      )}

      {modal === 'create' && (
        <AffiliateModal
          onClose={() => setModal(null)}
          onSave={data => createMut.mutate(data)}
          isSaving={createMut.isPending}
        />
      )}

      {modal && modal !== 'create' && (
        <AffiliateModal
          initial={modal}
          onClose={() => setModal(null)}
          onSave={data => updateMut.mutate({ id: (modal as AffiliateRecord).id, data })}
          isSaving={updateMut.isPending}
        />
      )}
    </div>
  )
}

// ── Referrals tab ─────────────────────────────────────────────────────────────

function ReferralsTab({
  affiliates,
  referrals,
  brand,
  onRefresh,
}: {
  affiliates: AffiliateRecord[]
  referrals: ReferralRecord[]
  brand: string
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [filterAffiliate, setFilterAffiliate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)

  const createMut = useMutation({
    mutationFn: (data: {
      affiliate_id: string
      contact_name: string
      contact_email: string | null
      deal_value_cents: number
    }) => createReferral({ ...data, brand }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', brand] })
      qc.invalidateQueries({ queryKey: ['affiliates', brand] })
      setShowModal(false)
      toast('Referral added')
      onRefresh()
    },
    onError: () => toast('Failed to save referral', { type: 'error' }),
  })

  const markPaidMut = useMutation({
    mutationFn: (id: string) => updateReferral(id, { status: 'paid', brand }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', brand] })
      toast('Marked as paid')
      onRefresh()
    },
    onError: () => toast('Failed to update', { type: 'error' }),
  })

  const markConvertedMut = useMutation({
    mutationFn: (id: string) => updateReferral(id, { status: 'converted', brand }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', brand] })
      toast('Marked as converted')
      onRefresh()
    },
    onError: () => toast('Failed to update', { type: 'error' }),
  })

  const filtered = referrals.filter(r => {
    if (filterAffiliate && r.affiliate_id !== filterAffiliate) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterAffiliate}
          onChange={e => setFilterAffiliate(e.target.value)}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-1.5 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        >
          <option value="">All affiliates</option>
          {affiliates.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-1.5 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="converted">Converted</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => setShowModal(true)} className={`${primaryBtnCls} ml-auto`} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={14} />
          Add referral
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-16 text-center"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={UserGroupIcon} size={22} />
          </span>
          <p className="text-[13px] font-semibold text-[var(--theme-text)]">
            {referrals.length === 0 ? 'No referrals yet' : 'No referrals match these filters'}
          </p>
          <p className="text-[11px] text-[var(--theme-muted)]">Referred deals and their commissions will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--theme-border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-hover)]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Contact</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Affiliate</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Deal value</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Commission</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border)] bg-[var(--theme-card)]">
              {filtered.map(r => (
                <tr key={r.id} className="group hover:bg-[var(--theme-hover)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--theme-text)]">{r.contact_name}</p>
                    {r.contact_email && (
                      <p className="text-xs text-[var(--theme-muted)]">{r.contact_email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[var(--theme-text)]">{r.affiliate_name}</p>
                    <code className="text-[10px] text-[var(--theme-muted)]">{r.source_code}</code>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--theme-text)]">
                    {fmtMoney(r.deal_value_cents)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums" style={{ color: 'var(--theme-accent)' }}>
                    {fmtMoney(r.commission_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <DotBadge label={r.status} color={REFERRAL_STATUS_COLORS[r.status]} />
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-[var(--theme-muted)]">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                      {r.status === 'pending' && (
                        <button
                          onClick={() => markConvertedMut.mutate(r.id)}
                          title="Mark converted"
                          className="rounded-md px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                        </button>
                      )}
                      {r.status === 'converted' && (
                        <button
                          onClick={() => markPaidMut.mutate(r.id)}
                          title="Mark paid"
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        >
                          <HugeiconsIcon icon={Money01Icon} size={14} />
                          Mark paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ReferralModal
          affiliates={affiliates}
          onClose={() => setShowModal(false)}
          onSave={data => createMut.mutate(data)}
          isSaving={createMut.isPending}
        />
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

function AffiliatesScreen() {
  const brand = useBrand()
  const [tab, setTab] = useState<'affiliates' | 'referrals'>('affiliates')

  const affiliatesQuery = useQuery({
    queryKey: ['affiliates', brand.id],
    queryFn: () => listAffiliates(brand.id),
  })

  const referralsQuery = useQuery({
    queryKey: ['referrals', brand.id],
    queryFn: () => listReferrals(brand.id),
  })

  const affiliates = affiliatesQuery.data ?? []
  const referrals = referralsQuery.data ?? []

  const refresh = () => {
    void affiliatesQuery.refetch()
    void referralsQuery.refetch()
  }

  const tabs: { id: 'affiliates' | 'referrals'; label: string }[] = [
    { id: 'affiliates', label: 'Affiliates' },
    { id: 'referrals', label: 'Referrals' },
  ]

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={UserSharingIcon} size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">Affiliates</h1>
            <p className="text-[12px] text-[var(--theme-muted)]">
              {affiliates.length > 0
                ? `${affiliates.length} partner${affiliates.length !== 1 ? 's' : ''} · manage referrals and track commissions`
                : 'Manage referral partners and track commissions'}
            </p>
          </div>
        </div>

        {/* Tabs — segmented control */}
        <div className="flex gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                tab === t.id ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
              }`}
              style={
                tab === t.id
                  ? {
                      background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                      color: 'var(--theme-accent)',
                    }
                  : undefined
              }
            >
              {t.label}
              {t.id === 'referrals' && referrals.length > 0 && (
                <span className="ml-1.5 opacity-60 tabular-nums">{referrals.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {affiliatesQuery.isLoading || referralsQuery.isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-[68px] animate-pulse rounded-xl border opacity-60"
                  style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-xl border opacity-60"
                  style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
                />
              ))}
            </div>
          </div>
        ) : tab === 'affiliates' ? (
          <AffiliatesTab
            affiliates={affiliates}
            referrals={referrals}
            brand={brand.id}
            onRefresh={refresh}
          />
        ) : (
          <ReferralsTab
            affiliates={affiliates}
            referrals={referrals}
            brand={brand.id}
            onRefresh={refresh}
          />
        )}
      </div>
    </div>
  )
}
