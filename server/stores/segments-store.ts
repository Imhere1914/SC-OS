import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string) {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}
function readJson<T>(f: string, fallback: T): T {
  const p = dbPath(f)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}
function writeJson(f: string, data: unknown) {
  const tmp = dbPath(f) + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, dbPath(f))
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_set' | 'is_not_set' | 'gt' | 'lt'

export interface SegmentFilter {
  field: string          // e.g. 'tags', 'stage', 'lead_score', 'city', 'custom_fields.key'
  operator: FilterOperator
  value?: string         // not needed for is_set / is_not_set
}

export interface SegmentRecord {
  id: string
  brand?: string
  name: string
  description?: string
  filters: SegmentFilter[]  // AND logic
  created_at: string
  updated_at: string
}

// ── File helper ───────────────────────────────────────────────────────────────

function file(brand?: string) {
  return brand ? `segments-${brand}.json` : 'segments.json'
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listSegments(brand?: string): SegmentRecord[] {
  return readJson<SegmentRecord[]>(file(brand), [])
}

export function getSegment(id: string, brand?: string): SegmentRecord | null {
  const all = brand ? listSegments(brand)
    : [...listSegments('sc'), ...listSegments('hfm'), ...listSegments(undefined)]
  return all.find(s => s.id === id) ?? null
}

export interface CreateSegmentInput {
  brand?: string
  name: string
  description?: string
  filters: SegmentFilter[]
}

export function createSegment(data: CreateSegmentInput): SegmentRecord {
  const list = listSegments(data.brand)
  const now = new Date().toISOString()
  const seg: SegmentRecord = {
    id: crypto.randomUUID(),
    brand: data.brand,
    name: data.name,
    description: data.description,
    filters: data.filters,
    created_at: now,
    updated_at: now,
  }
  writeJson(file(data.brand), [seg, ...list])
  return seg
}

export function updateSegment(
  id: string,
  updates: Partial<Omit<SegmentRecord, 'id' | 'created_at'>>,
  brand?: string,
): SegmentRecord | null {
  const list = listSegments(brand)
  const idx = list.findIndex(s => s.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() }
  writeJson(file(brand), list)
  return list[idx]
}

export function deleteSegment(id: string, brand?: string): boolean {
  const list = listSegments(brand)
  const next = list.filter(s => s.id !== id)
  if (next.length === list.length) return false
  writeJson(file(brand), next)
  return true
}
