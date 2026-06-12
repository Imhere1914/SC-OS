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

export interface SequenceStep {
  id: string
  subject: string
  body: string          // plain text / {{contact_name}} vars
  delay_days: number    // days after previous step (or enrollment for step 0)
}

export interface SequenceRecord {
  id: string
  brand?: string
  name: string
  status: 'draft' | 'active'
  steps: SequenceStep[]
  created_at: string
  updated_at: string
}

export type EnrollmentStatus = 'active' | 'completed' | 'unsubscribed' | 'bounced'

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  contact_id?: string
  contact_email: string
  contact_name: string
  brand?: string
  status: EnrollmentStatus
  current_step: number   // index of NEXT step to send
  next_send_at: string   // ISO — when to send current_step
  enrolled_at: string
  completed_at?: string
}

// ── File helpers ──────────────────────────────────────────────────────────────

function seqFile(brand?: string) {
  return brand ? `sequences-${brand}.json` : 'sequences.json'
}
function enrollFile(brand?: string) {
  return brand ? `seq-enrollments-${brand}.json` : 'seq-enrollments.json'
}

// ── Sequences CRUD ────────────────────────────────────────────────────────────

export function listSequences(brand?: string): SequenceRecord[] {
  return readJson<SequenceRecord[]>(seqFile(brand), [])
}

export function getSequence(id: string, brand?: string): SequenceRecord | null {
  const all = brand ? listSequences(brand)
    : [...listSequences('sc'), ...listSequences('hfm'), ...listSequences(undefined)]
  return all.find(s => s.id === id) ?? null
}

export interface CreateSequenceInput {
  brand?: string
  name: string
  status?: 'draft' | 'active'
  steps?: Omit<SequenceStep, 'id'>[]
}

export function createSequence(data: CreateSequenceInput): SequenceRecord {
  const list = listSequences(data.brand)
  const now = new Date().toISOString()
  const rec: SequenceRecord = {
    id: crypto.randomUUID(),
    brand: data.brand,
    name: data.name,
    status: data.status ?? 'draft',
    steps: (data.steps ?? []).map(s => ({ ...s, id: crypto.randomUUID() })),
    created_at: now,
    updated_at: now,
  }
  writeJson(seqFile(data.brand), [rec, ...list])
  return rec
}

export function updateSequence(
  id: string,
  updates: Partial<Omit<SequenceRecord, 'id' | 'created_at'>>,
  brand?: string,
): SequenceRecord | null {
  const list = listSequences(brand)
  const idx = list.findIndex(s => s.id === id)
  if (idx === -1) return null
  // Re-generate step IDs for new steps that have no id
  if (updates.steps) {
    updates.steps = updates.steps.map(s => ({ ...s, id: s.id || crypto.randomUUID() }))
  }
  list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() }
  writeJson(seqFile(brand), list)
  return list[idx]
}

export function deleteSequence(id: string, brand?: string): boolean {
  const list = listSequences(brand)
  const next = list.filter(s => s.id !== id)
  if (next.length === list.length) return false
  writeJson(seqFile(brand), next)
  return true
}

// ── Enrollments CRUD ──────────────────────────────────────────────────────────

export function listEnrollments(opts?: {
  sequence_id?: string
  brand?: string
  status?: EnrollmentStatus
  due_before?: string  // ISO — for scheduler
}): SequenceEnrollment[] {
  const brand = opts?.brand
  const all = brand ? readJson<SequenceEnrollment[]>(enrollFile(brand), [])
    : [
        ...readJson<SequenceEnrollment[]>(enrollFile('sc'), []),
        ...readJson<SequenceEnrollment[]>(enrollFile('hfm'), []),
        ...readJson<SequenceEnrollment[]>(enrollFile(undefined), []),
      ]
  return all.filter(e => {
    if (opts?.sequence_id && e.sequence_id !== opts.sequence_id) return false
    if (opts?.status && e.status !== opts.status) return false
    if (opts?.due_before && e.next_send_at > opts.due_before) return false
    return true
  })
}

export function getEnrollment(id: string, brand?: string): SequenceEnrollment | null {
  const all = brand ? readJson<SequenceEnrollment[]>(enrollFile(brand), [])
    : [
        ...readJson<SequenceEnrollment[]>(enrollFile('sc'), []),
        ...readJson<SequenceEnrollment[]>(enrollFile('hfm'), []),
        ...readJson<SequenceEnrollment[]>(enrollFile(undefined), []),
      ]
  return all.find(e => e.id === id) ?? null
}

export interface EnrollContactInput {
  sequence_id: string
  contact_id?: string
  contact_email: string
  contact_name: string
  brand?: string
  delay_override_days?: number  // override first-step delay (default: use step's delay_days)
}

export function enrollContact(seq: SequenceRecord, data: EnrollContactInput): SequenceEnrollment | null {
  if (!seq.steps.length) return null
  const list = readJson<SequenceEnrollment[]>(enrollFile(data.brand), [])
  // Prevent duplicate active enrollment for same sequence+contact
  const dup = list.find(e => e.sequence_id === seq.id && e.contact_email === data.contact_email && e.status === 'active')
  if (dup) return dup

  const firstStep = seq.steps[0]
  const delayMs = ((data.delay_override_days ?? firstStep.delay_days) || 0) * 86_400_000
  const next_send_at = new Date(Date.now() + delayMs).toISOString()

  const enrollment: SequenceEnrollment = {
    id: crypto.randomUUID(),
    sequence_id: seq.id,
    contact_id: data.contact_id,
    contact_email: data.contact_email,
    contact_name: data.contact_name,
    brand: data.brand,
    status: 'active',
    current_step: 0,
    next_send_at,
    enrolled_at: new Date().toISOString(),
  }
  writeJson(enrollFile(data.brand), [enrollment, ...list])
  return enrollment
}

export function updateEnrollment(
  id: string,
  updates: Partial<Pick<SequenceEnrollment, 'status' | 'current_step' | 'next_send_at' | 'completed_at'>>,
  brand?: string,
): SequenceEnrollment | null {
  const list = readJson<SequenceEnrollment[]>(enrollFile(brand), [])
  const idx = list.findIndex(e => e.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...updates }
  writeJson(enrollFile(brand), list)
  return list[idx]
}

export function unenroll(id: string, brand?: string): boolean {
  const list = readJson<SequenceEnrollment[]>(enrollFile(brand), [])
  const idx = list.findIndex(e => e.id === id)
  if (idx === -1) return false
  list[idx] = { ...list[idx], status: 'unsubscribed' }
  writeJson(enrollFile(brand), list)
  return true
}
