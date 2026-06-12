export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined'

export interface ProposalSection {
  id: string
  type: 'heading' | 'text' | 'pricing' | 'signature'
  content: string
  order: number
}

export interface PricingContent {
  items: { description: string; qty: number; unit_price: number }[]
  show_total: boolean
}

export interface ProposalRecord {
  id: string
  brand?: string
  title: string
  contact_id?: string
  contact_name?: string
  contact_email?: string
  deal_id?: string
  status: ProposalStatus
  sections: ProposalSection[]
  valid_until?: string
  notes?: string
  created_at: string
  updated_at: string
  sent_at?: string
  viewed_at?: string
  accepted_at?: string
  declined_at?: string
  signing_required?: boolean
  signature_data?: string
  signature_name?: string
  signature_email?: string
  signed_at?: string
}

export interface CreateProposalInput {
  brand?: string
  title: string
  contact_id?: string
  contact_name?: string
  contact_email?: string
  deal_id?: string
  status?: ProposalStatus
  sections?: ProposalSection[]
  valid_until?: string
  notes?: string
  signing_required?: boolean
}

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
}

export const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: 'var(--theme-muted)',
  sent: '#3b82f6',
  viewed: '#f59e0b',
  accepted: '#22c55e',
  declined: '#ef4444',
}

export const STATUS_BG: Record<ProposalStatus, string> = {
  draft: 'var(--theme-hover)',
  sent: '#3b82f610',
  viewed: '#f59e0b15',
  accepted: '#22c55e10',
  declined: '#ef444410',
}

export function calcProposalValue(sections: ProposalSection[]): number {
  return sections
    .filter(s => s.type === 'pricing')
    .reduce((total, s) => {
      try {
        const data = JSON.parse(s.content) as PricingContent
        return total + data.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
      } catch {
        return total
      }
    }, 0)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export async function fetchProposals(params?: { brand?: string }): Promise<ProposalRecord[]> {
  const url = new URL('/api/proposals', location.origin)
  if (params?.brand) url.searchParams.set('brand', params.brand)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load proposals')
  return res.json()
}

export async function fetchProposal(id: string, params?: { brand?: string }): Promise<ProposalRecord> {
  const url = new URL(`/api/proposals/${id}`, location.origin)
  if (params?.brand) url.searchParams.set('brand', params.brand)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load proposal')
  return res.json()
}

export async function createProposal(input: CreateProposalInput): Promise<ProposalRecord> {
  const res = await fetch('/api/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create proposal')
  return res.json()
}

export async function updateProposal(id: string, updates: Partial<ProposalRecord>): Promise<ProposalRecord> {
  const res = await fetch(`/api/proposals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update proposal')
  return res.json()
}

export async function deleteProposal(id: string): Promise<void> {
  const res = await fetch(`/api/proposals/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete proposal')
}

export async function sendProposal(id: string, brand?: string): Promise<ProposalRecord> {
  const res = await fetch(`/api/proposals/${id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(brand ? { brand } : {}),
  })
  if (!res.ok) {
    const err = await res.json() as { error?: string }
    throw new Error(err.error ?? 'Failed to send proposal')
  }
  return res.json()
}
