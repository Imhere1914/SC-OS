/** Templates API client — /api/templates routes. */

const API = '/api/templates'

export type TemplateCategory = 'email' | 'sms' | 'social' | 'reply' | 'note'

export type Template = {
  id: string
  brand: string
  name: string
  category: TemplateCategory
  subject: string
  body: string
  tags: string[]
  created_at: string
  updated_at: string
}

export type CreateTemplateInput = {
  name: string
  category?: TemplateCategory
  subject?: string
  body?: string
  tags?: string[]
  brand?: string
}

export type UpdateTemplateInput = Partial<Omit<CreateTemplateInput, 'brand'>>

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'email',
  'sms',
  'social',
  'reply',
  'note',
]

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  email: 'Email',
  sms: 'SMS',
  social: 'Social',
  reply: 'Reply',
  note: 'Note',
}

export async function fetchTemplates(params?: {
  category?: string
  brand?: string
}): Promise<Template[]> {
  const qs = new URLSearchParams()
  if (params?.category) qs.set('category', params.category)
  if (params?.brand) qs.set('brand', params.brand)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load templates (${res.status})`)
  const data = (await res.json()) as { templates?: Template[] }
  return Array.isArray(data.templates) ? data.templates : []
}

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<Template> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create template (${res.status})`)
  }
  const data = (await res.json()) as { template: Template }
  return data.template
}

export async function updateTemplate(
  id: string,
  updates: UpdateTemplateInput,
): Promise<Template> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update template (${res.status})`)
  }
  const data = (await res.json()) as { template: Template }
  return data.template
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete template (${res.status})`)
}
