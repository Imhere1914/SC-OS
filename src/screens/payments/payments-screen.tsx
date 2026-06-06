import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import {
  Add01Icon,
  Delete01Icon,
  Invoice01Icon,
  Mail02Icon,
  Money01Icon,
  PencilEdit02Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import {
  STATUS_BG,
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
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--theme-text)]">
          {isEdit ? 'Edit Invoice' : 'New Invoice'}
        </h2>

        {/* Contact */}
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
            <label className="text-[11px] font-medium text-[var(--theme-muted)]">Line items</label>
            <button
              onClick={addItem}
              className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-accent)] hover:bg-[var(--theme-hover)]"
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
                  className="w-14 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-center text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                  title="Quantity"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(item._key, { unit_price: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-right text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                  title="Unit price"
                />
                <button
                  onClick={() => removeItem(item._key)}
                  disabled={items.length <= 1}
                  className="rounded-lg p-1 hover:bg-[var(--theme-hover)] disabled:opacity-30"
                >
                  <HugeiconsIcon icon={Delete01Icon} size={12} style={{ color: 'var(--theme-danger)' }} />
                </button>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="mt-3 space-y-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-xs">
            <div className="flex justify-between text-[var(--theme-muted)]">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-[var(--theme-muted)]">
                <span>Tax ({taxRate}%)</span>
                <span>{formatCurrency(taxAmt)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--theme-border)] pt-1 font-semibold text-[var(--theme-text)]">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
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
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!contactName.trim() || isSubmitting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            {isSubmitting ? 'Saving…' : isEdit ? 'Update Invoice' : 'Create Invoice'}
          </button>
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
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Money01Icon} size={18} className="text-[var(--theme-accent)]" />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">Payments</h1>
              {invoicesQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">({allInvoices.length})</span>
              )}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--theme-accent)' }}
            >
              <HugeiconsIcon icon={Add01Icon} size={14} />
              New Invoice
            </button>
          </div>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { label: 'Total paid', value: formatCurrency(stats.paid), color: '#22c55e' },
              { label: 'Outstanding', value: formatCurrency(stats.outstanding), color: '#3b82f6' },
              { label: 'Drafts', value: String(stats.draft), color: 'var(--theme-muted)' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
                <p className="text-[11px] text-[var(--theme-muted)]">{s.label}</p>
                <p className="mt-0.5 text-base font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Status filter */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  statusFilter === s
                    ? 'border-transparent text-white'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={statusFilter === s ? { background: 'var(--theme-accent)' } : undefined}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
                <span className="ml-1 opacity-60">
                  ({s === 'all' ? allInvoices.length : allInvoices.filter((i) => i.status === s).length})
                </span>
              </button>
            ))}
          </div>
        </header>

        {/* Invoice list */}
        <div className="space-y-2">
          {invoicesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading invoices…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon icon={Invoice01Icon} size={32} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No invoices{statusFilter !== 'all' ? ` with status "${STATUS_LABELS[statusFilter as InvoiceStatus]}"` : ''}</p>
              <p className="mt-1 text-xs">Create invoices and track payments from clients.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((inv) => (
                <motion.div
                  key={inv.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{
                            background: STATUS_BG[inv.status],
                            color: STATUS_COLORS[inv.status],
                          }}
                        >
                          {STATUS_LABELS[inv.status]}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--theme-muted)]">{inv.invoice_number}</span>
                        <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">{inv.contact_name}</h3>
                      </div>
                      <p className="text-lg font-bold text-[var(--theme-text)]">{formatCurrency(inv.total)}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">
                        {inv.line_items.length} item{inv.line_items.length !== 1 ? 's' : ''}
                        {inv.due_date && ` · Due ${new Date(inv.due_date).toLocaleDateString()}`}
                        {inv.paid_at && ` · Paid ${new Date(inv.paid_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {inv.status === 'draft' && (
                        <button
                          onClick={() => markAs(inv, 'sent')}
                          className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
                          title="Mark as sent"
                        >
                          <HugeiconsIcon icon={Mail02Icon} size={11} />
                          Send
                        </button>
                      )}
                      {inv.status === 'sent' && (
                        <button
                          onClick={() => markAs(inv, 'paid')}
                          className="flex items-center gap-1 rounded-lg border border-green-500/30 px-2 py-1 text-[10px] font-medium text-green-600 hover:bg-green-500/10"
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
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                        title="Delete"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={14} style={{ color: 'var(--theme-danger)' }} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
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
