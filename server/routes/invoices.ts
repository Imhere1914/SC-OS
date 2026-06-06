import type { Hono } from 'hono'
import {
  createInvoice,
  deleteInvoice,
  listInvoices,
  updateInvoice,
} from '../stores/invoices-store'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerInvoices(app: Hono) {
  // List
  app.get('/api/invoices', (c) => {
    const brand = c.req.query('brand')
    return c.json(listInvoices(brand))
  })

  // Create
  app.post('/api/invoices', async (c) => {
    const body = await c.req.json()
    if (!body.contact_name?.trim()) return c.json({ error: 'contact_name required' }, 400)
    if (!Array.isArray(body.line_items) || body.line_items.length === 0)
      return c.json({ error: 'at least one line item required' }, 400)
    const invoice = createInvoice(body)
    // Log activity if contact_id present
    if (invoice.contact_id) {
      appendActivity({ contact_id: invoice.contact_id, type: 'invoice_created', description: `Invoice ${invoice.invoice_number} created ($${invoice.total.toFixed(2)})` })
    }
    appendNotification({ brand: BRAND, message: `Invoice ${invoice.invoice_number} created`, context_summary: `${invoice.contact_name} · $${invoice.total.toFixed(2)}` })
    return c.json(invoice, 201)
  })

  // Update (status, line items, etc.)
  app.patch('/api/invoices/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand')
    const prev = listInvoices(brand).find(i => i.id === id)
    const updated = updateInvoice(id, body, brand)
    if (!updated) return c.json({ error: 'not found' }, 404)
    // Log paid event
    if (prev && prev.status !== 'paid' && updated.status === 'paid') {
      if (updated.contact_id) {
        appendActivity({ contact_id: updated.contact_id, type: 'invoice_paid', description: `Invoice ${updated.invoice_number} marked paid ($${updated.total.toFixed(2)})` })
      }
      appendNotification({ brand: BRAND, message: `Invoice paid: ${updated.invoice_number}`, context_summary: `${updated.contact_name} · $${updated.total.toFixed(2)}` })
    }
    return c.json(updated)
  })

  // Delete
  app.delete('/api/invoices/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = deleteInvoice(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })
}
