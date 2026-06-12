/**
 * Recurring invoice scheduler — runs every 60 seconds.
 * Finds active recurring invoice records with next_invoice_at <= now,
 * creates an invoice for each, then advances next_invoice_at.
 */
import {
  listRecurringInvoices,
  updateRecurringInvoice,
  createInvoice,
  addFrequencyInterval,
} from '../stores/invoices-store'
import { appendNotification } from '../stores/notifications-store'

const BRAND = process.env.BRAND ?? 'default'
const INTERVAL_MS = 60 * 1_000  // 60 seconds
let _started = false

export async function runDueRecurringInvoices(): Promise<void> {
  const now = new Date().toISOString()

  // Collect active records across all known brand scopes (brand-specific + brandless)
  const brandFile = BRAND !== 'default' ? BRAND : undefined
  const records = [
    ...listRecurringInvoices(brandFile),
    ...(brandFile ? listRecurringInvoices(undefined) : []),
  ]

  const due = records.filter(r => r.status === 'active' && r.next_invoice_at <= now)
  if (!due.length) return

  console.log(`[recurring-invoice-scheduler] Processing ${due.length} due recurring invoice(s)`)

  for (const record of due) {
    try {
      const invoice = createInvoice({
        brand: record.brand,
        contact_id: record.contact_id,
        contact_name: record.contact_name,
        contact_email: record.contact_email,
        line_items: record.line_items.map(({ id: _id, ...li }) => li),
        tax_rate: record.tax_rate,
        notes: record.notes,
        status: 'draft',
      })

      const nextAt = addFrequencyInterval(now, record.frequency)
      updateRecurringInvoice(record.id, {
        last_invoiced_at: now,
        next_invoice_at: nextAt,
      }, record.brand)

      appendNotification({
        brand: record.brand ?? BRAND,
        message: `Recurring invoice created: ${invoice.invoice_number}`,
        context_summary: `${record.contact_name} · $${invoice.total.toFixed(2)} · next: ${nextAt.slice(0, 10)}`,
      })

      console.log(`[recurring-invoice-scheduler] Created invoice ${invoice.invoice_number} for "${record.contact_name}" (recurring: ${record.id})`)
    } catch (err) {
      console.error(`[recurring-invoice-scheduler] Error processing recurring invoice ${record.id}:`, err)
    }
  }
}

export function startRecurringInvoiceScheduler(): void {
  if (_started) return
  _started = true
  console.log('[ai-os] Recurring invoice scheduler started (60 s interval)')
  void runDueRecurringInvoices()
  setInterval(() => void runDueRecurringInvoices(), INTERVAL_MS)
}
