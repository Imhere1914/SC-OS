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
  const tmp = p + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountCategory = 'checking' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'investment'

export interface BankAccount {
  id: string
  brand: string
  name: string
  institution?: string
  account_number_last4?: string
  category: AccountCategory
  currency: string
  opening_balance_cents: number
  current_balance_cents: number
  is_active: boolean
  color?: string
  created_at: string
  updated_at: string
}

export type TransactionType = 'debit' | 'credit'

export interface BankTransaction {
  id: string
  brand: string
  account_id: string
  date: string
  description: string
  payee?: string
  amount_cents: number
  type: TransactionType
  category?: string
  category_name?: string
  reference?: string
  memo?: string
  is_reconciled: boolean
  reconciled_at?: string
  reconciliation_id?: string
  source: 'manual' | 'import'
  linked_invoice_id?: string
  linked_bill_id?: string
  created_at: string
  updated_at: string
}

export interface ReconciliationRecord {
  id: string
  brand: string
  account_id: string
  statement_date: string
  statement_balance_cents: number
  cleared_debits_cents: number
  cleared_credits_cents: number
  difference_cents: number
  status: 'in_progress' | 'completed'
  transaction_ids: string[]
  completed_at?: string
  created_at: string
}

// ── File helpers ───────────────────────────────────────────────────────────────

function accountsFile(brand: string) { return `bank-accounts-${brand}.json` }
function txnsFile(brand: string) { return `bank-transactions-${brand}.json` }
function reconFile(brand: string) { return `reconciliations-${brand}.json` }

// ── Accounts ──────────────────────────────────────────────────────────────────

export function listBankAccounts(brand: string): BankAccount[] {
  return readJson<BankAccount[]>(accountsFile(brand), [])
}

export function getBankAccount(brand: string, id: string): BankAccount | null {
  return listBankAccounts(brand).find(a => a.id === id) ?? null
}

export function createBankAccount(brand: string, data: Omit<BankAccount, 'id' | 'brand' | 'current_balance_cents' | 'created_at' | 'updated_at'>): BankAccount {
  const accounts = listBankAccounts(brand)
  const now = new Date().toISOString()
  const account: BankAccount = {
    ...data,
    id: crypto.randomUUID(),
    brand,
    current_balance_cents: data.opening_balance_cents,
    created_at: now,
    updated_at: now,
  }
  writeJson(accountsFile(brand), [account, ...accounts])
  return account
}

export function updateBankAccount(brand: string, id: string, data: Partial<Omit<BankAccount, 'id' | 'brand' | 'created_at'>>): BankAccount | null {
  const accounts = listBankAccounts(brand)
  const idx = accounts.findIndex(a => a.id === id)
  if (idx === -1) return null
  const updated: BankAccount = { ...accounts[idx], ...data, updated_at: new Date().toISOString() }
  accounts[idx] = updated
  writeJson(accountsFile(brand), accounts)
  return updated
}

export function deleteBankAccount(brand: string, id: string): boolean {
  const accounts = listBankAccounts(brand)
  const next = accounts.filter(a => a.id !== id)
  if (next.length === accounts.length) return false
  writeJson(accountsFile(brand), next)
  return true
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface ListTransactionsOpts {
  account_id?: string
  from?: string
  to?: string
  is_reconciled?: boolean
  type?: TransactionType
  limit?: number
}

export function listTransactions(brand: string, opts: ListTransactionsOpts = {}): BankTransaction[] {
  let txns = readJson<BankTransaction[]>(txnsFile(brand), [])
  if (opts.account_id) txns = txns.filter(t => t.account_id === opts.account_id)
  if (opts.from) txns = txns.filter(t => t.date >= opts.from!)
  if (opts.to) txns = txns.filter(t => t.date <= opts.to!)
  if (opts.is_reconciled !== undefined) txns = txns.filter(t => t.is_reconciled === opts.is_reconciled)
  if (opts.type) txns = txns.filter(t => t.type === opts.type)
  txns = txns.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  if (opts.limit) txns = txns.slice(0, opts.limit)
  return txns
}

export function getTransaction(brand: string, id: string): BankTransaction | null {
  return readJson<BankTransaction[]>(txnsFile(brand), []).find(t => t.id === id) ?? null
}

function applyBalanceDelta(brand: string, accountId: string, type: TransactionType, amountCents: number, sign: 1 | -1) {
  const accounts = listBankAccounts(brand)
  const idx = accounts.findIndex(a => a.id === accountId)
  if (idx === -1) return
  const delta = type === 'credit' ? amountCents * sign : -amountCents * sign
  accounts[idx] = { ...accounts[idx], current_balance_cents: accounts[idx].current_balance_cents + delta, updated_at: new Date().toISOString() }
  writeJson(accountsFile(brand), accounts)
}

export function createTransaction(brand: string, data: Omit<BankTransaction, 'id' | 'brand' | 'created_at' | 'updated_at'>): BankTransaction {
  const txns = readJson<BankTransaction[]>(txnsFile(brand), [])
  const now = new Date().toISOString()
  const txn: BankTransaction = { ...data, id: crypto.randomUUID(), brand, created_at: now, updated_at: now }
  writeJson(txnsFile(brand), [txn, ...txns])
  applyBalanceDelta(brand, data.account_id, data.type, data.amount_cents, 1)
  return txn
}

export function updateTransaction(brand: string, id: string, data: Partial<Omit<BankTransaction, 'id' | 'brand' | 'created_at'>>): BankTransaction | null {
  const txns = readJson<BankTransaction[]>(txnsFile(brand), [])
  const idx = txns.findIndex(t => t.id === id)
  if (idx === -1) return null
  const old = txns[idx]
  // Reverse old balance effect
  applyBalanceDelta(brand, old.account_id, old.type, old.amount_cents, -1)
  const updated: BankTransaction = { ...old, ...data, updated_at: new Date().toISOString() }
  txns[idx] = updated
  writeJson(txnsFile(brand), txns)
  // Apply new balance effect
  applyBalanceDelta(brand, updated.account_id, updated.type, updated.amount_cents, 1)
  return updated
}

export function deleteTransaction(brand: string, id: string): boolean {
  const txns = readJson<BankTransaction[]>(txnsFile(brand), [])
  const txn = txns.find(t => t.id === id)
  if (!txn) return false
  applyBalanceDelta(brand, txn.account_id, txn.type, txn.amount_cents, -1)
  writeJson(txnsFile(brand), txns.filter(t => t.id !== id))
  return true
}

export interface ImportTxnInput {
  date: string
  description: string
  amount_cents: number
  type: TransactionType
  payee?: string
  reference?: string
  memo?: string
}

export function importTransactions(brand: string, accountId: string, incoming: ImportTxnInput[]): { imported: number; skipped: number } {
  const existing = readJson<BankTransaction[]>(txnsFile(brand), [])
  const dupeSet = new Set(
    existing.filter(t => t.account_id === accountId).map(t => `${t.date}|${t.amount_cents}|${t.description}`)
  )
  const now = new Date().toISOString()
  const newTxns: BankTransaction[] = []
  let skipped = 0
  for (const row of incoming) {
    const key = `${row.date}|${row.amount_cents}|${row.description}`
    if (dupeSet.has(key)) { skipped++; continue }
    dupeSet.add(key)
    newTxns.push({
      id: crypto.randomUUID(),
      brand,
      account_id: accountId,
      date: row.date,
      description: row.description,
      payee: row.payee,
      amount_cents: row.amount_cents,
      type: row.type,
      reference: row.reference,
      memo: row.memo,
      is_reconciled: false,
      source: 'import',
      created_at: now,
      updated_at: now,
    })
  }
  if (newTxns.length > 0) {
    writeJson(txnsFile(brand), [...newTxns, ...existing])
    // Update balance for each new transaction
    for (const t of newTxns) {
      applyBalanceDelta(brand, accountId, t.type, t.amount_cents, 1)
    }
  }
  return { imported: newTxns.length, skipped }
}

// ── Reconciliation ────────────────────────────────────────────────────────────

export function reconcileAccount(
  brand: string,
  accountId: string,
  statementDate: string,
  statementBalanceCents: number,
  clearedTxnIds: string[],
): ReconciliationRecord {
  const allTxns = readJson<BankTransaction[]>(txnsFile(brand), [])
  const cleared = allTxns.filter(t => clearedTxnIds.includes(t.id) && t.account_id === accountId)

  let clearedCredits = 0
  let clearedDebits = 0
  for (const t of cleared) {
    if (t.type === 'credit') clearedCredits += t.amount_cents
    else clearedDebits += t.amount_cents
  }

  const account = getBankAccount(brand, accountId)
  const openingBalance = account?.opening_balance_cents ?? 0
  const clearedBalance = openingBalance + clearedCredits - clearedDebits
  const difference = clearedBalance - statementBalanceCents

  const now = new Date().toISOString()
  const record: ReconciliationRecord = {
    id: crypto.randomUUID(),
    brand,
    account_id: accountId,
    statement_date: statementDate,
    statement_balance_cents: statementBalanceCents,
    cleared_debits_cents: clearedDebits,
    cleared_credits_cents: clearedCredits,
    difference_cents: difference,
    status: difference === 0 ? 'completed' : 'in_progress',
    transaction_ids: clearedTxnIds,
    completed_at: difference === 0 ? now : undefined,
    created_at: now,
  }

  // Mark transactions as reconciled
  const reconId = record.id
  const updatedTxns = allTxns.map(t => {
    if (clearedTxnIds.includes(t.id) && t.account_id === accountId) {
      return { ...t, is_reconciled: true, reconciled_at: now, reconciliation_id: reconId, updated_at: now }
    }
    return t
  })
  writeJson(txnsFile(brand), updatedTxns)

  const recons = readJson<ReconciliationRecord[]>(reconFile(brand), [])
  writeJson(reconFile(brand), [record, ...recons])

  return record
}

// ── Account Statement ─────────────────────────────────────────────────────────

export interface StatementRow extends BankTransaction {
  running_balance_cents: number
}

export function getAccountStatement(brand: string, accountId: string, from: string, to: string): StatementRow[] {
  const account = getBankAccount(brand, accountId)
  if (!account) return []

  const txns = listTransactions(brand, { account_id: accountId, from, to })
  // Sort oldest first for running balance calc
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))

  let balance = account.opening_balance_cents
  const rows: StatementRow[] = sorted.map(t => {
    balance += t.type === 'credit' ? t.amount_cents : -t.amount_cents
    return { ...t, running_balance_cents: balance }
  })

  // Return newest first
  return rows.reverse()
}
