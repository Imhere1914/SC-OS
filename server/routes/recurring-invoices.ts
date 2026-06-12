import type { Hono } from 'hono'
import {
  listRecurringInvoices,
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
} from '../stores/invoices-store'
import { appendNotification } from '../stores/notifications-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerRecurringInvoices(app: Hono) {
  // List
  app.get('/api/recurring-invoices', (c) => {
    const brand = c.req.query('brand')
    return c.json(listRecurringInvoices(brand))
  })

  // Create
  app.post('/api/recurring-invoices', async (c) => {
    const body = await c.req.json()
    if (!body.contact_name?.trim()) return c.json({ error: 'contact_name required' }, 400)
    if (!Array.isArray(body.line_items) || body.line_items.length === 0)
      return c.json({ error: 'at least one line item required' }, 400)
    if (!body.frequency) return c.json({ error: 'frequency required' }, 400)

    const record = createRecurringInvoice(body)
    appendNotification({
      brand: BRAND,
      message: `Recurring invoice created for ${record.contact_name}`,
      context_summary: `Frequency: ${record.frequency} · Next: ${record.next_invoice_at.slice(0, 10)}`,
    })
    return c.json(record, 201)
  })

  // Update (status, frequency, next_invoice_at, etc.)
  app.patch('/api/recurring-invoices/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand')
    const updated = updateRecurringInvoice(id, body, brand)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // Delete
  app.delete('/api/recurring-invoices/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = deleteRecurringInvoice(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })
}
