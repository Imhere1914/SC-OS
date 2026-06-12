import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  Money01Icon,
  PencilEdit02Icon,
  Tick01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

export const Route = createFileRoute('/commissions')({ component: CommissionsScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommissionRule {
  id: string
  brand: string
  name: string
  assignee: string
  rate_pct: number
  applies_to: 'deal' | 'invoice' | 'both'
  active: boolean
  created_at: string
}

interface CommissionRecord {
  id: string
  brand: string
  rule_id?: string
  assignee: string
  reference_type: 'deal' | 'invoice'
  reference_id: string
  reference_label: string
  amount_cents: number
  commission_cents: number
  rate_pct: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  paid_at?: string
  notes?: string
  created_at: string
  updated_at: string
}

interface CommissionSummary {
  by_assignee: Record<string, {
    pending_cents: number
    approved_cents: number
    paid_cents: number
    total_cents: number
  }>
  total_pending_cents: number
  total_paid_cents: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const accentGradient = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const accentGlow = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const STATUS_COLORS: Record<CommissionRecord['status'], string> = {
  pending: '#f59e0b',
  approved: '#3b82f6',
  paid: '#10b981',
  cancelled: '#9ca3af',
}

function StatusBadge({ status }: { status: CommissionRecord['status'] }) {
  const c = STATUS_COLORS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
      style={{ background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {status}
    </span>
  )
}

const APPLIES_TO_COLORS: Record<CommissionRule['applies_to'], string> = {
  deal: '#8b5cf6',
  invoice: '#3b82f6',
  both: '#0ea5e9',
}

// Colored metric chip used in assignee cards
function MetricChip({ label, cents, color }: { label: string; cents: number; color: string }) {
  return (
    <div
      className="rounded-lg px-2.5 py-1.5"
      style={{ background: `color-mix(in srgb, ${color} 10%, var(--theme-card))` }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: `color-mix(in srgb, ${color} 70%, var(--theme-muted))` }}>{label}</p>
      <p className="text-[13px] font-bold tabular-nums" style={{ color }}>{fmtMoney(cents)}</p>
    </div>
  )
}

const checkboxCls = 'h-4 w-4 cursor-pointer rounded border-[var(--theme-border)] accent-[var(--theme-accent)] transition-all duration-150'

// ── API calls ─────────────────────────────────────────────────────────────────

async function apiFetch(url: string, brandId: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-brand': brandId, ...(opts?.headers ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}

// ── Rule Modal ────────────────────────────────────────────────────────────────

function RuleModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: CommissionRule
  onClose: () => void
  onSave: (data: Partial<CommissionRule>) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [assignee, setAssignee] = useState(initial?.assignee ?? '')
  const [rate, setRate] = useState(initial ? String(initial.rate_pct) : '')
  const [appliesTo, setAppliesTo] = useState<CommissionRule['applies_to']>(initial?.applies_to ?? 'both')
  const [active, setActive] = useState(initial?.active ?? true)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !assignee.trim() || !rate) return
    onSave({ name: name.trim(), assignee: assignee.trim(), rate_pct: Number(rate), applies_to: appliesTo, active })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGradient, boxShadow: accentGlow }}
            >
              <HugeiconsIcon icon={Money01Icon} size={16} />
            </span>
            <div>
              <h2 className="font-semibold text-[var(--theme-text)]">{initial ? 'Edit Rule' : 'New Rule'}</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Automatic commission for a team member</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <input
            placeholder="Rule name *"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
          />
          <input
            placeholder="Assignee (team member name) *"
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                placeholder="Rate % *"
                value={rate}
                onChange={e => setRate(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm tabular-nums text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-[var(--theme-muted)]">%</span>
            </div>
            <select
              value={appliesTo}
              onChange={e => setAppliesTo(e.target.value as CommissionRule['applies_to'])}
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
            >
              <option value="deal">Deals</option>
              <option value="invoice">Invoices</option>
              <option value="both">Both</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--theme-text)]">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className={checkboxCls} />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
            <button type="submit" className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150" style={{ background: accentGradient, boxShadow: accentGlow }}>
              {initial ? 'Save changes' : 'Create rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Commission Modal ──────────────────────────────────────────────────────────

function CommissionModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: Partial<CommissionRecord>) => void
}) {
  const [referenceType, setReferenceType] = useState<'deal' | 'invoice'>('deal')
  const [referenceLabel, setReferenceLabel] = useState('')
  const [referenceId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [amountDollars, setAmountDollars] = useState('')
  const [rate, setRate] = useState('')
  const [notes, setNotes] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!referenceLabel.trim() || !assignee.trim() || !amountDollars || !rate) return
    onSave({
      reference_type: referenceType,
      reference_id: referenceId.trim() || referenceLabel.trim(),
      reference_label: referenceLabel.trim(),
      assignee: assignee.trim(),
      amount_cents: Math.round(Number(amountDollars) * 100),
      rate_pct: Number(rate),
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGradient, boxShadow: accentGlow }}
            >
              <HugeiconsIcon icon={Money01Icon} size={16} />
            </span>
            <div>
              <h2 className="font-semibold text-[var(--theme-text)]">Add Commission</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Record a one-off commission</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={referenceType}
              onChange={e => setReferenceType(e.target.value as 'deal' | 'invoice')}
              className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
            >
              <option value="deal">Deal</option>
              <option value="invoice">Invoice</option>
            </select>
            <input
              placeholder="Reference label *"
              value={referenceLabel}
              onChange={e => setReferenceLabel(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
            />
          </div>
          <input
            placeholder="Assignee *"
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-[var(--theme-muted)]">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="Amount"
                value={amountDollars}
                onChange={e => setAmountDollars(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] pl-6 pr-3 py-2 text-sm tabular-nums text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
              />
            </div>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                placeholder="Rate %"
                value={rate}
                onChange={e => setRate(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm tabular-nums text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-[var(--theme-muted)]">%</span>
            </div>
          </div>
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:border-[var(--theme-accent)]"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
            <button type="submit" className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150" style={{ background: accentGradient, boxShadow: accentGlow }}>
              Add Commission
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ brandId }: { brandId: string }) {
  const qc = useQueryClient()
  const { data: summary, isLoading } = useQuery<CommissionSummary>({
    queryKey: ['commissions-summary', brandId],
    queryFn: () => apiFetch('/api/commissions/summary', brandId),
  })

  const bulkPay = useMutation({
    mutationFn: async () => {
      // Collect all approved ids first
      const all = await apiFetch(`/api/commissions?status=approved`, brandId) as CommissionRecord[]
      const ids = all.map(r => r.id)
      if (ids.length === 0) return { updated: 0 }
      return apiFetch('/api/commissions/bulk-pay', brandId, { method: 'POST', body: JSON.stringify({ ids }) })
    },
    onSuccess: (res: { updated: number }) => {
      toast(`Marked ${res.updated} commission${res.updated !== 1 ? 's' : ''} as paid`)
      void qc.invalidateQueries({ queryKey: ['commissions-summary', brandId] })
      void qc.invalidateQueries({ queryKey: ['commissions', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      </div>
    )
  }

  const assignees = Object.entries(summary?.by_assignee ?? {})

  return (
    <div className="space-y-6">
      {/* Totals bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div
          className="relative overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-[1px]"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: '#f59e0b' }} />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Total Pending</p>
          <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: '#f59e0b' }}>{fmtMoney(summary?.total_pending_cents ?? 0)}</p>
          <p className="text-[10px] text-[var(--theme-muted)]">awaiting approval</p>
        </div>
        <div
          className="relative overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-[1px]"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: '#10b981' }} />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Total Paid</p>
          <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: '#10b981' }}>{fmtMoney(summary?.total_paid_cents ?? 0)}</p>
          <p className="text-[10px] text-[var(--theme-muted)]">all time</p>
        </div>
        <div
          className="relative col-span-2 flex items-center justify-between overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-[1px]"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: '#3b82f6' }} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Approved (ready to pay)</p>
            <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: '#3b82f6' }}>
              {fmtMoney(assignees.reduce((s, [, v]) => s + v.approved_cents, 0))}
            </p>
          </div>
          <button
            onClick={() => bulkPay.mutate()}
            disabled={bulkPay.isPending || assignees.every(([, v]) => v.approved_cents === 0)}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50"
            style={{ background: accentGradient, boxShadow: accentGlow }}
          >
            Mark All Approved as Paid
          </button>
        </div>
      </div>

      {/* Per-assignee cards */}
      {assignees.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--theme-border)] py-16 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={Money01Icon} size={24} />
          </span>
          <p className="text-sm font-semibold text-[var(--theme-text)]">No commissions yet</p>
          <p className="-mt-2 text-xs text-[var(--theme-muted)]">Earnings per team member will show up here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignees.map(([name, vals]) => (
            <div
              key={name}
              className="space-y-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 transition-all duration-150 hover:-translate-y-[1px]"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: accentGradient, boxShadow: accentGlow }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-[var(--theme-text)]">{name}</span>
                  <span className="text-[11px] tabular-nums text-[var(--theme-muted)]">{fmtMoney(vals.total_cents)} earned total</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MetricChip label="Pending" cents={vals.pending_cents} color="#f59e0b" />
                <MetricChip label="Approved" cents={vals.approved_cents} color="#3b82f6" />
                <MetricChip label="Paid" cents={vals.paid_cents} color="#10b981" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Commissions Tab ───────────────────────────────────────────────────────────

function CommissionsTab({ brandId }: { brandId: string }) {
  const qc = useQueryClient()
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)

  const params = new URLSearchParams()
  if (assigneeFilter) params.set('assignee', assigneeFilter)
  if (statusFilter) params.set('status', statusFilter)
  if (fromFilter) params.set('from', fromFilter)
  if (toFilter) params.set('to', toFilter)

  const { data: records = [], isLoading } = useQuery<CommissionRecord[]>({
    queryKey: ['commissions', brandId, assigneeFilter, statusFilter, fromFilter, toFilter],
    queryFn: () => apiFetch(`/api/commissions?${params}`, brandId),
  })

  const addMutation = useMutation({
    mutationFn: (data: Partial<CommissionRecord>) =>
      apiFetch('/api/commissions', brandId, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast('Commission added')
      setShowAddModal(false)
      void qc.invalidateQueries({ queryKey: ['commissions', brandId] })
      void qc.invalidateQueries({ queryKey: ['commissions-summary', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CommissionRecord> }) =>
      apiFetch(`/api/commissions/${id}`, brandId, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commissions', brandId] })
      void qc.invalidateQueries({ queryKey: ['commissions-summary', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/commissions/${id}`, brandId, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Deleted')
      void qc.invalidateQueries({ queryKey: ['commissions', brandId] })
      void qc.invalidateQueries({ queryKey: ['commissions-summary', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch('/api/commissions/bulk-approve', brandId, { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: (res: { updated: number }) => {
      toast(`Approved ${res.updated} commission${res.updated !== 1 ? 's' : ''}`)
      setSelected(new Set())
      void qc.invalidateQueries({ queryKey: ['commissions', brandId] })
      void qc.invalidateQueries({ queryKey: ['commissions-summary', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const bulkPayMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch('/api/commissions/bulk-pay', brandId, { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: (res: { updated: number }) => {
      toast(`Marked ${res.updated} as paid`)
      setSelected(new Set())
      void qc.invalidateQueries({ queryKey: ['commissions', brandId] })
      void qc.invalidateQueries({ queryKey: ['commissions-summary', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  function toggleAll() {
    if (selected.size === records.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(records.map(r => r.id)))
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Unique assignees for filter dropdown
  const { data: allRecords = [] } = useQuery<CommissionRecord[]>({
    queryKey: ['commissions', brandId, '', '', '', ''],
    queryFn: () => apiFetch('/api/commissions', brandId),
  })
  const assignees = [...new Set(allRecords.map(r => r.assignee))].sort()

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-sm text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
        >
          <option value="">All assignees</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-sm text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={fromFilter}
          onChange={e => setFromFilter(e.target.value)}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-sm text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
        />
        <input
          type="date"
          value={toFilter}
          onChange={e => setToFilter(e.target.value)}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-sm text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
        />
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button
                onClick={() => bulkApproveMutation.mutate([...selected])}
                disabled={bulkApproveMutation.isPending}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 disabled:opacity-50"
                style={{
                  color: '#3b82f6',
                  background: 'color-mix(in srgb, #3b82f6 12%, var(--theme-card))',
                  border: '1px solid color-mix(in srgb, #3b82f6 35%, var(--theme-border))',
                }}
              >
                Approve <span className="tabular-nums">({selected.size})</span>
              </button>
              <button
                onClick={() => bulkPayMutation.mutate([...selected])}
                disabled={bulkPayMutation.isPending}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 disabled:opacity-50"
                style={{
                  color: '#10b981',
                  background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))',
                  border: '1px solid color-mix(in srgb, #10b981 35%, var(--theme-border))',
                }}
              >
                Mark Paid <span className="tabular-nums">({selected.size})</span>
              </button>
            </>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-all duration-150"
            style={{ background: accentGradient, boxShadow: accentGlow }}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} />
            Add Commission
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--theme-border)] py-16 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={Money01Icon} size={24} />
          </span>
          <p className="text-sm font-semibold text-[var(--theme-text)]">No commissions found</p>
          <p className="-mt-2 text-xs text-[var(--theme-muted)]">Adjust the filters or add a commission.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--theme-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-hover)] text-left">
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === records.length && records.length > 0}
                    onChange={toggleAll}
                    className={checkboxCls}
                  />
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Date</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Reference</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Assignee</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-right">Amount</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-right">Rate</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-right">Commission</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Status</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border)]">
              {records.map(r => (
                <tr key={r.id} className="group bg-[var(--theme-card)] transition-all duration-150 hover:bg-[var(--theme-hover)]">
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className={checkboxCls}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-[var(--theme-muted)]">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[var(--theme-text)]">{r.reference_label}</div>
                    <div className="text-xs text-[var(--theme-muted)] capitalize">{r.reference_type}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--theme-text)]">{r.assignee}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[var(--theme-text)]">{fmtMoney(r.amount_cents)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[var(--theme-muted)]">{r.rate_pct}%</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: r.status === 'paid' ? '#10b981' : 'var(--theme-text)' }}>
                    {fmtMoney(r.commission_cents)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 opacity-0 transition-all duration-150 focus-within:opacity-100 group-hover:opacity-100">
                      {r.status === 'pending' && (
                        <button
                          title="Approve"
                          onClick={() => updateMutation.mutate({ id: r.id, patch: { status: 'approved' } })}
                          className="rounded p-1 transition-all duration-150"
                          style={{ color: '#3b82f6' }}
                        >
                          <HugeiconsIcon icon={Tick01Icon} size={14} />
                        </button>
                      )}
                      {r.status === 'approved' && (
                        <button
                          title="Mark Paid"
                          onClick={() => updateMutation.mutate({ id: r.id, patch: { status: 'paid' } })}
                          className="rounded p-1 transition-all duration-150"
                          style={{ color: '#10b981' }}
                        >
                          <HugeiconsIcon icon={Tick01Icon} size={14} />
                        </button>
                      )}
                      {r.status !== 'cancelled' && r.status !== 'paid' && (
                        <button
                          title="Cancel"
                          onClick={() => updateMutation.mutate({ id: r.id, patch: { status: 'cancelled' } })}
                          className="rounded p-1 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} size={14} />
                        </button>
                      )}
                      <button
                        title="Delete"
                        onClick={() => {
                          if (confirm('Delete this commission?')) deleteMutation.mutate(r.id)
                        }}
                        className="rounded p-1 transition-all duration-150"
                        style={{ color: '#ef4444' }}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <CommissionModal
          onClose={() => setShowAddModal(false)}
          onSave={data => addMutation.mutate(data)}
        />
      )}
    </div>
  )
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────

function RulesTab({ brandId }: { brandId: string }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CommissionRule | null>(null)

  const { data: rules = [], isLoading } = useQuery<CommissionRule[]>({
    queryKey: ['commission-rules', brandId],
    queryFn: () => apiFetch('/api/commissions/rules', brandId),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<CommissionRule>) =>
      apiFetch('/api/commissions/rules', brandId, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast('Rule created')
      setShowModal(false)
      void qc.invalidateQueries({ queryKey: ['commission-rules', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CommissionRule> }) =>
      apiFetch(`/api/commissions/rules/${id}`, brandId, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      toast('Rule updated')
      setEditing(null)
      void qc.invalidateQueries({ queryKey: ['commission-rules', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/commissions/rules/${id}`, brandId, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Rule deleted')
      void qc.invalidateQueries({ queryKey: ['commission-rules', brandId] })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-all duration-150"
          style={{ background: accentGradient, boxShadow: accentGlow }}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          New Rule
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--theme-border)] py-16 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={Money01Icon} size={24} />
          </span>
          <p className="text-sm font-semibold text-[var(--theme-text)]">No commission rules yet</p>
          <p className="-mt-2 text-xs text-[var(--theme-muted)]">Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const appliesColor = APPLIES_TO_COLORS[rule.applies_to]
            return (
              <div
                key={rule.id}
                className="group flex items-center gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3 transition-all duration-150 hover:-translate-y-[1px]"
                style={{ backdropFilter: 'blur(10px)', opacity: rule.active ? 1 : 0.7 }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--theme-text)]">{rule.name}</span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                      style={{ background: `color-mix(in srgb, ${appliesColor} 12%, var(--theme-card))`, color: appliesColor }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: appliesColor }} />
                      {rule.applies_to}
                    </span>
                    {!rule.active && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: 'var(--theme-hover)', color: 'var(--theme-muted)' }}
                      >
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--theme-muted)]">
                    {rule.assignee} — <span className="tabular-nums">{rule.rate_pct}%</span> commission
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Active pill switch */}
                  <button
                    title={rule.active ? 'Deactivate' : 'Activate'}
                    onClick={() => updateMutation.mutate({ id: rule.id, patch: { active: !rule.active } })}
                    className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-150"
                    style={{
                      background: rule.active ? '#10b981' : 'var(--theme-border)',
                      boxShadow: rule.active ? '0 2px 8px color-mix(in srgb, #10b981 38%, transparent)' : 'none',
                    }}
                  >
                    <span
                      className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                      style={{ transform: rule.active ? 'translateX(18px)' : 'translateX(2px)' }}
                    />
                  </button>
                  <button
                    title="Edit"
                    onClick={() => setEditing(rule)}
                    className="rounded p-1 text-[var(--theme-muted)] opacity-0 transition-all duration-150 focus-visible:opacity-100 group-hover:opacity-100 hover:bg-[var(--theme-hover)]"
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} size={15} />
                  </button>
                  <button
                    title="Delete"
                    onClick={() => {
                      if (confirm(`Delete rule "${rule.name}"?`)) deleteMutation.mutate(rule.id)
                    }}
                    className="rounded p-1 opacity-0 transition-all duration-150 focus-visible:opacity-100 group-hover:opacity-100"
                    style={{ color: '#ef4444' }}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <RuleModal
          onClose={() => setShowModal(false)}
          onSave={data => createMutation.mutate(data)}
        />
      )}
      {editing && (
        <RuleModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={data => updateMutation.mutate({ id: editing.id, patch: data })}
        />
      )}
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type Tab = 'overview' | 'commissions' | 'rules'

function CommissionsScreen() {
  const brand = useBrand()
  const [tab, setTab] = useState<Tab>('overview')

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'rules', label: 'Rules' },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--theme-border)] bg-[var(--theme-card)] px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: accentGradient, boxShadow: accentGlow }}
          >
            <HugeiconsIcon icon={Money01Icon} size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[var(--theme-text)]">Commissions</h1>
            <p className="text-sm text-[var(--theme-muted)]">Track sales commissions per team member</p>
          </div>
        </div>
      </div>

      {/* Segmented control */}
      <div className="border-b border-[var(--theme-border)] bg-[var(--theme-card)] px-6 py-3">
        <div className="flex w-fit gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-1">
          {TABS.map(t => (
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
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'overview' && <OverviewTab brandId={brand.id} />}
        {tab === 'commissions' && <CommissionsTab brandId={brand.id} />}
        {tab === 'rules' && <RulesTab brandId={brand.id} />}
      </div>
    </div>
  )
}
