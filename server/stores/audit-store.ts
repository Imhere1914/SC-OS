/**
 * Audit log store — append-only per-brand audit trail.
 * Stored in audit-{brand}.json, capped at 10 000 entries.
 */
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

export interface AuditEntry {
  id: string
  brand: string
  actor: string            // 'system' | 'api' | team member name
  action: string           // e.g. 'contact.created', 'invoice.sent', 'deal.won'
  entity_type: string      // 'contact' | 'invoice' | 'deal' etc
  entity_id?: string
  entity_label?: string    // human-readable: "Jane Smith" for contact
  details?: Record<string, unknown>  // before/after values
  ip?: string
  user_agent?: string
  created_at: string
}

const MAX_ENTRIES = 10_000

function fileName(brand: string) {
  return `audit-${brand}.json`
}

// ── Public API ────────────────────────────────────────────────────────────────

export function appendAudit(
  brand: string,
  entry: Omit<AuditEntry, 'id' | 'created_at'>,
): AuditEntry {
  const all = readJson<AuditEntry[]>(fileName(brand), [])
  const record: AuditEntry = {
    ...entry,
    id: nanoid(),
    created_at: new Date().toISOString(),
  }
  const updated = [record, ...all].slice(0, MAX_ENTRIES)
  writeJson(fileName(brand), updated)
  return record
}

export function listAudit(
  brand: string,
  opts?: {
    entity_type?: string
    actor?: string
    from?: string
    to?: string
    limit?: number
  },
): AuditEntry[] {
  let entries = readJson<AuditEntry[]>(fileName(brand), [])

  if (opts?.entity_type) {
    entries = entries.filter(e => e.entity_type === opts.entity_type)
  }
  if (opts?.actor) {
    const a = opts.actor.toLowerCase()
    entries = entries.filter(e => e.actor.toLowerCase().includes(a))
  }
  if (opts?.from) {
    const from = new Date(opts.from).getTime()
    entries = entries.filter(e => new Date(e.created_at).getTime() >= from)
  }
  if (opts?.to) {
    const to = new Date(opts.to).getTime()
    entries = entries.filter(e => new Date(e.created_at).getTime() <= to)
  }

  // Already stored newest-first, but re-sort defensively
  entries.sort((a, b) => b.created_at.localeCompare(a.created_at))

  return entries.slice(0, opts?.limit ?? 200)
}
