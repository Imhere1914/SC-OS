import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync } from 'fs'
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

export interface DocumentRecord {
  id: string
  brand: string
  name: string
  description?: string
  folder?: string
  mime_type: string
  size_bytes: number
  contact_id?: string
  contact_name?: string
  tags?: string[]
  shared: boolean
  share_token?: string
  storage_path: string
  created_at: string
  updated_at: string
  uploaded_by?: string
}

function fileName(brand: string) {
  return `documents-${brand}.json`
}

function readAll(brand: string): DocumentRecord[] {
  return readJson<DocumentRecord[]>(fileName(brand), [])
}

function writeAll(brand: string, docs: DocumentRecord[]) {
  writeJson(fileName(brand), docs)
}

export function listDocuments(
  brand: string,
  opts?: { folder?: string; contact_id?: string; shared?: boolean },
): DocumentRecord[] {
  let docs = readAll(brand)
  if (opts?.folder !== undefined) docs = docs.filter(d => (d.folder ?? '') === opts.folder)
  if (opts?.contact_id) docs = docs.filter(d => d.contact_id === opts.contact_id)
  if (opts?.shared !== undefined) docs = docs.filter(d => d.shared === opts.shared)
  return docs.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getDocument(brand: string, id: string): DocumentRecord | null {
  return readAll(brand).find(d => d.id === id) ?? null
}

export function getDocumentByShareToken(token: string): { doc: DocumentRecord; brand: string } | null {
  const dataDir = DATA_DIR
  if (!existsSync(dataDir)) return null
  const files = readdirSync(dataDir).filter((f: string) => f.startsWith('documents-') && f.endsWith('.json'))
  for (const file of files) {
    const brand = file.replace('documents-', '').replace('.json', '')
    const docs = readJson<DocumentRecord[]>(file, [])
    const doc = docs.find(d => d.share_token === token)
    if (doc) return { doc, brand }
  }
  return null
}

export function createDocument(
  brand: string,
  data: Omit<DocumentRecord, 'id' | 'brand' | 'created_at' | 'updated_at'>,
): DocumentRecord {
  const now = new Date().toISOString()
  const doc: DocumentRecord = {
    ...data,
    id: nanoid(),
    brand,
    created_at: now,
    updated_at: now,
  }
  const docs = readAll(brand)
  docs.push(doc)
  writeAll(brand, docs)
  return doc
}

export function updateDocument(
  brand: string,
  id: string,
  patch: Partial<Omit<DocumentRecord, 'id' | 'brand' | 'created_at'>>,
): DocumentRecord | null {
  const docs = readAll(brand)
  const idx = docs.findIndex(d => d.id === id)
  if (idx === -1) return null
  docs[idx] = { ...docs[idx], ...patch, updated_at: new Date().toISOString() }
  writeAll(brand, docs)
  return docs[idx]
}

export function deleteDocument(brand: string, id: string): boolean {
  const docs = readAll(brand)
  const next = docs.filter(d => d.id !== id)
  if (next.length === docs.length) return false
  writeAll(brand, next)
  return true
}

export function listFolders(brand: string): string[] {
  const docs = readAll(brand)
  const folders = new Set<string>()
  for (const d of docs) {
    if (d.folder) folders.add(d.folder)
  }
  return Array.from(folders).sort()
}

export function generateShareToken(brand: string, id: string): DocumentRecord | null {
  return updateDocument(brand, id, { shared: true, share_token: nanoid(12) })
}

export function getStorageDir(brand: string, id: string): string {
  const dir = join(DATA_DIR, 'documents', brand, id)
  mkdirSync(dir, { recursive: true })
  return dir
}
