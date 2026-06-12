import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'node:crypto'

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

export type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'failed'
export type BroadcastChannel = 'sms' | 'whatsapp'

export interface BroadcastRecord {
  id: string
  brand: string
  name: string
  channel: BroadcastChannel
  body: string
  segment_id?: string
  target_tags?: string[]
  status: BroadcastStatus
  total_recipients: number
  sent_count: number
  failed_count: number
  scheduled_at?: string
  sent_at?: string
  created_at: string
  updated_at: string
}

// ── File helper ───────────────────────────────────────────────────────────────

function file(brand: string) {
  return `broadcasts-${brand}.json`
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listBroadcasts(brand: string): BroadcastRecord[] {
  return readJson<BroadcastRecord[]>(file(brand), []).sort(
    (a, b) => b.updated_at.localeCompare(a.updated_at),
  )
}

export function getBroadcast(id: string, brand: string): BroadcastRecord | null {
  return listBroadcasts(brand).find(b => b.id === id) ?? null
}

export interface CreateBroadcastInput {
  brand: string
  name: string
  channel: BroadcastChannel
  body?: string
  segment_id?: string
  target_tags?: string[]
  scheduled_at?: string
}

export function createBroadcast(data: CreateBroadcastInput): BroadcastRecord {
  const list = listBroadcasts(data.brand)
  const now = new Date().toISOString()
  const record: BroadcastRecord = {
    id: randomUUID(),
    brand: data.brand,
    name: data.name,
    channel: data.channel,
    body: data.body ?? '',
    segment_id: data.segment_id,
    target_tags: data.target_tags,
    status: 'draft',
    total_recipients: 0,
    sent_count: 0,
    failed_count: 0,
    scheduled_at: data.scheduled_at,
    created_at: now,
    updated_at: now,
  }
  writeJson(file(data.brand), [record, ...list])
  return record
}

export function updateBroadcast(
  id: string,
  brand: string,
  updates: Partial<Omit<BroadcastRecord, 'id' | 'brand' | 'created_at'>>,
): BroadcastRecord | null {
  const list = listBroadcasts(brand)
  const idx = list.findIndex(b => b.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() }
  writeJson(file(brand), list)
  return list[idx]
}

export function deleteBroadcast(id: string, brand: string): boolean {
  const list = listBroadcasts(brand)
  const next = list.filter(b => b.id !== id)
  if (next.length === list.length) return false
  writeJson(file(brand), next)
  return true
}
