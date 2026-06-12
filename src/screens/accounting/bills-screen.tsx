import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  PencilEdit02Icon,
  Invoice01Icon,
  Store01Icon,
  AlertCircleIcon,
  Cancel01Icon,
  Money01Icon,
  ArrowDown01Icon,
  Calendar01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type BillStatus = 'draft' | 'open' | 'partial' | 'paid' | 'overdue' | 'void'

interface BillLineItem {
  id: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
  expense_account?: string
  expense_account_name?: string
}

interface BillPayment {
  id: string
  amount_cents: number
  payment_date: string
  payment_method?: string
  reference?: string
  notes?: string
  created_at: string
}

interface BillRecord {
  id: string
  brand: string
  bill_number: string
  vendor_id?: string
  vendor_name: string
  status: BillStatus
  issue_date: string
  due_date: string
  line_items: BillLineItem[]
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  amount_paid_cents: number
  amount_due_cents: number
  payments: BillPayment[]
  notes?: string
  attachment_url?: string
  expense_account?: string
  created_at: string
  updated_at: string
}

interface BillSummary {
  total_open_cents: number
  total_overdue_cents: number
  total_paid_this_month_cents: number
  bills_due_this_week: number
}

interface VendorRecord {
  id: string
  brand: string
  name: string
  company?: string
  email?: string
  phone?: string
  website?: string
  address?: { street?: string; city?: string; state?: string; zip?: string; country?: string }
  account_number?: string
  payment_terms?: number
  default_expense_account?: string
  notes?: string
  tags?: string[]
  is_active: boolean
  total_billed_cents: number
  total_paid_cents: number
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMoneyFull(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function isOverdue(bill: BillRecord): boolean {
  return bill.status === 'overdue' || (bill.due_date < todayStr() && bill.status !== 'paid' && bill.status !== 'void')
}

// ── Shared design tokens ──────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'
const labelCls = 'block text-[11px] font-medium text-[var(--theme-muted)] mb-1'

const STATUS_COLORS: Record<BillStatus, string> = {
  draft: '#94a3b8',
  open: '#3b82f6',
  partial: '#f59e0b',
  paid: '#10b981',
  overdue: '#ef4444',
  void: '#6b7280',
}

function StatusBadge({ status }: { status: BillStatus }) {
  const c = STATUS_COLORS[status]
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
      {status}
    </span>
  )
}

// Gradient-accented stat card
interface StatCardProps {
  label: string
  value: string
  sub?: string
  color: string
  icon: typeof Money01Icon
}

function StatCard({ label, value, sub, color, icon }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-1 hover:shadow-md"
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
        backdropFilter: 'blur(8px)',
      }}
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
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// Avatar initials circle in accent gradient
function VendorAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
    >
      {initials}
    </span>
  )
}

// Modal header with gradient icon chip
function ModalHeader({ icon, title, subtitle, onClose, badge }: {
  icon: typeof Money01Icon
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

// Skeleton loader shaped like a table card
function TableSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div className="animate-pulse space-y-3 p-4">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-8 rounded-lg" style={{ background: 'var(--theme-hover)', opacity: 0.6 }} />
        ))}
      </div>
    </div>
  )
}

// ── Line Item Row (for bill form) ─────────────────────────────────────────────

interface LineItemFormRow {
  description: string
  quantity: string
  unit_price: string
  expense_account: string
}

const DEFAULT_LINE: LineItemFormRow = { description: '', quantity: '1', unit_price: '', expense_account: '' }

interface LineItemsEditorProps {
  rows: LineItemFormRow[]
  onChange: (rows: LineItemFormRow[]) => void
  inputCls: string
}

function LineItemsEditor({ rows, onChange, inputCls }: LineItemsEditorProps) {
  const update = (i: number, key: keyof LineItemFormRow, val: string) => {
    const next = rows.map((r, ri) => ri === i ? { ...r, [key]: val } : r)
    onChange(next)
  }
  const add = () => onChange([...rows, { ...DEFAULT_LINE }])
  const remove = (i: number) => onChange(rows.filter((_, ri) => ri !== i))

  const subtotal = rows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity) || 0
    const price = parseFloat(r.unit_price) || 0
    return sum + qty * price
  }, 0)

  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_70px_90px_90px_28px] gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit Price</span>
        <span>Account</span>
        <span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-[1fr_70px_90px_90px_28px] gap-1.5 items-center">
          <input
            className={inputCls}
            placeholder="Description"
            value={row.description}
            onChange={e => update(i, 'description', e.target.value)}
          />
          <input
            className={inputCls}
            type="number"
            min="0"
            step="any"
            placeholder="1"
            value={row.quantity}
            onChange={e => update(i, 'quantity', e.target.value)}
          />
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={row.unit_price}
            onChange={e => update(i, 'unit_price', e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="6800"
            value={row.expense_account}
            onChange={e => update(i, 'expense_account', e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={rows.length === 1}
            className="flex items-center justify-center rounded text-[var(--theme-muted)] transition-colors hover:text-red-500 disabled:opacity-30"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={13} />
          </button>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[11px] font-medium text-[var(--theme-accent)] hover:underline"
        >
          <HugeiconsIcon icon={Add01Icon} size={11} />
          Add line
        </button>
        <span className="text-[12px] font-semibold tabular-nums text-[var(--theme-text)]">
          Subtotal: {fmtMoneyFull(Math.round(subtotal * 100))}
        </span>
      </div>
    </div>
  )
}

// ── New Bill Modal ─────────────────────────────────────────────────────────────

interface BillFormState {
  vendor_id: string
  vendor_name: string
  issue_date: string
  due_date: string
  line_items: LineItemFormRow[]
  tax: string
  notes: string
  expense_account: string
}

function defaultBillForm(): BillFormState {
  const today = todayStr()
  const due = new Date()
  due.setDate(due.getDate() + 30)
  const dueStr = due.toISOString().slice(0, 10)
  return {
    vendor_id: '',
    vendor_name: '',
    issue_date: today,
    due_date: dueStr,
    line_items: [{ ...DEFAULT_LINE }],
    tax: '0',
    notes: '',
    expense_account: '',
  }
}

function billToForm(bill: BillRecord): BillFormState {
  return {
    vendor_id: bill.vendor_id ?? '',
    vendor_name: bill.vendor_name,
    issue_date: bill.issue_date,
    due_date: bill.due_date,
    line_items: bill.line_items.map(li => ({
      description: li.description,
      quantity: String(li.quantity),
      unit_price: (li.unit_price_cents / 100).toFixed(2),
      expense_account: li.expense_account ?? '',
    })),
    tax: (bill.tax_cents / 100).toFixed(2),
    notes: bill.notes ?? '',
    expense_account: bill.expense_account ?? '',
  }
}

interface BillModalProps {
  editing: BillRecord | null
  vendors: VendorRecord[]
  onClose: () => void
  onSave: (form: BillFormState) => void
  saving: boolean
}

function BillModal({ editing, vendors, onClose, onSave, saving }: BillModalProps) {
  const [form, setForm] = useState<BillFormState>(
    editing ? billToForm(editing) : defaultBillForm()
  )
  const set = <K extends keyof BillFormState>(k: K, v: BillFormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const handleVendorChange = (vendorId: string) => {
    const v = vendors.find(vv => vv.id === vendorId)
    if (v) {
      setForm(f => ({
        ...f,
        vendor_id: vendorId,
        vendor_name: v.name,
        expense_account: v.default_expense_account ?? f.expense_account,
      }))
    } else {
      setForm(f => ({ ...f, vendor_id: '', vendor_name: vendorId }))
    }
  }

  const canSave = form.vendor_name.trim() && form.due_date &&
    form.line_items.some(li => li.description.trim() && parseFloat(li.unit_price) > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={Invoice01Icon}
          title={editing ? 'Edit Bill' : 'New Bill'}
          subtitle={editing ? `${editing.bill_number} · ${editing.vendor_name}` : 'Track what you owe a vendor'}
          onClose={onClose}
        />

        <div className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4">
          {/* Vendor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vendor *</label>
              {vendors.length > 0 && (
                <select
                  className={inputCls}
                  value={form.vendor_id}
                  onChange={e => handleVendorChange(e.target.value)}
                >
                  <option value="">— Select or type below —</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}{v.company ? ` (${v.company})` : ''}</option>
                  ))}
                </select>
              )}
              {!form.vendor_id && (
                <input
                  className={`${inputCls} ${vendors.length > 0 ? 'mt-1' : ''}`}
                  placeholder="Vendor name"
                  value={form.vendor_name}
                  onChange={e => set('vendor_name', e.target.value)}
                />
              )}
            </div>
            <div>
              <label className={labelCls}>Default Expense Account</label>
              <input
                className={inputCls}
                placeholder="e.g. 6800"
                value={form.expense_account}
                onChange={e => set('expense_account', e.target.value)}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Issue Date</label>
              <input className={inputCls} type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Due Date *</label>
              <input className={inputCls} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Line Items *</label>
            <LineItemsEditor
              rows={form.line_items}
              onChange={rows => set('line_items', rows)}
              inputCls="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Tax */}
          <div>
            <label className={labelCls}>Tax ($)</label>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.tax}
              onChange={e => set('tax', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={2}
              placeholder="Additional notes…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !canSave}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Bill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Record Payment Modal ───────────────────────────────────────────────────────

interface PaymentFormState {
  amount: string
  payment_date: string
  payment_method: string
  reference: string
  notes: string
}

interface PaymentModalProps {
  bill: BillRecord
  onClose: () => void
  onSave: (form: PaymentFormState) => void
  saving: boolean
}

const PAYMENT_METHODS = ['check', 'ACH', 'credit card', 'cash', 'other']

function PaymentModal({ bill, onClose, onSave, saving }: PaymentModalProps) {
  const [form, setForm] = useState<PaymentFormState>({
    amount: (bill.amount_due_cents / 100).toFixed(2),
    payment_date: todayStr(),
    payment_method: 'ACH',
    reference: '',
    notes: '',
  })
  const set = <K extends keyof PaymentFormState>(k: K, v: PaymentFormState[K]) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={Money01Icon}
          title="Record Payment"
          subtitle={`${bill.bill_number} · ${bill.vendor_name} · Due ${fmtMoneyFull(bill.amount_due_cents)}`}
          onClose={onClose}
          badge={<StatusBadge status={bill.status} />}
        />

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount ($) *</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date *</label>
              <input className={inputCls} type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Method</label>
              <select className={inputCls} value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Reference #</label>
              <input className={inputCls} placeholder="Check # or memo" value={form.reference} onChange={e => set('reference', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.amount || !form.payment_date}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vendor Modal ──────────────────────────────────────────────────────────────

interface VendorFormState {
  name: string
  company: string
  email: string
  phone: string
  website: string
  account_number: string
  payment_terms: string
  default_expense_account: string
  notes: string
  is_active: boolean
}

function defaultVendorForm(): VendorFormState {
  return { name: '', company: '', email: '', phone: '', website: '', account_number: '', payment_terms: '30', default_expense_account: '', notes: '', is_active: true }
}

function vendorToForm(v: VendorRecord): VendorFormState {
  return {
    name: v.name,
    company: v.company ?? '',
    email: v.email ?? '',
    phone: v.phone ?? '',
    website: v.website ?? '',
    account_number: v.account_number ?? '',
    payment_terms: String(v.payment_terms ?? 30),
    default_expense_account: v.default_expense_account ?? '',
    notes: v.notes ?? '',
    is_active: v.is_active,
  }
}

interface VendorModalProps {
  editing: VendorRecord | null
  onClose: () => void
  onSave: (form: VendorFormState) => void
  saving: boolean
}

function VendorModal({ editing, onClose, onSave, saving }: VendorModalProps) {
  const [form, setForm] = useState<VendorFormState>(editing ? vendorToForm(editing) : defaultVendorForm())
  const set = <K extends keyof VendorFormState>(k: K, v: VendorFormState[K]) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={Store01Icon}
          title={editing ? 'Edit Vendor' : 'New Vendor'}
          subtitle={editing ? editing.name : 'Add a vendor to track bills against'}
          onClose={onClose}
        />

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. John Smith" />
            </div>
            <div>
              <label className={labelCls}>Company</label>
              <input className={inputCls} value={form.company} onChange={e => set('company', e.target.value)} placeholder="e.g. Acme Corp" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="vendor@example.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555-000-0000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Website</label>
              <input className={inputCls} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.com" />
            </div>
            <div>
              <label className={labelCls}>Account # (your acct)</label>
              <input className={inputCls} value={form.account_number} onChange={e => set('account_number', e.target.value)} placeholder="Your account number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Terms (days)</label>
              <input className={inputCls} type="number" min="0" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="30" />
            </div>
            <div>
              <label className={labelCls}>Default Expense Account</label>
              <input className={inputCls} value={form.default_expense_account} onChange={e => set('default_expense_account', e.target.value)} placeholder="e.g. 6800" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes…" />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className="relative h-5 w-9 rounded-full transition-colors"
              style={{ background: form.is_active ? 'var(--theme-accent)' : 'var(--theme-border)' }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: form.is_active ? 'translateX(16px)' : 'translateX(2px)' }}
              />
            </button>
            <span className="text-[12px] text-[var(--theme-text)]">Active</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Vendor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bills Tab ─────────────────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: BillStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Open', value: 'open' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Partial', value: 'partial' },
  { label: 'Paid', value: 'paid' },
]

interface BillsTabProps {
  brand: string
  vendors: VendorRecord[]
}

function BillsTab({ brand, vendors }: BillsTabProps) {
  const qc = useQueryClient()
  const headers = { 'x-brand': brand }

  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>('all')
  const [showBillModal, setShowBillModal] = useState(false)
  const [editingBill, setEditingBill] = useState<BillRecord | null>(null)
  const [payingBill, setPayingBill] = useState<BillRecord | null>(null)

  const { data: summary } = useQuery<BillSummary>({
    queryKey: ['bills-summary', brand],
    queryFn: async () => {
      const res = await fetch(`/api/bills/summary?brand=${brand}`, { headers })
      if (!res.ok) throw new Error('fetch failed')
      return res.json() as Promise<BillSummary>
    },
  })

  const { data: bills = [], isLoading } = useQuery<BillRecord[]>({
    queryKey: ['bills', brand, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ brand })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/bills?${params}`, { headers })
      if (!res.ok) throw new Error('fetch failed')
      return res.json() as Promise<BillRecord[]>
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['bills', brand] })
    void qc.invalidateQueries({ queryKey: ['bills-summary', brand] })
    void qc.invalidateQueries({ queryKey: ['vendors', brand] })
  }

  const createMut = useMutation({
    mutationFn: async (form: BillFormState) => {
      const line_items = form.line_items.map(li => ({
        description: li.description,
        quantity: parseFloat(li.quantity) || 1,
        unit_price_cents: Math.round((parseFloat(li.unit_price) || 0) * 100),
        amount_cents: Math.round((parseFloat(li.quantity) || 1) * (parseFloat(li.unit_price) || 0) * 100),
        expense_account: li.expense_account || undefined,
      }))
      const res = await fetch(`/api/bills?brand=${brand}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          vendor_id: form.vendor_id || undefined,
          vendor_name: form.vendor_name,
          issue_date: form.issue_date,
          due_date: form.due_date,
          line_items,
          tax_cents: Math.round((parseFloat(form.tax) || 0) * 100),
          notes: form.notes || undefined,
          expense_account: form.expense_account || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to create bill')
      return res.json()
    },
    onSuccess: () => { invalidate(); setShowBillModal(false); toast('Bill created') },
    onError: () => toast('Failed to create bill', { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: BillFormState }) => {
      const line_items = form.line_items.map(li => ({
        description: li.description,
        quantity: parseFloat(li.quantity) || 1,
        unit_price_cents: Math.round((parseFloat(li.unit_price) || 0) * 100),
        amount_cents: Math.round((parseFloat(li.quantity) || 1) * (parseFloat(li.unit_price) || 0) * 100),
        expense_account: li.expense_account || undefined,
      }))
      const res = await fetch(`/api/bills/${id}?brand=${brand}`, {
        method: 'PATCH',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          vendor_id: form.vendor_id || undefined,
          vendor_name: form.vendor_name,
          issue_date: form.issue_date,
          due_date: form.due_date,
          line_items,
          tax_cents: Math.round((parseFloat(form.tax) || 0) * 100),
          notes: form.notes || undefined,
          expense_account: form.expense_account || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to update bill')
      return res.json()
    },
    onSuccess: () => { invalidate(); setEditingBill(null); toast('Bill updated') },
    onError: () => toast('Failed to update bill', { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bills/${id}?brand=${brand}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to delete bill')
      }
    },
    onSuccess: () => { invalidate(); toast('Bill deleted') },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to delete', { type: 'error' }),
  })

  const payMut = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: PaymentFormState }) => {
      const res = await fetch(`/api/bills/${id}/pay?brand=${brand}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          amount_cents: Math.round((parseFloat(form.amount) || 0) * 100),
          payment_date: form.payment_date,
          payment_method: form.payment_method || undefined,
          reference: form.reference || undefined,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to record payment')
      return res.json()
    },
    onSuccess: () => { invalidate(); setPayingBill(null); toast('Payment recorded') },
    onError: () => toast('Failed to record payment', { type: 'error' }),
  })

  const voidMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bills/${id}/void?brand=${brand}`, { method: 'POST', headers })
      if (!res.ok) throw new Error('Failed to void bill')
      return res.json()
    },
    onSuccess: () => { invalidate(); toast('Bill voided') },
    onError: () => toast('Failed to void bill', { type: 'error' }),
  })

  // Aging buckets (overdue bills only)
  const overdueBills = bills.filter(b => b.status === 'overdue')
  const today = todayStr()
  const agingBuckets = [
    { label: '0–30 days', min: 0, max: 30, total: 0 },
    { label: '31–60 days', min: 31, max: 60, total: 0 },
    { label: '61–90 days', min: 61, max: 90, total: 0 },
    { label: '90+ days', min: 91, max: Infinity, total: 0 },
  ]
  for (const bill of overdueBills) {
    const days = Math.floor((new Date(today).getTime() - new Date(bill.due_date).getTime()) / 86400000)
    const bucket = agingBuckets.find(b => days >= b.min && days <= b.max)
    if (bucket) bucket.total += bill.amount_due_cents
  }

  const AGING_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#b91c1c']

  return (
    <div>
      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total Open"
          value={fmtMoney(summary?.total_open_cents ?? 0)}
          sub="awaiting payment"
          color="#3b82f6"
          icon={Invoice01Icon}
        />
        <StatCard
          label="Overdue"
          value={fmtMoney(summary?.total_overdue_cents ?? 0)}
          sub="past due date"
          color="#ef4444"
          icon={AlertCircleIcon}
        />
        <StatCard
          label="Due This Week"
          value={String(summary?.bills_due_this_week ?? 0)}
          sub={`bill${(summary?.bills_due_this_week ?? 0) !== 1 ? 's' : ''} coming due`}
          color="#f59e0b"
          icon={Calendar01Icon}
        />
        <StatCard
          label="Paid This Month"
          value={fmtMoney(summary?.total_paid_this_month_cents ?? 0)}
          sub="settled"
          color="#10b981"
          icon={Money01Icon}
        />
      </div>

      {/* Overdue alert */}
      {(summary?.total_overdue_cents ?? 0) > 0 && (
        <div
          className="mb-4 flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{
            background: 'color-mix(in srgb, #ef4444 8%, var(--theme-card))',
            borderColor: 'color-mix(in srgb, #ef4444 28%, transparent)',
          }}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #ef4444, color-mix(in srgb, #ef4444 65%, #000))',
              boxShadow: '0 2px 8px color-mix(in srgb, #ef4444 35%, transparent)',
            }}
          >
            <HugeiconsIcon icon={AlertCircleIcon} size={14} className="text-white" />
          </span>
          <p className="text-[13px]" style={{ color: '#ef4444' }}>
            You have {overdueBills.length} overdue bill{overdueBills.length !== 1 ? 's' : ''} totaling <strong className="tabular-nums">{fmtMoney(summary?.total_overdue_cents ?? 0)}</strong>.
          </p>
        </div>
      )}

      {/* Status filter + New bill button */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn('rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all',
                statusFilter === tab.value ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
              style={statusFilter === tab.value ? {
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
              } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => { setEditingBill(null); setShowBillModal(true) }}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          <HugeiconsIcon icon={Add01Icon} size={13} />
          New Bill
        </button>
      </div>

      {/* Bills table */}
      {isLoading ? (
        <TableSkeleton />
      ) : bills.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-16 text-center"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <span
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={Invoice01Icon} size={22} />
          </span>
          <p className="text-[14px] font-semibold text-[var(--theme-text)]">No bills{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}</p>
          <p className="mt-1 text-[12px] text-[var(--theme-muted)]">Create your first bill to track what you owe</p>
          <button
            onClick={() => { setEditingBill(null); setShowBillModal(true) }}
            className={cn(primaryBtnCls, 'mt-4')}
            style={primaryBtnStyle}
          >
            <HugeiconsIcon icon={Add01Icon} size={13} />
            New Bill
          </button>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-hover)' }}>
                {['Bill #', 'Vendor', 'Issue Date', 'Due Date', 'Total', 'Paid', 'Due', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bills.map((bill, i) => {
                const overdue = isOverdue(bill)
                const isLast = i === bills.length - 1
                return (
                  <tr
                    key={bill.id}
                    style={{ borderBottom: isLast ? 'none' : '1px solid var(--theme-border)' }}
                    className="group transition-colors duration-150 hover:bg-[var(--theme-hover)]"
                  >
                    <td className="px-3 py-2.5 font-mono text-[12px] font-medium text-[var(--theme-text)]">{bill.bill_number}</td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 text-[12px] font-medium text-[var(--theme-text)]">{bill.vendor_name}</td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums text-[var(--theme-muted)]">{fmtDate(bill.issue_date)}</td>
                    <td className="px-3 py-2.5 text-[12px] font-medium tabular-nums" style={{ color: overdue ? '#ef4444' : 'var(--theme-muted)' }}>{fmtDate(bill.due_date)}</td>
                    <td className="px-3 py-2.5 text-[12px] font-medium tabular-nums text-[var(--theme-text)]">{fmtMoneyFull(bill.total_cents)}</td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: bill.amount_paid_cents > 0 ? '#10b981' : 'var(--theme-muted)' }}>{fmtMoneyFull(bill.amount_paid_cents)}</td>
                    <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums" style={{ color: bill.amount_due_cents > 0 ? (overdue ? '#ef4444' : 'var(--theme-text)') : '#10b981' }}>{fmtMoneyFull(bill.amount_due_cents)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={bill.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        {bill.status !== 'paid' && bill.status !== 'void' && (
                          <button
                            onClick={() => setPayingBill(bill)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors duration-150"
                            style={{ color: '#10b981' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #10b981 12%, var(--theme-card))' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            title="Record Payment"
                          >
                            <HugeiconsIcon icon={Money01Icon} size={11} />
                            Pay
                          </button>
                        )}
                        {bill.status !== 'void' && (
                          <button
                            onClick={() => { setEditingBill(bill); setShowBillModal(true) }}
                            className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-[var(--theme-accent-soft)]"
                            title="Edit"
                          >
                            <HugeiconsIcon icon={PencilEdit02Icon} size={13} className="text-[var(--theme-accent)]" />
                          </button>
                        )}
                        {bill.status !== 'void' && bill.status !== 'paid' && (
                          <button
                            onClick={() => { if (confirm(`Void bill ${bill.bill_number}?`)) voidMut.mutate(bill.id) }}
                            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors duration-150 hover:bg-orange-500/10 hover:text-orange-500"
                            title="Void"
                          >
                            <HugeiconsIcon icon={Cancel01Icon} size={13} />
                          </button>
                        )}
                        {(bill.status === 'draft' || bill.status === 'void') && (
                          <button
                            onClick={() => { if (confirm(`Delete bill ${bill.bill_number}?`)) deleteMut.mutate(bill.id) }}
                            className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-red-500/10"
                            title="Delete"
                          >
                            <HugeiconsIcon icon={Delete01Icon} size={13} className="text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Aging summary */}
      {overdueBills.length > 0 && (
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Aging Summary</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {agingBuckets.map((b, i) => {
              const c = AGING_COLORS[i]
              const active = b.total > 0
              return (
                <div
                  key={b.label}
                  className="rounded-xl border px-3 py-2.5 transition-all duration-150 hover:-translate-y-px"
                  style={{
                    borderColor: active ? `color-mix(in srgb, ${c} 30%, transparent)` : 'var(--theme-border)',
                    background: active ? `color-mix(in srgb, ${c} 8%, var(--theme-card))` : 'var(--theme-card)',
                  }}
                >
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`,
                      color: active ? c : 'var(--theme-muted)',
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? c : 'var(--theme-muted)' }} />
                    {b.label}
                  </span>
                  <p className="mt-1.5 text-[16px] font-bold leading-none tabular-nums" style={{ color: active ? c : 'var(--theme-muted)' }}>{fmtMoney(b.total)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {(showBillModal || editingBill) && (
        <BillModal
          editing={editingBill}
          vendors={vendors}
          onClose={() => { setShowBillModal(false); setEditingBill(null) }}
          onSave={form => editingBill ? updateMut.mutate({ id: editingBill.id, form }) : createMut.mutate(form)}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
      {payingBill && (
        <PaymentModal
          bill={payingBill}
          onClose={() => setPayingBill(null)}
          onSave={form => payMut.mutate({ id: payingBill.id, form })}
          saving={payMut.isPending}
        />
      )}
    </div>
  )
}

// ── Vendors Tab ───────────────────────────────────────────────────────────────

interface VendorsTabProps {
  brand: string
}

function VendorsTab({ brand }: VendorsTabProps) {
  const qc = useQueryClient()
  const headers = { 'x-brand': brand }
  const [showModal, setShowModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState<VendorRecord | null>(null)
  const [vendorBillsId, setVendorBillsId] = useState<string | null>(null)

  const { data: vendors = [], isLoading } = useQuery<VendorRecord[]>({
    queryKey: ['vendors', brand],
    queryFn: async () => {
      const res = await fetch(`/api/vendors?brand=${brand}`, { headers })
      if (!res.ok) throw new Error('fetch failed')
      return res.json() as Promise<VendorRecord[]>
    },
  })

  const { data: vendorBills = [] } = useQuery<BillRecord[]>({
    queryKey: ['bills', brand, 'vendor', vendorBillsId],
    enabled: !!vendorBillsId,
    queryFn: async () => {
      const params = new URLSearchParams({ brand, vendor_id: vendorBillsId! })
      const res = await fetch(`/api/bills?${params}`, { headers })
      if (!res.ok) throw new Error('fetch failed')
      return res.json() as Promise<BillRecord[]>
    },
  })

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['vendors', brand] })

  const createMut = useMutation({
    mutationFn: async (form: VendorFormState) => {
      const res = await fetch(`/api/vendors?brand=${brand}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          company: form.company || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          website: form.website || undefined,
          account_number: form.account_number || undefined,
          payment_terms: form.payment_terms ? parseInt(form.payment_terms) : undefined,
          default_expense_account: form.default_expense_account || undefined,
          notes: form.notes || undefined,
          is_active: form.is_active,
        }),
      })
      if (!res.ok) throw new Error('Failed to create vendor')
      return res.json()
    },
    onSuccess: () => { invalidate(); setShowModal(false); toast('Vendor created') },
    onError: () => toast('Failed to create vendor', { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: VendorFormState }) => {
      const res = await fetch(`/api/vendors/${id}?brand=${brand}`, {
        method: 'PATCH',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          company: form.company || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          website: form.website || undefined,
          account_number: form.account_number || undefined,
          payment_terms: form.payment_terms ? parseInt(form.payment_terms) : undefined,
          default_expense_account: form.default_expense_account || undefined,
          notes: form.notes || undefined,
          is_active: form.is_active,
        }),
      })
      if (!res.ok) throw new Error('Failed to update vendor')
      return res.json()
    },
    onSuccess: () => { invalidate(); setEditingVendor(null); toast('Vendor updated') },
    onError: () => toast('Failed to update vendor', { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vendors/${id}?brand=${brand}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error('Failed to delete vendor')
    },
    onSuccess: () => { invalidate(); toast('Vendor deleted') },
    onError: () => toast('Failed to delete vendor', { type: 'error' }),
  })

  const selectedVendor = vendorBillsId ? vendors.find(v => v.id === vendorBillsId) : null

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{vendors.length} vendor{vendors.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setEditingVendor(null); setShowModal(true) }}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          <HugeiconsIcon icon={Add01Icon} size={13} />
          New Vendor
        </button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : vendors.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-16 text-center"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <span
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={Store01Icon} size={22} />
          </span>
          <p className="text-[14px] font-semibold text-[var(--theme-text)]">No vendors yet</p>
          <p className="mt-1 text-[12px] text-[var(--theme-muted)]">Add vendors to track what you owe and to whom</p>
          <button
            onClick={() => { setEditingVendor(null); setShowModal(true) }}
            className={cn(primaryBtnCls, 'mt-4')}
            style={primaryBtnStyle}
          >
            <HugeiconsIcon icon={Add01Icon} size={13} />
            New Vendor
          </button>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-hover)' }}>
                {['Name', 'Company', 'Email', 'Total Billed', 'Total Paid', 'Outstanding', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor, i) => {
                const outstanding = vendor.total_billed_cents - vendor.total_paid_cents
                const isLast = i === vendors.length - 1
                return (
                  <tr
                    key={vendor.id}
                    style={{ borderBottom: isLast ? 'none' : '1px solid var(--theme-border)' }}
                    className="group transition-colors duration-150 hover:bg-[var(--theme-hover)]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <VendorAvatar name={vendor.name} />
                        <span className="text-[12px] font-semibold text-[var(--theme-text)]">{vendor.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--theme-muted)]">{vendor.company ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--theme-muted)]">{vendor.email ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums text-[var(--theme-text)]">{fmtMoney(vendor.total_billed_cents)}</td>
                    <td className="px-3 py-2.5 text-[12px] tabular-nums text-[var(--theme-muted)]">{fmtMoney(vendor.total_paid_cents)}</td>
                    <td className="px-3 py-2.5 text-[14px] font-bold tabular-nums" style={{ color: outstanding > 0 ? '#ef4444' : '#10b981' }}>{fmtMoney(outstanding)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: vendor.is_active ? 'color-mix(in srgb, #10b981 12%, var(--theme-card))' : 'var(--theme-hover)',
                          color: vendor.is_active ? '#10b981' : 'var(--theme-muted)',
                          border: `1px solid ${vendor.is_active ? 'color-mix(in srgb, #10b981 30%, transparent)' : 'var(--theme-border)'}`,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: vendor.is_active ? '#10b981' : 'var(--theme-muted)' }} />
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          onClick={() => setVendorBillsId(vendorBillsId === vendor.id ? null : vendor.id)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-[var(--theme-accent)] transition-colors duration-150 hover:bg-[var(--theme-accent-soft)]"
                          title="View bills"
                        >
                          <HugeiconsIcon icon={ArrowDown01Icon} size={11} />
                          Bills
                        </button>
                        <button
                          onClick={() => { setEditingVendor(vendor); setShowModal(true) }}
                          className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-[var(--theme-accent-soft)]"
                          title="Edit"
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} size={13} className="text-[var(--theme-accent)]" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete vendor ${vendor.name}?`)) deleteMut.mutate(vendor.id) }}
                          className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-red-500/10"
                          title="Delete"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={13} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vendor bill history drawer */}
      {vendorBillsId && selectedVendor && (
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <VendorAvatar name={selectedVendor.name} />
              <h3 className="text-[13px] font-semibold text-[var(--theme-text)]">Bills for {selectedVendor.name}</h3>
            </div>
            <button onClick={() => setVendorBillsId(null)} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]">
              <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-[var(--theme-muted)]" />
            </button>
          </div>
          {vendorBills.length === 0 ? (
            <p className="text-[12px] text-[var(--theme-muted)]">No bills for this vendor yet.</p>
          ) : (
            <div className="space-y-1">
              {vendorBills.map(bill => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 transition-all duration-150 hover:border-[var(--theme-border)]"
                  style={{ background: 'color-mix(in srgb, var(--theme-hover) 60%, var(--theme-card))' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] font-medium text-[var(--theme-text)]">{bill.bill_number}</span>
                    <span className="text-[11px] tabular-nums text-[var(--theme-muted)]">{fmtDate(bill.due_date)}</span>
                    <StatusBadge status={bill.status} />
                  </div>
                  <div className="text-right">
                    <span className="text-[12px] font-semibold tabular-nums text-[var(--theme-text)]">{fmtMoneyFull(bill.total_cents)}</span>
                    {bill.amount_due_cents > 0 && (
                      <span className="ml-2 text-[11px] tabular-nums" style={{ color: '#ef4444' }}>({fmtMoneyFull(bill.amount_due_cents)} due)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {(showModal || editingVendor) && (
        <VendorModal
          editing={editingVendor}
          onClose={() => { setShowModal(false); setEditingVendor(null) }}
          onSave={form => editingVendor ? updateMut.mutate({ id: editingVendor.id, form }) : createMut.mutate(form)}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type MainTab = 'bills' | 'vendors'

export function BillsScreen() {
  const brand = useBrand()
  const [tab, setTab] = useState<MainTab>('bills')

  const { data: vendors = [] } = useQuery<VendorRecord[]>({
    queryKey: ['vendors', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/vendors?brand=${brand.id}`)
      if (!res.ok) throw new Error('fetch failed')
      return res.json() as Promise<VendorRecord[]>
    },
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 pb-20 md:pb-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Invoice01Icon} size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-[var(--theme-text)]">Bills &amp; Vendors</h1>
            <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">Track payables, vendors, and payments</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
          {([
            { value: 'bills' as MainTab, label: 'Bills', icon: Invoice01Icon },
            { value: 'vendors' as MainTab, label: 'Vendors', icon: Store01Icon },
          ]).map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn('flex items-center gap-2 rounded-lg px-4 py-1.5 text-[12px] font-semibold transition-all',
                tab === t.value ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
              style={tab === t.value ? {
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
              } : undefined}
            >
              <HugeiconsIcon icon={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'bills' && <BillsTab brand={brand.id} vendors={vendors} />}
        {tab === 'vendors' && <VendorsTab brand={brand.id} />}
      </div>
    </div>
  )
}
