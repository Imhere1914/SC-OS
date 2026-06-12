/**
 * Prospects store — inbound B2B lead capture for the prospecting pipeline.
 * File-backed JSON, atomic writes, per-brand files (prospects-{brand}.json), capped at 5000.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
const MAX_PROSPECTS = 5000

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

export type ProspectStatus = 'new' | 'reviewed' | 'converted' | 'dismissed'
export type ProspectTier = 'hot' | 'warm' | 'cold'

export interface ProspectRecord {
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
  source: string                 // e.g. 'codex-prospecting', 'manual'
  campaign?: string
  notes?: string
  custom?: Record<string, string>
  score: number                  // 0-100
  tier: ProspectTier
  status: ProspectStatus
  contact_id?: string            // set when converted to a contact
  deal_id?: string               // set when a deal was auto/manually created
  raw_payload?: unknown          // the original inbound body, for audit
  created_at: string
  updated_at: string
}

export interface ProspectInput {
  name: string
  email?: string
  phone?: string
  company?: string
  title?: string
  website?: string
  industry?: string
  location?: string
  employee_count?: number
  source?: string
  campaign?: string
  notes?: string
  custom?: Record<string, string>
  raw_payload?: unknown
}

function file(brand: string) {
  return `prospects-${brand}.json`
}

// ── Scoring ─────────────────────────────────────────────────────────────────
// Transparent, rule-based 0-100 score. Tier: >=70 hot, >=40 warm, else cold.

const SENIOR_KEYWORDS = ['founder', 'owner', 'ceo', 'cfo', 'coo', 'cto', 'president', 'vp', 'vice president', 'director', 'head of', 'manager', 'principal', 'partner']
const SC_INDUSTRY_KEYWORDS = ['home service', 'home services', 'hvac', 'plumbing', 'plumber', 'electrical', 'electrician', 'roofing', 'landscaping', 'cleaning', 'pest control', 'contractor', 'construction', 'remodel']

export function scoreLead(data: ProspectInput): { score: number; tier: ProspectTier } {
  let score = 0
  if (data.email && data.email.trim()) score += 25
  if (data.phone && data.phone.trim()) score += 15
  if (data.company && data.company.trim()) score += 15
  if (data.title && data.title.trim()) {
    score += 10
    const t = data.title.toLowerCase()
    if (SENIOR_KEYWORDS.some(k => t.includes(k))) score += 15
  }
  if (data.website && data.website.trim()) score += 10
  if (typeof data.employee_count === 'number' && data.employee_count > 0) score += 10
  if (data.industry && data.industry.trim()) {
    const ind = data.industry.toLowerCase()
    if (SC_INDUSTRY_KEYWORDS.some(k => ind.includes(k))) score += 10
    else score += 3
  }

  score = Math.max(0, Math.min(100, score))
  const tier: ProspectTier = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold'
  return { score, tier }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listProspects(
  brand: string,
  opts: { status?: string; tier?: string; limit?: number } = {},
): ProspectRecord[] {
  let all = readJson<ProspectRecord[]>(file(brand), [])
  if (opts.status) all = all.filter(p => p.status === opts.status)
  if (opts.tier) all = all.filter(p => p.tier === opts.tier)
  all = all.sort((a, b) => b.created_at.localeCompare(a.created_at)) // newest first
  if (typeof opts.limit === 'number' && opts.limit > 0) all = all.slice(0, opts.limit)
  return all
}

export function getProspect(brand: string, id: string): ProspectRecord | null {
  return readJson<ProspectRecord[]>(file(brand), []).find(p => p.id === id) ?? null
}

export function createProspect(brand: string, data: ProspectInput): ProspectRecord {
  const all = readJson<ProspectRecord[]>(file(brand), [])
  const now = new Date().toISOString()
  const { score, tier } = scoreLead(data)
  const record: ProspectRecord = {
    id: randomUUID(),
    brand,
    name: data.name,
    email: data.email?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
    company: data.company?.trim() || undefined,
    title: data.title?.trim() || undefined,
    website: data.website?.trim() || undefined,
    industry: data.industry?.trim() || undefined,
    location: data.location?.trim() || undefined,
    employee_count: typeof data.employee_count === 'number' ? data.employee_count : undefined,
    source: data.source?.trim() || 'manual',
    campaign: data.campaign?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    custom: data.custom && typeof data.custom === 'object' ? data.custom : undefined,
    score,
    tier,
    status: 'new',
    raw_payload: data.raw_payload,
    created_at: now,
    updated_at: now,
  }
  const next = [record, ...all].slice(0, MAX_PROSPECTS)
  writeJson(file(brand), next)
  return record
}

export function updateProspect(
  brand: string,
  id: string,
  updates: Partial<Omit<ProspectRecord, 'id' | 'brand' | 'created_at'>>,
): ProspectRecord | null {
  const all = readJson<ProspectRecord[]>(file(brand), [])
  const idx = all.findIndex(p => p.id === id)
  if (idx === -1) return null
  const updated: ProspectRecord = {
    ...all[idx],
    ...updates,
    id: all[idx].id,
    brand: all[idx].brand,
    created_at: all[idx].created_at,
    updated_at: new Date().toISOString(),
  }
  all[idx] = updated
  writeJson(file(brand), all)
  return updated
}

export function deleteProspect(brand: string, id: string): boolean {
  const all = readJson<ProspectRecord[]>(file(brand), [])
  const next = all.filter(p => p.id !== id)
  if (next.length === all.length) return false
  writeJson(file(brand), next)
  return true
}

export interface ProspectStats {
  new_count: number
  by_tier: Record<ProspectTier, number>
  by_source: Record<string, number>
  converted_count: number
  conversion_rate: number   // 0-100, converted / total
  this_week_count: number
}

export function getProspectStats(brand: string): ProspectStats {
  const all = readJson<ProspectRecord[]>(file(brand), [])
  const by_tier: Record<ProspectTier, number> = { hot: 0, warm: 0, cold: 0 }
  const by_source: Record<string, number> = {}
  let new_count = 0
  let converted_count = 0
  let this_week_count = 0
  const weekAgo = Date.now() - 7 * 86_400_000

  for (const p of all) {
    by_tier[p.tier] = (by_tier[p.tier] ?? 0) + 1
    by_source[p.source] = (by_source[p.source] ?? 0) + 1
    if (p.status === 'new') new_count++
    if (p.status === 'converted') converted_count++
    if (new Date(p.created_at).getTime() >= weekAgo) this_week_count++
  }

  const conversion_rate = all.length > 0 ? Math.round((converted_count / all.length) * 100) : 0
  return { new_count, by_tier, by_source, converted_count, conversion_rate, this_week_count }
}
