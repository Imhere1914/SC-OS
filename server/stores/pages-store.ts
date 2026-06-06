import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Landing pages store (Phase 4f).
 *
 * Template-based landing page builder: each page picks a template and fills
 * in content fields. Published pages render at the public /p/<slug> route.
 * File-backed JSON; swap for Postgres when the platform host is live.
 */

export type PageTemplate = 'hero-cta' | 'lead-capture' | 'simple'
export type PageStatus = 'draft' | 'published'

export type PageRecord = {
  id: string
  brand: string
  slug: string
  title: string
  template: PageTemplate
  status: PageStatus
  /** Template-specific content fields (headline, cta_text, etc.) */
  fields: Record<string, string>
  accent_color: string
  published_at: string | null
  created_at: string
  updated_at: string
}

type PageFile = { pages: PageRecord[] }

type CreatePageInput = Partial<PageRecord> & { title: string }
type UpdatePageInput = Partial<Omit<PageRecord, 'id' | 'created_at'>>

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const PAGES_FILE = path.join(CLAUDE_HOME, 'pages.json')

const TEMPLATES: PageTemplate[] = ['hero-cta', 'lead-capture', 'simple']

export function isPageTemplate(v: unknown): v is PageTemplate {
  return typeof v === 'string' && TEMPLATES.includes(v as PageTemplate)
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(PAGES_FILE)) {
    fs.writeFileSync(
      PAGES_FILE,
      JSON.stringify({ pages: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): PageFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(PAGES_FILE, 'utf-8').trim()
    if (!raw) return { pages: [] }
    const parsed = JSON.parse(raw) as Partial<PageFile>
    return { pages: Array.isArray(parsed.pages) ? parsed.pages : [] }
  } catch {
    return { pages: [] }
  }
}

function writeFile(data: PageFile): void {
  ensureFile()
  const tmp = `${PAGES_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, PAGES_FILE)
}

function normalize(
  p: Partial<PageRecord> &
    Pick<PageRecord, 'id' | 'slug' | 'title' | 'created_at' | 'updated_at'>,
): PageRecord {
  return {
    id: p.id,
    brand: typeof p.brand === 'string' ? p.brand : process.env.BRAND ?? 'default',
    slug: p.slug,
    title: p.title,
    template: isPageTemplate(p.template) ? p.template : 'hero-cta',
    status: p.status === 'published' ? 'published' : 'draft',
    fields:
      p.fields && typeof p.fields === 'object'
        ? Object.fromEntries(
            Object.entries(p.fields).filter(
              ([, v]) => typeof v === 'string',
            ) as Array<[string, string]>,
          )
        : {},
    accent_color:
      typeof p.accent_color === 'string' ? p.accent_color : '#4A9EA1',
    published_at: p.published_at ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

/** Ensure slug uniqueness by suffixing -2, -3, … if taken. */
function uniqueSlug(base: string, excludeId?: string): string {
  const existing = new Set(
    readFile()
      .pages.filter((p) => p.id !== excludeId)
      .map((p) => p.slug),
  )
  const clean = slugify(base) || 'page'
  if (!existing.has(clean)) return clean
  let n = 2
  while (existing.has(`${clean}-${n}`)) n++
  return `${clean}-${n}`
}

export function listPages(filters?: {
  status?: string | null
  brand?: string | null
}): PageRecord[] {
  let pages = readFile().pages.map(normalize)
  if (filters?.status) pages = pages.filter((p) => p.status === filters.status)
  if (filters?.brand) pages = pages.filter((p) => p.brand === filters.brand)
  return pages.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getPage(id: string): PageRecord | null {
  return readFile().pages.map(normalize).find((p) => p.id === id) ?? null
}

/** Public lookup — only returns PUBLISHED pages (for the /p/<slug> route). */
export function getPublishedPageBySlug(slug: string): PageRecord | null {
  return (
    readFile()
      .pages.map(normalize)
      .find((p) => p.slug === slug && p.status === 'published') ?? null
  )
}

export function createPage(input: CreatePageInput): PageRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const slug = uniqueSlug(input.slug || input.title)
  const page = normalize({
    id: randomUUID(),
    brand: typeof input.brand === 'string' ? input.brand : undefined,
    slug,
    title: input.title,
    template: input.template,
    status: 'draft',
    fields: input.fields,
    accent_color: input.accent_color,
    published_at: null,
    created_at: now,
    updated_at: now,
  })
  file.pages.push(page)
  writeFile({ pages: file.pages.map(normalize) })
  return page
}

export function updatePage(
  id: string,
  updates: UpdatePageInput,
): PageRecord | null {
  const file = readFile()
  const index = file.pages.findIndex((p) => p.id === id)
  if (index === -1) return null
  const current = normalize(file.pages[index] as PageRecord)
  // If slug changed, re-uniquify
  const nextSlug =
    typeof updates.slug === 'string' && updates.slug !== current.slug
      ? uniqueSlug(updates.slug, id)
      : current.slug
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    slug: nextSlug,
    title: typeof updates.title === 'string' ? updates.title : current.title,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  })
  file.pages[index] = next
  writeFile({ pages: file.pages.map(normalize) })
  return next
}

export function publishPage(id: string): PageRecord | null {
  return updatePage(id, {
    status: 'published',
    published_at: new Date().toISOString(),
  })
}

export function unpublishPage(id: string): PageRecord | null {
  return updatePage(id, { status: 'draft' })
}

export function deletePage(id: string): boolean {
  const file = readFile()
  const next = file.pages.filter((p) => p.id !== id)
  if (next.length === file.pages.length) return false
  writeFile({ pages: next.map((p) => normalize(p as PageRecord)) })
  return true
}

export const PAGE_TEMPLATES = TEMPLATES
