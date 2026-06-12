import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'node:crypto'

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

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReviewRequest {
  id: string
  brand?: string
  contact_id?: string
  contact_name: string
  contact_email: string
  message?: string       // custom message in the email
  review_url?: string    // e.g. Google Maps / Yelp / Healthgrades link
  status: 'sent' | 'clicked' | 'reviewed'
  sent_at: string
  clicked_at?: string
  reviewed_at?: string
}

export type CreateReviewRequestInput = Omit<ReviewRequest, 'id' | 'status' | 'sent_at'>

// ── Helpers ──────────────────────────────────────────────────────────────────

function file(brand?: string) {
  return brand ? `review-requests-${brand}.json` : 'review-requests.json'
}

// ── Store ────────────────────────────────────────────────────────────────────

export function listReviewRequests(brand?: string): ReviewRequest[] {
  return readJson<ReviewRequest[]>(file(brand), [])
}

export function getReviewRequest(id: string, brand?: string): ReviewRequest | null {
  return listReviewRequests(brand).find(r => r.id === id) ?? null
}

export function createReviewRequest(data: CreateReviewRequestInput): ReviewRequest {
  const brand = data.brand
  const all = listReviewRequests(brand)
  const record: ReviewRequest = {
    ...data,
    id: randomUUID(),
    status: 'sent',
    sent_at: new Date().toISOString(),
  }
  all.unshift(record)
  writeJson(file(brand), all)
  return record
}

export function updateReviewRequest(
  id: string,
  updates: Partial<Omit<ReviewRequest, 'id' | 'sent_at'>>,
  brand?: string,
): ReviewRequest | null {
  const all = listReviewRequests(brand)
  const idx = all.findIndex(r => r.id === id)
  if (idx === -1) return null
  const updated: ReviewRequest = { ...all[idx], ...updates, id: all[idx].id, sent_at: all[idx].sent_at }
  all[idx] = updated
  writeJson(file(brand), all)
  return updated
}

export function deleteReviewRequest(id: string, brand?: string): boolean {
  const all = listReviewRequests(brand)
  const next = all.filter(r => r.id !== id)
  if (next.length === all.length) return false
  writeJson(file(brand), next)
  return true
}
