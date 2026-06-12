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

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'url'
export type EntityType = 'deal' | 'contact'

export interface CustomFieldSchema {
  id: string
  brand: string
  entity: EntityType
  name: string        // display name, e.g. "Source URL"
  key: string         // machine key, e.g. "source_url" (auto-derived from name)
  type: FieldType
  options?: string[]  // for select type
  required: boolean
  sort_order: number
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function file(brand: string) {
  return `custom-field-schemas-${brand}.json`
}

function deriveKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listSchemas(brand: string, entity?: EntityType): CustomFieldSchema[] {
  const all = readJson<CustomFieldSchema[]>(file(brand), [])
  if (entity) return all.filter(s => s.entity === entity).sort((a, b) => a.sort_order - b.sort_order)
  return all.sort((a, b) => a.sort_order - b.sort_order)
}

export interface CreateSchemaInput {
  entity: EntityType
  name: string
  type: FieldType
  options?: string[]
  required?: boolean
  sort_order?: number
}

export function createSchema(brand: string, data: CreateSchemaInput): CustomFieldSchema {
  const all = listSchemas(brand)
  const maxOrder = all.reduce((m, s) => Math.max(m, s.sort_order), 0)
  const schema: CustomFieldSchema = {
    id: nanoid(),
    brand,
    entity: data.entity,
    name: data.name,
    key: deriveKey(data.name),
    type: data.type,
    options: data.type === 'select' ? (data.options ?? []) : undefined,
    required: data.required ?? false,
    sort_order: data.sort_order ?? maxOrder + 1,
    created_at: new Date().toISOString(),
  }
  writeJson(file(brand), [schema, ...readJson<CustomFieldSchema[]>(file(brand), [])])
  return schema
}

export interface UpdateSchemaInput {
  name?: string
  type?: FieldType
  options?: string[]
  required?: boolean
  sort_order?: number
}

export function updateSchema(brand: string, id: string, patch: UpdateSchemaInput): CustomFieldSchema | null {
  const all = readJson<CustomFieldSchema[]>(file(brand), [])
  const idx = all.findIndex(s => s.id === id)
  if (idx === -1) return null
  const prev = all[idx]
  const updated: CustomFieldSchema = {
    ...prev,
    ...patch,
    // re-derive key if name changed
    key: patch.name ? deriveKey(patch.name) : prev.key,
    // clear options if type changed away from select
    options: (patch.type ?? prev.type) === 'select' ? (patch.options ?? prev.options ?? []) : undefined,
  }
  all[idx] = updated
  writeJson(file(brand), all)
  return updated
}

export function deleteSchema(brand: string, id: string): boolean {
  const all = readJson<CustomFieldSchema[]>(file(brand), [])
  const next = all.filter(s => s.id !== id)
  if (next.length === all.length) return false
  writeJson(file(brand), next)
  return true
}
