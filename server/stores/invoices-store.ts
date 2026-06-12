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

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'

export interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
}

export interface InvoiceRecord {
  id: string
  invoice_number: string
  brand?: string
  contact_id?: string
  contact_name: string
  contact_email?: string
  line_items: LineItem[]
  status: InvoiceStatus
  due_date?: string
  notes?: string
  tax_rate: number  // percent, e.g. 10 for 10%
  subtotal: number
  tax_amount: number
  total: number
  created_at: string
  updated_at: string
  paid_at?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcTotals(items: LineItem[], taxRate: number) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const tax_amount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  return { subtotal: Math.round(subtotal * 100) / 100, tax_amount, total: Math.round((subtotal + tax_amount) * 100) / 100 }
}

function file(brand?: string) {
  return brand ? `invoices-${brand}.json` : 'invoices.json'
}

function nextInvoiceNumber(invoices: InvoiceRecord[]): string {
  const max = invoices.reduce((n, inv) => {
    const num = parseInt(inv.invoice_number.replace(/\D/g, ''), 10)
    return isNaN(num) ? n : Math.max(n, num)
  }, 0)
  return `INV-${String(max + 1).padStart(4, '0')}`
}

// ── Store ────────────────────────────────────────────────────────────────────

export function listInvoices(brand?: string): InvoiceRecord[] {
  return readJson<InvoiceRecord[]>(file(brand), [])
}

export function getInvoice(id: string, brand?: string): InvoiceRecord | null {
  const all = brand ? listInvoices(brand) : [...listInvoices('sc'), ...listInvoices('hfm'), ...listInvoices(undefined)]
  return all.find(i => i.id === id) ?? null
}

export interface CreateInvoiceInput {
  brand?: string
  contact_id?: string
  contact_name: string
  contact_email?: string
  line_items: Omit<LineItem, 'id'>[]
  status?: InvoiceStatus
  due_date?: string
  notes?: string
  tax_rate?: number
}

export function createInvoice(data: CreateInvoiceInput): InvoiceRecord {
  const invoices = listInvoices(data.brand)
  const now = new Date().toISOString()
  const items: LineItem[] = data.line_items.map((li) => ({ ...li, id: crypto.randomUUID() }))
  const taxRate = data.tax_rate ?? 0
  const totals = calcTotals(items, taxRate)
  const invoice: InvoiceRecord = {
    id: crypto.randomUUID(),
    invoice_number: nextInvoiceNumber(invoices),
    brand: data.brand,
    contact_id: data.contact_id,
    contact_name: data.contact_name,
    contact_email: data.contact_email,
    line_items: items,
    status: data.status ?? 'draft',
    due_date: data.due_date,
    notes: data.notes,
    tax_rate: taxRate,
    ...totals,
    created_at: now,
    updated_at: now,
  }
  writeJson(file(data.brand), [invoice, ...invoices])
  return invoice
}

export function updateInvoice(id: string, updates: Partial<Omit<InvoiceRecord, 'id' | 'invoice_number' | 'created_at'>>, brand?: string): InvoiceRecord | null {
  const invoices = listInvoices(brand)
  const idx = invoices.findIndex((i) => i.id === id)
  if (idx === -1) return null
  const base = { ...invoices[idx], ...updates }
  // Recalculate totals if line_items or tax_rate changed
  if (updates.line_items !== undefined || updates.tax_rate !== undefined) {
    const totals = calcTotals(base.line_items, base.tax_rate)
    Object.assign(base, totals)
  }
  base.updated_at = new Date().toISOString()
  if (updates.status === 'paid' && !base.paid_at) base.paid_at = new Date().toISOString()
  invoices[idx] = base
  writeJson(file(brand), invoices)
  return base
}

export function deleteInvoice(id: string, brand?: string): boolean {
  const invoices = listInvoices(brand)
  const next = invoices.filter((i) => i.id !== id)
  if (next.length === invoices.length) return false
  writeJson(file(brand), next)
  return true
}

// ── Recurring Invoices ────────────────────────────────────────────────────────

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurringInvoiceRecord {
  id: string
  brand?: string
  contact_id?: string
  contact_name: string
  contact_email?: string
  line_items: LineItem[]
  tax_rate: number
  notes?: string
  frequency: RecurrenceFrequency
  next_invoice_at: string   // ISO date — when to next auto-create
  last_invoiced_at?: string
  status: 'active' | 'paused'
  created_at: string
  updated_at: string
}

export interface CreateRecurringInvoiceInput {
  brand?: string
  contact_id?: string
  contact_name: string
  contact_email?: string
  line_items: Omit<LineItem, 'id'>[]
  tax_rate?: number
  notes?: string
  frequency: RecurrenceFrequency
  next_invoice_at?: string  // defaults to now + 1 interval
}

const FREQUENCY_DAYS: Record<RecurrenceFrequency, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
}

function addFrequencyInterval(from: string, frequency: RecurrenceFrequency): string {
  const d = new Date(from)
  d.setDate(d.getDate() + FREQUENCY_DAYS[frequency])
  return d.toISOString()
}

function recurringFile(brand?: string) {
  return brand ? `recurring-invoices-${brand}.json` : 'recurring-invoices.json'
}

export function listRecurringInvoices(brand?: string): RecurringInvoiceRecord[] {
  return readJson<RecurringInvoiceRecord[]>(recurringFile(brand), [])
}

export function getRecurringInvoice(id: string, brand?: string): RecurringInvoiceRecord | null {
  const all = listRecurringInvoices(brand)
  return all.find(r => r.id === id) ?? null
}

export function createRecurringInvoice(data: CreateRecurringInvoiceInput): RecurringInvoiceRecord {
  const records = listRecurringInvoices(data.brand)
  const now = new Date().toISOString()
  const items: LineItem[] = data.line_items.map(li => ({ ...li, id: crypto.randomUUID() }))
  const record: RecurringInvoiceRecord = {
    id: crypto.randomUUID(),
    brand: data.brand,
    contact_id: data.contact_id,
    contact_name: data.contact_name,
    contact_email: data.contact_email,
    line_items: items,
    tax_rate: data.tax_rate ?? 0,
    notes: data.notes,
    frequency: data.frequency,
    next_invoice_at: data.next_invoice_at ?? addFrequencyInterval(now, data.frequency),
    status: 'active',
    created_at: now,
    updated_at: now,
  }
  writeJson(recurringFile(data.brand), [record, ...records])
  return record
}

export function updateRecurringInvoice(
  id: string,
  updates: Partial<Omit<RecurringInvoiceRecord, 'id' | 'created_at'>>,
  brand?: string,
): RecurringInvoiceRecord | null {
  const records = listRecurringInvoices(brand)
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) return null
  const updated: RecurringInvoiceRecord = {
    ...records[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  }
  records[idx] = updated
  writeJson(recurringFile(brand), records)
  return updated
}

export function deleteRecurringInvoice(id: string, brand?: string): boolean {
  const records = listRecurringInvoices(brand)
  const next = records.filter(r => r.id !== id)
  if (next.length === records.length) return false
  writeJson(recurringFile(brand), next)
  return true
}

export { addFrequencyInterval }
