/**
 * Activity Feed Store — unified event log across all modules.
 * Stored per-brand in activity-feed-{brand}.json
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'

function dbPath(name: string): string {
  const dir = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

export type ActivityType =
  | 'contact.created'
  | 'deal.won'
  | 'deal.created'
  | 'deal.lost'
  | 'invoice.paid'
  | 'invoice.created'
  | 'appointment.booked'
  | 'appointment.completed'
  | 'form.submitted'
  | 'campaign.sent'
  | 'note.added'
  | 'task.completed'
  | 'payment.received'
  | 'review.received'
  | 'sequence.enrolled'
  | 'ticket.created'
  | 'ticket.resolved'
  | 'proposal.accepted'
  | 'custom'

export interface ActivityRecord {
  id: string
  brand: string
  type: ActivityType
  entity_type?: string
  entity_id?: string
  entity_name?: string
  actor: string
  message: string
  metadata?: Record<string, unknown>
  icon?: string
  created_at: string
}

function filePath(brand: string): string {
  return dbPath(brand === 'default' ? 'activity-feed.json' : `activity-feed-${brand}.json`)
}

function readAll(brand: string): ActivityRecord[] {
  const file = filePath(brand)
  if (!existsSync(file)) return []
  try { return JSON.parse(readFileSync(file, 'utf8')) as ActivityRecord[] }
  catch { return [] }
}

function writeAll(brand: string, items: ActivityRecord[]) {
  const file = filePath(brand)
  const tmp = `${file}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(items, null, 2))
  renameSync(tmp, file)
}

export interface ListActivitiesOpts {
  type?: ActivityType
  entity_type?: string
  entity_id?: string
  limit?: number
  from?: string
  to?: string
}

export function listActivities(brand: string, opts: ListActivitiesOpts = {}): ActivityRecord[] {
  let items = readAll(brand)

  if (opts.type) items = items.filter(i => i.type === opts.type)
  if (opts.entity_type) items = items.filter(i => i.entity_type === opts.entity_type)
  if (opts.entity_id) items = items.filter(i => i.entity_id === opts.entity_id)
  if (opts.from) items = items.filter(i => i.created_at >= opts.from!)
  if (opts.to) items = items.filter(i => i.created_at <= opts.to!)

  const limit = opts.limit ?? 100
  return items.slice(0, limit)
}

export function getActivityStats(brand: string): Record<string, number> {
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString()

  const items = readAll(brand).filter(i => i.created_at >= sinceStr)
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.type] = (counts[item.type] ?? 0) + 1
  }
  return counts
}

// ── Legacy API (contact-scoped activity log) ─────────────────────────────────

const BRAND = process.env.BRAND ?? 'default'

/** @deprecated Legacy contact-scoped activity event shape */
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
    | 'sequence_enrolled'
    | 'deal_created'
    | 'deal_stage_changed'
    | 'custom'
  description: string
  meta?: Record<string, string>
  created_at: string
}

/**
 * Legacy single-argument appendActivity for existing callers.
 * Maps old contact-scoped events into the new unified feed.
 */
export function appendActivity(
  brandOrData: string | Omit<ActivityEvent, 'id' | 'brand' | 'created_at'>,
  data?: Omit<ActivityRecord, 'id' | 'brand' | 'created_at'>,
): ActivityRecord | ActivityEvent {
  // New two-argument form
  if (typeof brandOrData === 'string' && data !== undefined) {
    return appendActivityNew(brandOrData, data)
  }

  // Legacy one-argument form
  const legacyInput = brandOrData as Omit<ActivityEvent, 'id' | 'brand' | 'created_at'>
  const record = appendActivityNew(BRAND, {
    type: 'custom',
    entity_type: 'contact',
    entity_id: legacyInput.contact_id,
    actor: 'system',
    message: legacyInput.description,
  })

  // Return legacy-shaped object for any callers that consume the return value
  const legacyEvent: ActivityEvent = {
    id: record.id,
    contact_id: legacyInput.contact_id,
    brand: BRAND,
    type: legacyInput.type,
    description: legacyInput.description,
    meta: legacyInput.meta,
    created_at: record.created_at,
  }
  return legacyEvent
}

function appendActivityNew(
  brand: string,
  data: Omit<ActivityRecord, 'id' | 'brand' | 'created_at'>,
): ActivityRecord {
  const all = readAll(brand)
  const record: ActivityRecord = {
    ...data,
    id: randomUUID(),
    brand,
    created_at: new Date().toISOString(),
  }
  all.unshift(record)
  writeAll(brand, all.slice(0, 10000))
  return record
}

/** Legacy: list activity events for a single contact */
export function listActivityForContact(contactId: string, limit = 50): ActivityEvent[] {
  const all = readAll(BRAND)
  return all
    .filter(r => r.entity_type === 'contact' && r.entity_id === contactId)
    .slice(0, limit)
    .map(r => ({
      id: r.id,
      contact_id: r.entity_id ?? contactId,
      brand: r.brand,
      type: 'custom' as ActivityEvent['type'],
      description: r.message,
      created_at: r.created_at,
    }))
}
