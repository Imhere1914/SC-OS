import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

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

// ── Types ────────────────────────────────────────────────────────────────────

export interface TestimonialRecord {
  id: string
  brand: string
  author_name: string
  author_title?: string
  author_company?: string
  author_avatar_url?: string
  body: string
  rating?: number
  source: 'manual' | 'form'
  status: 'pending' | 'approved' | 'rejected'
  featured: boolean
  contact_id?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function file(brand: string) {
  return `testimonials-${brand}.json`
}

// ── Store ────────────────────────────────────────────────────────────────────

export function listTestimonials(
  brand: string,
  opts?: { status?: string; featured?: boolean },
): TestimonialRecord[] {
  let records = readJson<TestimonialRecord[]>(file(brand), [])
  if (opts?.status) records = records.filter(r => r.status === opts.status)
  if (opts?.featured !== undefined) records = records.filter(r => r.featured === opts.featured)
  return records
}

export function getTestimonial(brand: string, id: string): TestimonialRecord | null {
  return listTestimonials(brand).find(r => r.id === id) ?? null
}

export function createTestimonial(
  brand: string,
  data: Omit<TestimonialRecord, 'id' | 'brand' | 'created_at' | 'updated_at'>,
): TestimonialRecord {
  const all = listTestimonials(brand)
  const now = new Date().toISOString()
  const record: TestimonialRecord = {
    ...data,
    id: nanoid(),
    brand,
    created_at: now,
    updated_at: now,
  }
  all.unshift(record)
  writeJson(file(brand), all)
  return record
}

export function updateTestimonial(
  brand: string,
  id: string,
  patch: Partial<Omit<TestimonialRecord, 'id' | 'brand' | 'created_at'>>,
): TestimonialRecord | null {
  const all = listTestimonials(brand)
  const idx = all.findIndex(r => r.id === id)
  if (idx === -1) return null
  const updated: TestimonialRecord = {
    ...all[idx],
    ...patch,
    id: all[idx].id,
    brand: all[idx].brand,
    created_at: all[idx].created_at,
    updated_at: new Date().toISOString(),
  }
  all[idx] = updated
  writeJson(file(brand), all)
  return updated
}

export function deleteTestimonial(brand: string, id: string): boolean {
  const all = listTestimonials(brand)
  const next = all.filter(r => r.id !== id)
  if (next.length === all.length) return false
  writeJson(file(brand), next)
  return true
}

export function approveTestimonial(brand: string, id: string): TestimonialRecord | null {
  return updateTestimonial(brand, id, { status: 'approved' })
}

export function getApprovedTestimonials(brand: string): TestimonialRecord[] {
  return listTestimonials(brand, { status: 'approved' }).sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return b.created_at.localeCompare(a.created_at)
  })
}
