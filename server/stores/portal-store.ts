import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Portal token store — token-gated client portal links.
 * One file per brand: portal-tokens-{brand}.json
 */

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

export interface PortalToken {
  id: string           // nanoid — this IS the token used in the URL
  contact_id: string
  brand: string
  label: string        // e.g. "Jane Smith Portal"
  created_at: string
  expires_at?: string  // optional ISO date
  last_accessed_at?: string
  access_count: number
  show_projects: boolean
  show_invoices: boolean
  show_proposals: boolean
}

function file(brand: string) {
  return `portal-tokens-${brand}.json`
}

// ── Store functions ──────────────────────────────────────────────────────────

export function listPortalTokens(brand: string): PortalToken[] {
  return readJson<PortalToken[]>(file(brand), [])
}

/** Search ALL brands for a token by id. */
export function getPortalToken(token: string): PortalToken | undefined {
  // Try the known brands first, then fall back to scanning files
  const BRANDS = ['sc', 'hfm', 'default']
  for (const brand of BRANDS) {
    const found = listPortalTokens(brand).find(t => t.id === token)
    if (found) return found
  }
  // Also try any additional brand set in env
  const envBrand = process.env.BRAND
  if (envBrand && !BRANDS.includes(envBrand)) {
    const found = listPortalTokens(envBrand).find(t => t.id === token)
    if (found) return found
  }
  return undefined
}

export interface CreatePortalTokenInput {
  contact_id: string
  label: string
  expires_at?: string
  show_projects?: boolean
  show_invoices?: boolean
  show_proposals?: boolean
}

export function createPortalToken(brand: string, data: CreatePortalTokenInput): PortalToken {
  const tokens = listPortalTokens(brand)
  const now = new Date().toISOString()
  const token: PortalToken = {
    id: randomUUID(),
    contact_id: data.contact_id,
    brand,
    label: data.label,
    created_at: now,
    expires_at: data.expires_at,
    access_count: 0,
    show_projects: data.show_projects ?? true,
    show_invoices: data.show_invoices ?? true,
    show_proposals: data.show_proposals ?? true,
  }
  writeJson(file(brand), [token, ...tokens])
  return token
}

export function updatePortalToken(brand: string, id: string, patch: Partial<Omit<PortalToken, 'id' | 'brand' | 'created_at'>>): PortalToken {
  const tokens = listPortalTokens(brand)
  const idx = tokens.findIndex(t => t.id === id)
  if (idx === -1) throw new Error(`Portal token ${id} not found`)
  const updated: PortalToken = { ...tokens[idx], ...patch }
  tokens[idx] = updated
  writeJson(file(brand), tokens)
  return updated
}

export function deletePortalToken(brand: string, id: string): void {
  const tokens = listPortalTokens(brand)
  writeJson(file(brand), tokens.filter(t => t.id !== id))
}

/** Update last_accessed_at and increment access_count. Finds token across all brands. */
export function touchPortalToken(token: string): void {
  const existing = getPortalToken(token)
  if (!existing) return
  updatePortalToken(existing.brand, existing.id, {
    last_accessed_at: new Date().toISOString(),
    access_count: existing.access_count + 1,
  })
}
