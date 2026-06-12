import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string): string {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}

function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, data: unknown): void {
  const p = dbPath(file)
  const tmp = p + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface VendorRecord {
  id: string
  brand: string
  name: string
  company?: string
  email?: string
  phone?: string
  website?: string
  address?: { street?: string; city?: string; state?: string; zip?: string; country?: string }
  account_number?: string
  payment_terms?: number
  default_expense_account?: string
  notes?: string
  tags?: string[]
  is_active: boolean
  total_billed_cents: number
  total_paid_cents: number
  created_at: string
  updated_at: string
}

// ── Store ────────────────────────────────────────────────────────────────────

function file(brand: string): string {
  return `vendors-${brand}.json`
}

export function listVendors(brand: string, opts?: { is_active?: boolean }): VendorRecord[] {
  const all = readJson<VendorRecord[]>(file(brand), [])
  if (opts?.is_active !== undefined) return all.filter(v => v.is_active === opts.is_active)
  return all
}

export function getVendor(brand: string, id: string): VendorRecord | null {
  return listVendors(brand).find(v => v.id === id) ?? null
}

export type CreateVendorInput = Omit<VendorRecord, 'id' | 'brand' | 'is_active' | 'total_billed_cents' | 'total_paid_cents' | 'created_at' | 'updated_at'> & {
  is_active?: boolean
}

export function createVendor(brand: string, data: CreateVendorInput): VendorRecord {
  const vendors = listVendors(brand)
  const now = new Date().toISOString()
  const vendor: VendorRecord = {
    id: crypto.randomUUID(),
    brand,
    name: data.name,
    company: data.company,
    email: data.email,
    phone: data.phone,
    website: data.website,
    address: data.address,
    account_number: data.account_number,
    payment_terms: data.payment_terms,
    default_expense_account: data.default_expense_account,
    notes: data.notes,
    tags: data.tags,
    is_active: data.is_active ?? true,
    total_billed_cents: 0,
    total_paid_cents: 0,
    created_at: now,
    updated_at: now,
  }
  writeJson(file(brand), [vendor, ...vendors])
  return vendor
}

export function updateVendor(
  brand: string,
  id: string,
  data: Partial<Omit<VendorRecord, 'id' | 'brand' | 'created_at'>>,
): VendorRecord | null {
  const vendors = listVendors(brand)
  const idx = vendors.findIndex(v => v.id === id)
  if (idx === -1) return null
  const updated: VendorRecord = {
    ...vendors[idx],
    ...data,
    id,
    brand,
    updated_at: new Date().toISOString(),
  }
  vendors[idx] = updated
  writeJson(file(brand), vendors)
  return updated
}

export function deleteVendor(brand: string, id: string): boolean {
  const vendors = listVendors(brand)
  const next = vendors.filter(v => v.id !== id)
  if (next.length === vendors.length) return false
  writeJson(file(brand), next)
  return true
}
