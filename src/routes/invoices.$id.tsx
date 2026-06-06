/**
 * Invoice print/detail page — /invoices/:id
 * A print-friendly invoice view with download/print button.
 * Accessible from the Payments screen.
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, PrinterIcon } from '@hugeicons/core-free-icons'
import { fetchInvoices, formatCurrency, STATUS_LABELS, STATUS_COLORS, STATUS_BG } from '@/lib/invoices-api'
import { useBrand } from '@/contexts/BrandContext'

export const Route = createFileRoute('/invoices/$id')({ component: InvoicePrint })

function InvoicePrint() {
  const { id } = Route.useParams()
  const brand = useBrand()

  const invoiceQuery = useQuery({
    queryKey: ['invoice-print', id],
    queryFn: async () => {
      const list = await fetchInvoices()
      return list.find(i => i.id === id) ?? null
    },
  })

  const inv = invoiceQuery.data

  if (invoiceQuery.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--theme-muted)]">Loading…</div>
  }
  if (!inv) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-400">Invoice not found</p>
        <Link to="/payments" className="text-xs text-[var(--theme-accent)] hover:underline">← Back to Payments</Link>
      </div>
    )
  }

  const accentColor = brand.accentColor

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b]">
      {/* Toolbar — hidden on print */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <Link to="/payments" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={12} /> Payments
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-xs font-semibold text-slate-700">{inv.invoice_number}</span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase"
            style={{ background: STATUS_BG[inv.status as keyof typeof STATUS_BG], color: STATUS_COLORS[inv.status as keyof typeof STATUS_COLORS] }}
          >
            {STATUS_LABELS[inv.status as keyof typeof STATUS_LABELS]}
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <HugeiconsIcon icon={PrinterIcon} size={13} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Invoice paper */}
      <div className="mx-auto my-8 max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:my-0 print:rounded-none print:border-0 print:shadow-none">
        {/* Brand header strip */}
        <div
          className="px-8 py-6"
          style={{ background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 65%, #7b3fe4))` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-white">{brand.name}</p>
              <p className="text-xs text-white/70">AI Operating System</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black tracking-tight text-white">{inv.invoice_number}</p>
              <p className="text-xs text-white/70 uppercase tracking-wider">Invoice</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Bill to + dates */}
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bill To</p>
              <p className="text-sm font-bold text-slate-800">{inv.contact_name}</p>
              {inv.contact_email && <p className="text-xs text-slate-500">{inv.contact_email}</p>}
            </div>
            <div className="text-right">
              <div className="mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date Issued</p>
                <p className="text-sm text-slate-700">{new Date(inv.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              {inv.due_date && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Due Date</p>
                  <p className="text-sm text-slate-700">{new Date(inv.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Description</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Qty</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Unit Price</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.line_items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{item.description}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-56 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(inv.subtotal)}</span>
              </div>
              {inv.tax_rate > 0 && (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Tax ({inv.tax_rate}%)</span>
                  <span>{formatCurrency(inv.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between rounded-lg px-2 py-2 font-bold" style={{ background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}>
                <span style={{ color: accentColor }}>Total</span>
                <span className="text-base" style={{ color: accentColor }}>{formatCurrency(inv.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
              <p className="text-xs text-slate-600">{inv.notes}</p>
            </div>
          )}

          {/* Status footer */}
          {inv.status === 'paid' && inv.paid_at && (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-green-50 py-3">
              <span className="text-sm font-bold text-green-600">✓ Paid</span>
              <span className="text-xs text-green-500">{new Date(inv.paid_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
