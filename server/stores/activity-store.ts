/**
 * Activity log — per-contact event timeline.
 * Each event is a lightweight record stored in activity-{brand}.json (or activity.json).
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(homedir(), '.ai-os')
const BRAND = process.env.BRAND ?? 'default'

function filePath() {
  return join(DATA_DIR, BRAND === 'default' ? 'activity.json' : `activity-${BRAND}.json`)
}

export type ActivityEvent = {
  id: string
  contact_id: string
  brand: string
  type:
    | 'contact_created'
    | 'stage_changed'
    | 'note_updated'
    | 'appointment_created'
    | 'appointment_completed'
    | 'invoice_created'
    | 'invoice_paid'
    | 'form_submitted'
    | 'conversation_started'
    | 'tag_added'
    | 'custom'
  description: string
  meta?: Record<string, string>
  created_at: string
}

function readAll(): ActivityEvent[] {
  const file = filePath()
  if (!existsSync(file)) return []
  try { return JSON.parse(readFileSync(file, 'utf8')) as ActivityEvent[] }
  catch { return [] }
}

function writeAll(items: ActivityEvent[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const file = filePath()
  const tmp = `${file}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(items, null, 2))
  renameSync(tmp, file)
}

export function appendActivity(input: Omit<ActivityEvent, 'id' | 'brand' | 'created_at'>): ActivityEvent {
  const all = readAll()
  const event: ActivityEvent = {
    ...input,
    id: randomUUID(),
    brand: BRAND,
    created_at: new Date().toISOString(),
  }
  all.unshift(event)
  // Cap at 5000 events to prevent unbounded growth
  writeAll(all.slice(0, 5000))
  return event
}

export function listActivityForContact(contactId: string, limit = 50): ActivityEvent[] {
  return readAll()
    .filter(e => e.contact_id === contactId)
    .slice(0, limit)
}
