import type { Hono } from 'hono'
import {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustStock,
  listStockMovements,
  getLowStockItems,
  getInventorySummary,
} from '../stores/inventory-store'
import type { StockMovementType } from '../stores/inventory-store'
import { getBrandId } from '../lib/brand'

export function registerInventory(app: Hono) {
  // GET /api/inventory — list items
  app.get('/api/inventory', (c) => {
    const brand = getBrandId(c)
    const search = c.req.query('search') || undefined
    const category = c.req.query('category') || undefined
    const lowStock = c.req.query('low_stock') === 'true' ? true : undefined
    const items = listInventoryItems(brand, { search, category, low_stock: lowStock })
    return c.json({ items })
  })

  // GET /api/inventory/summary
  app.get('/api/inventory/summary', (c) => {
    const brand = getBrandId(c)
    const summary = getInventorySummary(brand)
    return c.json(summary)
  })

  // GET /api/inventory/low-stock
  app.get('/api/inventory/low-stock', (c) => {
    const brand = getBrandId(c)
    const items = getLowStockItems(brand)
    return c.json({ items })
  })

  // GET /api/inventory/:id
  app.get('/api/inventory/:id', (c) => {
    const brand = getBrandId(c)
    const item = getInventoryItem(brand, c.req.param('id'))
    if (!item) return c.json({ error: 'not found' }, 404)
    return c.json(item)
  })

  // POST /api/inventory — create item
  app.post('/api/inventory', async (c) => {
    const brand = getBrandId(c)
    const body = await c.req.json() as {
      product_id?: string
      sku?: string
      name?: string
      description?: string
      category?: string
      unit?: string
      cost_price_cents?: number
      selling_price_cents?: number
      quantity_on_hand?: number
      quantity_reserved?: number
      quantity_reorder_point?: number
      quantity_reorder_quantity?: number
      location?: string
      supplier_name?: string
      supplier_contact?: string
      is_active?: boolean
      tags?: string[]
    }
    if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
    if (!body.sku?.trim()) return c.json({ error: 'sku is required' }, 400)

    const item = createInventoryItem(brand, {
      product_id: body.product_id,
      sku: body.sku.trim().toUpperCase(),
      name: body.name.trim(),
      description: body.description,
      category: body.category,
      unit: body.unit ?? 'each',
      cost_price_cents: Math.round(body.cost_price_cents ?? 0),
      selling_price_cents: Math.round(body.selling_price_cents ?? 0),
      quantity_on_hand: body.quantity_on_hand ?? 0,
      quantity_reserved: body.quantity_reserved ?? 0,
      quantity_reorder_point: body.quantity_reorder_point ?? 0,
      quantity_reorder_quantity: body.quantity_reorder_quantity ?? 0,
      location: body.location,
      supplier_name: body.supplier_name,
      supplier_contact: body.supplier_contact,
      is_active: body.is_active ?? true,
      tags: body.tags ?? [],
    })
    return c.json(item, 201)
  })

  // PATCH /api/inventory/:id — update item
  app.patch('/api/inventory/:id', async (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    const body = await c.req.json() as Record<string, unknown>
    if (body.cost_price_cents !== undefined) body.cost_price_cents = Math.round(Number(body.cost_price_cents))
    if (body.selling_price_cents !== undefined) body.selling_price_cents = Math.round(Number(body.selling_price_cents))
    if (typeof body.sku === 'string') body.sku = body.sku.trim().toUpperCase()
    const item = updateInventoryItem(brand, id, body)
    if (!item) return c.json({ error: 'not found' }, 404)
    return c.json(item)
  })

  // DELETE /api/inventory/:id
  app.delete('/api/inventory/:id', (c) => {
    const brand = getBrandId(c)
    const ok = deleteInventoryItem(brand, c.req.param('id'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // POST /api/inventory/:id/adjust — stock adjustment
  app.post('/api/inventory/:id/adjust', async (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    const body = await c.req.json() as {
      quantity?: number
      type?: StockMovementType
      reference?: string
      notes?: string
      actor?: string
    }
    if (body.quantity === undefined || typeof body.quantity !== 'number') {
      return c.json({ error: 'quantity (number) is required' }, 400)
    }
    const validTypes: StockMovementType[] = ['receive', 'ship', 'adjust', 'transfer']
    const type: StockMovementType = validTypes.includes(body.type as StockMovementType)
      ? (body.type as StockMovementType)
      : 'adjust'

    const movement = adjustStock(brand, id, body.quantity, type, body.reference, body.notes, body.actor)
    if (!movement) return c.json({ error: 'item not found' }, 404)
    return c.json(movement, 201)
  })

  // GET /api/inventory/:id/movements — movement history
  app.get('/api/inventory/:id/movements', (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    const limit = parseInt(c.req.query('limit') ?? '100', 10)
    const movements = listStockMovements(brand, id, limit)
    return c.json({ movements })
  })
}
