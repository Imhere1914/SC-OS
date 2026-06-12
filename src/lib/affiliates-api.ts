const API = '/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AffiliateRecord {
  id: string
  brand: string
  name: string
  email: string | null
  phone: string | null
  code: string
  commission_pct: number
  status: 'active' | 'paused' | 'inactive'
  total_referrals: number
  total_revenue_cents: number
  total_commission_cents: number
  notes: string
  created_at: string
  updated_at: string
}

export interface ReferralRecord {
  id: string
  brand: string
  affiliate_id: string
  affiliate_name: string
  contact_id: string | null
  contact_name: string
  contact_email: string | null
  source_code: string
  deal_value_cents: number
  commission_cents: number
  status: 'pending' | 'converted' | 'paid' | 'cancelled'
  converted_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface TrackResult {
  affiliate_id: string
  affiliate_name: string
  commission_pct: number
}

// ── Affiliates ─────────────────────────────────────────────────────────────────

export async function listAffiliates(brand?: string): Promise<AffiliateRecord[]> {
  const url = brand ? `${API}/affiliates?brand=${brand}` : `${API}/affiliates`
  const res = await fetch(url)
  const d = await res.json() as { affiliates?: AffiliateRecord[] }
  return d.affiliates ?? []
}

export async function createAffiliate(data: Partial<AffiliateRecord>): Promise<AffiliateRecord> {
  const res = await fetch(`${API}/affiliates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<AffiliateRecord>
}

export async function updateAffiliate(id: string, data: Partial<AffiliateRecord>): Promise<AffiliateRecord> {
  const res = await fetch(`${API}/affiliates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<AffiliateRecord>
}

export async function deleteAffiliate(id: string): Promise<void> {
  await fetch(`${API}/affiliates/${id}`, { method: 'DELETE' })
}

// ── Referrals ─────────────────────────────────────────────────────────────────

export async function listReferrals(brand?: string, affiliateId?: string): Promise<ReferralRecord[]> {
  const params = new URLSearchParams()
  if (brand) params.set('brand', brand)
  if (affiliateId) params.set('affiliate_id', affiliateId)
  const qs = params.toString()
  const res = await fetch(`${API}/referrals${qs ? `?${qs}` : ''}`)
  const d = await res.json() as { referrals?: ReferralRecord[] }
  return d.referrals ?? []
}

export async function createReferral(data: {
  affiliate_id: string
  contact_name: string
  contact_email?: string | null
  contact_id?: string | null
  deal_value_cents?: number
  brand?: string
}): Promise<ReferralRecord> {
  const res = await fetch(`${API}/referrals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<ReferralRecord>
}

export async function updateReferral(id: string, data: Partial<ReferralRecord>): Promise<ReferralRecord> {
  const res = await fetch(`${API}/referrals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<ReferralRecord>
}

export async function trackAffiliate(code: string): Promise<TrackResult | null> {
  const res = await fetch(`${API}/affiliates/track/${encodeURIComponent(code)}`)
  if (!res.ok) return null
  return res.json() as Promise<TrackResult>
}
