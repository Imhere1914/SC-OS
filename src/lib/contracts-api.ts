export type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'cancelled'

export interface ContractVariable {
  key: string
  label: string
  default_value: string
}

export interface ContractTemplate {
  id: string
  brand: string
  name: string
  description: string
  category: string
  body_html: string
  variables: ContractVariable[]
  created_at: string
  updated_at: string
}

export interface ContractRecord {
  id: string
  brand: string
  template_id?: string
  contact_id?: string
  contact_name?: string
  title: string
  body_html: string
  status: ContractStatus
  variables_data: Record<string, string>
  share_token: string
  sent_at?: string
  signed_at?: string
  signature_name?: string
  signature_data?: string
  signature_ip?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export const STATUS_COLORS: Record<ContractStatus, string> = {
  draft: 'var(--theme-muted)',
  sent: '#3b82f6',
  signed: '#22c55e',
  expired: '#f97316',
  cancelled: '#ef4444',
}

export const STATUS_BG: Record<ContractStatus, string> = {
  draft: 'var(--theme-hover)',
  sent: '#3b82f610',
  signed: '#22c55e10',
  expired: '#f9731615',
  cancelled: '#ef444410',
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchTemplates(brand?: string): Promise<ContractTemplate[]> {
  const url = new URL('/api/contracts/templates', location.origin)
  if (brand) url.searchParams.set('brand', brand)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load templates')
  return res.json()
}

export async function createTemplate(data: Partial<ContractTemplate>): Promise<ContractTemplate> {
  const res = await fetch('/api/contracts/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create template')
  return res.json()
}

export async function updateTemplate(id: string, data: Partial<ContractTemplate>): Promise<ContractTemplate> {
  const res = await fetch(`/api/contracts/templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update template')
  return res.json()
}

export async function deleteTemplate(id: string, brand?: string): Promise<void> {
  const url = new URL(`/api/contracts/templates/${id}`, location.origin)
  if (brand) url.searchParams.set('brand', brand)
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete template')
}

export async function fetchContracts(brand?: string): Promise<ContractRecord[]> {
  const url = new URL('/api/contracts', location.origin)
  if (brand) url.searchParams.set('brand', brand)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load contracts')
  return res.json()
}

export async function createContract(data: Partial<ContractRecord>): Promise<ContractRecord> {
  const res = await fetch('/api/contracts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create contract')
  return res.json()
}

export async function updateContract(id: string, data: Partial<ContractRecord>): Promise<ContractRecord> {
  const res = await fetch(`/api/contracts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update contract')
  return res.json()
}

export async function deleteContract(id: string, brand?: string): Promise<void> {
  const url = new URL(`/api/contracts/${id}`, location.origin)
  if (brand) url.searchParams.set('brand', brand)
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete contract')
}

export async function sendContract(id: string, brand?: string): Promise<ContractRecord> {
  const res = await fetch(`/api/contracts/${id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(brand ? { brand } : {}),
  })
  if (!res.ok) {
    const err = await res.json() as { error?: string }
    throw new Error(err.error ?? 'Failed to send contract')
  }
  return res.json()
}

/** Extract {{variable}} placeholders from HTML body */
export function extractVariables(bodyHtml: string): string[] {
  const matches = bodyHtml.match(/\{\{([^}]+)\}\}/g) ?? []
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))]
}

/** Replace {{variable}} with values from data map */
export function renderTemplate(bodyHtml: string, data: Record<string, string>): string {
  return bodyHtml.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => data[key.trim()] ?? `{{${key.trim()}}}`)
}
