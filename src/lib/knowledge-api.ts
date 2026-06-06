/** Knowledge Vault API client */

export type KnowledgeCategory =
  | 'brand-voice' | 'icp' | 'services' | 'faq'
  | 'objections' | 'snippets' | 'strategy' | 'other'

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

export type KnowledgeEntry = {
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

export type CreateKnowledgeInput = {
  category: KnowledgeCategory
  title: string
  body: string
  tags?: string[]
  pinned?: boolean
  brand?: string
}

export type UpdateKnowledgeInput = Partial<Omit<CreateKnowledgeInput, 'brand'>>

export async function fetchKnowledge(filters?: { category?: KnowledgeCategory; search?: string }): Promise<KnowledgeEntry[]> {
  const p = new URLSearchParams()
  if (filters?.category) p.set('category', filters.category)
  if (filters?.search) p.set('search', filters.search)
  const res = await fetch(`/api/knowledge${p.toString() ? '?' + p : ''}`)
  if (!res.ok) throw new Error('Failed to load knowledge')
  return (await res.json()).entries
}

export async function createKnowledgeEntry(input: CreateKnowledgeInput): Promise<KnowledgeEntry> {
  const res = await fetch('/api/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Create failed')
  return (await res.json()).entry
}

export async function updateKnowledgeEntry(id: string, input: UpdateKnowledgeInput): Promise<KnowledgeEntry> {
  const res = await fetch(`/api/knowledge/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Update failed')
  return (await res.json()).entry
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}
