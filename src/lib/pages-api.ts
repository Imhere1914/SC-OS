/**
 * Landing pages API client — /api/pages routes.
 */

import type { PageTemplate } from './pages-templates'

const API = '/api/pages'

export type PageStatus = 'draft' | 'published'

export type Page = {
  id: string
  brand: string
  slug: string
  title: string
  template: PageTemplate
  status: PageStatus
  fields: Record<string, string>
  accent_color: string
  published_at: string | null
  created_at: string
  updated_at: string
}

export type CreatePageInput = {
  title: string
  slug?: string
  template?: PageTemplate
  fields?: Record<string, string>
  accent_color?: string
  brand?: string
}

export type UpdatePageInput = {
  title?: string
  slug?: string
  fields?: Record<string, string>
  accent_color?: string
}

export async function fetchPages(params?: {
  status?: string
  brand?: string
}): Promise<Page[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.brand) qs.set('brand', params.brand)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load pages (${res.status})`)
  const data = (await res.json()) as { pages?: Page[] }
  return Array.isArray(data.pages) ? data.pages : []
}

export async function createPage(input: CreatePageInput): Promise<Page> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create page (${res.status})`)
  }
  const data = (await res.json()) as { page: Page }
  return data.page
}

export async function updatePage(
  id: string,
  updates: UpdatePageInput,
): Promise<Page> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update page (${res.status})`)
  }
  const data = (await res.json()) as { page: Page }
  return data.page
}

export async function setPagePublished(
  id: string,
  publish: boolean,
): Promise<Page> {
  const res = await fetch(
    `${API}/${id}?action=${publish ? 'publish' : 'unpublish'}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
  )
  if (!res.ok) throw new Error(`Failed to update page (${res.status})`)
  const data = (await res.json()) as { page: Page }
  return data.page
}

export async function deletePage(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete page (${res.status})`)
}

/** Fetch a published page by slug (public — used by the renderer). */
export async function fetchPublicPage(slug: string): Promise<Page | null> {
  const res = await fetch(`${API}/public/${encodeURIComponent(slug)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to load page (${res.status})`)
  const data = (await res.json()) as { page: Page }
  return data.page
}
