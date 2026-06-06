import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(homedir(), '.ai-os')
const FILE = join(DATA_DIR, 'media.json')

export type MediaKind = 'image' | 'video'
export type MediaStatus = 'pending' | 'ready' | 'failed'

export interface MediaRecord {
  id: string
  brand: string
  kind: MediaKind
  prompt: string
  status: MediaStatus
  url: string | null
  aspect: string
  provider: string
  error: string | null
  created_at: string
  updated_at: string
}

function nowISO(): string {
  // Date.now is unavailable in some sandboxes; new Date() is fine here (server runtime)
  return new Date().toISOString()
}

function readAll(): MediaRecord[] {
  if (!existsSync(FILE)) return []
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as MediaRecord[]
  } catch {
    return []
  }
}

function writeAll(records: MediaRecord[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(records, null, 2))
  renameSync(tmp, FILE)
}

export function isMediaKind(v: unknown): v is MediaKind {
  return v === 'image' || v === 'video'
}

export function listMedia(filters: { brand?: string | null; kind?: string | null } = {}): MediaRecord[] {
  const brand = filters.brand ?? process.env.BRAND ?? null
  return readAll()
    .filter((m) => (!brand || brand === 'default' ? true : m.brand === brand))
    .filter((m) => (filters.kind ? m.kind === filters.kind : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getMedia(id: string): MediaRecord | undefined {
  return readAll().find((m) => m.id === id)
}

export function createMedia(input: { kind: MediaKind; prompt: string; aspect?: string; brand?: string }): MediaRecord {
  const ts = nowISO()
  const rec: MediaRecord = {
    id: randomUUID(),
    brand: input.brand ?? process.env.BRAND ?? 'default',
    kind: input.kind,
    prompt: input.prompt,
    status: 'pending',
    url: null,
    aspect: input.aspect ?? '1:1',
    provider: 'hermes',
    error: null,
    created_at: ts,
    updated_at: ts,
  }
  const all = readAll()
  all.push(rec)
  writeAll(all)
  return rec
}

export function updateMedia(id: string, patch: Partial<Pick<MediaRecord, 'status' | 'url' | 'error' | 'provider'>>): MediaRecord | undefined {
  const all = readAll()
  const i = all.findIndex((m) => m.id === id)
  if (i === -1) return undefined
  all[i] = { ...all[i], ...patch, updated_at: nowISO() }
  writeAll(all)
  return all[i]
}

export function deleteMedia(id: string): boolean {
  const all = readAll()
  const next = all.filter((m) => m.id !== id)
  if (next.length === all.length) return false
  writeAll(next)
  return true
}
