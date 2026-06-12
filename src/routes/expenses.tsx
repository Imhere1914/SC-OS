import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  Invoice01Icon,
  Money01Icon,
  PencilEdit02Icon,
  ReceiptDollarIcon,
  TaxesIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

export const Route = createFileRoute('/expenses')({ component: ExpensesScreen })

// ── Types ────────────────────────────────────────────────────────────────────

type ExpenseCategory =
  | 'advertising' | 'software' | 'equipment' | 'travel' | 'meals'
  | 'office' | 'utilities' | 'payroll' | 'contractor' | 'legal'
  | 'insurance' | 'rent' | 'marketing' | 'training' | 'other'

interface ExpenseRecord {
  id: string
  brand: string
  title: string
  amount_cents: number
  category: ExpenseCategory
  date: string
  vendor?: string
  notes?: string
  receipt_url?: string
  project_id?: string
  project_name?: string
  reimbursable: boolean
  reimbursed: boolean
  tax_deductible: boolean
  created_at: string
  updated_at: string
}

interface ExpenseSummary {
  total_cents: number
  by_category: Partial<Record<ExpenseCategory, number>>
  count: number
  reimbursable_unpaid_cents: number
  tax_deductible_cents: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  advertising: '#6366f1',
  software: '#8b5cf6',
  equipment: '#06b6d4',
  travel: '#0ea5e9',
  meals: '#f59e0b',
  office: '#84cc16',
  utilities: '#ef4444',
  payroll: '#10b981',
  contractor: '#f97316',
  legal: '#64748b',
  insurance: '#475569',
  rent: '#a855f7',
  marketing: '#ec4899',
  training: '#14b8a6',
  other: '#6b7280',
}

const ALL_CATEGORIES: ExpenseCategory[] = [
  'advertising', 'software', 'equipment', 'travel', 'meals',
  'office', 'utilities', 'payroll', 'contractor', 'legal',
  'insurance', 'rent', 'marketing', 'training', 'other',
]

const accentGradient = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const accentGlow = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

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

function monthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Tinted category chip — consistent color per category via CATEGORY_COLORS map
function CategoryChip({ category }: { category: ExpenseCategory }) {
  const c = CATEGORY_COLORS[category]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {capitalize(category)}
    </span>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

interface ModalForm {
  title: string
  amount: string
  date: string
  category: ExpenseCategory
  vendor: string
  notes: string
  project_name: string
  reimbursable: boolean
  tax_deductible: boolean
}

const DEFAULT_FORM: ModalForm = {
  title: '',
  amount: '',
  date: todayStr(),
  category: 'other',
  vendor: '',
  notes: '',
  project_name: '',
  reimbursable: false,
  tax_deductible: true,
}

function expenseToForm(e: ExpenseRecord): ModalForm {
  return {
    title: e.title,
    amount: (e.amount_cents / 100).toFixed(2),
    date: e.date,
    category: e.category,
    vendor: e.vendor ?? '',
    notes: e.notes ?? '',
    project_name: e.project_name ?? '',
    reimbursable: e.reimbursable,
    tax_deductible: e.tax_deductible,
  }
}

interface ExpenseModalProps {
  editing: ExpenseRecord | null
  onClose: () => void
  onSave: (form: ModalForm) => void
  saving: boolean
}

function ExpenseModal({ editing, onClose, onSave, saving }: ExpenseModalProps) {
  const [form, setForm] = useState<ModalForm>(editing ? expenseToForm(editing) : DEFAULT_FORM)
  const set = <K extends keyof ModalForm>(k: K, v: ModalForm[K]) => setForm(f => ({ ...f, [k]: v }))

  const inputCls = "w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
  const labelCls = "block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGradient, boxShadow: accentGlow }}
            >
              <HugeiconsIcon icon={ReceiptDollarIcon} size={16} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">
                {editing ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {editing ? 'Update the details below' : 'Record a new business expense'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">✕</button>
        </div>

        <div className="space-y-4 px-5 py-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. AWS Monthly Bill" />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount ($) *</label>
              <input className={inputCls + ' tabular-nums'} type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Date *</label>
              <input className={inputCls} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category *</label>
            <select className={inputCls} value={form.category} onChange={e => set('category', e.target.value as ExpenseCategory)}>
              {ALL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{capitalize(cat)}</option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div>
            <label className={labelCls}>Vendor</label>
            <input className={inputCls} value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="e.g. Amazon Web Services" />
          </div>

          {/* Project */}
          <div>
            <label className={labelCls}>Project</label>
            <input className={inputCls} value={form.project_name} onChange={e => set('project_name', e.target.value)} placeholder="Project name" />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes…" />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4">
            {([
              ['reimbursable', 'Reimbursable'] as const,
              ['tax_deductible', 'Tax Deductible'] as const,
            ]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <button
                  type="button"
                  onClick={() => set(key, !form[key])}
                  className="relative h-5 w-9 rounded-full transition-all duration-150"
                  style={{
                    background: form[key] ? accentGradient : 'var(--theme-border)',
                    boxShadow: form[key] ? accentGlow : 'none',
                  }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: form[key] ? 'translateX(16px)' : 'translateX(2px)' }}
                  />
                </button>
                <span className="text-[12px] text-[var(--theme-text)]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.title || !form.amount}
            className="rounded-lg px-5 py-2 text-[13px] font-semibold text-white transition-all duration-150 disabled:opacity-50"
            style={{ background: accentGradient, boxShadow: accentGlow }}
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

function ExpensesScreen() {
  const brand = useBrand()
  const qc = useQueryClient()

  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayStr())
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null)

  const headers = { 'x-brand': brand.id }

  const { data: expenses = [], isLoading } = useQuery<ExpenseRecord[]>({
    queryKey: ['expenses', brand.id, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/expenses?${params}`, { headers })
      if (!res.ok) throw new Error('Failed to fetch expenses')
      return res.json()
    },
  })

  const { data: summary } = useQuery<ExpenseSummary>({
    queryKey: ['expenses-summary', brand.id, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/expenses/summary?${params}`, { headers })
      if (!res.ok) throw new Error('Failed to fetch summary')
      return res.json()
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['expenses', brand.id] })
    void qc.invalidateQueries({ queryKey: ['expenses-summary', brand.id] })
  }

  const createMut = useMutation({
    mutationFn: async (form: ModalForm) => {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          amount_cents: Math.round(parseFloat(form.amount) * 100),
          category: form.category,
          date: form.date,
          vendor: form.vendor || undefined,
          notes: form.notes || undefined,
          project_name: form.project_name || undefined,
          reimbursable: form.reimbursable,
          reimbursed: false,
          tax_deductible: form.tax_deductible,
        }),
      })
      if (!res.ok) throw new Error('Failed to create expense')
      return res.json()
    },
    onSuccess: () => { invalidate(); setShowModal(false); toast('Expense added') },
    onError: () => toast('Failed to add expense', { type: "error" }),
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: ModalForm }) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          amount_cents: Math.round(parseFloat(form.amount) * 100),
          category: form.category,
          date: form.date,
          vendor: form.vendor || undefined,
          notes: form.notes || undefined,
          project_name: form.project_name || undefined,
          reimbursable: form.reimbursable,
          tax_deductible: form.tax_deductible,
        }),
      })
      if (!res.ok) throw new Error('Failed to update expense')
      return res.json()
    },
    onSuccess: () => { invalidate(); setEditingExpense(null); toast('Expense updated') },
    onError: () => toast('Failed to update expense', { type: "error" }),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error('Failed to delete expense')
    },
    onSuccess: () => { invalidate(); toast('Expense deleted') },
    onError: () => toast('Failed to delete expense', { type: "error" }),
  })

  const handleSave = (form: ModalForm) => {
    if (editingExpense) {
      updateMut.mutate({ id: editingExpense.id, form })
    } else {
      createMut.mutate(form)
    }
  }

  // Group expenses by date
  const grouped = expenses.reduce<Record<string, ExpenseRecord[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Category bar chart — top 5
  const byCat = summary?.by_category ?? {}
  const total = summary?.total_cents ?? 1
  const top5 = Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) as [ExpenseCategory, number][]

  const inputCls = "rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-[12px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"

  const statCards = [
    { label: 'Total This Period', value: fmtMoney(summary?.total_cents ?? 0), sub: 'all expenses', color: '#ef4444', icon: ReceiptDollarIcon },
    { label: 'Tax Deductible', value: fmtMoney(summary?.tax_deductible_cents ?? 0), sub: 'write-offs', color: '#10b981', icon: TaxesIcon },
    { label: 'Reimbursable', value: fmtMoney(summary?.reimbursable_unpaid_cents ?? 0), sub: 'awaiting payout', color: '#f59e0b', icon: Money01Icon },
    { label: 'Count', value: String(summary?.count ?? 0), sub: 'expenses recorded', color: '#3b82f6', icon: Invoice01Icon },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-20 md:pb-6">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGradient, boxShadow: accentGlow }}
            >
              <HugeiconsIcon icon={ReceiptDollarIcon} size={18} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[var(--theme-text)]">Expenses</h1>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {summary?.count ?? 0} expenses · {fmtMoney(summary?.total_cents ?? 0)} this period
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-[var(--theme-muted)]">From</label>
            <input className={inputCls} type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <label className="text-[11px] text-[var(--theme-muted)]">To</label>
            <input className={inputCls} type="date" value={to} onChange={e => setTo(e.target.value)} />
            <button
              onClick={() => { setEditingExpense(null); setShowModal(true) }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-all duration-150"
              style={{ background: accentGradient, boxShadow: accentGlow }}
            >
              <HugeiconsIcon icon={Add01Icon} size={13} />
              Add Expense
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {statCards.map(card => (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-[1px]"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${card.color} 40%, var(--theme-border))` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            >
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: card.color }} />
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                  style={{
                    background: `linear-gradient(135deg, ${card.color}, color-mix(in srgb, ${card.color} 65%, #000))`,
                    boxShadow: `0 2px 8px color-mix(in srgb, ${card.color} 38%, transparent)`,
                  }}
                >
                  <HugeiconsIcon icon={card.icon} size={13} />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{card.label}</p>
              </div>
              <p className="text-[20px] font-bold tabular-nums text-[var(--theme-text)]">{card.value}</p>
              <p className="text-[10px] text-[var(--theme-muted)]">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        {top5.length > 0 && (
          <div
            className="mb-6 rounded-xl border p-4"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
          >
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Top Categories</h2>
            <div className="space-y-2.5">
              {top5.map(([cat, cents]) => {
                const pct = total > 0 ? Math.round((cents / total) * 100) : 0
                const c = CATEGORY_COLORS[cat]
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-24 shrink-0"><CategoryChip category={cat} /></span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--theme-hover)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, color-mix(in srgb, ${c} 65%, var(--theme-card)), ${c})`,
                          boxShadow: `0 0 6px color-mix(in srgb, ${c} 45%, transparent)`,
                        }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[11px] font-medium tabular-nums text-[var(--theme-text)]">{fmtMoney(cents)}</span>
                    <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-[var(--theme-muted)]">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Expense list */}
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--theme-card)] opacity-60" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border py-16 text-center"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
          >
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
                color: 'var(--theme-accent)',
              }}
            >
              <HugeiconsIcon icon={ReceiptDollarIcon} size={24} />
            </div>
            <p className="text-[14px] font-semibold text-[var(--theme-text)]">No expenses yet</p>
            <p className="mt-1 text-[12px] text-[var(--theme-muted)]">Track your first business expense to get started</p>
            <button
              onClick={() => { setEditingExpense(null); setShowModal(true) }}
              className="mt-4 rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150"
              style={{ background: accentGradient, boxShadow: accentGlow }}
            >
              Add Expense
            </button>
          </div>
        ) : (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
          >
            {sortedDates.map((date, di) => (
              <div key={date}>
                {/* Date group header */}
                <div
                  className="sticky top-0 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]"
                  style={{ background: 'var(--theme-hover)', zIndex: 1 }}
                >
                  {fmtDate(date)}
                </div>

                {grouped[date].map((expense, i) => {
                  const isLast = i === grouped[date].length - 1 && di === sortedDates.length - 1
                  return (
                    <div
                      key={expense.id}
                      className="group flex items-center gap-3 px-4 py-3 transition-all duration-150 hover:bg-[var(--theme-hover)]"
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid var(--theme-border)',
                      }}
                    >
                      {/* Category dot */}
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: CATEGORY_COLORS[expense.category] }}
                      />

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-[var(--theme-text)]">{expense.title}</span>
                          {expense.vendor && (
                            <span className="text-[11px] text-[var(--theme-muted)]">· {expense.vendor}</span>
                          )}
                          <CategoryChip category={expense.category} />
                          {expense.reimbursable && !expense.reimbursed && (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))', color: '#f59e0b' }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f59e0b' }} />
                              Reimbursable
                            </span>
                          )}
                          {expense.tax_deductible && (
                            <span
                              title="Tax deductible"
                              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))', color: '#10b981' }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10b981' }} />
                              Deductible
                            </span>
                          )}
                        </div>
                        {expense.project_name && (
                          <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{expense.project_name}</p>
                        )}
                      </div>

                      {/* Amount */}
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums" style={{ color: '#ef4444' }}>
                        {fmtMoneyFull(expense.amount_cents)}
                      </span>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-1 opacity-0 transition-all duration-150 focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          onClick={() => { setEditingExpense(expense); setShowModal(true) }}
                          className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                          title="Edit"
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this expense?')) deleteMut.mutate(expense.id)
                          }}
                          className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          title="Delete"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {(showModal || editingExpense) && (
        <ExpenseModal
          editing={editingExpense}
          onClose={() => { setShowModal(false); setEditingExpense(null) }}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  )
}
