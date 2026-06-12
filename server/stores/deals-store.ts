import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'

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

export const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
export type DealStage = typeof DEAL_STAGES[number]

export interface DealRecord {
  id: string
  brand?: string
  title: string
  contact_id?: string
  contact_name?: string
  value: number         // USD cents (integer) — stored as number
  stage: DealStage
  probability?: number  // 0–100
  close_date?: string   // ISO date
  notes?: string
  tags?: string[]
  custom_fields?: Record<string, string>
  created_at: string
  updated_at: string
  closed_at?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function file(brand?: string) {
  return brand ? `deals-${brand}.json` : 'deals.json'
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listDeals(brand?: string): DealRecord[] {
  return readJson<DealRecord[]>(file(brand), [])
}

export function getDeal(id: string, brand?: string): DealRecord | null {
  const all = brand ? listDeals(brand)
    : [...listDeals('sc'), ...listDeals('hfm'), ...listDeals(undefined)]
  return all.find(d => d.id === id) ?? null
}

export interface CreateDealInput {
  brand?: string
  title: string
  contact_id?: string
  contact_name?: string
  value?: number
  stage?: DealStage
  probability?: number
  close_date?: string
  notes?: string
  tags?: string[]
  custom_fields?: Record<string, unknown>
}

export function createDeal(data: CreateDealInput): DealRecord {
  const deals = listDeals(data.brand)
  const now = new Date().toISOString()
  const deal: DealRecord = {
    id: crypto.randomUUID(),
    brand: data.brand,
    title: data.title,
    contact_id: data.contact_id,
    contact_name: data.contact_name,
    value: data.value ?? 0,
    stage: data.stage ?? 'lead',
    probability: data.probability,
    close_date: data.close_date,
    notes: data.notes,
    tags: data.tags ?? [],
    custom_fields: (data.custom_fields && typeof data.custom_fields === 'object' && !Array.isArray(data.custom_fields))
      ? Object.fromEntries(Object.entries(data.custom_fields).map(([k, v]) => [k, String(v)]))
      : undefined,
    created_at: now,
    updated_at: now,
  }
  writeJson(file(data.brand), [deal, ...deals])
  return deal
}

export function updateDeal(
  id: string,
  updates: Partial<Omit<DealRecord, 'id' | 'created_at'>> & { custom_fields?: Record<string, unknown> },
  brand?: string,
): DealRecord | null {
  const deals = listDeals(brand)
  const idx = deals.findIndex(d => d.id === id)
  if (idx === -1) return null
  const prev = deals[idx]
  const now = new Date().toISOString()
  // Normalize custom_fields values to strings
  const normalizedUpdates = { ...updates }
  if (updates.custom_fields !== undefined) {
    normalizedUpdates.custom_fields = (updates.custom_fields && typeof updates.custom_fields === 'object' && !Array.isArray(updates.custom_fields))
      ? Object.fromEntries(Object.entries(updates.custom_fields).map(([k, v]) => [k, String(v)]))
      : undefined
  }
  const updated: DealRecord = { ...prev, ...normalizedUpdates, updated_at: now }
  // Auto-stamp closed_at when moving to won/lost
  if (!prev.closed_at && (updates.stage === 'won' || updates.stage === 'lost')) {
    updated.closed_at = now
  }
  deals[idx] = updated
  writeJson(file(brand), deals)
  return updated
}

export function deleteDeal(id: string, brand?: string): boolean {
  const deals = listDeals(brand)
  const next = deals.filter(d => d.id !== id)
  if (next.length === deals.length) return false
  writeJson(file(brand), next)
  return true
}
