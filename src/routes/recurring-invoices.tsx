import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listRecurringInvoices,
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  type RecurringInvoice,
  type RecurringInvoiceLineItem,
  type RecurrenceFrequency,
} from '../lib/recurring-invoices-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  Add01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  Cancel01Icon,
  RepeatIcon,
  MoneyBag02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/recurring-invoices')({ component: RecurringInvoicesPage })

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ──

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

// ── Helpers ───────────────────────────────────────────────────────────────────

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

// Cadence pill colors
const FREQUENCY_COLORS: Record<RecurrenceFrequency, string> = {
  weekly: '#0ea5e9',
  monthly: '#3b82f6',
  quarterly: '#8b5cf6',
  yearly: '#f97316',
}

// Cycles per month, for the MRR-style normalized total
const CYCLES_PER_MONTH: Record<RecurrenceFrequency, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function calcTotal(items: RecurringInvoiceLineItem[], taxRate: number): number {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  return subtotal * (1 + taxRate / 100)
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function CadencePill({ frequency }: { frequency: RecurrenceFrequency }) {
  const color = FREQUENCY_COLORS[frequency]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <HugeiconsIcon icon={RepeatIcon} size={10} />
      {FREQUENCY_LABELS[frequency]}
    </span>
  )
}

// ── Line items editor ─────────────────────────────────────────────────────────

function LineItemsEditor({
  items,
  onChange,
}: {
  items: RecurringInvoiceLineItem[]
  onChange: (items: RecurringInvoiceLineItem[]) => void
}) {
  function addItem() {
    onChange([...items, { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 }])
  }
  function removeItem(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function updateItem(i: number, patch: Partial<RecurringInvoiceLineItem>) {
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_60px_88px_28px] gap-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Description</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-center">Qty</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-right">Unit price</span>
        <span />
      </div>
      {items.map((item, i) => (
        <div key={item.id} className="grid grid-cols-[1fr_60px_88px_28px] gap-2 items-center">
          <input
            type="text"
            placeholder="Description"
            value={item.description}
            onChange={e => updateItem(i, { description: e.target.value })}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-1.5 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
          />
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={e => updateItem(i, { quantity: parseFloat(e.target.value) || 1 })}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-2 py-1.5 text-sm tabular-nums text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)] text-center"
          />
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={item.unit_price || ''}
            onChange={e => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-2 py-1.5 text-sm tabular-nums text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)] text-right"
          />
          <button
            onClick={() => removeItem(i)}
            className="flex items-center justify-center rounded-lg p-1 text-[var(--theme-muted)] transition-all duration-150 hover:text-[#ef4444]"
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--theme-border)] px-3 py-2 text-sm text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] transition-all duration-150 w-full justify-center"
      >
        <HugeiconsIcon icon={Add01Icon} size={14} /> Add line item
      </button>
    </div>
  )
}

// ── Recurring invoice modal ───────────────────────────────────────────────────

type ModalFormState = {
  contact_name: string
  contact_email: string
  frequency: RecurrenceFrequency
  line_items: RecurringInvoiceLineItem[]
  tax_rate: string
  notes: string
  next_invoice_at: string
}

function RecurringInvoiceModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: RecurringInvoice
  onClose: () => void
  onSave: (data: Partial<RecurringInvoice>) => void
}) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().slice(0, 10)

  const [form, setForm] = useState<ModalFormState>({
    contact_name: initial?.contact_name ?? '',
    contact_email: initial?.contact_email ?? '',
    frequency: initial?.frequency ?? 'monthly',
    line_items: initial?.line_items ?? [{ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 }],
    tax_rate: String(initial?.tax_rate ?? '0'),
    notes: initial?.notes ?? '',
    next_invoice_at: initial?.next_invoice_at ? initial.next_invoice_at.slice(0, 10) : defaultDate,
  })

  function set<K extends keyof ModalFormState>(key: K, val: ModalFormState[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const subtotal = form.line_items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const taxRate = parseFloat(form.tax_rate) || 0
  const total = subtotal * (1 + taxRate / 100)

  function handleSave() {
    if (!form.contact_name.trim() || form.line_items.length === 0) return
    onSave({
      contact_name: form.contact_name.trim(),
      contact_email: form.contact_email.trim() || undefined,
      frequency: form.frequency,
      line_items: form.line_items,
      tax_rate: taxRate,
      notes: form.notes.trim() || undefined,
      next_invoice_at: new Date(form.next_invoice_at).toISOString(),
    })
  }

  const inputCls =
    'rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]'
  const fieldLabelCls = 'text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-10 px-4 overflow-y-auto">
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl mb-12 motion-safe:animate-[fadeSlideIn_150ms_ease-out]"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={RepeatIcon} size={15} className="text-white" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">
                {initial ? 'Edit recurring invoice' : 'New recurring invoice'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Bill a client automatically on a schedule</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={fieldLabelCls}>Contact name *</label>
              <input
                placeholder="Jane Smith"
                value={form.contact_name}
                onChange={e => set('contact_name', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={fieldLabelCls}>Contact email</label>
              <input
                type="email"
                placeholder="jane@example.com"
                value={form.contact_email}
                onChange={e => set('contact_email', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Frequency + next date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={fieldLabelCls}>Frequency</label>
              <select
                value={form.frequency}
                onChange={e => set('frequency', e.target.value as RecurrenceFrequency)}
                className={inputCls}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={fieldLabelCls}>Next invoice date</label>
              <input
                type="date"
                value={form.next_invoice_at}
                onChange={e => set('next_invoice_at', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Line items */}
          <div className="flex flex-col gap-2">
            <label className={fieldLabelCls}>Line items</label>
            <LineItemsEditor
              items={form.line_items}
              onChange={items => set('line_items', items)}
            />
          </div>

          {/* Tax rate + totals */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className={fieldLabelCls}>Tax rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                placeholder="0"
                value={form.tax_rate}
                onChange={e => set('tax_rate', e.target.value)}
                className="w-20 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-2 py-1.5 text-sm tabular-nums text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)] text-center"
              />
            </div>
            <div className="text-right">
              <p className="text-xs tabular-nums text-[var(--theme-muted)]">
                Subtotal: {fmtCurrency(subtotal)}
                {taxRate > 0 && <> · Tax: {fmtCurrency(subtotal * taxRate / 100)}</>}
              </p>
              <p className="text-sm font-semibold tabular-nums text-[var(--theme-text)]">
                Total: {fmtCurrency(total)} / {FREQUENCY_LABELS[form.frequency].toLowerCase()}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className={fieldLabelCls}>Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes for the invoice"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.contact_name.trim() || form.line_items.length === 0}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function RecurringInvoicesPage() {
  const brand = useBrand()
  const qc = useQueryClient()

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['recurring-invoices', brand.id],
    queryFn: () => listRecurringInvoices(brand.id),
  })

  // undefined = modal closed, null = creating new, Recurring invoice = editing
  const [editing, setEditing] = useState<RecurringInvoice | null | undefined>(undefined)

  const createMutation = useMutation({
    mutationFn: (data: Partial<RecurringInvoice>) =>
      createRecurringInvoice({ ...data, brand: brand.id, status: 'active' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recurring-invoices', brand.id] })
      setEditing(undefined)
      toast('Recurring invoice created')
    },
    onError: () => toast('Failed to create recurring invoice'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RecurringInvoice> }) =>
      updateRecurringInvoice(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recurring-invoices', brand.id] })
      setEditing(undefined)
      toast('Saved')
    },
    onError: () => toast('Failed to save'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecurringInvoice(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['recurring-invoices', brand.id] }),
    onError: () => toast('Failed to delete'),
  })

  function handleSave(data: Partial<RecurringInvoice>) {
    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  function toggleStatus(inv: RecurringInvoice) {
    const next = inv.status === 'active' ? 'paused' : 'active'
    updateMutation.mutate(
      { id: inv.id, data: { status: next } },
    )
    toast(next === 'active' ? 'Resumed' : 'Paused')
  }

  // MRR-style monthly-normalized total across active schedules (display only)
  const activeInvoices = invoices.filter(inv => inv.status === 'active')
  const mrr = activeInvoices.reduce(
    (s, inv) => s + calcTotal(inv.line_items, inv.tax_rate) * CYCLES_PER_MONTH[inv.frequency],
    0,
  )

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={RepeatIcon} size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Recurring Billing</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">
              Automatically generate invoices on a set schedule · <span className="tabular-nums">{invoices.length}</span> schedule{invoices.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => setEditing(null)} className={primaryBtnCls} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={16} /> New recurring invoice
        </button>
      </div>

      {/* MRR stat card */}
      {!isLoading && invoices.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:max-w-sm">
          <div
            className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
          >
            <div
              className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
              style={{ background: 'linear-gradient(180deg, #10b981, color-mix(in srgb, #10b981 40%, transparent))' }}
            />
            <div className="pl-1.5">
              <span
                className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, #10b981, color-mix(in srgb, #10b981 65%, #000))',
                  boxShadow: '0 2px 8px color-mix(in srgb, #10b981 35%, transparent)',
                }}
              >
                <HugeiconsIcon icon={MoneyBag02Icon} size={15} className="text-white" />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Monthly recurring revenue</p>
              <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{fmtCurrency(mrr)}</p>
              <p className="mt-1 text-[11px] text-[var(--theme-muted)]">
                <span className="tabular-nums">{activeInvoices.length}</span> active schedule{activeInvoices.length !== 1 ? 's' : ''}, normalized monthly
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-[var(--theme-border)]"
              style={{ background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }}
            />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={RepeatIcon} size={26} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-[var(--theme-text)]">No recurring invoices yet</p>
          <p className="text-xs text-[var(--theme-muted)] max-w-xs">
            Set up a recurring invoice to automatically bill clients on a regular schedule
          </p>
          <button onClick={() => setEditing(null)} className={`mt-2 ${primaryBtnCls}`} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={14} /> Create first invoice
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_110px_130px_110px_90px_104px] gap-4 px-5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            <span>Contact</span>
            <span>Cadence</span>
            <span>Next invoice</span>
            <span className="text-right">Per cycle</span>
            <span className="text-center">Active</span>
            <span className="text-right">Actions</span>
          </div>

          {invoices.map(inv => {
            const total = calcTotal(inv.line_items, inv.tax_rate)
            const isActive = inv.status === 'active'

            return (
              <div
                key={inv.id}
                className="group grid grid-cols-[1fr_110px_130px_110px_90px_104px] gap-4 items-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md hover:border-[color-mix(in_srgb,var(--theme-accent)_45%,var(--theme-border))]"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                {/* Contact */}
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--theme-text)] truncate">{inv.contact_name}</p>
                  {inv.contact_email && (
                    <p className="text-xs text-[var(--theme-muted)] truncate">{inv.contact_email}</p>
                  )}
                  {inv.last_invoiced_at && (
                    <p className="text-[11px] text-[var(--theme-muted)] opacity-70">
                      Last sent {fmtDate(inv.last_invoiced_at)}
                    </p>
                  )}
                </div>

                {/* Cadence pill */}
                <span>
                  <CadencePill frequency={inv.frequency} />
                </span>

                {/* Next invoice — prominent */}
                <div>
                  <p className="text-sm font-semibold tabular-nums text-[var(--theme-text)]">
                    {fmtDate(inv.next_invoice_at)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--theme-muted)]">next run</p>
                </div>

                {/* Per cycle */}
                <span className="text-[15px] font-bold tabular-nums text-[var(--theme-text)] text-right">
                  {fmtCurrency(total)}
                </span>

                {/* Active toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleStatus(inv)}
                    title={isActive ? 'Pause' : 'Resume'}
                    className="relative h-5 w-9 rounded-full transition-colors duration-150"
                    style={{ background: isActive ? '#10b981' : 'var(--theme-border)' }}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${isActive ? 'translate-x-4' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                  {/* Edit */}
                  <button
                    onClick={() => setEditing(inv)}
                    title="Edit"
                    className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} size={15} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm(`Delete recurring invoice for "${inv.contact_name}"?`)) {
                        deleteMutation.mutate(inv.id)
                      }
                    }}
                    title="Delete"
                    className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[#ef4444]"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {editing !== undefined && (
        <RecurringInvoiceModal
          initial={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
