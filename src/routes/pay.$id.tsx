/**
 * Public invoice payment page — /pay/:id
 * No auth required. Shows invoice details + Pay button (Stripe Checkout).
 */
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/pay/$id')({ component: PayPage })

type PublicInvoice = {
  id: string
  invoice_number: string
  brand: string
  brand_name: string
  contact_name: string
  line_items: { id: string; description: string; quantity: number; unit_price: number }[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: string
  due_date?: string
  notes?: string
  created_at: string
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PayPage() {
  const { id } = Route.useParams()
  // Check for ?paid=1 redirect from Stripe
  const paid = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paid') === '1'

  const { data: invoice, isLoading, isError } = useQuery<PublicInvoice>({
    queryKey: ['pay', id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}/public`)
      if (!res.ok) throw new Error('Invoice not found')
      return res.json()
    },
  })

  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const handlePay = async () => {
    setPaying(true)
    setPayError(null)
    try {
      const res = await fetch(`/api/invoices/${id}/checkout`, { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setPayError(data.error ?? 'Could not start checkout')
        setPaying(false)
      }
    } catch {
      setPayError('Network error — please try again')
      setPaying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading invoice…</p>
      </div>
    )
  }

  if (isError || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-800">Invoice not found</p>
          <p className="mt-1 text-sm text-gray-400">This payment link may have expired or been removed.</p>
        </div>
      </div>
    )
  }

  const alreadyPaid = invoice.status === 'paid' || paid

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-lg">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{invoice.brand_name}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Invoice header */}
          <div className="border-b border-gray-100 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400">Invoice</p>
                <p className="text-lg font-bold text-gray-900">{invoice.invoice_number}</p>
                <p className="mt-1 text-sm text-gray-500">To: {invoice.contact_name}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  alreadyPaid ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'
                }`}
              >
                {alreadyPaid ? '✓ Paid' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
            {invoice.due_date && (
              <p className="mt-2 text-xs text-gray-400">
                Due: {new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Line items */}
          <div className="px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-400">Description</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-400">Qty</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-400">Price</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map(li => (
                  <tr key={li.id} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-700">{li.description}</td>
                    <td className="py-2.5 text-right text-gray-500">{li.quantity}</td>
                    <td className="py-2.5 text-right text-gray-500">${fmt(li.unit_price)}</td>
                    <td className="py-2.5 text-right font-medium text-gray-800">${fmt(li.quantity * li.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>${fmt(invoice.subtotal)}</span>
              </div>
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({invoice.tax_rate}%)</span>
                  <span>${fmt(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
                <span>Total</span>
                <span className="text-lg">${fmt(invoice.total)}</span>
              </div>
            </div>

            {invoice.notes && (
              <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">{invoice.notes}</p>
            )}
          </div>

          {/* CTA */}
          <div className="border-t border-gray-100 px-6 py-5">
            {alreadyPaid ? (
              <div className="flex flex-col items-center gap-1 py-2 text-center">
                <span className="text-2xl">✅</span>
                <p className="font-semibold text-gray-800">Payment received — thank you!</p>
                <p className="text-xs text-gray-400">Your payment for this invoice has been processed.</p>
              </div>
            ) : (
              <>
                {payError && (
                  <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{payError}</div>
                )}
                <button
                  onClick={() => void handlePay()}
                  disabled={paying}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {paying ? 'Redirecting to checkout…' : `Pay $${fmt(invoice.total)}`}
                </button>
                <p className="mt-2 text-center text-[10px] text-gray-400">Secured by Stripe</p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-gray-300">{invoice.brand_name}</p>
      </div>
    </div>
  )
}
