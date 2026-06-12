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
  const tmp = `${p}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface CalendarSyncConfig {
  brand: string
  google_connected: boolean
  calendar_id: string | null
  sync_direction: 'push' | 'pull' | 'bidirectional'
  enabled: boolean
  last_synced_at: string | null
  event_prefix: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fileName(brand?: string): string {
  return brand ? `calendar-sync-${brand}.json` : 'calendar-sync.json'
}

function defaults(brand?: string): CalendarSyncConfig {
  return {
    brand: brand ?? 'default',
    google_connected: false,
    calendar_id: null,
    sync_direction: 'bidirectional',
    enabled: false,
    last_synced_at: null,
    event_prefix: '',
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCalendarSync(brand?: string): CalendarSyncConfig {
  return readJson<CalendarSyncConfig>(fileName(brand), defaults(brand))
}

export function upsertCalendarSync(
  brand: string,
  patch: Partial<Omit<CalendarSyncConfig, 'brand'>>,
): CalendarSyncConfig {
  const current = getCalendarSync(brand)
  const updated: CalendarSyncConfig = {
    ...current,
    ...patch,
    brand,
  }
  writeJson(fileName(brand), updated)
  return updated
}
