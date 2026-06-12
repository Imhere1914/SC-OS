import type { Hono } from 'hono'
import {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
} from '../stores/vendors-store'

export function registerVendors(app: Hono) {
  // List
  app.get('/api/vendors', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const isActiveParam = c.req.query('is_active')
    const opts = isActiveParam !== undefined ? { is_active: isActiveParam === 'true' } : undefined
    return c.json(listVendors(brand, opts))
  })

  // Single
  app.get('/api/vendors/:id', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const vendor = getVendor(brand, c.req.param('id'))
    if (!vendor) return c.json({ error: 'not found' }, 404)
    return c.json(vendor)
  })

  // Create
  app.post('/api/vendors', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const body = await c.req.json()
    if (!body.name?.trim()) return c.json({ error: 'name required' }, 400)
    const vendor = createVendor(brand, body)
    return c.json(vendor, 201)
  })

  // Update
  app.patch('/api/vendors/:id', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const body = await c.req.json()
    const updated = updateVendor(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // Delete
  app.delete('/api/vendors/:id', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const ok = deleteVendor(brand, c.req.param('id'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })
}
