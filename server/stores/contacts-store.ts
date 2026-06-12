import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Contacts store — CRM backbone. File-backed JSON, atomic writes.
 * Data dir: AIOS_DATA_DIR or ~/.ai-os. Postgres-swappable later.
 */

export type ContactStage = 'lead' | 'contacted' | 'qualified' | 'customer' | 'lost'
export type ContactSource =
  | 'webchat' | 'manual' | 'import' | 'email' | 'sms' | 'whatsapp' | 'social' | 'phone'

export type ContactRecord = {
  id: string
  brand: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  stage: ContactStage
  source: ContactSource
  tags: string[]
  notes: string
  owner: string | null
  unverified: boolean
  last_contacted_at: string | null
  custom_fields: Record<string, string>   // arbitrary key→value pairs
  created_at: string
  updated_at: string
}

type ContactFile = { contacts: ContactRecord[] }
type CreateInput = Partial<ContactRecord> & { name: string }
type UpdateInput = Partial<Omit<ContactRecord, 'id' | 'created_at'>>

const DATA_DIR =
  process.env.AIOS_DATA_DIR ?? path.join(os.homedir(), '.ai-os')
const FILE = path.join(DATA_DIR, 'contacts.json')
const BRAND = process.env.BRAND ?? 'default'

const STAGES: ContactStage[] = ['lead', 'contacted', 'qualified', 'customer', 'lost']
const SOURCES: ContactSource[] = ['webchat', 'manual', 'import', 'email', 'sms', 'whatsapp', 'social', 'phone']

export function isContactStage(v: unknown): v is ContactStage {
  return typeof v === 'string' && STAGES.includes(v as ContactStage)
}
export function isContactSource(v: unknown): v is ContactSource {
  return typeof v === 'string' && SOURCES.includes(v as ContactSource)
}

function ensureFile(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(FILE))
    fs.writeFileSync(FILE, JSON.stringify({ contacts: [] }, null, 2) + '\n', 'utf-8')
}
function readFile(): ContactFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(FILE, 'utf-8').trim()
    if (!raw) return { contacts: [] }
    const p = JSON.parse(raw) as Partial<ContactFile>
    return { contacts: Array.isArray(p.contacts) ? p.contacts : [] }
  } catch {
    return { contacts: [] }
  }
}
function writeFile(data: ContactFile): void {
  ensureFile()
  const tmp = `${FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, FILE)
}

function normalize(
  c: Partial<ContactRecord> & Pick<ContactRecord, 'id' | 'name' | 'created_at' | 'updated_at'>,
): ContactRecord {
  return {
    id: c.id,
    brand: typeof c.brand === 'string' ? c.brand : BRAND,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    company: c.company ?? null,
    stage: isContactStage(c.stage) ? c.stage : 'lead',
    source: isContactSource(c.source) ? c.source : 'manual',
    tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : [],
    notes: typeof c.notes === 'string' ? c.notes : '',
    owner: c.owner ?? null,
    unverified: c.unverified === true,
    last_contacted_at: c.last_contacted_at ?? null,
    custom_fields: (c.custom_fields && typeof c.custom_fields === 'object' && !Array.isArray(c.custom_fields))
      ? c.custom_fields as Record<string, string>
      : {},
    created_at: c.created_at,
    updated_at: c.updated_at,
  }
}

export function listContacts(filters: { stage?: string | null; source?: string | null; search?: string | null } = {}): ContactRecord[] {
  let contacts = readFile().contacts.map(normalize).filter((c) => c.brand === BRAND)
  if (filters.stage) contacts = contacts.filter((c) => c.stage === filters.stage)
  if (filters.source) contacts = contacts.filter((c) => c.source === filters.source)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    contacts = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
  return contacts.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getContact(id: string): ContactRecord | null {
  return readFile().contacts.map(normalize).find((c) => c.id === id) ?? null
}

export function createContact(input: CreateInput): ContactRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const contact = normalize({
    id: randomUUID(),
    brand: BRAND,
    name: input.name,
    email: input.email,
    phone: input.phone,
    company: input.company,
    stage: input.stage,
    source: input.source,
    tags: input.tags,
    notes: input.notes,
    owner: input.owner,
    unverified: input.unverified,
    last_contacted_at: input.last_contacted_at ?? null,
    created_at: now,
    updated_at: now,
  })
  file.contacts.push(contact)
  writeFile({ contacts: file.contacts.map(normalize) })
  return contact
}

export function updateContact(id: string, updates: UpdateInput): ContactRecord | null {
  const file = readFile()
  const i = file.contacts.findIndex((c) => c.id === id)
  if (i === -1) return null
  const current = normalize(file.contacts[i] as ContactRecord)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    name: typeof updates.name === 'string' ? updates.name : current.name,
  })
  file.contacts[i] = next
  writeFile({ contacts: file.contacts.map(normalize) })
  return next
}

export function deleteContact(id: string): boolean {
  const file = readFile()
  const next = file.contacts.filter((c) => c.id !== id)
  if (next.length === file.contacts.length) return false
  writeFile({ contacts: next.map((c) => normalize(c as ContactRecord)) })
  return true
}

export const CONTACT_STAGES = STAGES
