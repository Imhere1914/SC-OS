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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommissionRule {
  id: string
  brand: string
  name: string                  // e.g. "Sales Rep Standard"
  assignee: string              // team member name
  rate_pct: number              // e.g. 10 = 10%
  applies_to: 'deal' | 'invoice' | 'both'
  active: boolean
  created_at: string
}

export interface CommissionRecord {
  id: string
  brand: string
  rule_id?: string
  assignee: string
  reference_type: 'deal' | 'invoice'
  reference_id: string
  reference_label: string       // "Deal: Acme Corp" or "Invoice #INV-001"
  amount_cents: number          // deal/invoice value
  commission_cents: number      // calculated commission
  rate_pct: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  paid_at?: string
  notes?: string
  created_at: string
  updated_at: string
}

// ── File helpers ──────────────────────────────────────────────────────────────

function rulesFile(brand: string) { return `commission-rules-${brand}.json` }
function commissionsFile(brand: string) { return `commissions-${brand}.json` }

// ── Rules CRUD ────────────────────────────────────────────────────────────────

export function listRules(brand: string): CommissionRule[] {
  return readJson<CommissionRule[]>(rulesFile(brand), [])
}

export function createRule(
  brand: string,
  data: Omit<CommissionRule, 'id' | 'brand' | 'created_at'>,
): CommissionRule {
  const rules = listRules(brand)
  const rule: CommissionRule = {
    id: nanoid(),
    brand,
    ...data,
    created_at: new Date().toISOString(),
  }
  writeJson(rulesFile(brand), [...rules, rule])
  return rule
}

export function updateRule(brand: string, id: string, patch: Partial<CommissionRule>): CommissionRule | null {
  const rules = listRules(brand)
  const idx = rules.findIndex(r => r.id === id)
  if (idx === -1) return null
  const updated: CommissionRule = { ...rules[idx], ...patch, id, brand }
  rules[idx] = updated
  writeJson(rulesFile(brand), rules)
  return updated
}

export function deleteRule(brand: string, id: string): boolean {
  const rules = listRules(brand)
  const next = rules.filter(r => r.id !== id)
  if (next.length === rules.length) return false
  writeJson(rulesFile(brand), next)
  return true
}

// ── Commissions CRUD ──────────────────────────────────────────────────────────

export function listCommissions(
  brand: string,
  opts?: { assignee?: string; status?: string; from?: string; to?: string },
): CommissionRecord[] {
  let records = readJson<CommissionRecord[]>(commissionsFile(brand), [])
  if (opts?.assignee) records = records.filter(r => r.assignee === opts.assignee)
  if (opts?.status) records = records.filter(r => r.status === opts.status)
  if (opts?.from) records = records.filter(r => r.created_at >= opts.from!)
  if (opts?.to) records = records.filter(r => r.created_at <= opts.to! + 'T23:59:59.999Z')
  return records.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function createCommission(
  brand: string,
  data: Omit<CommissionRecord, 'id' | 'brand' | 'created_at' | 'updated_at'>,
): CommissionRecord {
  const records = readJson<CommissionRecord[]>(commissionsFile(brand), [])
  const now = new Date().toISOString()
  const record: CommissionRecord = { id: nanoid(), brand, ...data, created_at: now, updated_at: now }
  writeJson(commissionsFile(brand), [...records, record])
  return record
}

export function updateCommission(brand: string, id: string, patch: Partial<CommissionRecord>): CommissionRecord | null {
  const records = readJson<CommissionRecord[]>(commissionsFile(brand), [])
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) return null
  const updated: CommissionRecord = {
    ...records[idx],
    ...patch,
    id,
    brand,
    updated_at: new Date().toISOString(),
  }
  records[idx] = updated
  writeJson(commissionsFile(brand), records)
  return updated
}

export function deleteCommission(brand: string, id: string): boolean {
  const records = readJson<CommissionRecord[]>(commissionsFile(brand), [])
  const next = records.filter(r => r.id !== id)
  if (next.length === records.length) return false
  writeJson(commissionsFile(brand), next)
  return true
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function getCommissionSummary(brand: string): {
  by_assignee: Record<string, {
    pending_cents: number
    approved_cents: number
    paid_cents: number
    total_cents: number
  }>
  total_pending_cents: number
  total_paid_cents: number
} {
  const records = listCommissions(brand)
  const by_assignee: Record<string, {
    pending_cents: number
    approved_cents: number
    paid_cents: number
    total_cents: number
  }> = {}

  let total_pending_cents = 0
  let total_paid_cents = 0

  for (const r of records) {
    if (r.status === 'cancelled') continue
    if (!by_assignee[r.assignee]) {
      by_assignee[r.assignee] = { pending_cents: 0, approved_cents: 0, paid_cents: 0, total_cents: 0 }
    }
    const a = by_assignee[r.assignee]
    a.total_cents += r.commission_cents
    if (r.status === 'pending') {
      a.pending_cents += r.commission_cents
      total_pending_cents += r.commission_cents
    } else if (r.status === 'approved') {
      a.approved_cents += r.commission_cents
    } else if (r.status === 'paid') {
      a.paid_cents += r.commission_cents
      total_paid_cents += r.commission_cents
    }
  }

  return { by_assignee, total_pending_cents, total_paid_cents }
}
