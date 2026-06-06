import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(homedir(), '.ai-os')
const FILE = join(DATA_DIR, 'knowledge.json')

export type KnowledgeCategory =
  | 'brand-voice'
  | 'icp'
  | 'services'
  | 'faq'
  | 'objections'
  | 'snippets'
  | 'strategy'
  | 'other'

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  'brand-voice', 'icp', 'services', 'faq', 'objections', 'snippets', 'strategy', 'other',
]

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  'brand-voice': 'Brand Voice',
  'icp': 'Ideal Client',
  'services': 'Services & Pricing',
  'faq': 'FAQ',
  'objections': 'Objection Handling',
  'snippets': 'Best-of Snippets',
  'strategy': 'Strategy & Goals',
  'other': 'Other',
}

export const CATEGORY_EMOJIS: Record<KnowledgeCategory, string> = {
  'brand-voice': '🎨',
  'icp': '🎯',
  'services': '💼',
  'faq': '❓',
  'objections': '🛡️',
  'snippets': '✨',
  'strategy': '🧭',
  'other': '📝',
}

export interface KnowledgeEntry {
  id: string
  brand: string
  category: KnowledgeCategory
  title: string
  body: string
  tags: string[]
  pinned: boolean
  created_at: string
  updated_at: string
}

function nowISO() { return new Date().toISOString() }

function readAll(): KnowledgeEntry[] {
  if (!existsSync(FILE)) return []
  try { return JSON.parse(readFileSync(FILE, 'utf8')) as KnowledgeEntry[] }
  catch { return [] }
}

function writeAll(entries: KnowledgeEntry[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(entries, null, 2))
  renameSync(tmp, FILE)
}

export function isKnowledgeCategory(v: unknown): v is KnowledgeCategory {
  return KNOWLEDGE_CATEGORIES.includes(v as KnowledgeCategory)
}

export function listKnowledge(filters: {
  brand?: string | null
  category?: string | null
  search?: string | null
} = {}): KnowledgeEntry[] {
  const brand = filters.brand ?? process.env.BRAND ?? null
  const q = filters.search?.toLowerCase()
  return readAll()
    .filter(e => !brand || brand === 'default' ? true : e.brand === brand)
    .filter(e => !filters.category || e.category === filters.category)
    .filter(e => !q || e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q)))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updated_at.localeCompare(a.updated_at)
    })
}

export function getKnowledge(id: string) {
  return readAll().find(e => e.id === id)
}

export function createKnowledge(input: {
  category: KnowledgeCategory
  title: string
  body: string
  tags?: string[]
  pinned?: boolean
  brand?: string
}): KnowledgeEntry {
  const ts = nowISO()
  const entry: KnowledgeEntry = {
    id: randomUUID(),
    brand: input.brand ?? process.env.BRAND ?? 'default',
    category: input.category,
    title: input.title,
    body: input.body,
    tags: input.tags ?? [],
    pinned: input.pinned ?? false,
    created_at: ts,
    updated_at: ts,
  }
  const all = readAll()
  all.push(entry)
  writeAll(all)
  return entry
}

export function updateKnowledge(id: string, patch: Partial<Pick<KnowledgeEntry, 'category' | 'title' | 'body' | 'tags' | 'pinned'>>): KnowledgeEntry | undefined {
  const all = readAll()
  const i = all.findIndex(e => e.id === id)
  if (i === -1) return undefined
  all[i] = { ...all[i], ...patch, updated_at: nowISO() }
  writeAll(all)
  return all[i]
}

export function deleteKnowledge(id: string): boolean {
  const all = readAll()
  const next = all.filter(e => e.id !== id)
  if (next.length === all.length) return false
  writeAll(next)
  return true
}

/** Return a compact context string for the assistant */
export function buildAssistantContext(brand: string): string {
  const entries = listKnowledge({ brand })
  if (!entries.length) return ''
  const sections = KNOWLEDGE_CATEGORIES.map(cat => {
    const items = entries.filter(e => e.category === cat)
    if (!items.length) return null
    return `### ${CATEGORY_LABELS[cat]}\n${items.map(e => `**${e.title}**: ${e.body}`).join('\n\n')}`
  }).filter(Boolean)
  return sections.join('\n\n')
}
