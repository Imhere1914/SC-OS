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
  const p = dbPath(file)
  const tmp = p + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

// ── Types ────────────────────────────────────────────────────────────────────

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export type AccountSubtype =
  | 'checking' | 'savings' | 'accounts_receivable' | 'other_current_asset' | 'fixed_asset'
  | 'accounts_payable' | 'credit_card' | 'payroll_liability' | 'sales_tax_payable' | 'other_current_liability' | 'long_term_liability'
  | 'equity' | 'retained_earnings' | 'owners_draw'
  | 'service_revenue' | 'product_sales' | 'other_income'
  | 'advertising' | 'bank_charges' | 'insurance' | 'meals_entertainment' | 'office_supplies' | 'payroll_expense' | 'professional_services' | 'rent_lease' | 'software_tech' | 'travel' | 'utilities' | 'other_expense'

export interface AccountRecord {
  id: string
  brand: string
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  description?: string
  is_active: boolean
  is_system: boolean
  parent_id?: string
  balance_cents: number
  created_at: string
  updated_at: string
}

export interface JournalLine {
  account_id: string
  account_code: string
  account_name: string
  debit_cents: number
  credit_cents: number
  memo?: string
}

export interface JournalEntry {
  id: string
  brand: string
  date: string
  description: string
  reference?: string
  source: 'manual' | 'invoice' | 'payment' | 'bill' | 'expense' | 'payroll'
  lines: JournalLine[]
  created_at: string
  created_by?: string
}

// ── Default accounts seed ────────────────────────────────────────────────────

type SeedRow = {
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  is_system: boolean
}

const DEFAULT_ACCOUNTS: SeedRow[] = [
  // Assets
  { code: '1000', name: 'Checking Account',        type: 'asset',     subtype: 'checking',             is_system: false },
  { code: '1010', name: 'Savings Account',          type: 'asset',     subtype: 'savings',              is_system: false },
  { code: '1100', name: 'Accounts Receivable',      type: 'asset',     subtype: 'accounts_receivable',  is_system: true  },
  { code: '1500', name: 'Other Current Assets',     type: 'asset',     subtype: 'other_current_asset',  is_system: false },
  // Liabilities
  { code: '2000', name: 'Accounts Payable',         type: 'liability', subtype: 'accounts_payable',     is_system: true  },
  { code: '2100', name: 'Credit Card',              type: 'liability', subtype: 'credit_card',          is_system: false },
  { code: '2200', name: 'Payroll Liabilities',      type: 'liability', subtype: 'payroll_liability',    is_system: true  },
  { code: '2300', name: 'Sales Tax Payable',        type: 'liability', subtype: 'sales_tax_payable',    is_system: true  },
  // Equity
  { code: '3000', name: 'Opening Balance Equity',   type: 'equity',    subtype: 'equity',               is_system: true  },
  { code: '3100', name: "Owner's Draw",             type: 'equity',    subtype: 'owners_draw',          is_system: false },
  { code: '3200', name: 'Retained Earnings',        type: 'equity',    subtype: 'retained_earnings',    is_system: true  },
  // Income
  { code: '4000', name: 'Services Revenue',         type: 'income',    subtype: 'service_revenue',      is_system: true  },
  { code: '4100', name: 'Other Income',             type: 'income',    subtype: 'other_income',         is_system: false },
  // Expenses
  { code: '6000', name: 'Advertising & Marketing',  type: 'expense',   subtype: 'advertising',          is_system: false },
  { code: '6100', name: 'Bank Charges & Fees',      type: 'expense',   subtype: 'bank_charges',         is_system: false },
  { code: '6200', name: 'Insurance',                type: 'expense',   subtype: 'insurance',            is_system: false },
  { code: '6300', name: 'Meals & Entertainment',    type: 'expense',   subtype: 'meals_entertainment',  is_system: false },
  { code: '6400', name: 'Office Supplies',          type: 'expense',   subtype: 'office_supplies',      is_system: false },
  { code: '6500', name: 'Payroll Expenses',         type: 'expense',   subtype: 'payroll_expense',      is_system: true  },
  { code: '6600', name: 'Professional Services',    type: 'expense',   subtype: 'professional_services', is_system: false },
  { code: '6700', name: 'Rent & Lease',             type: 'expense',   subtype: 'rent_lease',           is_system: false },
  { code: '6800', name: 'Software & Technology',    type: 'expense',   subtype: 'software_tech',        is_system: false },
  { code: '6900', name: 'Travel',                   type: 'expense',   subtype: 'travel',               is_system: false },
  { code: '6950', name: 'Utilities',                type: 'expense',   subtype: 'utilities',            is_system: false },
  { code: '6999', name: 'Other Expenses',           type: 'expense',   subtype: 'other_expense',        is_system: false },
]

// ── File helpers ─────────────────────────────────────────────────────────────

function accountsFile(brand: string) { return `accounts-${brand}.json` }
function journalFile(brand: string) { return `journal-entries-${brand}.json` }

function readAccounts(brand: string): AccountRecord[] {
  return readJson<AccountRecord[]>(accountsFile(brand), [])
}

function saveAccounts(brand: string, records: AccountRecord[]) {
  writeJson(accountsFile(brand), records)
}

function readJournal(brand: string): JournalEntry[] {
  return readJson<JournalEntry[]>(journalFile(brand), [])
}

function saveJournal(brand: string, entries: JournalEntry[]) {
  writeJson(journalFile(brand), entries)
}

// ── Seed ─────────────────────────────────────────────────────────────────────

export function seedDefaultAccounts(brand: string): void {
  const existing = readAccounts(brand)
  if (existing.length > 0) return
  const now = new Date().toISOString()
  const seeded: AccountRecord[] = DEFAULT_ACCOUNTS.map(row => ({
    id: nanoid(),
    brand,
    code: row.code,
    name: row.name,
    type: row.type,
    subtype: row.subtype,
    is_active: true,
    is_system: row.is_system,
    balance_cents: 0,
    created_at: now,
    updated_at: now,
  }))
  saveAccounts(brand, seeded)
}

// ── Account CRUD ─────────────────────────────────────────────────────────────

export function listAccounts(
  brand: string,
  opts?: { type?: AccountType; active_only?: boolean },
): AccountRecord[] {
  seedDefaultAccounts(brand)
  let records = readAccounts(brand)
  if (opts?.type) records = records.filter(r => r.type === opts.type)
  if (opts?.active_only) records = records.filter(r => r.is_active)
  return records.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
}

export function getAccount(brand: string, id: string): AccountRecord | undefined {
  return readAccounts(brand).find(r => r.id === id)
}

export function getAccountByCode(brand: string, code: string): AccountRecord | undefined {
  return readAccounts(brand).find(r => r.code === code)
}

export function createAccount(
  brand: string,
  data: Omit<AccountRecord, 'id' | 'brand' | 'balance_cents' | 'created_at' | 'updated_at'>,
): AccountRecord | { error: string } {
  const records = readAccounts(brand)
  if (records.find(r => r.code === data.code)) {
    return { error: `Account code ${data.code} already exists` }
  }
  const now = new Date().toISOString()
  const record: AccountRecord = {
    id: nanoid(),
    brand,
    balance_cents: 0,
    created_at: now,
    updated_at: now,
    ...data,
  }
  saveAccounts(brand, [...records, record])
  return record
}

export function updateAccount(
  brand: string,
  id: string,
  data: Partial<Omit<AccountRecord, 'id' | 'brand' | 'created_at'>>,
): AccountRecord | { error: string } | undefined {
  const records = readAccounts(brand)
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) return undefined
  const existing = records[idx]
  // System accounts cannot change type/subtype
  if (existing.is_system) {
    if (data.type && data.type !== existing.type) return { error: 'Cannot change type of system account' }
    if (data.subtype && data.subtype !== existing.subtype) return { error: 'Cannot change subtype of system account' }
  }
  // Code uniqueness check
  if (data.code && data.code !== existing.code && records.find(r => r.code === data.code)) {
    return { error: `Account code ${data.code} already exists` }
  }
  const updated: AccountRecord = { ...existing, ...data, updated_at: new Date().toISOString() }
  records[idx] = updated
  saveAccounts(brand, records)
  return updated
}

export function deleteAccount(brand: string, id: string): { error: string } | { deleted: true } {
  const records = readAccounts(brand)
  const record = records.find(r => r.id === id)
  if (!record) return { error: 'Account not found' }
  if (record.is_system) return { error: 'System accounts cannot be deleted' }
  saveAccounts(brand, records.filter(r => r.id !== id))
  return { deleted: true }
}

// ── Balance helpers ───────────────────────────────────────────────────────────

export function getAccountBalance(brand: string, id: string): number | undefined {
  const record = getAccount(brand, id)
  return record?.balance_cents
}

export function getTrialBalance(brand: string): {
  type: AccountType
  accounts: AccountRecord[]
  subtotal_cents: number
}[] {
  const accounts = listAccounts(brand).filter(r => r.balance_cents !== 0)
  const types: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']
  return types.map(type => {
    const group = accounts.filter(a => a.type === type)
    return {
      type,
      accounts: group,
      subtotal_cents: group.reduce((s, a) => s + a.balance_cents, 0),
    }
  })
}

// ── Journal entries ───────────────────────────────────────────────────────────

export function listJournalEntries(
  brand: string,
  opts?: { from?: string; to?: string; account_id?: string; source?: JournalEntry['source']; limit?: number },
): JournalEntry[] {
  let entries = readJournal(brand)
  if (opts?.from) entries = entries.filter(e => e.date >= opts.from!)
  if (opts?.to) entries = entries.filter(e => e.date <= opts.to!)
  if (opts?.account_id) entries = entries.filter(e => e.lines.some(l => l.account_id === opts.account_id))
  if (opts?.source) entries = entries.filter(e => e.source === opts.source)
  entries = entries.sort((a, b) => b.date.localeCompare(a.date))
  if (opts?.limit) entries = entries.slice(0, opts.limit)
  return entries
}

export function createJournalEntry(
  brand: string,
  data: Omit<JournalEntry, 'id' | 'brand' | 'created_at'>,
): JournalEntry | { error: string } {
  // Validate balanced
  const totalDebits = data.lines.reduce((s, l) => s + l.debit_cents, 0)
  const totalCredits = data.lines.reduce((s, l) => s + l.credit_cents, 0)
  if (totalDebits !== totalCredits) {
    return { error: `Journal entry not balanced: debits ${totalDebits} ≠ credits ${totalCredits}` }
  }
  if (totalDebits === 0) {
    return { error: 'Journal entry must have at least one debit and one credit' }
  }

  const entry: JournalEntry = {
    id: nanoid(),
    brand,
    created_at: new Date().toISOString(),
    ...data,
  }

  // Update account balances
  const records = readAccounts(brand)
  for (const line of entry.lines) {
    const idx = records.findIndex(r => r.id === line.account_id)
    if (idx === -1) continue
    const acct = records[idx]
    // Normal balance rules:
    // Assets/Expenses: debit increases, credit decreases
    // Liabilities/Equity/Income: credit increases, debit decreases
    const normalDebitTypes: AccountType[] = ['asset', 'expense']
    if (normalDebitTypes.includes(acct.type)) {
      records[idx] = { ...acct, balance_cents: acct.balance_cents + line.debit_cents - line.credit_cents, updated_at: new Date().toISOString() }
    } else {
      records[idx] = { ...acct, balance_cents: acct.balance_cents + line.credit_cents - line.debit_cents, updated_at: new Date().toISOString() }
    }
  }
  saveAccounts(brand, records)

  const entries = readJournal(brand)
  saveJournal(brand, [...entries, entry])
  return entry
}
