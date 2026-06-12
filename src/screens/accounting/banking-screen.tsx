import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  BankIcon,
  Delete01Icon,
  Download04Icon,
  PencilEdit02Icon,
  Tick02Icon,
  Upload01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Wallet01Icon,
  PiggyBankIcon,
  CreditCardIcon,
  Cash01Icon,
  ChartLineData01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type AccountCategory = 'checking' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'investment'
type TransactionType = 'debit' | 'credit'

interface BankAccount {
  id: string
  brand: string
  name: string
  institution?: string
  account_number_last4?: string
  category: AccountCategory
  currency: string
  opening_balance_cents: number
  current_balance_cents: number
  is_active: boolean
  color?: string
  created_at: string
  updated_at: string
}

interface BankTransaction {
  id: string
  brand: string
  account_id: string
  date: string
  description: string
  payee?: string
  amount_cents: number
  type: TransactionType
  category?: string
  category_name?: string
  reference?: string
  memo?: string
  is_reconciled: boolean
  reconciled_at?: string
  reconciliation_id?: string
  source: 'manual' | 'import'
  linked_invoice_id?: string
  created_at: string
  updated_at: string
}

interface StatementRow extends BankTransaction {
  running_balance_cents: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  const abs = Math.abs(cents) / 100
  return (cents < 0 ? '-' : '') + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CATEGORY_LABELS: Record<AccountCategory, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  cash: 'Cash',
  loan: 'Loan',
  investment: 'Investment',
}

const CATEGORY_COLORS: Record<AccountCategory, string> = {
  checking: '#3b82f6',
  savings: '#10b981',
  credit_card: '#8b5cf6',
  cash: '#f59e0b',
  loan: '#f97316',
  investment: '#0ea5e9',
}

const CATEGORY_ICONS: Record<AccountCategory, typeof BankIcon> = {
  checking: Wallet01Icon,
  savings: PiggyBankIcon,
  credit_card: CreditCardIcon,
  cash: Cash01Icon,
  loan: BankIcon,
  investment: ChartLineData01Icon,
}

// ── Shared design tokens ──────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }
const ghostBtnCls = 'flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] px-3 py-2 text-[12px] font-medium text-[var(--theme-text)] transition-all duration-150 hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)]'

const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--theme-muted)]'
const thCls = 'px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]'

// Gradient icon chip per account category
function CategoryChip({ category, size = 'md' }: { category: AccountCategory; size?: 'sm' | 'md' }) {
  const c = CATEGORY_COLORS[category]
  const dim = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center', dim)}
      style={{
        background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 65%, #000))`,
        boxShadow: `0 2px 8px color-mix(in srgb, ${c} 38%, transparent)`,
      }}
    >
      <HugeiconsIcon icon={CATEGORY_ICONS[category]} size={size === 'sm' ? 14 : 16} className="text-white" />
    </span>
  )
}

// Dot + tint category badge
function CategoryBadge({ category }: { category: AccountCategory }) {
  const c = CATEGORY_COLORS[category]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`,
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {CATEGORY_LABELS[category]}
    </span>
  )
}

// Modal header with gradient icon chip
function ModalHeader({ icon, title, subtitle, onClose, badge }: {
  icon: typeof BankIcon
  title: string
  subtitle?: string
  onClose: () => void
  badge?: React.ReactNode
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
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="text-[11px] text-[var(--theme-muted)]">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]">
        <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-[var(--theme-muted)]" />
      </button>
    </div>
  )
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): Array<{ date: string; description: string; amount_cents: number; type: 'debit' | 'credit' }> {
  const lines = text.trim().split('\n')
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cols[i] ?? '' })
    const amount = parseFloat(row['amount'] ?? row['debit'] ?? row['credit'] ?? '0') || 0
    const isDebit = row['type']?.toLowerCase() === 'debit' || parseFloat(row['debit'] ?? '0') > 0
    return {
      date: row['date'] ?? new Date().toISOString().slice(0, 10),
      description: row['description'] ?? row['memo'] ?? row['payee'] ?? '',
      amount_cents: Math.round(Math.abs(amount) * 100),
      type: isDebit ? 'debit' as const : 'credit' as const,
    }
  }).filter(r => r.amount_cents > 0)
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Add Account Modal ─────────────────────────────────────────────────────────

interface AddAccountModalProps {
  onClose: () => void
  onSave: (data: Partial<BankAccount>) => void
  isLoading: boolean
  initial?: BankAccount | null
}

function AddAccountModal({ onClose, onSave, isLoading, initial }: AddAccountModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [institution, setInstitution] = useState(initial?.institution ?? '')
  const [last4, setLast4] = useState(initial?.account_number_last4 ?? '')
  const [category, setCategory] = useState<AccountCategory>(initial?.category ?? 'checking')
  const [openingBalance, setOpeningBalance] = useState(initial ? (initial.opening_balance_cents / 100).toFixed(2) : '0.00')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast('Account name is required', { type: 'error' }); return }
    onSave({
      name: name.trim(),
      institution: institution.trim() || undefined,
      account_number_last4: last4.trim() || undefined,
      category,
      currency: 'USD',
      opening_balance_cents: Math.round(parseFloat(openingBalance) * 100) || 0,
      is_active: true,
      color: CATEGORY_COLORS[category],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={BankIcon}
          title={initial ? 'Edit Account' : 'Add Bank Account'}
          subtitle={initial ? initial.name : 'Track balances, register, and reconciliation'}
          onClose={onClose}
        />
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div>
            <label className={labelCls}>Account Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Business Checking"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Institution</label>
              <input
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="e.g. Chase"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Last 4 digits</label>
              <input
                value={last4}
                onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as AccountCategory)}
              className={inputCls}
            >
              {(Object.keys(CATEGORY_LABELS) as AccountCategory[]).map(k => (
                <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Opening Balance (USD)</label>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              {isLoading ? 'Saving…' : initial ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Transaction Modal ─────────────────────────────────────────────────────

interface AddTransactionModalProps {
  accountId: string
  onClose: () => void
  onSave: (data: Partial<BankTransaction>) => void
  isLoading: boolean
  initial?: BankTransaction | null
}

function AddTransactionModal({ accountId, onClose, onSave, isLoading, initial }: AddTransactionModalProps) {
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState(initial?.description ?? '')
  const [payee, setPayee] = useState(initial?.payee ?? '')
  const [amount, setAmount] = useState(initial ? (initial.amount_cents / 100).toFixed(2) : '')
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'debit')
  const [category, setCategory] = useState(initial?.category_name ?? '')
  const [reference, setReference] = useState(initial?.reference ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) { toast('Description is required', { type: 'error' }); return }
    const amtCents = Math.round(parseFloat(amount) * 100)
    if (!amtCents || amtCents <= 0) { toast('Amount must be positive', { type: 'error' }); return }
    onSave({
      account_id: accountId,
      date,
      description: description.trim(),
      payee: payee.trim() || undefined,
      amount_cents: amtCents,
      type,
      category_name: category.trim() || undefined,
      reference: reference.trim() || undefined,
      memo: memo.trim() || undefined,
      is_reconciled: false,
      source: 'manual',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={Cash01Icon}
          title={initial ? 'Edit Transaction' : 'Add Transaction'}
          subtitle={initial ? initial.description : 'Record a debit or credit on this account'}
          onClose={onClose}
        />
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
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
              <label className={labelCls}>Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TransactionType)}
                className={inputCls}
              >
                <option value="debit">Debit (money out)</option>
                <option value="credit">Credit (money in)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Transaction description"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payee</label>
              <input
                value={payee}
                onChange={e => setPayee(e.target.value)}
                placeholder="Payee name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Amount (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Office Supplies"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Reference / Check #</label>
              <input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Check number, wire ref…"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Memo</label>
            <input
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="Optional note"
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              {isLoading ? 'Saving…' : initial ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Import CSV Modal ──────────────────────────────────────────────────────────

interface ImportCSVModalProps {
  accountId: string
  onClose: () => void
  onImported: () => void
  brandId: string
}

function ImportCSVModal({ accountId, onClose, onImported, brandId }: ImportCSVModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Array<{ date: string; description: string; amount_cents: number; type: 'debit' | 'credit' }>>([])
  const [isImporting, setIsImporting] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setIsImporting(true)
    try {
      const result = await apiFetch<{ imported: number; skipped: number }>(
        `/api/banking/transactions/import?brand=${brandId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: accountId, transactions: rows }),
        }
      )
      toast(`Imported ${result.imported} transactions${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}`)
      onImported()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', { type: 'error' })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={Upload01Icon}
          title="Import CSV"
          subtitle="Bring in transactions from a bank export"
          onClose={onClose}
        />
        <div className="px-5 py-4">
          <p className="mb-4 text-[12px] text-[var(--theme-muted)]">
            CSV must have columns: <code className="rounded bg-[var(--theme-hover)] px-1">date</code>, <code className="rounded bg-[var(--theme-hover)] px-1">description</code>, <code className="rounded bg-[var(--theme-hover)] px-1">amount</code> (or <code className="rounded bg-[var(--theme-hover)] px-1">debit</code>/<code className="rounded bg-[var(--theme-hover)] px-1">credit</code>), <code className="rounded bg-[var(--theme-hover)] px-1">type</code> (optional)
          </p>
          <div
            onClick={() => fileRef.current?.click()}
            className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--theme-border)] p-8 transition-colors duration-150 hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)]"
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                color: 'var(--theme-accent)',
              }}
            >
              <HugeiconsIcon icon={Upload01Icon} size={22} />
            </span>
            <p className="text-[13px] font-medium text-[var(--theme-text)]">Click to select a .csv file</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>

          {rows.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{rows.length} transactions parsed — preview</p>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--theme-border)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: 'var(--theme-hover)' }}>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Date</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Description</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Type</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-[var(--theme-border)] transition-colors hover:bg-[var(--theme-hover)]">
                        <td className="px-3 py-1.5 tabular-nums text-[var(--theme-muted)]">{r.date}</td>
                        <td className="max-w-[200px] truncate px-3 py-1.5 text-[var(--theme-text)]">{r.description}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: `color-mix(in srgb, ${r.type === 'credit' ? '#10b981' : '#ef4444'} 12%, var(--theme-card))`,
                              color: r.type === 'credit' ? '#10b981' : '#ef4444',
                            }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.type === 'credit' ? '#10b981' : '#ef4444' }} />
                            {r.type === 'credit' ? 'Credit' : 'Debit'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums text-[var(--theme-text)]">{formatCents(r.amount_cents)}</td>
                      </tr>
                    ))}
                    {rows.length > 20 && (
                      <tr><td colSpan={4} className="px-3 py-2 text-center text-[var(--theme-muted)]">…and {rows.length - 20} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={rows.length === 0 || isImporting}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              {isImporting ? 'Importing…' : `Import ${rows.length} transactions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reconcile Modal ───────────────────────────────────────────────────────────

interface ReconcileModalProps {
  account: BankAccount
  transactions: BankTransaction[]
  onClose: () => void
  onReconciled: () => void
  brandId: string
}

function ReconcileModal({ account, transactions, onClose, onReconciled, brandId }: ReconcileModalProps) {
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10))
  const [statementBalance, setStatementBalance] = useState('')
  const [cleared, setCleared] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const unreconciled = transactions.filter(t => !t.is_reconciled)

  const toggleCleared = (id: string) => {
    setCleared(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const clearedTxns = unreconciled.filter(t => cleared.has(t.id))
  const clearedCredits = clearedTxns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount_cents, 0)
  const clearedDebits = clearedTxns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount_cents, 0)
  const clearedBalance = account.opening_balance_cents + clearedCredits - clearedDebits
  const statementBalanceCents = Math.round(parseFloat(statementBalance || '0') * 100)
  const difference = clearedBalance - statementBalanceCents
  const balanced = statementBalance !== '' && difference === 0

  const handleComplete = async () => {
    if (!statementBalance) { toast('Statement balance is required', { type: 'error' }); return }
    setIsSaving(true)
    try {
      await apiFetch(`/api/banking/reconcile?brand=${brandId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: account.id,
          statement_date: statementDate,
          statement_balance_cents: statementBalanceCents,
          cleared_transaction_ids: Array.from(cleared),
        }),
      })
      toast(balanced ? 'Reconciliation completed!' : 'Reconciliation saved (difference noted)')
      onReconciled()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Reconciliation failed', { type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={CheckmarkCircle01Icon}
          title={`Reconcile: ${account.name}`}
          subtitle="Match cleared transactions against your statement"
          onClose={onClose}
          badge={<CategoryBadge category={account.category} />}
        />

        <div className="flex gap-4 border-b border-[var(--theme-border)] px-5 py-4">
          <div>
            <label className={labelCls}>Statement Date</label>
            <input
              type="date"
              value={statementDate}
              onChange={e => setStatementDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Statement Ending Balance</label>
            <input
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={e => setStatementBalance(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {unreconciled.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, #10b981 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card)))',
                  color: '#10b981',
                }}
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={22} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--theme-text)]">All transactions are reconciled</p>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0" style={{ background: 'var(--theme-card)' }}>
                <tr className="border-b border-[var(--theme-border)]" style={{ background: 'var(--theme-hover)' }}>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Date</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Description</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {unreconciled.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => toggleCleared(t.id)}
                    className={cn('cursor-pointer border-b border-[var(--theme-border)] transition-colors duration-150', cleared.has(t.id) ? 'bg-green-500/5' : 'hover:bg-[var(--theme-hover)]')}
                  >
                    <td className="px-3 py-2">
                      <div
                        className="flex h-4 w-4 items-center justify-center rounded border-2 transition-colors"
                        style={cleared.has(t.id)
                          ? { borderColor: '#10b981', background: '#10b981' }
                          : { borderColor: 'var(--theme-border)' }}
                      >
                        {cleared.has(t.id) && <HugeiconsIcon icon={Tick02Icon} size={10} className="text-white" />}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--theme-muted)]">{t.date}</td>
                    <td className="px-3 py-2 text-[var(--theme-text)]">{t.payee ?? t.description}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: t.type === 'credit' ? '#10b981' : '#ef4444' }}>
                      {t.type === 'credit' ? '+' : '-'}{formatCents(t.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-[var(--theme-border)] px-5 py-4">
          <div className="mb-3 grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-[var(--theme-border)] px-3 py-2 text-center" style={{ background: 'color-mix(in srgb, var(--theme-hover) 40%, var(--theme-card))' }}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Cleared Credits</p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums" style={{ color: '#10b981' }}>{formatCents(clearedCredits)}</p>
            </div>
            <div className="rounded-xl border border-[var(--theme-border)] px-3 py-2 text-center" style={{ background: 'color-mix(in srgb, var(--theme-hover) 40%, var(--theme-card))' }}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Cleared Debits</p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums" style={{ color: '#ef4444' }}>{formatCents(clearedDebits)}</p>
            </div>
            <div className="rounded-xl border border-[var(--theme-border)] px-3 py-2 text-center" style={{ background: 'color-mix(in srgb, var(--theme-hover) 40%, var(--theme-card))' }}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Cleared Balance</p>
              <p className="mt-0.5 text-[13px] font-bold tabular-nums text-[var(--theme-text)]">{formatCents(clearedBalance)}</p>
            </div>
            <div
              className="rounded-xl border px-3 py-2 text-center transition-all duration-150"
              style={{
                borderColor: statementBalance
                  ? `color-mix(in srgb, ${balanced ? '#10b981' : '#ef4444'} 45%, transparent)`
                  : 'var(--theme-border)',
                background: statementBalance
                  ? `color-mix(in srgb, ${balanced ? '#10b981' : '#ef4444'} 10%, var(--theme-card))`
                  : 'color-mix(in srgb, var(--theme-hover) 40%, var(--theme-card))',
                boxShadow: balanced ? '0 0 14px color-mix(in srgb, #10b981 45%, transparent)' : undefined,
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Difference</p>
              <p
                className="mt-0.5 text-[16px] font-bold leading-none tabular-nums"
                style={{ color: statementBalance ? (balanced ? '#10b981' : '#ef4444') : 'var(--theme-muted)' }}
              >
                {statementBalance ? formatCents(difference) : '—'}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={isSaving || cleared.size === 0}
              className={primaryBtnCls}
              style={balanced
                ? { background: 'linear-gradient(135deg, #10b981, color-mix(in srgb, #10b981 65%, #000))', boxShadow: '0 2px 8px color-mix(in srgb, #10b981 38%, transparent)' }
                : primaryBtnStyle}
            >
              {isSaving ? 'Saving…' : balanced ? 'Complete Reconciliation' : 'Save (Unbalanced)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Banking Screen ───────────────────────────────────────────────────────

export function BankingScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const brandId = brand.id

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null)
  const [showAddTxn, setShowAddTxn] = useState(false)
  const [editTxn, setEditTxn] = useState<BankTransaction | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showReconcile, setShowReconcile] = useState(false)

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['banking', 'accounts', brandId],
    queryFn: () => apiFetch(`/api/banking/accounts?brand=${brandId}`),
  })

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) ?? null

  const { data: transactions = [] } = useQuery<BankTransaction[]>({
    queryKey: ['banking', 'transactions', brandId, selectedAccountId],
    queryFn: () => apiFetch(`/api/banking/transactions?brand=${brandId}&account_id=${selectedAccountId}`),
    enabled: !!selectedAccountId,
  })

  // Statement view with running balance
  const { data: statement = [] } = useQuery<StatementRow[]>({
    queryKey: ['banking', 'statement', brandId, selectedAccountId],
    queryFn: () => {
      const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
      const to = new Date().toISOString().slice(0, 10)
      return apiFetch(`/api/banking/statement?brand=${brandId}&account_id=${selectedAccountId}&from=${from}&to=${to}`)
    },
    enabled: !!selectedAccountId,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['banking', 'accounts', brandId] })
    void qc.invalidateQueries({ queryKey: ['banking', 'transactions', brandId, selectedAccountId] })
    void qc.invalidateQueries({ queryKey: ['banking', 'statement', brandId, selectedAccountId] })
  }

  const createAccountMut = useMutation({
    mutationFn: (data: Partial<BankAccount>) =>
      apiFetch<BankAccount>(`/api/banking/accounts?brand=${brandId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (acc) => {
      toast('Account created')
      setShowAddAccount(false)
      setSelectedAccountId(acc.id)
      invalidateAll()
    },
    onError: (err: Error) => toast(err.message, { type: 'error' }),
  })

  const updateAccountMut = useMutation({
    mutationFn: (data: Partial<BankAccount>) =>
      apiFetch<BankAccount>(`/api/banking/accounts/${editAccount!.id}?brand=${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast('Account updated')
      setEditAccount(null)
      invalidateAll()
    },
    onError: (err: Error) => toast(err.message, { type: 'error' }),
  })

  const deleteAccountMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/banking/accounts/${id}?brand=${brandId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Account deleted')
      setSelectedAccountId(null)
      invalidateAll()
    },
    onError: (err: Error) => toast(err.message, { type: 'error' }),
  })

  const createTxnMut = useMutation({
    mutationFn: (data: Partial<BankTransaction>) =>
      apiFetch<BankTransaction>(`/api/banking/transactions?brand=${brandId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast('Transaction added')
      setShowAddTxn(false)
      invalidateAll()
    },
    onError: (err: Error) => toast(err.message, { type: 'error' }),
  })

  const updateTxnMut = useMutation({
    mutationFn: (data: Partial<BankTransaction>) =>
      apiFetch<BankTransaction>(`/api/banking/transactions/${editTxn!.id}?brand=${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast('Transaction updated')
      setEditTxn(null)
      invalidateAll()
    },
    onError: (err: Error) => toast(err.message, { type: 'error' }),
  })

  const deleteTxnMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/banking/transactions/${id}?brand=${brandId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Transaction deleted')
      invalidateAll()
    },
    onError: (err: Error) => toast(err.message, { type: 'error' }),
  })

  // Summary stats for selected account
  const totalCredits = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount_cents, 0)
  const totalDebits = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount_cents, 0)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Modals */}
      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onSave={data => createAccountMut.mutate(data)}
          isLoading={createAccountMut.isPending}
        />
      )}
      {editAccount && (
        <AddAccountModal
          initial={editAccount}
          onClose={() => setEditAccount(null)}
          onSave={data => updateAccountMut.mutate(data)}
          isLoading={updateAccountMut.isPending}
        />
      )}
      {showAddTxn && selectedAccountId && (
        <AddTransactionModal
          accountId={selectedAccountId}
          onClose={() => setShowAddTxn(false)}
          onSave={data => createTxnMut.mutate(data)}
          isLoading={createTxnMut.isPending}
        />
      )}
      {editTxn && (
        <AddTransactionModal
          accountId={editTxn.account_id}
          initial={editTxn}
          onClose={() => setEditTxn(null)}
          onSave={data => updateTxnMut.mutate(data)}
          isLoading={updateTxnMut.isPending}
        />
      )}
      {showImport && selectedAccountId && (
        <ImportCSVModal
          accountId={selectedAccountId}
          brandId={brandId}
          onClose={() => setShowImport(false)}
          onImported={invalidateAll}
        />
      )}
      {showReconcile && selectedAccount && (
        <ReconcileModal
          account={selectedAccount}
          transactions={transactions}
          brandId={brandId}
          onClose={() => setShowReconcile(false)}
          onReconciled={invalidateAll}
        />
      )}

      {/* ── Left Sidebar: Account list ──────────────────────────────────────── */}
      <aside
        className="flex w-[260px] shrink-0 flex-col border-r"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}
      >
        <div className="px-4 pb-3 pt-5">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={BankIcon} size={16} className="text-white" />
            </span>
            <div>
              <h1 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">Banking</h1>
              <p className="text-[11px] text-[var(--theme-muted)]">Register &amp; reconciliation</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={BankIcon} size={22} />
              </span>
              <p className="text-[12px] font-semibold text-[var(--theme-text)]">No accounts yet</p>
              <p className="text-[11px] text-[var(--theme-muted)]">Add your first account below.</p>
            </div>
          ) : (
            accounts.map(account => {
              const active = selectedAccountId === account.id
              const c = CATEGORY_COLORS[account.category]
              return (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={cn(
                    'mb-2 w-full rounded-xl border p-3 text-left transition-all duration-150',
                    active ? '' : 'border-transparent hover:-translate-y-px hover:border-[var(--theme-border)] hover:bg-[var(--theme-hover)]',
                  )}
                  style={active
                    ? {
                        borderColor: 'var(--theme-accent)',
                        background: 'color-mix(in srgb, var(--theme-accent) 8%, var(--theme-card))',
                        boxShadow: '0 0 0 1px var(--theme-accent), 0 2px 10px color-mix(in srgb, var(--theme-accent) 22%, transparent)',
                      }
                    : { background: 'var(--theme-card)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <CategoryChip category={account.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[var(--theme-text)]">{account.name}</p>
                      <p className="truncate text-[10px] text-[var(--theme-muted)]">
                        {account.institution
                          ? `${account.institution}${account.account_number_last4 ? ` ···${account.account_number_last4}` : ''}`
                          : CATEGORY_LABELS[account.category]}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p
                      className="text-[17px] font-bold leading-none tabular-nums"
                      style={{ color: account.current_balance_cents < 0 ? '#ef4444' : 'var(--theme-text)' }}
                    >
                      {formatCents(account.current_balance_cents)}
                    </p>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                      style={{ background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`, color: c }}
                    >
                      {CATEGORY_LABELS[account.category]}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="border-t px-3 py-3" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={() => setShowAddAccount(true)}
            className={cn(primaryBtnCls, 'w-full justify-center')}
            style={primaryBtnStyle}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} />
            Add Account
          </button>
        </div>
      </aside>

      {/* ── Main Area ───────────────────────────────────────────────────────── */}
      {!selectedAccount ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={BankIcon} size={26} />
          </span>
          <p className="text-[15px] font-semibold text-[var(--theme-text)]">Select an account</p>
          <p className="text-[13px] text-[var(--theme-muted)]">Choose an account from the sidebar or create a new one</p>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Account header */}
          <div className="border-b px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CategoryChip category={selectedAccount.category} />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-bold leading-tight text-[var(--theme-text)]">{selectedAccount.name}</h2>
                    <CategoryBadge category={selectedAccount.category} />
                  </div>
                  {selectedAccount.institution && (
                    <p className="text-[12px] text-[var(--theme-muted)]">
                      {selectedAccount.institution}{selectedAccount.account_number_last4 ? ` ···${selectedAccount.account_number_last4}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Current Balance</p>
                  <p
                    className="text-[26px] font-bold leading-tight tabular-nums"
                    style={{ color: selectedAccount.current_balance_cents < 0 ? '#ef4444' : 'var(--theme-text)' }}
                  >
                    {formatCents(selectedAccount.current_balance_cents)}
                  </p>
                </div>
                <button
                  onClick={() => setEditAccount(selectedAccount)}
                  className="rounded-lg p-2 text-[var(--theme-muted)] transition-colors duration-150 hover:bg-[var(--theme-accent-soft)] hover:text-[var(--theme-accent)]"
                >
                  <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${selectedAccount.name}"? This cannot be undone.`)) {
                      deleteAccountMut.mutate(selectedAccount.id)
                    }
                  }}
                  className="rounded-lg p-2 text-[var(--theme-muted)] transition-colors duration-150 hover:bg-red-500/10 hover:text-red-500"
                >
                  <HugeiconsIcon icon={Delete01Icon} size={16} />
                </button>
              </div>
            </div>

            {/* Balance summary */}
            <div className="mt-3 flex gap-3">
              {([
                { label: 'Opening', value: formatCents(selectedAccount.opening_balance_cents), color: '#0ea5e9' },
                { label: '+ Credits', value: formatCents(totalCredits), color: '#10b981' },
                { label: '- Debits', value: formatCents(totalDebits), color: '#ef4444' },
              ]).map(pill => (
                <div
                  key={pill.label}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{
                    background: `color-mix(in srgb, ${pill.color} 10%, var(--theme-card))`,
                    border: `1px solid color-mix(in srgb, ${pill.color} 25%, transparent)`,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.color }} />
                  <span className="text-[11px] font-medium" style={{ color: pill.color }}>{pill.label}</span>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color: pill.color }}>{pill.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 border-b px-6 py-3" style={{ borderColor: 'var(--theme-border)' }}>
            <button onClick={() => setShowAddTxn(true)} className={primaryBtnCls} style={primaryBtnStyle}>
              <HugeiconsIcon icon={Add01Icon} size={13} />
              Add Transaction
            </button>
            <button onClick={() => setShowImport(true)} className={ghostBtnCls}>
              <HugeiconsIcon icon={Download04Icon} size={13} />
              Import CSV
            </button>
            <button onClick={() => setShowReconcile(true)} className={ghostBtnCls}>
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} />
              Reconcile
            </button>
          </div>

          {/* Transaction register */}
          <div className="flex-1 overflow-auto">
            {statement.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                    color: 'var(--theme-accent)',
                  }}
                >
                  <HugeiconsIcon icon={Cash01Icon} size={22} />
                </span>
                <p className="text-[13px] font-semibold text-[var(--theme-text)]">No transactions yet</p>
                <p className="text-[11px] text-[var(--theme-muted)]">Add the first transaction to start the register.</p>
                <button onClick={() => setShowAddTxn(true)} className={cn(primaryBtnCls, 'mt-2')} style={primaryBtnStyle}>
                  <HugeiconsIcon icon={Add01Icon} size={13} />
                  Add Transaction
                </button>
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 z-10" style={{ background: 'var(--theme-card)' }}>
                  <tr className="border-b" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Payee / Description</th>
                    <th className={thCls}>Category</th>
                    <th className={thCls}>Ref</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Amount</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Balance</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">R</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map(txn => (
                    <tr
                      key={txn.id}
                      className="group border-b transition-colors duration-150 hover:bg-[var(--theme-hover)]"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      <td className="px-4 py-2.5 tabular-nums text-[var(--theme-muted)]">{txn.date}</td>
                      <td className="max-w-[220px] px-4 py-2.5">
                        <p className="truncate font-medium text-[var(--theme-text)]">{txn.payee ?? txn.description}</p>
                        {txn.payee && txn.description !== txn.payee && (
                          <p className="truncate text-[10px] text-[var(--theme-muted)]">{txn.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--theme-muted)]">{txn.category_name ?? txn.category ?? '—'}</td>
                      <td className="px-4 py-2.5 text-[var(--theme-muted)]">{txn.reference ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: txn.type === 'credit' ? '#10b981' : '#ef4444' }}>
                        {txn.type === 'credit' ? '+' : '-'}{formatCents(txn.amount_cents)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[var(--theme-muted)]">
                        {formatCents(txn.running_balance_cents)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {txn.is_reconciled ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5"
                            style={{
                              background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))',
                              border: '1px solid color-mix(in srgb, #10b981 30%, transparent)',
                            }}
                            title="Reconciled"
                          >
                            <HugeiconsIcon icon={Tick02Icon} size={10} style={{ color: '#10b981' }} />
                          </span>
                        ) : (
                          <span className="text-[var(--theme-muted)] opacity-50">○</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            onClick={() => setEditTxn(txn)}
                            className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-[var(--theme-accent-soft)]"
                            title="Edit"
                          >
                            <HugeiconsIcon icon={PencilEdit02Icon} size={13} className="text-[var(--theme-accent)]" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this transaction?')) deleteTxnMut.mutate(txn.id)
                            }}
                            className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-red-500/10"
                            title="Delete"
                          >
                            <HugeiconsIcon icon={Delete01Icon} size={13} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
