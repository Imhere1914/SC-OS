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
  const p = dbPath(file)
  writeFileSync(p + '.tmp', JSON.stringify(data, null, 2))
  renameSync(p + '.tmp', p)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SocialLinks {
  facebook?: string
  twitter?: string
  instagram?: string
  linkedin?: string
  youtube?: string
}

export interface BusinessAddress {
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export interface BrandingProfile {
  brand: string
  business_name: string
  tagline: string
  description: string
  logo_url: string
  favicon_url: string
  primary_color: string
  secondary_color: string
  accent_color: string
  email_header_html: string
  email_footer_html: string
  email_from_name: string
  email_reply_to: string
  sms_sender_name: string
  website_url: string
  address: BusinessAddress
  phone: string
  social_links: SocialLinks
  timezone: string
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD'
  date_format: string
  invoice_prefix: string
  invoice_next_number: number
  proposal_prefix: string
  contract_prefix: string
  terms_and_conditions: string
  privacy_policy_url: string
  created_at: string
  updated_at: string
}

// ── Defaults ──────────────────────────────────────────────────────────────────

function defaultProfile(brand: string): BrandingProfile {
  const now = new Date().toISOString()
  return {
    brand,
    business_name: '',
    tagline: '',
    description: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#22c55e',
    secondary_color: '#4ade80',
    accent_color: '#22c55e',
    email_header_html: '',
    email_footer_html: '',
    email_from_name: '',
    email_reply_to: '',
    sms_sender_name: '',
    website_url: '',
    address: {},
    phone: '',
    social_links: {},
    timezone: 'America/New_York',
    currency: 'USD',
    date_format: 'MM/DD/YYYY',
    invoice_prefix: 'INV-',
    invoice_next_number: 1001,
    proposal_prefix: 'PROP-',
    contract_prefix: 'CONTR-',
    terms_and_conditions: '',
    privacy_policy_url: '',
    created_at: now,
    updated_at: now,
  }
}

// ── Store functions ───────────────────────────────────────────────────────────

export function getBrandingProfile(brand: string): BrandingProfile {
  const stored = readJson<Partial<BrandingProfile> | null>(`branding-${brand}.json`, null)
  if (!stored) return defaultProfile(brand)
  return { ...defaultProfile(brand), ...stored }
}

export function upsertBrandingProfile(brand: string, data: Partial<Omit<BrandingProfile, 'brand' | 'created_at'>>): BrandingProfile {
  const existing = getBrandingProfile(brand)
  const updated: BrandingProfile = {
    ...existing,
    ...data,
    // Merge nested objects
    address: data.address ? { ...existing.address, ...data.address } : existing.address,
    social_links: data.social_links ? { ...existing.social_links, ...data.social_links } : existing.social_links,
    brand,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  }
  writeJson(`branding-${brand}.json`, updated)
  return updated
}
