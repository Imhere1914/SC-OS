import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  PencilEdit02Icon,
  Calculator01Icon,
  Tick02Icon,
  Cancel01Icon,
  LockIcon,
  BookOpen01Icon,
  JusticeScale01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

// ── Types ────────────────────────────────────────────────────────────────────

type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

type AccountSubtype =
  | 'checking' | 'savings' | 'accounts_receivable' | 'other_current_asset' | 'fixed_asset'
  | 'accounts_payable' | 'credit_card' | 'payroll_liability' | 'sales_tax_payable'
  | 'other_current_liability' | 'long_term_liability'
  | 'equity' | 'retained_earnings' | 'owners_draw'
  | 'service_revenue' | 'product_sales' | 'other_income'
  | 'advertising' | 'bank_charges' | 'insurance' | 'meals_entertainment' | 'office_supplies'
  | 'payroll_expense' | 'professional_services' | 'rent_lease' | 'software_tech' | 'travel'
  | 'utilities' | 'other_expense'

interface AccountRecord {
  id: string
  brand: string
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  description?: string
  is_active: boolean
  is_system: boolean
  parent_id?: string
  balance_cents: number
  created_at: string
  updated_at: string
}

type JournalSource = 'manual' | 'invoice' | 'payment' | 'bill' | 'expense' | 'payroll'

interface JournalLine {
  account_id: string
  account_code: string
  account_name: string
  debit_cents: number
  credit_cents: number
  memo?: string
}

interface JournalEntry {
  id: string
  brand: string
  date: string
  description: string
  reference?: string
  source: JournalSource
  lines: JournalLine[]
  created_at: string
  created_by?: string
}

interface TrialBalanceGroup {
  type: AccountType
  accounts: AccountRecord[]
  subtotal_cents: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_SUBTYPES: Record<AccountType, AccountSubtype[]> = {
  asset: ['checking', 'savings', 'accounts_receivable', 'other_current_asset', 'fixed_asset'],
  liability: ['accounts_payable', 'credit_card', 'payroll_liability', 'sales_tax_payable', 'other_current_liability', 'long_term_liability'],
  equity: ['equity', 'retained_earnings', 'owners_draw'],
  income: ['service_revenue', 'product_sales', 'other_income'],
  expense: ['advertising', 'bank_charges', 'insurance', 'meals_entertainment', 'office_supplies', 'payroll_expense', 'professional_services', 'rent_lease', 'software_tech', 'travel', 'utilities', 'other_expense'],
}

const SUBTYPE_LABELS: Record<AccountSubtype, string> = {
  checking: 'Checking', savings: 'Savings', accounts_receivable: 'Accounts Receivable',
  other_current_asset: 'Other Current Asset', fixed_asset: 'Fixed Asset',
  accounts_payable: 'Accounts Payable', credit_card: 'Credit Card',
  payroll_liability: 'Payroll Liability', sales_tax_payable: 'Sales Tax Payable',
  other_current_liability: 'Other Current Liability', long_term_liability: 'Long-term Liability',
  equity: 'Equity', retained_earnings: 'Retained Earnings', owners_draw: "Owner's Draw",
  service_revenue: 'Service Revenue', product_sales: 'Product Sales', other_income: 'Other Income',
  advertising: 'Advertising', bank_charges: 'Bank Charges', insurance: 'Insurance',
  meals_entertainment: 'Meals & Entertainment', office_supplies: 'Office Supplies',
  payroll_expense: 'Payroll Expense', professional_services: 'Professional Services',
  rent_lease: 'Rent & Lease', software_tech: 'Software & Tech', travel: 'Travel',
  utilities: 'Utilities', other_expense: 'Other Expense',
}

// asset green / liability red / equity purple / income blue / expense amber
const TYPE_COLORS: Record<AccountType, string> = {
  asset: '#10b981',
  liability: '#ef4444',
  equity: '#8b5cf6',
  income: '#3b82f6',
  expense: '#f59e0b',
}

const SOURCE_COLORS: Record<JournalSource, string> = {
  manual: '#94a3b8',
  invoice: '#3b82f6',
  payment: '#10b981',
  bill: '#f97316',
  expense: '#ef4444',
  payroll: '#8b5cf6',
}

// ── Shared design tokens ──────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--theme-muted)]'

// Dot + tinted pill badge for account types
function TypeBadge({ type, label }: { type: AccountType; label: string }) {
  const c = TYPE_COLORS[type]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`,
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {label}
    </span>
  )
}

// Dot + tinted pill badge for journal sources
function SourceBadge({ source }: { source: JournalSource }) {
  const c = SOURCE_COLORS[source]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{
        background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`,
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {source}
    </span>
  )
}

// Mono account-code chip, accent tinted
function CodeChip({ code }: { code: string }) {
  return (
    <span
      className="inline-flex rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold"
      style={{
        background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
        color: 'var(--theme-accent)',
        border: '1px solid color-mix(in srgb, var(--theme-accent) 25%, transparent)',
      }}
    >
      {code}
    </span>
  )
}

// Small lock-tinted chip for system accounts
function SystemChip() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{
        background: 'color-mix(in srgb, #94a3b8 12%, var(--theme-card))',
        color: '#94a3b8',
        border: '1px solid color-mix(in srgb, #94a3b8 30%, transparent)',
      }}
    >
      <HugeiconsIcon icon={LockIcon} size={9} /> System
    </span>
  )
}

// Modal header with gradient icon chip
function ModalHeader({ icon, title, subtitle, onClose }: {
  icon: typeof Calculator01Icon
  title: string
  subtitle?: string
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={icon} size={16} className="text-white" />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
          {subtitle && <p className="text-[11px] text-[var(--theme-muted)]">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]">
        <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-[var(--theme-muted)]" />
      </button>
    </div>
  )
}

// Skeleton loading shaped like a table
function TableSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-9 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="h-11 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
      ))}
    </div>
  )
}

// Empty state with gradient icon circle
function EmptyState({ icon, title, subtitle }: { icon: typeof Calculator01Icon; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
          color: 'var(--theme-accent)',
        }}
      >
        <HugeiconsIcon icon={icon} size={22} />
      </span>
      <p className="text-[13px] font-semibold text-[var(--theme-text)]">{title}</p>
      <p className="text-[11px] text-[var(--theme-muted)]">{subtitle}</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const abs = Math.abs(cents / 100)
  const formatted = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}

function dollarsToCents(val: string): number {
  return Math.round(parseFloat(val || '0') * 100)
}

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts)
  const data = await res.json() as T & { error?: string }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText)
  return data
}

// ── Account Modal ─────────────────────────────────────────────────────────────

interface AccountModalProps {
  account?: AccountRecord | null
  onClose: () => void
  onSaved: () => void
  brand: string
}

function AccountModal({ account, onClose, onSaved, brand }: AccountModalProps) {
  const isEdit = !!account
  const [code, setCode] = useState(account?.code ?? '')
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'asset')
  const [subtype, setSubtype] = useState<AccountSubtype>(account?.subtype ?? 'checking')
  const [description, setDescription] = useState(account?.description ?? '')
  const [isActive, setIsActive] = useState(account?.is_active ?? true)
  const [saving, setSaving] = useState(false)

  // Reset subtype when type changes
  useEffect(() => {
    if (!account) {
      setSubtype(TYPE_SUBTYPES[type][0])
    }
  }, [type, account])

  const handleSave = async () => {
    if (!code.trim()) { toast('Account code required', { type: 'error' }); return }
    if (!name.trim()) { toast('Account name required', { type: 'error' }); return }
    setSaving(true)
    try {
      if (isEdit) {
        await apiFetch(`/api/accounts/${account!.id}?brand=${brand}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name, type, subtype, description, is_active: isActive }),
        })
        toast('Account updated')
      } else {
        await apiFetch(`/api/accounts?brand=${brand}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name, type, subtype, description, is_active: isActive }),
        })
        toast('Account created')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const isSystemEdit = isEdit && account!.is_system

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <ModalHeader
          icon={Calculator01Icon}
          title={isEdit ? 'Edit Account' : 'New Account'}
          subtitle={isEdit ? `${account!.code} — ${account!.name}` : 'Add an account to your chart'}
          onClose={onClose}
        />
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Code *</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. 1000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Account name"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as AccountType)}
                disabled={isSystemEdit}
                className={cn(inputCls, 'disabled:opacity-50')}
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Subtype *</label>
              <select
                value={subtype}
                onChange={e => setSubtype(e.target.value as AccountSubtype)}
                disabled={isSystemEdit}
                className={cn(inputCls, 'disabled:opacity-50')}
              >
                {TYPE_SUBTYPES[type].map(st => (
                  <option key={st} value={st}>{SUBTYPE_LABELS[st]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              className={inputCls}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <div
              className={cn('relative h-5 w-9 rounded-full transition-colors', isActive ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-border)]')}
              onClick={() => setIsActive(v => !v)}
            >
              <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', isActive ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className="text-[12px] text-[var(--theme-text)]">Active</span>
          </label>
          {isSystemEdit && (
            <p
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium"
              style={{
                background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))',
                color: '#f59e0b',
                border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
              }}
            >
              <HugeiconsIcon icon={LockIcon} size={12} /> System account — type and subtype cannot be changed.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--theme-border)' }}>
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Journal Entry Modal ───────────────────────────────────────────────────────

interface JournalModalProps {
  accounts: AccountRecord[]
  onClose: () => void
  onSaved: () => void
  brand: string
}

interface LineDraft {
  _key: string
  account_id: string
  debit: string
  credit: string
  memo: string
}

function JournalEntryModal({ accounts, onClose, onSaved, brand }: JournalModalProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [source, setSource] = useState<JournalSource>('manual')
  const [lines, setLines] = useState<LineDraft[]>([
    { _key: crypto.randomUUID(), account_id: '', debit: '', credit: '', memo: '' },
    { _key: crypto.randomUUID(), account_id: '', debit: '', credit: '', memo: '' },
  ])
  const [saving, setSaving] = useState(false)

  const totalDebits = lines.reduce((s, l) => s + dollarsToCents(l.debit), 0)
  const totalCredits = lines.reduce((s, l) => s + dollarsToCents(l.credit), 0)
  const balanced = totalDebits > 0 && totalDebits === totalCredits

  const updateLine = (key: string, field: keyof LineDraft, value: string) => {
    setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l))
  }

  const addLine = () => {
    setLines(prev => [...prev, { _key: crypto.randomUUID(), account_id: '', debit: '', credit: '', memo: '' }])
  }

  const removeLine = (key: string) => {
    if (lines.length <= 2) return
    setLines(prev => prev.filter(l => l._key !== key))
  }

  const handleSave = async () => {
    if (!date) { toast('Date required', { type: 'error' }); return }
    if (!description.trim()) { toast('Description required', { type: 'error' }); return }
    if (!balanced) { toast('Debits must equal credits', { type: 'error' }); return }

    const apiLines = lines
      .filter(l => l.account_id)
      .map(l => {
        const acct = accounts.find(a => a.id === l.account_id)!
        return {
          account_id: l.account_id,
          account_code: acct?.code ?? '',
          account_name: acct?.name ?? '',
          debit_cents: dollarsToCents(l.debit),
          credit_cents: dollarsToCents(l.credit),
          memo: l.memo || undefined,
        }
      })

    setSaving(true)
    try {
      await apiFetch(`/api/journal-entries?brand=${brand}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, description, reference: reference || undefined, source, lines: apiLines }),
      })
      toast('Journal entry created')
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const smallInputCls = 'rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <ModalHeader
          icon={BookOpen01Icon}
          title="New Journal Entry"
          subtitle="Debits must equal credits to post"
          onClose={onClose}
        />
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Reference</label>
              <input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="INV-001, etc."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <select
                value={source}
                onChange={e => setSource(e.target.value as JournalSource)}
                className={inputCls}
              >
                <option value="manual">Manual</option>
                <option value="invoice">Invoice</option>
                <option value="payment">Payment</option>
                <option value="bill">Bill</option>
                <option value="expense">Expense</option>
                <option value="payroll">Payroll</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Entry description"
              className={inputCls}
            />
          </div>

          {/* Lines table */}
          <div>
            <div className="mb-2 grid grid-cols-[1fr_120px_120px_1fr_32px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              <span>Account</span><span>Debit ($)</span><span>Credit ($)</span><span>Memo</span><span />
            </div>
            <div className="space-y-1.5">
              {lines.map(line => (
                <div key={line._key} className="grid grid-cols-[1fr_120px_120px_1fr_32px] gap-2 items-center">
                  <select
                    value={line.account_id}
                    onChange={e => updateLine(line._key, 'account_id', e.target.value)}
                    className={smallInputCls}
                  >
                    <option value="">Select account…</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.debit}
                    onChange={e => updateLine(line._key, 'debit', e.target.value)}
                    placeholder="0.00"
                    className={cn(smallInputCls, 'tabular-nums')}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.credit}
                    onChange={e => updateLine(line._key, 'credit', e.target.value)}
                    placeholder="0.00"
                    className={cn(smallInputCls, 'tabular-nums')}
                  />
                  <input
                    value={line.memo}
                    onChange={e => updateLine(line._key, 'memo', e.target.value)}
                    placeholder="Memo"
                    className={smallInputCls}
                  />
                  <button
                    onClick={() => removeLine(line._key)}
                    disabled={lines.length <= 2}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-30"
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={13} className="text-[var(--theme-muted)]" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addLine}
              className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[var(--theme-accent)] hover:underline"
            >
              <HugeiconsIcon icon={Add01Icon} size={12} /> Add line
            </button>
          </div>

          {/* Totals */}
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{
              borderColor: balanced ? 'color-mix(in srgb, #10b981 35%, transparent)' : 'var(--theme-border)',
              background: 'color-mix(in srgb, var(--theme-hover) 60%, var(--theme-card))',
            }}
          >
            <div className="flex gap-6 text-[12px] tabular-nums">
              <span className="text-[var(--theme-muted)]">
                Debits: <span className="font-mono font-semibold text-[var(--theme-text)]">{formatCents(totalDebits)}</span>
              </span>
              <span className="text-[var(--theme-muted)]">
                Credits: <span className="font-mono font-semibold text-[var(--theme-text)]">{formatCents(totalCredits)}</span>
              </span>
            </div>
            {balanced ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: 'color-mix(in srgb, #10b981 14%, var(--theme-card))',
                  color: '#10b981',
                  border: '1px solid color-mix(in srgb, #10b981 35%, transparent)',
                  boxShadow: '0 0 10px color-mix(in srgb, #10b981 30%, transparent)',
                }}
              >
                <HugeiconsIcon icon={Tick02Icon} size={12} /> Balanced ✓
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
                style={{
                  background: 'color-mix(in srgb, #ef4444 12%, var(--theme-card))',
                  color: '#ef4444',
                  border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                }}
              >
                Out of balance by {formatCents(Math.abs(totalDebits - totalCredits))}
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--theme-border)' }}>
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !balanced}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {saving ? 'Saving…' : 'Post Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Trial Balance Modal ───────────────────────────────────────────────────────

function TrialBalanceModal({ brand, onClose }: { brand: string; onClose: () => void }) {
  const { data: groups = [] } = useQuery<TrialBalanceGroup[]>({
    queryKey: ['trial-balance', brand],
    queryFn: () => apiFetch<TrialBalanceGroup[]>(`/api/accounts/trial-balance?brand=${brand}`),
  })

  const grandTotal = groups.reduce((s, g) => s + g.subtotal_cents, 0)

  const TYPE_LABELS: Record<AccountType, string> = {
    asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <ModalHeader
          icon={JusticeScale01Icon}
          title="Trial Balance"
          subtitle="Balances grouped by account type"
          onClose={onClose}
        />
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {groups.filter(g => g.accounts.length > 0).map(g => {
            const c = TYPE_COLORS[g.type]
            return (
              <div key={g.type}>
                <div className="mb-1.5 flex items-center justify-between">
                  <TypeBadge type={g.type} label={TYPE_LABELS[g.type]} />
                  <span className="text-[12px] font-bold tabular-nums text-[var(--theme-text)]">{formatCents(g.subtotal_cents)}</span>
                </div>
                <div
                  className="overflow-hidden rounded-xl border"
                  style={{ borderColor: `color-mix(in srgb, ${c} 25%, var(--theme-border))` }}
                >
                  {g.accounts.map(a => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between border-b border-[var(--theme-border)] px-3 py-2 text-[12px] transition-colors last:border-0 hover:bg-[var(--theme-hover)]"
                    >
                      <span className="flex items-center gap-2 text-[var(--theme-muted)]">
                        <span className="font-mono text-[11px]">{a.code}</span>
                        <span className="text-[var(--theme-text)]">{a.name}</span>
                      </span>
                      <span className={cn('font-mono font-medium tabular-nums', a.balance_cents < 0 ? 'text-red-500' : 'text-[var(--theme-text)]')}>
                        {formatCents(a.balance_cents)}
                      </span>
                    </div>
                  ))}
                  <div
                    className="flex items-center justify-between px-3 py-2 text-[11px] font-bold"
                    style={{ background: `color-mix(in srgb, ${c} 8%, var(--theme-card))`, color: c }}
                  >
                    <span className="uppercase tracking-wider">Subtotal</span>
                    <span className="font-mono tabular-nums">{formatCents(g.subtotal_cents)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div
          className="flex items-center justify-between rounded-b-2xl border-t px-5 py-4"
          style={{
            borderColor: 'var(--theme-border)',
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card)), color-mix(in srgb, #000 10%, var(--theme-card)))',
          }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--theme-text)]">Grand Total</span>
          <span
            className="text-[18px] font-bold tabular-nums"
            style={{ color: grandTotal < 0 ? '#ef4444' : '#10b981' }}
          >
            {formatCents(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type TabFilter = 'all' | AccountType
type MainTab = 'accounts' | 'journal'

export function AccountsScreen() {
  const brand = useBrand()
  const qc = useQueryClient()

  const [mainTab, setMainTab] = useState<MainTab>('accounts')
  const [typeFilter, setTypeFilter] = useState<TabFilter>('all')
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null)
  const [showJournalModal, setShowJournalModal] = useState(false)
  const [showTrialBalance, setShowTrialBalance] = useState(false)

  // Journal filters
  const [jeFrom, setJeFrom] = useState('')
  const [jeTo, setJeTo] = useState('')
  const [jeSource, setJeSource] = useState<JournalSource | ''>('')

  const invalidateAccounts = () => void qc.invalidateQueries({ queryKey: ['accounts', brand.id] })
  const invalidateJournal = () => void qc.invalidateQueries({ queryKey: ['journal', brand.id] })

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<AccountRecord[]>({
    queryKey: ['accounts', brand.id],
    queryFn: () => apiFetch<AccountRecord[]>(`/api/accounts?brand=${brand.id}`),
  })

  const { data: journalEntries = [], isLoading: jeLoading } = useQuery<JournalEntry[]>({
    queryKey: ['journal', brand.id, jeFrom, jeTo, jeSource],
    queryFn: () => {
      const params = new URLSearchParams({ brand: brand.id })
      if (jeFrom) params.set('from', jeFrom)
      if (jeTo) params.set('to', jeTo)
      if (jeSource) params.set('source', jeSource)
      return apiFetch<JournalEntry[]>(`/api/journal-entries?${params}`)
    },
    enabled: mainTab === 'journal',
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounts/${id}?brand=${brand.id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateAccounts(); toast('Account deleted') },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to delete', { type: 'error' }),
  })

  const filteredAccounts = useMemo(() => {
    if (typeFilter === 'all') return accounts
    return accounts.filter(a => a.type === typeFilter)
  }, [accounts, typeFilter])

  const TYPE_LABELS: Record<AccountType, string> = {
    asset: 'Asset', liability: 'Liability', equity: 'Equity', income: 'Income', expense: 'Expense',
  }

  const filterTabs: { label: string; value: TabFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Assets', value: 'asset' },
    { label: 'Liabilities', value: 'liability' },
    { label: 'Equity', value: 'equity' },
    { label: 'Income', value: 'income' },
    { label: 'Expenses', value: 'expense' },
  ]

  const tabCount = (value: TabFilter) =>
    value === 'all' ? accounts.length : accounts.filter(a => a.type === value).length

  // balances colored by sign
  const balanceColor = (acct: AccountRecord) => {
    if (acct.balance_cents === 0) return 'text-[var(--theme-muted)]'
    if (acct.balance_cents < 0) return 'text-red-500'
    return 'text-[#10b981]'
  }

  const inputBarCls = 'rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-[12px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Calculator01Icon} size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[var(--theme-text)]">Chart of Accounts</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">{accounts.length} accounts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Main tab toggle — segmented control */}
          <div className="flex gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
            <button
              onClick={() => setMainTab('accounts')}
              className={cn('rounded-md px-3 py-1 text-[12px] font-semibold transition-all', mainTab === 'accounts' ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
              style={mainTab === 'accounts' ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' } : undefined}
            >
              Accounts
            </button>
            <button
              onClick={() => setMainTab('journal')}
              className={cn('rounded-md px-3 py-1 text-[12px] font-semibold transition-all', mainTab === 'journal' ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
              style={mainTab === 'journal' ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' } : undefined}
            >
              Journal Entries
            </button>
          </div>
          <button
            onClick={() => setShowTrialBalance(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] px-3 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]"
          >
            <HugeiconsIcon icon={JusticeScale01Icon} size={13} /> Trial Balance
          </button>
          {mainTab === 'accounts' ? (
            <button
              onClick={() => { setEditingAccount(null); setShowAccountModal(true) }}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              <HugeiconsIcon icon={Add01Icon} size={13} /> New Account
            </button>
          ) : (
            <button
              onClick={() => setShowJournalModal(true)}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              <HugeiconsIcon icon={Add01Icon} size={13} /> New Journal Entry
            </button>
          )}
        </div>
      </div>

      {mainTab === 'accounts' && (
        <>
          {/* Type filter — segmented control */}
          <div className="flex items-center border-b px-6 py-2.5" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}>
            <div className="flex gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
              {filterTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setTypeFilter(tab.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold transition-all',
                    typeFilter === tab.value ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  style={typeFilter === tab.value ? {
                    background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                    color: 'var(--theme-accent)',
                  } : undefined}
                >
                  {tab.label}
                  <span className="tabular-nums text-[10px] text-[var(--theme-muted)]">{tabCount(tab.value)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Accounts table */}
          <div className="flex-1 overflow-y-auto p-6">
            {accountsLoading ? (
              <TableSkeleton />
            ) : filteredAccounts.length === 0 ? (
              <EmptyState icon={Calculator01Icon} title="No accounts found" subtitle="Try a different type filter or add a new account." />
            ) : (
              <div className="overflow-hidden rounded-xl border bg-[var(--theme-card)]" style={{ borderColor: 'var(--theme-border)' }}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: 'var(--theme-hover)' }}>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Code</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Name</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Type</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Subtype</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Balance</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Status</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map(acct => (
                      <tr
                        key={acct.id}
                        className="group border-t transition-colors hover:bg-[var(--theme-hover)]"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <td className="px-4 py-2.5"><CodeChip code={acct.code} /></td>
                        <td className="px-4 py-2.5 font-medium text-[var(--theme-text)]">
                          {acct.name}
                          {acct.description && (
                            <span className="ml-1 text-[10px] font-normal text-[var(--theme-muted)]">— {acct.description}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <TypeBadge type={acct.type} label={TYPE_LABELS[acct.type]} />
                        </td>
                        <td className="px-4 py-2.5 text-[var(--theme-muted)]">{SUBTYPE_LABELS[acct.subtype]}</td>
                        <td className={cn('px-4 py-2.5 text-right font-mono font-semibold tabular-nums', balanceColor(acct))}>
                          {formatCents(acct.balance_cents)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {acct.is_system && <SystemChip />}
                            {!acct.is_active && (
                              <span
                                className="inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                                style={{
                                  background: 'color-mix(in srgb, #ef4444 12%, var(--theme-card))',
                                  color: '#ef4444',
                                  border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                                }}
                              >
                                Inactive
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              onClick={() => { setEditingAccount(acct); setShowAccountModal(true) }}
                              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-accent-soft)]"
                              title="Edit"
                            >
                              <HugeiconsIcon icon={PencilEdit02Icon} size={13} className="text-[var(--theme-accent)]" />
                            </button>
                            <button
                              onClick={() => {
                                if (acct.is_system) { toast('System accounts cannot be deleted', { type: 'error' }); return }
                                if (confirm(`Delete "${acct.name}"?`)) deleteMutation.mutate(acct.id)
                              }}
                              disabled={acct.is_system}
                              className="rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                              title={acct.is_system ? 'System account — cannot delete' : 'Delete'}
                              onMouseEnter={e => { if (!acct.is_system) e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                              <HugeiconsIcon icon={Delete01Icon} size={13} className="text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {mainTab === 'journal' && (
        <>
          {/* Journal filters */}
          <div className="flex items-center gap-3 border-b px-6 py-3" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}>
            <input
              type="date"
              value={jeFrom}
              onChange={e => setJeFrom(e.target.value)}
              className={inputBarCls}
            />
            <span className="text-[11px] text-[var(--theme-muted)]">to</span>
            <input
              type="date"
              value={jeTo}
              onChange={e => setJeTo(e.target.value)}
              className={inputBarCls}
            />
            <select
              value={jeSource}
              onChange={e => setJeSource(e.target.value as JournalSource | '')}
              className={inputBarCls}
            >
              <option value="">All sources</option>
              <option value="manual">Manual</option>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="bill">Bill</option>
              <option value="expense">Expense</option>
              <option value="payroll">Payroll</option>
            </select>
          </div>

          {/* Journal table */}
          <div className="flex-1 overflow-y-auto p-6">
            {jeLoading ? (
              <TableSkeleton />
            ) : journalEntries.length === 0 ? (
              <EmptyState icon={BookOpen01Icon} title="No journal entries found" subtitle="Adjust the filters or post a new entry." />
            ) : (
              <div className="overflow-hidden rounded-xl border bg-[var(--theme-card)]" style={{ borderColor: 'var(--theme-border)' }}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: 'var(--theme-hover)' }}>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Date</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Description</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Reference</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Source</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Lines</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntries.map(je => {
                      const totalAmt = je.lines.reduce((s, l) => s + l.debit_cents, 0)
                      const drAccts = je.lines.filter(l => l.debit_cents > 0).map(l => l.account_code).join(', ')
                      const crAccts = je.lines.filter(l => l.credit_cents > 0).map(l => l.account_code).join(', ')
                      return (
                        <tr
                          key={je.id}
                          className="border-t transition-colors hover:bg-[var(--theme-hover)]"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          <td className="px-4 py-2.5 font-mono text-[11px] tabular-nums text-[var(--theme-muted)]">{je.date}</td>
                          <td className="px-4 py-2.5 font-medium text-[var(--theme-text)]">{je.description}</td>
                          <td className="px-4 py-2.5 text-[var(--theme-muted)]">{je.reference ?? '—'}</td>
                          <td className="px-4 py-2.5"><SourceBadge source={je.source} /></td>
                          <td className="px-4 py-2.5 font-mono text-[10px]">
                            <span style={{ color: '#10b981' }}>DR {drAccts}</span>
                            <span className="mx-1 text-[var(--theme-muted)]">/</span>
                            <span style={{ color: '#ef4444' }}>CR {crAccts}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-[var(--theme-text)]">
                            {formatCents(totalAmt)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showAccountModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => { setShowAccountModal(false); setEditingAccount(null) }}
          onSaved={invalidateAccounts}
          brand={brand.id}
        />
      )}
      {showJournalModal && (
        <JournalEntryModal
          accounts={accounts}
          onClose={() => setShowJournalModal(false)}
          onSaved={() => { invalidateAccounts(); invalidateJournal() }}
          brand={brand.id}
        />
      )}
      {showTrialBalance && (
        <TrialBalanceModal brand={brand.id} onClose={() => setShowTrialBalance(false)} />
      )}
    </div>
  )
}
