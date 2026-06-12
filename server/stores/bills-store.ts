import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { updateVendor, getVendor } from './vendors-store'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string): string {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}

function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, data: unknown): void {
  const p = dbPath(file)
  const tmp = p + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

// ── Types ────────────────────────────────────────────────────────────────────

export type BillStatus = 'draft' | 'open' | 'partial' | 'paid' | 'overdue' | 'void'

export interface BillLineItem {
  id: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
  expense_account?: string
  expense_account_name?: string
}

export interface BillPayment {
  id: string
  amount_cents: number
  payment_date: string
  payment_method?: string
  reference?: string
  notes?: string
  created_at: string
}

export interface BillRecord {
  id: string
  brand: string
  bill_number: string
  vendor_id?: string
  vendor_name: string
  status: BillStatus
  issue_date: string
  due_date: string
  line_items: BillLineItem[]
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  amount_paid_cents: number
  amount_due_cents: number
  payments: BillPayment[]
  notes?: string
  attachment_url?: string
  expense_account?: string
  created_at: string
  updated_at: string
}

export interface BillSummary {
  total_open_cents: number
  total_overdue_cents: number
  total_paid_this_month_cents: number
  bills_due_this_week: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function file(brand: string): string {
  return `bills-${brand}.json`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function computeTotals(lineItems: BillLineItem[], taxCents: number): { subtotal_cents: number; total_cents: number } {
  const subtotal_cents = lineItems.reduce((sum, li) => sum + li.amount_cents, 0)
  return { subtotal_cents, total_cents: subtotal_cents + taxCents }
}

function autoStatus(bill: BillRecord): BillStatus {
  if (bill.status === 'paid' || bill.status === 'void' || bill.status === 'draft') return bill.status
  if (bill.amount_paid_cents >= bill.total_cents) return 'paid'
  if (bill.amount_paid_cents > 0) {
    // Check if overdue despite partial payment
    if (bill.due_date < todayStr()) return 'partial'
    return 'partial'
  }
  if (bill.due_date < todayStr()) return 'overdue'
  return 'open'
}

function applyOverdueCheck(bills: BillRecord[]): BillRecord[] {
  const today = todayStr()
  return bills.map(b => {
    if ((b.status === 'open' || b.status === 'partial') && b.due_date < today) {
      return { ...b, status: 'overdue' as BillStatus }
    }
    return b
  })
}

function nextBillNumber(bills: BillRecord[]): string {
  const max = bills.reduce((n, b) => {
    const num = parseInt(b.bill_number.replace(/\D/g, ''), 10)
    return isNaN(num) ? n : Math.max(n, num)
  }, 0)
  return `BILL-${String(max + 1).padStart(3, '0')}`
}

// ── Store ────────────────────────────────────────────────────────────────────

export function listBills(
  brand: string,
  opts?: { status?: BillStatus; vendor_id?: string; from?: string; to?: string },
): BillRecord[] {
  const raw = readJson<BillRecord[]>(file(brand), [])
  let bills = applyOverdueCheck(raw)

  // Persist updated overdue statuses
  const hasChanges = bills.some((b, i) => b.status !== raw[i].status)
  if (hasChanges) writeJson(file(brand), bills)

  if (opts?.status) bills = bills.filter(b => b.status === opts.status)
  if (opts?.vendor_id) bills = bills.filter(b => b.vendor_id === opts.vendor_id)
  if (opts?.from) bills = bills.filter(b => b.issue_date >= opts.from!)
  if (opts?.to) bills = bills.filter(b => b.issue_date <= opts.to!)

  return bills
}

export function getBill(brand: string, id: string): BillRecord | null {
  const all = readJson<BillRecord[]>(file(brand), [])
  const bills = applyOverdueCheck(all)
  return bills.find(b => b.id === id) ?? null
}

export type CreateBillInput = {
  vendor_id?: string
  vendor_name: string
  issue_date?: string
  due_date: string
  line_items: Omit<BillLineItem, 'id'>[]
  tax_cents?: number
  notes?: string
  attachment_url?: string
  expense_account?: string
  status?: BillStatus
}

export function createBill(brand: string, data: CreateBillInput): BillRecord {
  const bills = readJson<BillRecord[]>(file(brand), [])
  const now = new Date().toISOString()
  const items: BillLineItem[] = data.line_items.map(li => ({ ...li, id: crypto.randomUUID() }))
  const taxCents = data.tax_cents ?? 0
  const { subtotal_cents, total_cents } = computeTotals(items, taxCents)

  const bill: BillRecord = {
    id: crypto.randomUUID(),
    brand,
    bill_number: nextBillNumber(bills),
    vendor_id: data.vendor_id,
    vendor_name: data.vendor_name,
    status: data.status ?? 'open',
    issue_date: data.issue_date ?? now.slice(0, 10),
    due_date: data.due_date,
    line_items: items,
    subtotal_cents,
    tax_cents: taxCents,
    total_cents,
    amount_paid_cents: 0,
    amount_due_cents: total_cents,
    payments: [],
    notes: data.notes,
    attachment_url: data.attachment_url,
    expense_account: data.expense_account,
    created_at: now,
    updated_at: now,
  }

  // Apply overdue check
  bill.status = autoStatus(bill)

  writeJson(file(brand), [bill, ...bills])

  // Update vendor totals
  if (data.vendor_id) {
    const vendor = getVendor(brand, data.vendor_id)
    if (vendor) {
      updateVendor(brand, data.vendor_id, {
        total_billed_cents: vendor.total_billed_cents + total_cents,
      })
    }
  }

  return bill
}

export function updateBill(
  brand: string,
  id: string,
  data: Partial<Omit<BillRecord, 'id' | 'brand' | 'bill_number' | 'created_at' | 'payments'>>,
): BillRecord | null {
  const bills = readJson<BillRecord[]>(file(brand), [])
  const idx = bills.findIndex(b => b.id === id)
  if (idx === -1) return null

  const base: BillRecord = { ...bills[idx], ...data }

  // Recompute totals if line_items or tax_cents changed
  if (data.line_items !== undefined || data.tax_cents !== undefined) {
    const { subtotal_cents, total_cents } = computeTotals(base.line_items, base.tax_cents)
    base.subtotal_cents = subtotal_cents
    base.total_cents = total_cents
    base.amount_due_cents = total_cents - base.amount_paid_cents
  }

  base.status = autoStatus(base)
  base.updated_at = new Date().toISOString()
  bills[idx] = base
  writeJson(file(brand), bills)
  return base
}

export function deleteBill(brand: string, id: string): { ok: boolean; error?: string } {
  const bills = readJson<BillRecord[]>(file(brand), [])
  const bill = bills.find(b => b.id === id)
  if (!bill) return { ok: false, error: 'not found' }
  if (bill.status !== 'draft' && bill.status !== 'void') {
    return { ok: false, error: 'Only draft or void bills can be deleted' }
  }
  writeJson(file(brand), bills.filter(b => b.id !== id))
  return { ok: true }
}

export type RecordPaymentInput = {
  amount_cents: number
  payment_date: string
  payment_method?: string
  reference?: string
  notes?: string
}

export function recordBillPayment(
  brand: string,
  id: string,
  payment: RecordPaymentInput,
): BillRecord | null {
  const bills = readJson<BillRecord[]>(file(brand), [])
  const idx = bills.findIndex(b => b.id === id)
  if (idx === -1) return null

  const bill = bills[idx]
  if (bill.status === 'void') return null

  const newPayment: BillPayment = {
    id: crypto.randomUUID(),
    amount_cents: payment.amount_cents,
    payment_date: payment.payment_date,
    payment_method: payment.payment_method,
    reference: payment.reference,
    notes: payment.notes,
    created_at: new Date().toISOString(),
  }

  const updatedPayments = [...bill.payments, newPayment]
  const amount_paid_cents = updatedPayments.reduce((sum, p) => sum + p.amount_cents, 0)
  const amount_due_cents = Math.max(0, bill.total_cents - amount_paid_cents)

  const updated: BillRecord = {
    ...bill,
    payments: updatedPayments,
    amount_paid_cents,
    amount_due_cents,
    updated_at: new Date().toISOString(),
    status: amount_paid_cents >= bill.total_cents ? 'paid' : amount_paid_cents > 0 ? 'partial' : bill.status,
  }

  bills[idx] = updated
  writeJson(file(brand), bills)

  // Update vendor paid totals
  if (bill.vendor_id) {
    const vendor = getVendor(brand, bill.vendor_id)
    if (vendor) {
      updateVendor(brand, bill.vendor_id, {
        total_paid_cents: vendor.total_paid_cents + payment.amount_cents,
      })
    }
  }

  return updated
}

export function voidBill(brand: string, id: string): BillRecord | null {
  const bills = readJson<BillRecord[]>(file(brand), [])
  const idx = bills.findIndex(b => b.id === id)
  if (idx === -1) return null
  bills[idx] = { ...bills[idx], status: 'void', updated_at: new Date().toISOString() }
  writeJson(file(brand), bills)
  return bills[idx]
}

export function getBillSummary(brand: string): BillSummary {
  const all = applyOverdueCheck(readJson<BillRecord[]>(file(brand), []))
  const today = todayStr()
  const now = new Date()

  // This month range
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = today

  // This week range (next 7 days)
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  let total_open_cents = 0
  let total_overdue_cents = 0
  let total_paid_this_month_cents = 0
  let bills_due_this_week = 0

  for (const b of all) {
    if (b.status === 'open' || b.status === 'partial') {
      total_open_cents += b.amount_due_cents
    }
    if (b.status === 'overdue') {
      total_overdue_cents += b.amount_due_cents
    }
    if (b.status === 'paid') {
      // Sum payments made this month
      for (const p of b.payments) {
        if (p.payment_date >= monthStart && p.payment_date <= monthEnd) {
          total_paid_this_month_cents += p.amount_cents
        }
      }
    }
    if ((b.status === 'open' || b.status === 'overdue' || b.status === 'partial') &&
        b.due_date >= today && b.due_date <= weekEndStr) {
      bills_due_this_week++
    }
  }

  return { total_open_cents, total_overdue_cents, total_paid_this_month_cents, bills_due_this_week }
}
