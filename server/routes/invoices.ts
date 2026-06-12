import type { Hono } from 'hono'
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  updateInvoice,
} from '../stores/invoices-store'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'
import { eventBus } from '../lib/event-bus'

const BRAND = process.env.BRAND ?? 'default'
const BRAND_NAME =
  BRAND === 'hfm' ? 'Holistic Functional Care'
  : BRAND === 'sc' ? 'Simple Connect'
  : 'AI OS'

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
    void eventBus.emit({
      type: 'invoice.created',
      brand: BRAND,
      entity_id: invoice.id,
      entity_type: 'invoice',
      data: { invoice_number: invoice.invoice_number, contact_name: invoice.contact_name, contact_email: invoice.contact_email ?? '', contact_id: invoice.contact_id ?? '', total: invoice.total, actor: 'user' },
      occurred_at: new Date().toISOString(),
    })
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
      void eventBus.emit({
        type: 'invoice.paid',
        brand: BRAND,
        entity_id: updated.id,
        entity_type: 'invoice',
        data: { invoice_number: updated.invoice_number, contact_name: updated.contact_name, contact_email: updated.contact_email ?? '', contact_id: updated.contact_id ?? '', total: updated.total, actor: 'user' },
        occurred_at: new Date().toISOString(),
      })
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

  // ── Public invoice view (no auth — returns safe subset) ─────────────────────
  app.get('/api/invoices/:id/public', (c) => {
    const invoice = getInvoice(c.req.param('id'))
    if (!invoice) return c.json({ error: 'not found' }, 404)
    // Return invoice without internal fields
    return c.json({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      brand: invoice.brand,
      brand_name: BRAND_NAME,
      contact_name: invoice.contact_name,
      line_items: invoice.line_items,
      subtotal: invoice.subtotal,
      tax_rate: invoice.tax_rate,
      tax_amount: invoice.tax_amount,
      total: invoice.total,
      status: invoice.status,
      due_date: invoice.due_date,
      notes: invoice.notes,
      created_at: invoice.created_at,
    })
  })

  // ── Create Stripe Checkout session for an invoice ────────────────────────────
  app.post('/api/invoices/:id/checkout', async (c) => {
    const invoice = getInvoice(c.req.param('id'))
    if (!invoice) return c.json({ error: 'not found' }, 404)
    if (invoice.status === 'paid') return c.json({ error: 'Invoice already paid' }, 409)

    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
    if (!stripeKey) {
      return c.json({ error: 'Stripe not configured — set STRIPE_SECRET_KEY' }, 502)
    }

    const origin = c.req.header('origin') ?? `https://${c.req.header('host') ?? 'localhost'}`
    const lineItems = invoice.line_items.map(li => ({
      price_data: {
        currency: 'usd',
        product_data: { name: li.description },
        unit_amount: Math.round(li.unit_price * 100),
      },
      quantity: li.quantity,
    }))

    // Add tax as a separate line item if applicable
    if (invoice.tax_amount > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `Tax (${invoice.tax_rate}%)` },
          unit_amount: Math.round(invoice.tax_amount * 100),
        },
        quantity: 1,
      })
    }

    // Build form-encoded body for Stripe line_items array
    const params = new URLSearchParams()
    params.set('mode', 'payment')
    params.set('success_url', `${origin}/pay/${invoice.id}?paid=1`)
    params.set('cancel_url', `${origin}/pay/${invoice.id}`)
    params.set('metadata[invoice_id]', invoice.id)
    params.set('metadata[invoice_number]', invoice.invoice_number)
    if (invoice.contact_email) params.set('customer_email', invoice.contact_email)
    lineItems.forEach((li, i) => {
      params.set(`line_items[${i}][price_data][currency]`, 'usd')
      params.set(`line_items[${i}][price_data][product_data][name]`, li.price_data.product_data.name)
      params.set(`line_items[${i}][price_data][unit_amount]`, String(li.price_data.unit_amount))
      params.set(`line_items[${i}][quantity]`, String(li.quantity))
    })

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await stripeRes.json() as { url?: string; error?: { message: string } }
    if (!stripeRes.ok || !data.url) {
      return c.json({ error: data.error?.message ?? 'Stripe error' }, 502)
    }
    return c.json({ url: data.url })
  })
}
