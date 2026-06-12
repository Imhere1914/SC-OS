/**
 * API key management store.
 * Raw keys are never stored — only SHA-256 hashes + display prefixes.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { createHash } from 'crypto'
import { readdirSync } from 'fs'

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

export interface ApiKey {
  id: string
  brand: string
  name: string           // "My Integration", "Zapier", etc.
  key_hash: string       // SHA-256 hash of the actual key (never store plaintext after creation)
  key_prefix: string     // first 8 chars of key for display: "aios_sk_abc12345..."
  scopes: string[]       // e.g. ['contacts:read', 'contacts:write', 'invoices:read']
  last_used_at?: string
  created_at: string
  expires_at?: string
  active: boolean
}

function fileName(brand: string) {
  return `api-keys-${brand}.json`
}

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

// ── Public API ────────────────────────────────────────────────────────────────

/** List API keys for a brand — key_hash is omitted from the returned objects */
export function listApiKeys(brand: string): Omit<ApiKey, 'key_hash'>[] {
  return readJson<ApiKey[]>(fileName(brand), []).map(({ key_hash: _omit, ...rest }) => rest)
}

/** Create a new API key. Returns the key record (without hash) + the raw key (shown once). */
export function createApiKey(
  brand: string,
  data: { name: string; scopes: string[]; expires_at?: string },
): { key: Omit<ApiKey, 'key_hash'>; raw_key: string } {
  const rawKey = `aios_sk_${nanoid(32)}`
  const hash = hashKey(rawKey)
  const prefix = rawKey.slice(0, 16) // "aios_sk_" (8) + 8 chars of nanoid

  const record: ApiKey = {
    id: nanoid(),
    brand,
    name: data.name,
    key_hash: hash,
    key_prefix: prefix,
    scopes: data.scopes,
    created_at: new Date().toISOString(),
    expires_at: data.expires_at,
    active: true,
  }

  const all = readJson<ApiKey[]>(fileName(brand), [])
  all.unshift(record)
  writeJson(fileName(brand), all)

  const { key_hash: _omit, ...keyWithoutHash } = record
  return { key: keyWithoutHash, raw_key: rawKey }
}

/** Validate a raw API key — searches all brands. Updates last_used_at on match. */
export function validateApiKey(rawKey: string): { brand: string; key: Omit<ApiKey, 'key_hash'> } | null {
  const hash = hashKey(rawKey)

  let brandFiles: string[] = []
  try {
    brandFiles = readdirSync(DATA_DIR).filter(f => f.startsWith('api-keys-') && f.endsWith('.json'))
  } catch {
    return null
  }

  for (const file of brandFiles) {
    const brand = file.replace('api-keys-', '').replace('.json', '')
    const all = readJson<ApiKey[]>(file, [])
    const idx = all.findIndex(k => k.key_hash === hash && k.active)
    if (idx === -1) continue

    const key = all[idx]
    if (key.expires_at && new Date(key.expires_at) < new Date()) continue

    // Update last_used_at
    all[idx] = { ...key, last_used_at: new Date().toISOString() }
    writeJson(file, all)

    const { key_hash: _omit, ...keyWithoutHash } = all[idx]
    return { brand, key: keyWithoutHash }
  }

  return null
}

/** Revoke a key (sets active=false) */
export function revokeApiKey(brand: string, id: string): boolean {
  const all = readJson<ApiKey[]>(fileName(brand), [])
  const idx = all.findIndex(k => k.id === id)
  if (idx === -1) return false
  all[idx] = { ...all[idx], active: false }
  writeJson(fileName(brand), all)
  return true
}

/** Permanently delete a key record */
export function deleteApiKey(brand: string, id: string): boolean {
  const all = readJson<ApiKey[]>(fileName(brand), [])
  const filtered = all.filter(k => k.id !== id)
  if (filtered.length === all.length) return false
  writeJson(fileName(brand), filtered)
  return true
}
