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

export interface ProductRecord {
  id: string
  brand: string
  name: string
  description?: string
  unit_price_cents: number   // e.g. 15000 = $150.00
  category?: string
  sku?: string
  taxable: boolean
  active: boolean
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function file(brand: string) {
  return `products-${brand}.json`
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export interface ListProductsFilter {
  active?: boolean
  category?: string
}

export function listProducts(brand: string, filter: ListProductsFilter = {}): ProductRecord[] {
  let products = readJson<ProductRecord[]>(file(brand), [])
  if (filter.active !== undefined) products = products.filter(p => p.active === filter.active)
  if (filter.category) products = products.filter(p => p.category === filter.category)
  return products.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getProduct(brand: string, id: string): ProductRecord | null {
  return readJson<ProductRecord[]>(file(brand), []).find(p => p.id === id) ?? null
}

export interface CreateProductInput {
  name: string
  description?: string
  unit_price_cents: number
  category?: string
  sku?: string
  taxable?: boolean
  active?: boolean
}

export function createProduct(brand: string, data: CreateProductInput): ProductRecord {
  const products = listProducts(brand)
  const now = new Date().toISOString()
  const product: ProductRecord = {
    id: nanoid(),
    brand,
    name: data.name,
    description: data.description,
    unit_price_cents: data.unit_price_cents,
    category: data.category,
    sku: data.sku,
    taxable: data.taxable ?? true,
    active: data.active ?? true,
    created_at: now,
    updated_at: now,
  }
  writeJson(file(brand), [product, ...products])
  return product
}

export type UpdateProductInput = Partial<Omit<ProductRecord, 'id' | 'brand' | 'created_at'>>

export function updateProduct(brand: string, id: string, updates: UpdateProductInput): ProductRecord | null {
  const products = readJson<ProductRecord[]>(file(brand), [])
  const idx = products.findIndex(p => p.id === id)
  if (idx === -1) return null
  const updated: ProductRecord = { ...products[idx], ...updates, updated_at: new Date().toISOString() }
  products[idx] = updated
  writeJson(file(brand), products)
  return updated
}

export function deleteProduct(brand: string, id: string): boolean {
  const products = readJson<ProductRecord[]>(file(brand), [])
  const next = products.filter(p => p.id !== id)
  if (next.length === products.length) return false
  writeJson(file(brand), next)
  return true
}
