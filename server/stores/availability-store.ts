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
  writeFileSync(dbPath(file) + '.tmp', JSON.stringify(data, null, 2))
  renameSync(dbPath(file) + '.tmp', dbPath(file))
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DayRule {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6  // 0 = Sunday
  enabled: boolean
  start_time: string  // "09:00"
  end_time: string    // "17:00"
}

export interface BookingSettings {
  brand?: string
  duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  max_per_day: number
  booking_window_days: number
  confirmation_message: string
  timezone: string
  days: DayRule[]
  updated_at: string
}

const DEFAULT_DAYS: DayRule[] = [
  { day: 0, enabled: false, start_time: '09:00', end_time: '17:00' },
  { day: 1, enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day: 2, enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day: 3, enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day: 4, enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day: 5, enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day: 6, enabled: false, start_time: '09:00', end_time: '17:00' },
]

function file(brand?: string) {
  return brand ? `availability-${brand}.json` : 'availability.json'
}

export function getAvailability(brand?: string): BookingSettings {
  return readJson<BookingSettings>(file(brand), {
    brand,
    duration_minutes: 30,
    buffer_before_minutes: 5,
    buffer_after_minutes: 5,
    max_per_day: 8,
    booking_window_days: 30,
    confirmation_message: 'Your appointment has been confirmed. We look forward to seeing you!',
    timezone: 'America/New_York',
    days: DEFAULT_DAYS,
    updated_at: new Date().toISOString(),
  })
}

export function saveAvailability(settings: Partial<BookingSettings>, brand?: string): BookingSettings {
  const current = getAvailability(brand)
  const updated: BookingSettings = {
    ...current,
    ...settings,
    brand,
    updated_at: new Date().toISOString(),
  }
  writeJson(file(brand), updated)
  return updated
}
