import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string) {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}
function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}
function writeJson(file: string, data: unknown) {
  const tmp = dbPath(file) + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, dbPath(file))
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  brand: string
  product_id?: string
  sku: string
  name: string
  description?: string
  category?: string
  unit: string  // each, box, kg, lb, oz, liter, etc.
  cost_price_cents: number
  selling_price_cents: number
  quantity_on_hand: number
  quantity_reserved: number
  quantity_reorder_point: number
  quantity_reorder_quantity: number
  location?: string  // warehouse/shelf label
  supplier_name?: string
  supplier_contact?: string
  is_active: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

export type StockMovementType = 'receive' | 'ship' | 'adjust' | 'transfer'

export interface StockMovement {
  id: string
  brand: string
  item_id: string
  type: StockMovementType
  quantity: number  // positive = in, negative = out
  reference?: string  // PO number, order ID, etc.
  notes?: string
  actor?: string
  created_at: string
}

export interface InventorySummary {
  total_items: number
  active_items: number
  total_value_cents: number
  low_stock_count: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemsFile(brand: string) {
  return `inventory-items-${brand}.json`
}

function movementsFile(brand: string) {
  return `inventory-movements-${brand}.json`
}

// ── List / Get ────────────────────────────────────────────────────────────────

export interface ListInventoryOpts {
  search?: string
  category?: string
  low_stock?: boolean
  active?: boolean
}

export function listInventoryItems(brand: string, opts: ListInventoryOpts = {}): InventoryItem[] {
  let items = readJson<InventoryItem[]>(itemsFile(brand), [])
  if (opts.active !== undefined) items = items.filter(i => i.is_active === opts.active)
  if (opts.category) items = items.filter(i => i.category === opts.category)
  if (opts.low_stock) items = items.filter(i => i.quantity_on_hand <= i.quantity_reorder_point)
  if (opts.search) {
    const q = opts.search.toLowerCase()
    items = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q) ||
      (i.category ?? '').toLowerCase().includes(q) ||
      (i.supplier_name ?? '').toLowerCase().includes(q)
    )
  }
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getInventoryItem(brand: string, id: string): InventoryItem | null {
  return readJson<InventoryItem[]>(itemsFile(brand), []).find(i => i.id === id) ?? null
}

// ── Create ────────────────────────────────────────────────────────────────────

export type CreateInventoryItemInput = Omit<InventoryItem, 'id' | 'brand' | 'created_at' | 'updated_at'>

export function createInventoryItem(brand: string, data: CreateInventoryItemInput): InventoryItem {
  const items = readJson<InventoryItem[]>(itemsFile(brand), [])
  const now = new Date().toISOString()
  const item: InventoryItem = {
    ...data,
    id: nanoid(),
    brand,
    tags: data.tags ?? [],
    created_at: now,
    updated_at: now,
  }
  writeJson(itemsFile(brand), [item, ...items])
  return item
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateInventoryItemInput = Partial<Omit<InventoryItem, 'id' | 'brand' | 'created_at'>>

export function updateInventoryItem(brand: string, id: string, updates: UpdateInventoryItemInput): InventoryItem | null {
  const items = readJson<InventoryItem[]>(itemsFile(brand), [])
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  const updated: InventoryItem = { ...items[idx], ...updates, updated_at: new Date().toISOString() }
  items[idx] = updated
  writeJson(itemsFile(brand), items)
  return updated
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function deleteInventoryItem(brand: string, id: string): boolean {
  const items = readJson<InventoryItem[]>(itemsFile(brand), [])
  const next = items.filter(i => i.id !== id)
  if (next.length === items.length) return false
  writeJson(itemsFile(brand), next)
  return true
}

// ── Stock Movements ───────────────────────────────────────────────────────────

export function adjustStock(
  brand: string,
  itemId: string,
  quantity: number,
  type: StockMovementType,
  reference?: string,
  notes?: string,
  actor?: string,
): StockMovement | null {
  const items = readJson<InventoryItem[]>(itemsFile(brand), [])
  const idx = items.findIndex(i => i.id === itemId)
  if (idx === -1) return null

  // Update quantity_on_hand
  items[idx] = {
    ...items[idx],
    quantity_on_hand: items[idx].quantity_on_hand + quantity,
    updated_at: new Date().toISOString(),
  }
  writeJson(itemsFile(brand), items)

  // Record movement
  const movements = readJson<StockMovement[]>(movementsFile(brand), [])
  const movement: StockMovement = {
    id: nanoid(),
    brand,
    item_id: itemId,
    type,
    quantity,
    reference,
    notes,
    actor,
    created_at: new Date().toISOString(),
  }
  writeJson(movementsFile(brand), [movement, ...movements])
  return movement
}

export function listStockMovements(brand: string, itemId?: string, limit = 100): StockMovement[] {
  let movements = readJson<StockMovement[]>(movementsFile(brand), [])
  if (itemId) movements = movements.filter(m => m.item_id === itemId)
  return movements.slice(0, limit)
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function getLowStockItems(brand: string): InventoryItem[] {
  return readJson<InventoryItem[]>(itemsFile(brand), [])
    .filter(i => i.is_active && i.quantity_on_hand <= i.quantity_reorder_point)
    .sort((a, b) => a.quantity_on_hand - b.quantity_on_hand)
}

export function getInventorySummary(brand: string): InventorySummary {
  const items = readJson<InventoryItem[]>(itemsFile(brand), [])
  const activeItems = items.filter(i => i.is_active)
  const totalValue = activeItems.reduce((sum, i) => sum + i.cost_price_cents * i.quantity_on_hand, 0)
  const lowStockCount = activeItems.filter(i => i.quantity_on_hand <= i.quantity_reorder_point).length
  return {
    total_items: items.length,
    active_items: activeItems.length,
    total_value_cents: totalValue,
    low_stock_count: lowStockCount,
  }
}
