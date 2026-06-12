import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string) {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}
function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}
function writeJson(file: string, data: unknown) {
  const tmp = dbPath(file) + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, dbPath(file))
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AffiliateRecord {
  id: string
  brand: string
  name: string
  email: string | null
  phone: string | null
  code: string          // unique short code, e.g. "JOHN25"
  commission_pct: number  // 0–100
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
  deal_value_cents: number    // 0 if no deal yet
  commission_cents: number    // calculated from affiliate.commission_pct
  status: 'pending' | 'converted' | 'paid' | 'cancelled'
  converted_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

// ── File helpers ──────────────────────────────────────────────────────────────

function affiliateFile(brand?: string) {
  return brand ? `affiliates-${brand}.json` : 'affiliates.json'
}

function referralFile(brand?: string) {
  return brand ? `referrals-${brand}.json` : 'referrals.json'
}

// ── Code uniqueness helper ────────────────────────────────────────────────────

function ensureUniqueCode(baseCode: string, brand?: string): string {
  const existing = listAffiliates(brand).map(a => a.code.toUpperCase())
  let code = baseCode.toUpperCase()
  if (!existing.includes(code)) return code
  let i = 2
  while (existing.includes(`${code}${i}`)) i++
  return `${code}${i}`
}

// ── Affiliates CRUD ───────────────────────────────────────────────────────────

export function listAffiliates(brand?: string): AffiliateRecord[] {
  return readJson<AffiliateRecord[]>(affiliateFile(brand), [])
}

export function getAffiliate(id: string, brand?: string): AffiliateRecord | null {
  const all = brand
    ? listAffiliates(brand)
    : [...listAffiliates('sc'), ...listAffiliates('hfm'), ...listAffiliates(undefined)]
  return all.find(a => a.id === id) ?? null
}

export function getAffiliateByCode(code: string, brand?: string): AffiliateRecord | null {
  const all = brand
    ? listAffiliates(brand)
    : [...listAffiliates('sc'), ...listAffiliates('hfm'), ...listAffiliates(undefined)]
  return all.find(a => a.code.toUpperCase() === code.toUpperCase()) ?? null
}

export interface CreateAffiliateInput {
  brand?: string
  name: string
  email?: string | null
  phone?: string | null
  code?: string
  commission_pct?: number
  status?: 'active' | 'paused' | 'inactive'
  notes?: string
}

export function createAffiliate(input: CreateAffiliateInput): AffiliateRecord {
  const affiliates = listAffiliates(input.brand)
  const now = new Date().toISOString()

  // Auto-generate code from name if not provided
  const baseCode = input.code?.trim()
    ? input.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    : input.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)

  const code = ensureUniqueCode(baseCode || 'AFF', input.brand)

  const affiliate: AffiliateRecord = {
    id: crypto.randomUUID(),
    brand: input.brand ?? 'default',
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    code,
    commission_pct: input.commission_pct ?? 10,
    status: input.status ?? 'active',
    total_referrals: 0,
    total_revenue_cents: 0,
    total_commission_cents: 0,
    notes: input.notes ?? '',
    created_at: now,
    updated_at: now,
  }

  writeJson(affiliateFile(input.brand), [affiliate, ...affiliates])
  return affiliate
}

export function updateAffiliate(
  id: string,
  patch: Partial<Omit<AffiliateRecord, 'id' | 'created_at'>>,
  brand?: string,
): AffiliateRecord | null {
  const affiliates = listAffiliates(brand)
  const idx = affiliates.findIndex(a => a.id === id)
  if (idx === -1) return null
  const now = new Date().toISOString()
  const updated: AffiliateRecord = { ...affiliates[idx], ...patch, updated_at: now }
  affiliates[idx] = updated
  writeJson(affiliateFile(brand), affiliates)
  return updated
}

export function deleteAffiliate(id: string, brand?: string): boolean {
  const affiliates = listAffiliates(brand)
  const next = affiliates.filter(a => a.id !== id)
  if (next.length === affiliates.length) return false
  writeJson(affiliateFile(brand), next)
  return true
}

// ── Referrals CRUD ────────────────────────────────────────────────────────────

export function listReferrals(brand?: string, affiliateId?: string): ReferralRecord[] {
  const all = readJson<ReferralRecord[]>(referralFile(brand), [])
  if (affiliateId) return all.filter(r => r.affiliate_id === affiliateId)
  return all
}

export interface CreateReferralInput {
  brand?: string
  affiliate_id: string
  contact_id?: string | null
  contact_name: string
  contact_email?: string | null
  deal_value_cents?: number
  notes?: string
}

export function createReferral(input: CreateReferralInput): ReferralRecord {
  const brand = input.brand ?? 'default'
  const referrals = listReferrals(brand)
  const now = new Date().toISOString()

  const affiliate = getAffiliate(input.affiliate_id) ?? { name: 'Unknown', code: '', commission_pct: 0 }
  const dealValue = input.deal_value_cents ?? 0
  const commissionCents = Math.round(dealValue * (affiliate.commission_pct / 100))

  const referral: ReferralRecord = {
    id: crypto.randomUUID(),
    brand,
    affiliate_id: input.affiliate_id,
    affiliate_name: affiliate.name,
    contact_id: input.contact_id ?? null,
    contact_name: input.contact_name,
    contact_email: input.contact_email ?? null,
    source_code: affiliate.code,
    deal_value_cents: dealValue,
    commission_cents: commissionCents,
    status: 'pending',
    converted_at: null,
    paid_at: null,
    created_at: now,
    updated_at: now,
  }

  writeJson(referralFile(brand), [referral, ...referrals])

  // Update affiliate stats
  const aff = getAffiliate(input.affiliate_id, brand)
  if (aff) {
    updateAffiliate(input.affiliate_id, {
      total_referrals: aff.total_referrals + 1,
      total_revenue_cents: aff.total_revenue_cents + dealValue,
      total_commission_cents: aff.total_commission_cents + commissionCents,
    }, brand)
  }

  return referral
}

export function updateReferral(
  id: string,
  patch: Partial<Omit<ReferralRecord, 'id' | 'created_at'>>,
  brand?: string,
): ReferralRecord | null {
  const referrals = listReferrals(brand)
  const idx = referrals.findIndex(r => r.id === id)
  if (idx === -1) return null
  const prev = referrals[idx]
  const now = new Date().toISOString()
  const updated: ReferralRecord = { ...prev, ...patch, updated_at: now }

  // Auto-stamp converted_at / paid_at
  if (!prev.converted_at && patch.status === 'converted') {
    updated.converted_at = now
  }
  if (!prev.paid_at && patch.status === 'paid') {
    updated.paid_at = now
  }

  referrals[idx] = updated
  writeJson(referralFile(brand), referrals)
  return updated
}
