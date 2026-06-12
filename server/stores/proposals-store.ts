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
  writeFileSync(dbPath(file) + '.tmp', JSON.stringify(data, null, 2))
  renameSync(dbPath(file) + '.tmp', dbPath(file))
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined'

export interface ProposalSection {
  id: string
  type: 'heading' | 'text' | 'pricing' | 'signature'
  content: string  // text/markdown for heading/text; JSON string for pricing
  order: number
}

// Pricing section content (JSON.stringify'd):
// { items: { description: string; qty: number; unit_price: number }[]; show_total: boolean }

export interface ProposalRecord {
  id: string
  brand?: string
  title: string
  contact_id?: string
  contact_name?: string
  contact_email?: string
  deal_id?: string
  status: ProposalStatus
  sections: ProposalSection[]
  valid_until?: string  // ISO date
  notes?: string
  created_at: string
  updated_at: string
  sent_at?: string
  viewed_at?: string
  accepted_at?: string
  declined_at?: string
  signature_data?: string    // base64 PNG of signature drawing OR typed name
  signature_name?: string    // full name typed by signer
  signature_email?: string   // email typed by signer
  signature_ip?: string      // IP from request
  signed_at?: string         // ISO timestamp
  signing_required: boolean  // default false
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function file(brand?: string) {
  return brand ? `proposals-${brand}.json` : 'proposals.json'
}

// ── Store ────────────────────────────────────────────────────────────────────

export function listProposals(brand?: string): ProposalRecord[] {
  return readJson<ProposalRecord[]>(file(brand), [])
}

export function getProposal(id: string, brand?: string): ProposalRecord | null {
  if (brand) {
    return listProposals(brand).find(p => p.id === id) ?? null
  }
  // Search across all known stores
  const all = [
    ...listProposals('sc'),
    ...listProposals('hfm'),
    ...listProposals(undefined),
  ]
  return all.find(p => p.id === id) ?? null
}

export interface CreateProposalInput {
  brand?: string
  title: string
  contact_id?: string
  contact_name?: string
  contact_email?: string
  deal_id?: string
  status?: ProposalStatus
  sections?: ProposalSection[]
  valid_until?: string
  notes?: string
  signing_required?: boolean
}

export function createProposal(data: CreateProposalInput): ProposalRecord {
  const proposals = listProposals(data.brand)
  const now = new Date().toISOString()
  const proposal: ProposalRecord = {
    id: crypto.randomUUID(),
    brand: data.brand,
    title: data.title,
    contact_id: data.contact_id,
    contact_name: data.contact_name,
    contact_email: data.contact_email,
    deal_id: data.deal_id,
    status: data.status ?? 'draft',
    sections: data.sections ?? [],
    valid_until: data.valid_until,
    notes: data.notes,
    signing_required: data.signing_required ?? false,
    created_at: now,
    updated_at: now,
  }
  writeJson(file(data.brand), [proposal, ...proposals])
  return proposal
}

export function updateProposal(
  id: string,
  updates: Partial<Omit<ProposalRecord, 'id' | 'created_at'>>,
  brand?: string,
): ProposalRecord | null {
  const proposals = listProposals(brand)
  const idx = proposals.findIndex(p => p.id === id)
  if (idx === -1) return null
  const base: ProposalRecord = {
    ...proposals[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  }
  const now = new Date().toISOString()
  if (updates.status === 'sent' && !base.sent_at) base.sent_at = now
  if (updates.status === 'viewed' && !base.viewed_at) base.viewed_at = now
  if (updates.status === 'accepted' && !base.accepted_at) base.accepted_at = now
  if (updates.status === 'declined' && !base.declined_at) base.declined_at = now
  proposals[idx] = base
  writeJson(file(brand), proposals)
  return base
}

export function deleteProposal(id: string, brand?: string): boolean {
  const proposals = listProposals(brand)
  const next = proposals.filter(p => p.id !== id)
  if (next.length === proposals.length) return false
  writeJson(file(brand), next)
  return true
}
