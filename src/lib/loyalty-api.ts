const API = '/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoyaltyTier {
  id: string
  name: string
  min_points: number
  color: string
  perks: string[]
}

export interface LoyaltyProgram {
  brand: string
  name: string
  points_per_dollar: number
  tiers: LoyaltyTier[]
  enabled: boolean
  updated_at: string
}

export interface LoyaltyAccount {
  id: string
  brand: string
  contact_id: string
  contact_name: string
  points_balance: number
  lifetime_points: number
  tier_id: string
  tier?: LoyaltyTier | null
  created_at: string
  updated_at: string
}

export interface LoyaltyTransaction {
  id: string
  brand: string
  account_id: string
  contact_id: string
  type: 'earn' | 'redeem' | 'adjust' | 'expire'
  points: number
  description: string
  reference_id?: string
  created_at: string
}

// ── Program ───────────────────────────────────────────────────────────────────

export async function getLoyaltyProgram(brand: string): Promise<LoyaltyProgram> {
  const res = await fetch(`${API}/loyalty/program?brand=${encodeURIComponent(brand)}`)
  return res.json() as Promise<LoyaltyProgram>
}

export async function upsertLoyaltyProgram(brand: string, data: Partial<LoyaltyProgram>): Promise<LoyaltyProgram> {
  const res = await fetch(`${API}/loyalty/program?brand=${encodeURIComponent(brand)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<LoyaltyProgram>
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function listLoyaltyAccounts(brand: string): Promise<LoyaltyAccount[]> {
  const res = await fetch(`${API}/loyalty/accounts?brand=${encodeURIComponent(brand)}`)
  const d = await res.json() as { accounts?: LoyaltyAccount[] }
  return d.accounts ?? []
}

export async function getLoyaltyAccount(brand: string, contactId: string): Promise<LoyaltyAccount | null> {
  const res = await fetch(`${API}/loyalty/accounts/${encodeURIComponent(contactId)}?brand=${encodeURIComponent(brand)}`)
  if (!res.ok) return null
  return res.json() as Promise<LoyaltyAccount>
}

// ── Points operations ─────────────────────────────────────────────────────────

export async function awardPoints(
  brand: string,
  contactId: string,
  data: { points: number; description: string; reference_id?: string; contact_name?: string },
): Promise<LoyaltyAccount> {
  const res = await fetch(`${API}/loyalty/accounts/${encodeURIComponent(contactId)}/award?brand=${encodeURIComponent(brand)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<LoyaltyAccount>
}

export async function redeemPoints(
  brand: string,
  contactId: string,
  data: { points: number; description: string },
): Promise<LoyaltyAccount> {
  const res = await fetch(`${API}/loyalty/accounts/${encodeURIComponent(contactId)}/redeem?brand=${encodeURIComponent(brand)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json() as { error?: string }
    throw new Error(err.error ?? 'Redeem failed')
  }
  return res.json() as Promise<LoyaltyAccount>
}

export async function adjustPoints(
  brand: string,
  contactId: string,
  data: { points: number; description: string },
): Promise<LoyaltyAccount> {
  const res = await fetch(`${API}/loyalty/accounts/${encodeURIComponent(contactId)}/adjust?brand=${encodeURIComponent(brand)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<LoyaltyAccount>
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function listLoyaltyTransactions(brand: string, contactId?: string): Promise<LoyaltyTransaction[]> {
  const params = new URLSearchParams({ brand })
  if (contactId) params.set('contact_id', contactId)
  const res = await fetch(`${API}/loyalty/transactions?${params.toString()}`)
  const d = await res.json() as { transactions?: LoyaltyTransaction[] }
  return d.transactions ?? []
}
