const API = '/api/prospecting'

export type ProspectStatus = 'new' | 'reviewed' | 'converted' | 'dismissed'
export type ProspectTier = 'hot' | 'warm' | 'cold'

export interface Prospect {
  id: string
  brand: string
  name: string
  email?: string
  phone?: string
  company?: string
  title?: string
  website?: string
  industry?: string
  location?: string
  employee_count?: number
  source: string
  campaign?: string
  notes?: string
  custom?: Record<string, string>
  score: number
  tier: ProspectTier
  status: ProspectStatus
  contact_id?: string
  deal_id?: string
  created_at: string
  updated_at: string
}

export interface ProspectStats {
  new_count: number
  by_tier: Record<ProspectTier, number>
  by_source: Record<string, number>
  converted_count: number
  conversion_rate: number
  this_week_count: number
}

export async function listProspects(
  brand: string,
  opts: { status?: string; tier?: string } = {},
): Promise<Prospect[]> {
  const params = new URLSearchParams({ brand })
  if (opts.status) params.set('status', opts.status)
  if (opts.tier) params.set('tier', opts.tier)
  const res = await fetch(`${API}?${params.toString()}`)
  const d = (await res.json()) as { prospects?: Prospect[] }
  return d.prospects ?? []
}

export async function getProspectStats(brand: string): Promise<ProspectStats> {
  const res = await fetch(`${API}/stats?brand=${brand}`)
  return res.json() as Promise<ProspectStats>
}

export async function updateProspect(
  brand: string,
  id: string,
  data: { status?: ProspectStatus; notes?: string },
): Promise<Prospect> {
  const res = await fetch(`${API}/${id}?brand=${brand}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const d = (await res.json()) as { prospect: Prospect }
  return d.prospect
}

export async function convertProspect(
  brand: string,
  id: string,
): Promise<{ ok: boolean; prospect: Prospect; deal_id: string }> {
  const res = await fetch(`${API}/${id}/convert?brand=${brand}`, { method: 'POST' })
  return res.json() as Promise<{ ok: boolean; prospect: Prospect; deal_id: string }>
}

export async function deleteProspect(brand: string, id: string): Promise<void> {
  await fetch(`${API}/${id}?brand=${brand}`, { method: 'DELETE' })
}

export interface ApiKeySummary {
  id: string
  name: string
  key_prefix: string
}

export async function listApiKeyPrefixes(): Promise<ApiKeySummary[]> {
  try {
    const res = await fetch('/api/api-keys')
    if (!res.ok) return []
    const d = (await res.json()) as { keys?: ApiKeySummary[] }
    return d.keys ?? []
  } catch {
    return []
  }
}
