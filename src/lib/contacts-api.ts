const API = '/api/contacts'

export type ContactStage = 'lead' | 'contacted' | 'qualified' | 'customer' | 'lost'
export type ContactSource =
  | 'webchat' | 'manual' | 'import' | 'email' | 'sms' | 'whatsapp' | 'social' | 'phone'

export type Contact = {
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
  custom_fields: Record<string, string>
  created_at: string
  updated_at: string
}

export type CreateContactInput = {
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  stage?: ContactStage
  source?: ContactSource
  tags?: string[]
  notes?: string
  owner?: string | null
  custom_fields?: Record<string, string>
}
export type UpdateContactInput = Partial<CreateContactInput>

export const CONTACT_STAGES: ContactStage[] = ['lead', 'contacted', 'qualified', 'customer', 'lost']
export const STAGE_LABELS: Record<ContactStage, string> = {
  lead: 'Lead', contacted: 'Contacted', qualified: 'Qualified', customer: 'Customer', lost: 'Lost',
}

export async function fetchContacts(params?: { stage?: string; search?: string }): Promise<Contact[]> {
  const qs = new URLSearchParams()
  if (params?.stage) qs.set('stage', params.stage)
  if (params?.search) qs.set('search', params.search)
  const suffix = qs.toString() ? `?${qs}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load contacts (${res.status})`)
  const data = (await res.json()) as { contacts?: Contact[] }
  return Array.isArray(data.contacts) ? data.contacts : []
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(e.error || `Failed to create contact (${res.status})`)
  }
  return ((await res.json()) as { contact: Contact }).contact
}

export async function updateContact(id: string, updates: UpdateContactInput): Promise<Contact> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(e.error || `Failed to update contact (${res.status})`)
  }
  return ((await res.json()) as { contact: Contact }).contact
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete contact (${res.status})`)
}

export async function mergeContacts(keepId: string, deleteId: string): Promise<Contact> {
  const res = await fetch(`${API}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepId, deleteId }),
  })
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(e.error || `Merge failed (${res.status})`)
  }
  return ((await res.json()) as { contact: Contact }).contact
}

export async function bulkContacts(action: 'delete' | 'stage' | 'tag', ids: string[], payload?: { stage?: ContactStage; tag?: string }): Promise<void> {
  const res = await fetch(`${API}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ids, ...payload }),
  })
  if (!res.ok) throw new Error(`Bulk action failed (${res.status})`)
}
