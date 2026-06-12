import type { Hono } from 'hono'
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../stores/products-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerProducts(app: Hono) {
  // GET /api/products?active=true&category=...
  app.get('/api/products', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const activeParam = c.req.query('active')
    const category = c.req.query('category') || undefined
    const active = activeParam === 'true' ? true : activeParam === 'false' ? false : undefined
    const products = listProducts(brand, { active, category })
    return c.json({ products })
  })

  // GET /api/products/:id
  app.get('/api/products/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const product = getProduct(brand, c.req.param('id'))
    if (!product) return c.json({ error: 'not found' }, 404)
    return c.json(product)
  })

  // POST /api/products
  app.post('/api/products', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json() as {
      name?: string
      description?: string
      unit_price_cents?: number
      category?: string
      sku?: string
      taxable?: boolean
      active?: boolean
    }
    if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
    if (body.unit_price_cents === undefined || typeof body.unit_price_cents !== 'number' || body.unit_price_cents < 0) {
      return c.json({ error: 'unit_price_cents must be a non-negative number' }, 400)
    }
    const product = createProduct(brand, {
      name: body.name.trim(),
      description: body.description,
      unit_price_cents: Math.round(body.unit_price_cents),
      category: body.category,
      sku: body.sku,
      taxable: body.taxable,
      active: body.active,
    })
    return c.json(product, 201)
  })

  // PATCH /api/products/:id
  app.patch('/api/products/:id', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const body = await c.req.json()
    // Ensure unit_price_cents is rounded integer if provided
    if (body.unit_price_cents !== undefined) {
      body.unit_price_cents = Math.round(Number(body.unit_price_cents))
    }
    const product = updateProduct(brand, id, body)
    if (!product) return c.json({ error: 'not found' }, 404)
    return c.json(product)
  })

  // DELETE /api/products/:id
  app.delete('/api/products/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const ok = deleteProduct(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })
}
