/**
 * Email campaigns API client — /api/campaigns routes.
 */

const API = '/api/campaigns'

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'

export type CampaignAudience = {
  stages: string[]
  tags: string[]
  include_unverified: boolean
}

export type CampaignStats = {
  recipients: number
  sent: number
  failed: number
}

export type Campaign = {
  id: string
  brand: string
  name: string
  subject: string
  body: string
  audience: CampaignAudience
  status: CampaignStatus
  scheduled_at: string | null
  sent_at: string | null
  stats: CampaignStats
  created_by: string
  created_at: string
  updated_at: string
}

export type CreateCampaignInput = {
  name: string
  subject: string
  body?: string
  audience?: CampaignAudience
  scheduled_at?: string | null
  brand?: string
}

export type UpdateCampaignInput = Partial<Omit<CreateCampaignInput, 'brand'>> & {
  status?: CampaignStatus
}

export const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'var(--theme-muted)',
  scheduled: 'var(--theme-accent)',
  sending: 'var(--theme-warning)',
  sent: 'var(--theme-success)',
  failed: 'var(--theme-danger)',
}

export async function fetchCampaigns(params?: {
  status?: string
  brand?: string
}): Promise<Campaign[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.brand) qs.set('brand', params.brand)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load campaigns (${res.status})`)
  const data = (await res.json()) as { campaigns?: Campaign[] }
  return Array.isArray(data.campaigns) ? data.campaigns : []
}

export async function fetchCampaign(
  id: string,
): Promise<{ campaign: Campaign; recipient_preview: number }> {
  const res = await fetch(`${API}/${id}`)
  if (!res.ok) throw new Error(`Failed to load campaign (${res.status})`)
  return (await res.json()) as { campaign: Campaign; recipient_preview: number }
}

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<Campaign> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create campaign (${res.status})`)
  }
  const data = (await res.json()) as { campaign: Campaign }
  return data.campaign
}

export async function updateCampaign(
  id: string,
  updates: UpdateCampaignInput,
): Promise<Campaign> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update campaign (${res.status})`)
  }
  const data = (await res.json()) as { campaign: Campaign }
  return data.campaign
}

export async function sendCampaign(
  id: string,
): Promise<{ campaign: Campaign; error?: string }> {
  const res = await fetch(`${API}/${id}?action=send`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const data = (await res.json()) as { campaign?: Campaign; error?: string }
  if (!res.ok && !data.campaign) {
    throw new Error(data.error || `Failed to send campaign (${res.status})`)
  }
  return { campaign: data.campaign as Campaign, error: data.error }
}

export async function deleteCampaign(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete campaign (${res.status})`)
}
