import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Templates store — reusable message/email/social/content templates.
 * File-backed JSON, same conventions as the other platform stores.
 */

export type TemplateCategory = 'email' | 'sms' | 'social' | 'reply' | 'note'

export type TemplateRecord = {
  id: string
  brand: string
  name: string
  category: TemplateCategory
  /** Optional subject line (used for email category) */
  subject: string
  body: string
  tags: string[]
  created_at: string
  updated_at: string
}

type TemplateFile = { templates: TemplateRecord[] }

type CreateTemplateInput = Partial<TemplateRecord> & { name: string }
type UpdateTemplateInput = Partial<Omit<TemplateRecord, 'id' | 'created_at'>>

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const TEMPLATES_FILE = path.join(CLAUDE_HOME, 'templates.json')

const CATEGORIES: TemplateCategory[] = ['email', 'sms', 'social', 'reply', 'note']

export function isTemplateCategory(v: unknown): v is TemplateCategory {
  return typeof v === 'string' && CATEGORIES.includes(v as TemplateCategory)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(TEMPLATES_FILE)) {
    fs.writeFileSync(
      TEMPLATES_FILE,
      JSON.stringify({ templates: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): TemplateFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8').trim()
    if (!raw) return { templates: [] }
    const parsed = JSON.parse(raw) as Partial<TemplateFile>
    return { templates: Array.isArray(parsed.templates) ? parsed.templates : [] }
  } catch {
    return { templates: [] }
  }
}

function writeFile(data: TemplateFile): void {
  ensureFile()
  const tmp = `${TEMPLATES_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, TEMPLATES_FILE)
}

function normalize(
  t: Partial<TemplateRecord> &
    Pick<TemplateRecord, 'id' | 'name' | 'created_at' | 'updated_at'>,
): TemplateRecord {
  return {
    id: t.id,
    brand: typeof t.brand === 'string' ? t.brand : process.env.BRAND ?? 'default',
    name: t.name,
    category: isTemplateCategory(t.category) ? t.category : 'reply',
    subject: typeof t.subject === 'string' ? t.subject : '',
    body: typeof t.body === 'string' ? t.body : '',
    tags: Array.isArray(t.tags)
      ? t.tags.filter((x): x is string => typeof x === 'string')
      : [],
    created_at: t.created_at,
    updated_at: t.updated_at,
  }
}

export function listTemplates(filters?: {
  category?: string | null
  brand?: string | null
}): TemplateRecord[] {
  let templates = readFile().templates.map(normalize)
  if (filters?.category)
    templates = templates.filter((t) => t.category === filters.category)
  if (filters?.brand) templates = templates.filter((t) => t.brand === filters.brand)
  return templates.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getTemplate(id: string): TemplateRecord | null {
  return readFile().templates.map(normalize).find((t) => t.id === id) ?? null
}

export function createTemplate(input: CreateTemplateInput): TemplateRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const template = normalize({
    id: randomUUID(),
    brand: typeof input.brand === 'string' ? input.brand : undefined,
    name: input.name,
    category: input.category,
    subject: input.subject,
    body: input.body,
    tags: input.tags,
    created_at: now,
    updated_at: now,
  })
  file.templates.push(template)
  writeFile({ templates: file.templates.map(normalize) })
  return template
}

export function updateTemplate(
  id: string,
  updates: UpdateTemplateInput,
): TemplateRecord | null {
  const file = readFile()
  const index = file.templates.findIndex((t) => t.id === id)
  if (index === -1) return null
  const current = normalize(file.templates[index] as TemplateRecord)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    name: typeof updates.name === 'string' ? updates.name : current.name,
  })
  file.templates[index] = next
  writeFile({ templates: file.templates.map(normalize) })
  return next
}

export function deleteTemplate(id: string): boolean {
  const file = readFile()
  const next = file.templates.filter((t) => t.id !== id)
  if (next.length === file.templates.length) return false
  writeFile({ templates: next.map((t) => normalize(t as TemplateRecord)) })
  return true
}

export const TEMPLATE_CATEGORIES = CATEGORIES
