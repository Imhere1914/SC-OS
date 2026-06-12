import type { Hono } from 'hono'
import {
  listBills,
  getBill,
  createBill,
  updateBill,
  deleteBill,
  recordBillPayment,
  voidBill,
  getBillSummary,
  type BillStatus,
} from '../stores/bills-store'

export function registerBills(app: Hono) {
  // Summary
  app.get('/api/bills/summary', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    return c.json(getBillSummary(brand))
  })

  // List
  app.get('/api/bills', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const status = c.req.query('status') as BillStatus | undefined
    const vendor_id = c.req.query('vendor_id')
    const from = c.req.query('from')
    const to = c.req.query('to')
    return c.json(listBills(brand, { status, vendor_id, from, to }))
  })

  // Single
  app.get('/api/bills/:id', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const bill = getBill(brand, c.req.param('id'))
    if (!bill) return c.json({ error: 'not found' }, 404)
    return c.json(bill)
  })

  // Create
  app.post('/api/bills', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const body = await c.req.json()
    if (!body.vendor_name?.trim()) return c.json({ error: 'vendor_name required' }, 400)
    if (!body.due_date) return c.json({ error: 'due_date required' }, 400)
    if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
      return c.json({ error: 'at least one line item required' }, 400)
    }
    const bill = createBill(brand, body)
    return c.json(bill, 201)
  })

  // Update
  app.patch('/api/bills/:id', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const body = await c.req.json()
    const updated = updateBill(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // Delete
  app.delete('/api/bills/:id', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const result = deleteBill(brand, c.req.param('id'))
    if (!result.ok) return c.json({ error: result.error ?? 'not found' }, result.error === 'not found' ? 404 : 409)
    return c.json({ ok: true })
  })

  // Record payment
  app.post('/api/bills/:id/pay', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const body = await c.req.json()
    if (!body.amount_cents || body.amount_cents <= 0) return c.json({ error: 'amount_cents required' }, 400)
    if (!body.payment_date) return c.json({ error: 'payment_date required' }, 400)
    const updated = recordBillPayment(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'not found or bill is void' }, 404)
    return c.json(updated)
  })

  // Void
  app.post('/api/bills/:id/void', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const updated = voidBill(brand, c.req.param('id'))
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })
}
