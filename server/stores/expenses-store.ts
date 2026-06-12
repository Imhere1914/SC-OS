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

export type ExpenseCategory =
  | 'advertising' | 'software' | 'equipment' | 'travel' | 'meals'
  | 'office' | 'utilities' | 'payroll' | 'contractor' | 'legal'
  | 'insurance' | 'rent' | 'marketing' | 'training' | 'other'

export interface ExpenseRecord {
  id: string
  brand: string
  title: string
  amount_cents: number         // positive integer
  category: ExpenseCategory
  date: string                 // YYYY-MM-DD
  vendor?: string
  notes?: string
  receipt_url?: string         // optional URL to receipt image
  project_id?: string
  project_name?: string
  reimbursable: boolean
  reimbursed: boolean
  tax_deductible: boolean
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function file(brand: string) {
  return dbPath(`expenses-${brand}.json`)
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listExpenses(brand: string, opts?: {
  category?: ExpenseCategory
  from?: string
  to?: string
  reimbursable?: boolean
}): ExpenseRecord[] {
  let records = readJson<ExpenseRecord[]>(file(brand), [])
  if (opts?.category) records = records.filter((e) => e.category === opts.category)
  if (opts?.reimbursable !== undefined) records = records.filter((e) => e.reimbursable === opts.reimbursable)
  if (opts?.from) records = records.filter((e) => e.date >= opts.from!)
  if (opts?.to) records = records.filter((e) => e.date <= opts.to!)
  return records.sort((a, b) => b.date.localeCompare(a.date))
}

export function getExpense(brand: string, id: string): ExpenseRecord | null {
  return listExpenses(brand).find((e) => e.id === id) ?? null
}

export function createExpense(
  brand: string,
  data: Omit<ExpenseRecord, 'id' | 'brand' | 'created_at' | 'updated_at'>,
): ExpenseRecord {
  const records = readJson<ExpenseRecord[]>(file(brand), [])
  const now = new Date().toISOString()
  const record: ExpenseRecord = { id: nanoid(), brand, ...data, created_at: now, updated_at: now }
  writeJson(file(brand), [...records, record])
  return record
}

export function updateExpense(brand: string, id: string, patch: Partial<ExpenseRecord>): ExpenseRecord | null {
  const records = readJson<ExpenseRecord[]>(file(brand), [])
  const idx = records.findIndex((e) => e.id === id)
  if (idx === -1) return null
  const updated: ExpenseRecord = { ...records[idx], ...patch, id, brand, updated_at: new Date().toISOString() }
  records[idx] = updated
  writeJson(file(brand), records)
  return updated
}

export function deleteExpense(brand: string, id: string): boolean {
  const records = readJson<ExpenseRecord[]>(file(brand), [])
  const next = records.filter((e) => e.id !== id)
  if (next.length === records.length) return false
  writeJson(file(brand), next)
  return true
}

export function getExpenseSummary(brand: string, opts?: { from?: string; to?: string }): {
  total_cents: number
  by_category: Record<ExpenseCategory, number>
  count: number
  reimbursable_unpaid_cents: number
  tax_deductible_cents: number
} {
  const records = listExpenses(brand, { from: opts?.from, to: opts?.to })

  const by_category = {} as Record<ExpenseCategory, number>
  let total_cents = 0
  let reimbursable_unpaid_cents = 0
  let tax_deductible_cents = 0

  for (const e of records) {
    total_cents += e.amount_cents
    by_category[e.category] = (by_category[e.category] ?? 0) + e.amount_cents
    if (e.reimbursable && !e.reimbursed) reimbursable_unpaid_cents += e.amount_cents
    if (e.tax_deductible) tax_deductible_cents += e.amount_cents
  }

  return {
    total_cents,
    by_category,
    count: records.length,
    reimbursable_unpaid_cents,
    tax_deductible_cents,
  }
}
