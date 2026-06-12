import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import {
  Add01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  FileEditIcon,
  Invoice01Icon,
  LinkSquare02Icon,
  Mail02Icon,
  Money01Icon,
  PencilEdit02Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  createInvoice,
  deleteInvoice,
  fetchInvoices,
  formatCurrency,
  updateInvoice,
} from '@/lib/invoices-api'
import type {
  CreateInvoiceInput,
  InvoiceRecord,
  InvoiceStatus,
  LineItem,
} from '@/lib/invoices-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'invoices'] as const

type StatusFilter = 'all' | InvoiceStatus

function newLineItem(): Omit<LineItem, 'id'> {
  return { description: '', quantity: 1, unit_price: 0 }
}

type LineItemDraft = Omit<LineItem, 'id'> & { _key: string }

// ── Design tokens (shared vocabulary with Payroll / Mission Control) ─────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

function isOverdue(inv: InvoiceRecord): boolean {
  return inv.status === 'sent' && !!inv.due_date && new Date(inv.due_date).getTime() < Date.now()
}

// Status as colored dot + soft tinted badge; overdue rendered red
function InvoiceStatusBadge({ invoice }: { invoice: InvoiceRecord }) {
  const overdue = isOverdue(invoice)
  const color = overdue ? '#ef4444' : invoice.status === 'draft' ? '#94a3b8' : STATUS_COLORS[invoice.status]
  const label = overdue ? 'Overdue' : STATUS_LABELS[invoice.status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
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

// Gradient-accented stat card
function StatCard({ label, value, sub, color, icon }: {
  label: string
  value: string
  sub?: string
  color: string
  icon: typeof Money01Icon
}) {
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

// ── Invoice dialog ───────────────────────────────────────────────────────────
function InvoiceDialog({
  open,
  invoice,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  invoice?: InvoiceRecord | null
  onClose: () => void
  onSubmit: (data: CreateInvoiceInput) => void
  isSubmitting: boolean
}) {
  const isEdit = !!invoice
  const [contactName, setContactName] = useState(invoice?.contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(invoice?.contact_email ?? '')
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? '')
  const [notes, setNotes] = useState(invoice?.notes ?? '')
  const [taxRate, setTaxRate] = useState(invoice?.tax_rate ?? 0)
  const [items, setItems] = useState<LineItemDraft[]>(
    invoice?.line_items.map((li) => ({ ...li, _key: li.id })) ??
      [{ ...newLineItem(), _key: crypto.randomUUID() }],
  )

  useMemo(() => {
    if (open) {
      setContactName(invoice?.contact_name ?? '')
      setContactEmail(invoice?.contact_email ?? '')
      setDueDate(invoice?.due_date ?? '')
      setNotes(invoice?.notes ?? '')
      setTaxRate(invoice?.tax_rate ?? 0)
      setItems(
        invoice?.line_items.map((li) => ({ ...li, _key: li.id })) ??
          [{ ...newLineItem(), _key: crypto.randomUUID() }],
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const taxAmt = subtotal * (taxRate / 100)
  const total = subtotal + taxAmt

  const updateItem = (key: string, patch: Partial<Omit<LineItemDraft, '_key'>>) =>
    setItems((prev) => prev.map((li) => li._key === key ? { ...li, ...patch } : li))

  const removeItem = (key: string) =>
    setItems((prev) => prev.filter((li) => li._key !== key))

  const addItem = () =>
    setItems((prev) => [...prev, { ...newLineItem(), _key: crypto.randomUUID() }])

  const handleSubmit = () => {
    const validItems = items.filter((i) => i.description.trim())
    if (!validItems.length) { toast('Add at least one line item', { type: 'error' }); return }
    onSubmit({
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim() || undefined,
      line_items: validItems.map(({ _key: _, ...li }) => li),
      due_date: dueDate || undefined,
      notes: notes.trim() || undefined,
      tax_rate: taxRate,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      style={{ backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Invoice01Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">
              {isEdit ? 'Edit Invoice' : 'New Invoice'}
            </h2>
            <p className="text-[11px] text-[var(--theme-muted)]">
              {isEdit ? invoice?.invoice_number : 'Bill a client for products or services'}
            </p>
          </div>
        </div>

        <div className="p-5">
          {/* Contact */}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Client &amp; Terms</p>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Client name *</label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Client email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Tax rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
          </div>

          {/* Line items */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Line items</label>
              <button
                onClick={addItem}
                className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-accent)] transition-colors hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)]"
              >
                <HugeiconsIcon icon={Add01Icon} size={10} /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item._key} className="flex items-center gap-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item._key, { description: e.target.value })}
                    placeholder="Description"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item._key, { quantity: Number(e.target.value) })}
                    className="w-14 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-center text-xs tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    title="Quantity"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(item._key, { unit_price: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-right text-xs tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    title="Unit price"
                  />
                  <button
                    onClick={() => removeItem(item._key)}
                    disabled={items.length <= 1}
                    className="rounded-lg p-1 transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-30"
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={12} style={{ color: 'var(--theme-danger)' }} />
                  </button>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div
              className="mt-3 space-y-1 rounded-xl border p-3 text-xs"
              style={{
                borderColor: 'color-mix(in srgb, var(--theme-accent) 25%, var(--theme-border))',
                background: 'color-mix(in srgb, var(--theme-accent) 5%, var(--theme-card))',
              }}
            >
              <div className="flex justify-between text-[var(--theme-muted)]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-[var(--theme-muted)]">
                  <span>Tax ({taxRate}%)</span>
                  <span className="tabular-nums">{formatCurrency(taxAmt)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 text-[13px] font-bold text-[var(--theme-text)]" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 25%, var(--theme-border))' }}>
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Payment terms, bank details, etc."
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!contactName.trim() || isSubmitting}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────
export function PaymentsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<InvoiceRecord | null>(null)

  const invoicesQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchInvoices({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      createInvoice({ ...input, brand: brand.id !== 'hermes' ? brand.id : undefined }),
    onSuccess: () => { invalidate(); toast('Invoice created'); setShowCreate(false) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to create', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<InvoiceRecord> | CreateInvoiceInput }) =>
      updateInvoice(p.id, p.updates as Partial<InvoiceRecord>),
    onSuccess: () => { invalidate(); toast('Invoice updated'); setEditing(null) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => { invalidate(); toast('Invoice deleted') },
  })

  const allInvoices = invoicesQuery.data ?? []

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return allInvoices
    return allInvoices.filter((i) => i.status === statusFilter)
  }, [allInvoices, statusFilter])

  // Stats
  const stats = useMemo(() => {
    const paid = allInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)
    const outstanding = allInvoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0)
    const draft = allInvoices.filter((i) => i.status === 'draft').length
    return { paid, outstanding, draft }
  }, [allInvoices])

  const markAs = (invoice: InvoiceRecord, status: InvoiceStatus) => {
    updateMutation.mutate({ id: invoice.id, updates: { status } })
  }

  const STATUS_FILTERS: StatusFilter[] = ['all', 'draft', 'sent', 'paid', 'void']

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Money01Icon} size={18} className="text-white" />
            </span>
            <div>
              <h1 className="text-[22px] font-bold leading-tight text-[var(--theme-text)]">Payments</h1>
              <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">
                {invoicesQuery.data
                  ? `${allInvoices.length} invoice${allInvoices.length !== 1 ? 's' : ''} · track billing and payments`
                  : 'Track billing and payments'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className={primaryBtnCls} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={14} />
            New Invoice
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Paid"
            value={formatCurrency(stats.paid)}
            sub="collected revenue"
            color="#10b981"
            icon={CheckmarkCircle01Icon}
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(stats.outstanding)}
            sub="awaiting payment"
            color="#3b82f6"
            icon={Clock01Icon}
          />
          <StatCard
            label="Drafts"
            value={String(stats.draft)}
            sub="not yet sent"
            color="#94a3b8"
            icon={FileEditIcon}
          />
        </div>

        {/* Status filter — segmented control */}
        <div className="flex w-fit gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all',
                statusFilter === s ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
              )}
              style={statusFilter === s ? {
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
              } : undefined}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
              <span className="ml-1 opacity-60 tabular-nums">
                {s === 'all' ? allInvoices.length : allInvoices.filter((i) => i.status === s).length}
              </span>
            </button>
          ))}
        </div>

        {/* Invoice list */}
        <div className="space-y-2">
          {invoicesQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border bg-[var(--theme-card)]"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl border py-14 text-center"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={Invoice01Icon} size={22} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--theme-text)]">
                No invoices{statusFilter !== 'all' ? ` with status "${STATUS_LABELS[statusFilter as InvoiceStatus]}"` : ''}
              </p>
              <p className="text-[11px] text-[var(--theme-muted)]">Create invoices and track payments from clients.</p>
              <button onClick={() => setShowCreate(true)} className={cn(primaryBtnCls, 'mt-2')} style={primaryBtnStyle}>
                <HugeiconsIcon icon={Add01Icon} size={13} /> New Invoice
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((inv) => {
                const overdue = isOverdue(inv)
                return (
                  <motion.div
                    key={inv.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="group rounded-xl border p-4 transition-all hover:-translate-y-px hover:shadow-md"
                    style={{
                      background: 'var(--theme-card)',
                      borderColor: overdue
                        ? 'color-mix(in srgb, #ef4444 30%, var(--theme-border))'
                        : 'var(--theme-border)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <InvoiceStatusBadge invoice={inv} />
                          <span className="font-mono text-[11px] text-[var(--theme-muted)]">{inv.invoice_number}</span>
                          <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">{inv.contact_name}</h3>
                        </div>
                        <p className="text-[20px] font-bold leading-none tabular-nums text-[var(--theme-text)]">
                          {formatCurrency(inv.total)}
                        </p>
                        <p className="mt-1.5 text-[11px] text-[var(--theme-muted)]">
                          {inv.line_items.length} item{inv.line_items.length !== 1 ? 's' : ''}
                          {inv.due_date && (
                            <>
                              {' · '}
                              <span className={overdue ? 'font-semibold text-red-500' : undefined}>
                                Due {new Date(inv.due_date).toLocaleDateString()}
                              </span>
                            </>
                          )}
                          {inv.paid_at && (
                            <>
                              {' · '}
                              <span style={{ color: '#10b981' }}>Paid {new Date(inv.paid_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => markAs(inv, 'sent')}
                            className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]"
                            title="Mark as sent"
                          >
                            <HugeiconsIcon icon={Mail02Icon} size={11} />
                            Send
                          </button>
                        )}
                        {inv.status !== 'paid' && inv.status !== 'void' && (
                          <button
                            onClick={() => {
                              const link = `${location.origin}/pay/${inv.id}`
                              void navigator.clipboard.writeText(link)
                              toast('Payment link copied')
                            }}
                            className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-accent)] transition-colors hover:border-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)]"
                            title="Copy payment link for client"
                          >
                            <HugeiconsIcon icon={LinkSquare02Icon} size={11} />
                            Pay link
                          </button>
                        )}
                        {inv.status === 'sent' && (
                          <button
                            onClick={() => markAs(inv, 'paid')}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors"
                            style={{
                              color: '#10b981',
                              borderColor: 'color-mix(in srgb, #10b981 30%, transparent)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #10b981 12%, var(--theme-card))' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            title="Mark as paid"
                          >
                            <HugeiconsIcon icon={Tick02Icon} size={11} />
                            Paid
                          </button>
                        )}
                        <Link
                          to="/invoices/$id"
                          params={{ id: inv.id }}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                          title="View / Print"
                          onClick={e => e.stopPropagation()}
                        >
                          <HugeiconsIcon icon={Invoice01Icon} size={14} className="text-[var(--theme-muted)]" />
                        </Link>
                        <button
                          onClick={() => setEditing(inv)}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                          title="Edit"
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} size={14} className="text-[var(--theme-muted)]" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete invoice ${inv.invoice_number}?`)) deleteMutation.mutate(inv.id) }}
                          className="rounded-lg p-1.5 transition-colors"
                          onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          title="Delete"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={14} style={{ color: 'var(--theme-danger)' }} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      <InvoiceDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />
      <InvoiceDialog
        open={editing !== null}
        invoice={editing}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (editing) updateMutation.mutate({ id: editing.id, updates: data })
        }}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}
