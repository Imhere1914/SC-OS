const API = '/api/recurring-invoices'

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurringInvoiceLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
}

export interface RecurringInvoice {
  id: string
  brand?: string
  contact_id?: string
  contact_name: string
  contact_email?: string
  line_items: RecurringInvoiceLineItem[]
  tax_rate: number
  notes?: string
  frequency: RecurrenceFrequency
  next_invoice_at: string
  last_invoiced_at?: string
  status: 'active' | 'paused'
  created_at: string
  updated_at: string
}

export async function listRecurringInvoices(brand?: string): Promise<RecurringInvoice[]> {
  const url = brand ? `${API}?brand=${brand}` : API
  const res = await fetch(url)
  const d = (await res.json()) as { recurring_invoices?: RecurringInvoice[] }
  return d.recurring_invoices ?? []
}

export async function createRecurringInvoice(
  data: Partial<RecurringInvoice>,
): Promise<RecurringInvoice> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<RecurringInvoice>
}

export async function updateRecurringInvoice(
  id: string,
  data: Partial<RecurringInvoice>,
): Promise<RecurringInvoice> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<RecurringInvoice>
}

export async function deleteRecurringInvoice(id: string): Promise<void> {
  await fetch(`${API}/${id}`, { method: 'DELETE' })
}
