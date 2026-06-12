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

function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContractVariable {
  key: string
  label: string
  default_value: string
}

export interface ContractTemplate {
  id: string
  brand: string
  name: string
  description: string
  category: string
  body_html: string
  variables: ContractVariable[]
  created_at: string
  updated_at: string
}

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'cancelled'

export interface ContractRecord {
  id: string
  brand: string
  template_id?: string
  contact_id?: string
  contact_name?: string
  title: string
  body_html: string
  status: ContractStatus
  variables_data: Record<string, string>
  share_token: string
  sent_at?: string
  signed_at?: string
  signature_name?: string
  signature_data?: string
  signature_ip?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

// ── File helpers ──────────────────────────────────────────────────────────────

function templatesFile(brand: string) {
  return `contract-templates-${brand}.json`
}

function contractsFile(brand: string) {
  return `contracts-${brand}.json`
}

// ── Template CRUD ─────────────────────────────────────────────────────────────

export function listTemplates(brand: string): ContractTemplate[] {
  return readJson<ContractTemplate[]>(templatesFile(brand), [])
}

export function getTemplate(brand: string, id: string): ContractTemplate | null {
  return listTemplates(brand).find(t => t.id === id) ?? null
}

export function createTemplate(
  brand: string,
  data: Omit<ContractTemplate, 'id' | 'brand' | 'created_at' | 'updated_at'>,
): ContractTemplate {
  const templates = listTemplates(brand)
  const now = new Date().toISOString()
  const template: ContractTemplate = {
    id: crypto.randomUUID(),
    brand,
    name: data.name,
    description: data.description ?? '',
    category: data.category ?? 'General',
    body_html: data.body_html ?? '',
    variables: data.variables ?? [],
    created_at: now,
    updated_at: now,
  }
  writeJson(templatesFile(brand), [template, ...templates])
  return template
}

export function updateTemplate(
  brand: string,
  id: string,
  data: Partial<Omit<ContractTemplate, 'id' | 'brand' | 'created_at'>>,
): ContractTemplate | null {
  const templates = listTemplates(brand)
  const idx = templates.findIndex(t => t.id === id)
  if (idx === -1) return null
  const updated: ContractTemplate = {
    ...templates[idx],
    ...data,
    updated_at: new Date().toISOString(),
  }
  templates[idx] = updated
  writeJson(templatesFile(brand), templates)
  return updated
}

export function deleteTemplate(brand: string, id: string): boolean {
  const templates = listTemplates(brand)
  const next = templates.filter(t => t.id !== id)
  if (next.length === templates.length) return false
  writeJson(templatesFile(brand), next)
  return true
}

// ── Contract CRUD ─────────────────────────────────────────────────────────────

export function listContracts(brand: string, opts?: { status?: ContractStatus }): ContractRecord[] {
  const all = readJson<ContractRecord[]>(contractsFile(brand), [])
  if (opts?.status) return all.filter(c => c.status === opts.status)
  return all
}

export function getContract(brand: string, id: string): ContractRecord | null {
  return listContracts(brand).find(c => c.id === id) ?? null
}

export function getContractByToken(token: string): ContractRecord | null {
  // Search across known brands
  const brands = ['sc', 'hfm', 'default']
  for (const brand of brands) {
    const found = listContracts(brand).find(c => c.share_token === token)
    if (found) return found
  }
  return null
}

export function createContract(
  brand: string,
  data: Omit<ContractRecord, 'id' | 'brand' | 'share_token' | 'created_at' | 'updated_at'>,
): ContractRecord {
  const contracts = listContracts(brand)
  const now = new Date().toISOString()
  const contract: ContractRecord = {
    id: crypto.randomUUID(),
    brand,
    template_id: data.template_id,
    contact_id: data.contact_id,
    contact_name: data.contact_name,
    title: data.title,
    body_html: data.body_html ?? '',
    status: data.status ?? 'draft',
    variables_data: data.variables_data ?? {},
    share_token: generateShareToken(),
    sent_at: data.sent_at,
    signed_at: data.signed_at,
    signature_name: data.signature_name,
    signature_data: data.signature_data,
    signature_ip: data.signature_ip,
    expires_at: data.expires_at,
    created_at: now,
    updated_at: now,
  }
  writeJson(contractsFile(brand), [contract, ...contracts])
  return contract
}

export function updateContract(
  brand: string,
  id: string,
  data: Partial<Omit<ContractRecord, 'id' | 'brand' | 'created_at'>>,
): ContractRecord | null {
  const contracts = listContracts(brand)
  const idx = contracts.findIndex(c => c.id === id)
  if (idx === -1) return null
  const updated: ContractRecord = {
    ...contracts[idx],
    ...data,
    updated_at: new Date().toISOString(),
  }
  contracts[idx] = updated
  writeJson(contractsFile(brand), contracts)
  return updated
}

export function deleteContract(brand: string, id: string): boolean {
  const contracts = listContracts(brand)
  const next = contracts.filter(c => c.id !== id)
  if (next.length === contracts.length) return false
  writeJson(contractsFile(brand), next)
  return true
}

export function signContract(
  brand: string,
  id: string,
  signatureData: string,
  signatureName: string,
  ip: string,
): ContractRecord | null {
  const now = new Date().toISOString()
  return updateContract(brand, id, {
    status: 'signed',
    signature_data: signatureData,
    signature_name: signatureName,
    signature_ip: ip,
    signed_at: now,
  })
}
