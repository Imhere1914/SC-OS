import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
function dbPath(name: string) { mkdirSync(DATA_DIR, { recursive: true }); return join(DATA_DIR, name) }
function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file); if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}
function writeJson(file: string, data: unknown) {
  const tmp = dbPath(file) + '.tmp'; writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, dbPath(file))
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoyaltyProgram {
  brand: string
  name: string              // e.g. "Rewards Club"
  points_per_dollar: number // e.g. 10 = 10 pts per $1
  tiers: LoyaltyTier[]
  enabled: boolean
  updated_at: string
}

export interface LoyaltyTier {
  id: string
  name: string              // Bronze, Silver, Gold, Platinum
  min_points: number
  color: string             // hex
  perks: string[]           // list of perk descriptions
}

export interface LoyaltyAccount {
  id: string
  brand: string
  contact_id: string
  contact_name: string
  points_balance: number
  lifetime_points: number
  tier_id: string
  created_at: string
  updated_at: string
}

export interface LoyaltyTransaction {
  id: string
  brand: string
  account_id: string
  contact_id: string
  type: 'earn' | 'redeem' | 'adjust' | 'expire'
  points: number            // positive=earned, negative=redeemed/expired
  description: string
  reference_id?: string     // e.g. invoice_id
  created_at: string
}

// ── Default tiers ─────────────────────────────────────────────────────────────

const DEFAULT_TIERS: LoyaltyTier[] = [
  { id: 'bronze', name: 'Bronze', min_points: 0, color: '#cd7f32', perks: ['Member pricing'] },
  { id: 'silver', name: 'Silver', min_points: 500, color: '#c0c0c0', perks: ['5% discount', 'Priority support'] },
  { id: 'gold', name: 'Gold', min_points: 2000, color: '#ffd700', perks: ['10% discount', 'Free shipping', 'VIP access'] },
  { id: 'platinum', name: 'Platinum', min_points: 5000, color: '#e5e4e2', perks: ['15% discount', 'Dedicated account manager', 'Early access'] },
]

// ── File name helpers ─────────────────────────────────────────────────────────

function programFile(brand: string) { return `loyalty-program-${brand}.json` }
function accountsFile(brand: string) { return `loyalty-accounts-${brand}.json` }
function txFile(brand: string) { return `loyalty-transactions-${brand}.json` }

// ── Program ───────────────────────────────────────────────────────────────────

export function getLoyaltyProgram(brand: string): LoyaltyProgram {
  return readJson<LoyaltyProgram>(programFile(brand), {
    brand,
    name: 'Rewards Club',
    points_per_dollar: 10,
    tiers: DEFAULT_TIERS,
    enabled: true,
    updated_at: new Date().toISOString(),
  })
}

export function upsertLoyaltyProgram(brand: string, patch: Partial<Omit<LoyaltyProgram, 'brand'>>): LoyaltyProgram {
  const existing = getLoyaltyProgram(brand)
  const updated: LoyaltyProgram = {
    ...existing,
    ...patch,
    brand,
    updated_at: new Date().toISOString(),
  }
  writeJson(programFile(brand), updated)
  return updated
}

// ── Tier recalc ───────────────────────────────────────────────────────────────

export function recalcTier(program: LoyaltyProgram, account: LoyaltyAccount): void {
  const tiers = [...program.tiers].sort((a, b) => b.min_points - a.min_points)
  const matched = tiers.find(t => account.lifetime_points >= t.min_points)
  account.tier_id = matched?.id ?? (program.tiers[0]?.id ?? 'bronze')
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export function getLoyaltyAccount(brand: string, contactId: string): LoyaltyAccount | null {
  const accounts = readJson<LoyaltyAccount[]>(accountsFile(brand), [])
  return accounts.find(a => a.contact_id === contactId) ?? null
}

export function upsertLoyaltyAccount(brand: string, contactId: string, contactName: string): LoyaltyAccount {
  const accounts = readJson<LoyaltyAccount[]>(accountsFile(brand), [])
  const existing = accounts.find(a => a.contact_id === contactId)
  if (existing) {
    // Update contact name if changed
    if (existing.contact_name !== contactName) {
      existing.contact_name = contactName
      existing.updated_at = new Date().toISOString()
      writeJson(accountsFile(brand), accounts)
    }
    return existing
  }
  const program = getLoyaltyProgram(brand)
  const now = new Date().toISOString()
  const account: LoyaltyAccount = {
    id: nanoid(),
    brand,
    contact_id: contactId,
    contact_name: contactName,
    points_balance: 0,
    lifetime_points: 0,
    tier_id: program.tiers[0]?.id ?? 'bronze',
    created_at: now,
    updated_at: now,
  }
  recalcTier(program, account)
  accounts.push(account)
  writeJson(accountsFile(brand), accounts)
  return account
}

// ── Points operations ─────────────────────────────────────────────────────────

function appendTransaction(brand: string, tx: LoyaltyTransaction): void {
  const txs = readJson<LoyaltyTransaction[]>(txFile(brand), [])
  txs.push(tx)
  writeJson(txFile(brand), txs)
}

function saveAccount(brand: string, account: LoyaltyAccount): void {
  const accounts = readJson<LoyaltyAccount[]>(accountsFile(brand), [])
  const idx = accounts.findIndex(a => a.contact_id === account.contact_id)
  if (idx === -1) {
    accounts.push(account)
  } else {
    accounts[idx] = account
  }
  writeJson(accountsFile(brand), accounts)
}

export function awardPoints(
  brand: string,
  contactId: string,
  contactName: string,
  points: number,
  description: string,
  referenceId?: string,
): LoyaltyAccount {
  const account = upsertLoyaltyAccount(brand, contactId, contactName)
  const program = getLoyaltyProgram(brand)
  const now = new Date().toISOString()

  account.points_balance += points
  account.lifetime_points += points
  account.updated_at = now
  recalcTier(program, account)
  saveAccount(brand, account)

  const tx: LoyaltyTransaction = {
    id: nanoid(),
    brand,
    account_id: account.id,
    contact_id: contactId,
    type: 'earn',
    points,
    description,
    reference_id: referenceId,
    created_at: now,
  }
  appendTransaction(brand, tx)
  return account
}

export function redeemPoints(
  brand: string,
  contactId: string,
  points: number,
  description: string,
): LoyaltyAccount | null {
  const account = getLoyaltyAccount(brand, contactId)
  if (!account) return null
  if (account.points_balance < points) return null

  const now = new Date().toISOString()
  account.points_balance -= points
  account.updated_at = now
  saveAccount(brand, account)

  const tx: LoyaltyTransaction = {
    id: nanoid(),
    brand,
    account_id: account.id,
    contact_id: contactId,
    type: 'redeem',
    points: -points,
    description,
    created_at: now,
  }
  appendTransaction(brand, tx)
  return account
}

export function adjustPoints(
  brand: string,
  contactId: string,
  points: number,
  description: string,
): LoyaltyAccount {
  const account = upsertLoyaltyAccount(brand, contactId, contactId)
  const program = getLoyaltyProgram(brand)
  const now = new Date().toISOString()

  account.points_balance += points
  if (points > 0) account.lifetime_points += points
  account.updated_at = now
  recalcTier(program, account)
  saveAccount(brand, account)

  const tx: LoyaltyTransaction = {
    id: nanoid(),
    brand,
    account_id: account.id,
    contact_id: contactId,
    type: 'adjust',
    points,
    description,
    created_at: now,
  }
  appendTransaction(brand, tx)
  return account
}

export function listAccounts(brand: string): LoyaltyAccount[] {
  const accounts = readJson<LoyaltyAccount[]>(accountsFile(brand), [])
  return accounts.sort((a, b) => b.lifetime_points - a.lifetime_points)
}

export function listTransactions(brand: string, contactId?: string): LoyaltyTransaction[] {
  const txs = readJson<LoyaltyTransaction[]>(txFile(brand), [])
  if (contactId) return txs.filter(t => t.contact_id === contactId)
  return txs
}
