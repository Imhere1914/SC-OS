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

export interface TimeEntry {
  id: string
  brand: string
  project_id?: string
  project_name?: string
  contact_id?: string
  contact_name?: string
  description: string
  duration_minutes: number
  billable: boolean
  billed: boolean
  hourly_rate?: number     // USD cents per hour
  invoice_id?: string
  date: string             // YYYY-MM-DD
  started_at?: string
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function file(brand: string) {
  return dbPath(`time-entries-${brand}`)
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listTimeEntries(brand: string, opts?: {
  project_id?: string
  contact_id?: string
  billed?: boolean
  from?: string
  to?: string
}): TimeEntry[] {
  let entries = readJson<TimeEntry[]>(file(brand), [])
  if (opts?.project_id) entries = entries.filter((e: TimeEntry) => e.project_id === opts.project_id)
  if (opts?.contact_id) entries = entries.filter((e: TimeEntry) => e.contact_id === opts.contact_id)
  if (opts?.billed !== undefined) entries = entries.filter((e: TimeEntry) => e.billed === opts.billed)
  if (opts?.from) entries = entries.filter((e: TimeEntry) => e.date >= opts.from!)
  if (opts?.to) entries = entries.filter((e: TimeEntry) => e.date <= opts.to!)
  return entries.sort((a: TimeEntry, b: TimeEntry) => b.date.localeCompare(a.date))
}

export function getTimeEntry(brand: string, id: string): TimeEntry | null {
  return listTimeEntries(brand).find((e: TimeEntry) => e.id === id) ?? null
}

export function createTimeEntry(brand: string, data: Omit<TimeEntry, 'id' | 'brand' | 'created_at' | 'updated_at'>): TimeEntry {
  const entries = readJson<TimeEntry[]>(file(brand), [])
  const now = new Date().toISOString()
  const entry: TimeEntry = { id: nanoid(), brand, ...data, created_at: now, updated_at: now }
  writeJson(file(brand), [...entries, entry])
  return entry
}

export function updateTimeEntry(brand: string, id: string, patch: Partial<TimeEntry>): TimeEntry | null {
  const entries = readJson<TimeEntry[]>(file(brand), [])
  const idx = entries.findIndex((e: TimeEntry) => e.id === id)
  if (idx === -1) return null
  const updated: TimeEntry = { ...entries[idx], ...patch, id, brand, updated_at: new Date().toISOString() }
  entries[idx] = updated
  writeJson(file(brand), entries)
  return updated
}

export function deleteTimeEntry(brand: string, id: string): boolean {
  const entries = readJson<TimeEntry[]>(file(brand), [])
  const next = entries.filter((e: TimeEntry) => e.id !== id)
  if (next.length === entries.length) return false
  writeJson(file(brand), next)
  return true
}

export function getTimeSummary(brand: string, opts?: { project_id?: string; from?: string; to?: string }) {
  const entries = listTimeEntries(brand, opts)
  const total_minutes = entries.reduce((s: number, e: TimeEntry) => s + e.duration_minutes, 0)
  const billable_minutes = entries.filter((e: TimeEntry) => e.billable).reduce((s: number, e: TimeEntry) => s + e.duration_minutes, 0)
  const unbilled_minutes = entries.filter((e: TimeEntry) => e.billable && !e.billed).reduce((s: number, e: TimeEntry) => s + e.duration_minutes, 0)
  const unbilled_cents = entries
    .filter((e: TimeEntry) => e.billable && !e.billed && e.hourly_rate)
    .reduce((s: number, e: TimeEntry) => s + Math.round((e.duration_minutes / 60) * (e.hourly_rate ?? 0)), 0)
  return { total_minutes, billable_minutes, unbilled_minutes, unbilled_cents, entry_count: entries.length }
}
