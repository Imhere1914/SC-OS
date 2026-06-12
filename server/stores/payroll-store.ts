import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string) {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback
  try { return JSON.parse(readFileSync(file, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, data: unknown) {
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, file)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaySchedule = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
export type EmployeeType = 'full_time' | 'part_time' | 'contractor' | '1099'

export interface Deduction {
  id: string
  name: string
  type: 'tax' | 'benefit' | 'garnishment' | 'other'
  calculation: 'fixed' | 'percent'
  amount: number
  is_employee_contribution: boolean
  is_employer_contribution: boolean
}

export interface EmployeeRecord {
  id: string
  brand: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  employee_type: EmployeeType
  job_title?: string
  department?: string
  pay_schedule: PaySchedule
  pay_type: 'salary' | 'hourly'
  pay_rate_cents: number
  start_date: string
  end_date?: string
  is_active: boolean
  deductions: Deduction[]
  bank_account_last4?: string
  notes?: string
  ytd_gross_cents: number
  ytd_tax_cents: number
  ytd_net_cents: number
  created_at: string
  updated_at: string
}

export interface PayRunLine {
  employee_id: string
  employee_name: string
  pay_type: 'salary' | 'hourly'
  hours_worked?: number
  gross_pay_cents: number
  deductions: {
    deduction_id: string
    name: string
    employee_amount_cents: number
    employer_amount_cents: number
  }[]
  total_employee_deductions_cents: number
  total_employer_contributions_cents: number
  net_pay_cents: number
}

export interface PayRunRecord {
  id: string
  brand: string
  run_number: string
  pay_period_start: string
  pay_period_end: string
  pay_date: string
  status: 'draft' | 'approved' | 'paid'
  lines: PayRunLine[]
  total_gross_cents: number
  total_deductions_cents: number
  total_employer_cost_cents: number
  total_net_cents: number
  notes?: string
  created_at: string
  updated_at: string
}

// ── File paths ────────────────────────────────────────────────────────────────

function empFile(brand: string) { return dbPath(`employees-${brand}.json`) }
function runFile(brand: string) { return dbPath(`pay-runs-${brand}.json`) }

// ── Standard hours per pay schedule ──────────────────────────────────────────

const SCHEDULE_PERIODS: Record<PaySchedule, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
}

const SCHEDULE_HOURS: Record<PaySchedule, number> = {
  weekly: 40,
  biweekly: 80,
  semimonthly: 86.67,
  monthly: 173.33,
}

// ── Employee CRUD ─────────────────────────────────────────────────────────────

export function listEmployees(brand: string, opts?: { active_only?: boolean; type?: EmployeeType }): EmployeeRecord[] {
  let records = readJson<EmployeeRecord[]>(empFile(brand), [])
  if (opts?.active_only) records = records.filter(e => e.is_active)
  if (opts?.type) records = records.filter(e => e.employee_type === opts.type)
  return records.sort((a, b) => a.last_name.localeCompare(b.last_name))
}

export function getEmployee(brand: string, id: string): EmployeeRecord | null {
  return readJson<EmployeeRecord[]>(empFile(brand), []).find(e => e.id === id) ?? null
}

export function createEmployee(
  brand: string,
  data: Omit<EmployeeRecord, 'id' | 'brand' | 'ytd_gross_cents' | 'ytd_tax_cents' | 'ytd_net_cents' | 'created_at' | 'updated_at'>,
): EmployeeRecord {
  const records = readJson<EmployeeRecord[]>(empFile(brand), [])
  const now = new Date().toISOString()
  const record: EmployeeRecord = {
    id: nanoid(),
    brand,
    ...data,
    ytd_gross_cents: 0,
    ytd_tax_cents: 0,
    ytd_net_cents: 0,
    created_at: now,
    updated_at: now,
  }
  writeJson(empFile(brand), [...records, record])
  return record
}

export function updateEmployee(brand: string, id: string, patch: Partial<EmployeeRecord>): EmployeeRecord | null {
  const records = readJson<EmployeeRecord[]>(empFile(brand), [])
  const idx = records.findIndex(e => e.id === id)
  if (idx === -1) return null
  const updated: EmployeeRecord = { ...records[idx], ...patch, id, brand, updated_at: new Date().toISOString() }
  records[idx] = updated
  writeJson(empFile(brand), records)
  return updated
}

export function terminateEmployee(brand: string, id: string, end_date: string): EmployeeRecord | null {
  return updateEmployee(brand, id, { is_active: false, end_date })
}

// ── Pay Run CRUD ──────────────────────────────────────────────────────────────

export function listPayRuns(brand: string, opts?: { status?: PayRunRecord['status']; year?: number }): PayRunRecord[] {
  let records = readJson<PayRunRecord[]>(runFile(brand), [])
  if (opts?.status) records = records.filter(r => r.status === opts.status)
  if (opts?.year) records = records.filter(r => r.pay_date.startsWith(String(opts.year)))
  return records.sort((a, b) => b.pay_date.localeCompare(a.pay_date))
}

export function getPayRun(brand: string, id: string): PayRunRecord | null {
  return readJson<PayRunRecord[]>(runFile(brand), []).find(r => r.id === id) ?? null
}

function nextRunNumber(brand: string): string {
  const runs = readJson<PayRunRecord[]>(runFile(brand), [])
  const max = runs.reduce((n, r) => {
    const m = r.run_number.match(/PAY-(\d+)/)
    return m ? Math.max(n, parseInt(m[1])) : n
  }, 0)
  return `PAY-${String(max + 1).padStart(3, '0')}`
}

export function createPayRun(
  brand: string,
  data: Omit<PayRunRecord, 'id' | 'brand' | 'run_number' | 'created_at' | 'updated_at'>,
): PayRunRecord {
  const records = readJson<PayRunRecord[]>(runFile(brand), [])
  const now = new Date().toISOString()
  const record: PayRunRecord = {
    id: nanoid(),
    brand,
    run_number: nextRunNumber(brand),
    ...data,
    created_at: now,
    updated_at: now,
  }
  writeJson(runFile(brand), [...records, record])
  return record
}

// ── Calculate Pay Run ─────────────────────────────────────────────────────────

export function calculatePayRun(
  brand: string,
  payPeriodStart: string,
  payPeriodEnd: string,
  payDate: string,
  employeeIds?: string[],
): PayRunRecord {
  const allEmployees = listEmployees(brand, { active_only: true })
  const employees = employeeIds?.length
    ? allEmployees.filter(e => employeeIds.includes(e.id))
    : allEmployees

  const lines: PayRunLine[] = employees.map(emp => {
    const periods = SCHEDULE_PERIODS[emp.pay_schedule]
    const stdHours = SCHEDULE_HOURS[emp.pay_schedule]

    let gross_pay_cents: number
    let hours_worked: number | undefined

    if (emp.pay_type === 'salary') {
      gross_pay_cents = Math.round(emp.pay_rate_cents / periods)
    } else {
      hours_worked = stdHours
      gross_pay_cents = Math.round(emp.pay_rate_cents * stdHours)
    }

    let total_employee_deductions_cents = 0
    let total_employer_contributions_cents = 0

    const deductionLines = emp.deductions.map(d => {
      let employee_amount_cents = 0
      let employer_amount_cents = 0

      if (d.calculation === 'percent') {
        const amt = Math.round(gross_pay_cents * d.amount / 100)
        if (d.is_employee_contribution) employee_amount_cents = amt
        if (d.is_employer_contribution) employer_amount_cents = amt
      } else {
        if (d.is_employee_contribution) employee_amount_cents = d.amount
        if (d.is_employer_contribution) employer_amount_cents = d.amount
      }

      total_employee_deductions_cents += employee_amount_cents
      total_employer_contributions_cents += employer_amount_cents

      return {
        deduction_id: d.id,
        name: d.name,
        employee_amount_cents,
        employer_amount_cents,
      }
    })

    const net_pay_cents = gross_pay_cents - total_employee_deductions_cents

    const line: PayRunLine = {
      employee_id: emp.id,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      pay_type: emp.pay_type,
      gross_pay_cents,
      deductions: deductionLines,
      total_employee_deductions_cents,
      total_employer_contributions_cents,
      net_pay_cents,
    }
    if (hours_worked !== undefined) line.hours_worked = hours_worked
    return line
  })

  const total_gross_cents = lines.reduce((s, l) => s + l.gross_pay_cents, 0)
  const total_deductions_cents = lines.reduce((s, l) => s + l.total_employee_deductions_cents, 0)
  const total_employer_cost_cents = lines.reduce((s, l) => s + l.total_employer_contributions_cents, 0)
  const total_net_cents = lines.reduce((s, l) => s + l.net_pay_cents, 0)

  return createPayRun(brand, {
    pay_period_start: payPeriodStart,
    pay_period_end: payPeriodEnd,
    pay_date: payDate,
    status: 'draft',
    lines,
    total_gross_cents,
    total_deductions_cents,
    total_employer_cost_cents,
    total_net_cents,
  })
}

export function approvePayRun(brand: string, id: string): PayRunRecord | null {
  const records = readJson<PayRunRecord[]>(runFile(brand), [])
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) return null
  records[idx] = { ...records[idx], status: 'approved', updated_at: new Date().toISOString() }
  writeJson(runFile(brand), records)
  return records[idx]
}

export function markPayRunPaid(brand: string, id: string): PayRunRecord | null {
  const runs = readJson<PayRunRecord[]>(runFile(brand), [])
  const idx = runs.findIndex(r => r.id === id)
  if (idx === -1) return null
  const run = runs[idx]

  runs[idx] = { ...run, status: 'paid', updated_at: new Date().toISOString() }
  writeJson(runFile(brand), runs)

  // Update employee YTD
  const employees = readJson<EmployeeRecord[]>(empFile(brand), [])
  for (const line of run.lines) {
    const ei = employees.findIndex(e => e.id === line.employee_id)
    if (ei === -1) continue
    const taxCents = line.deductions
      .filter(d => {
        const emp = employees[ei]
        const ded = emp.deductions.find(de => de.id === d.deduction_id)
        return ded?.type === 'tax'
      })
      .reduce((s, d) => s + d.employee_amount_cents, 0)

    employees[ei] = {
      ...employees[ei],
      ytd_gross_cents: employees[ei].ytd_gross_cents + line.gross_pay_cents,
      ytd_tax_cents: employees[ei].ytd_tax_cents + taxCents,
      ytd_net_cents: employees[ei].ytd_net_cents + line.net_pay_cents,
      updated_at: new Date().toISOString(),
    }
  }
  writeJson(empFile(brand), employees)

  return runs[idx]
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function getPayrollSummary(brand: string): {
  total_employees: number
  monthly_payroll_cents: number
  ytd_payroll_cents: number
  next_pay_date: string | null
} {
  const employees = listEmployees(brand, { active_only: true })
  const total_employees = employees.length

  const monthly_payroll_cents = employees.reduce((sum, emp) => {
    if (emp.pay_type === 'salary') {
      return sum + Math.round(emp.pay_rate_cents / 12)
    } else {
      return sum + Math.round(emp.pay_rate_cents * SCHEDULE_HOURS['monthly'])
    }
  }, 0)

  const ytd_payroll_cents = employees.reduce((s, e) => s + e.ytd_gross_cents, 0)

  const runs = listPayRuns(brand)
  const today = new Date().toISOString().slice(0, 10)
  const futureRun = runs
    .filter(r => r.pay_date >= today && r.status !== 'paid')
    .sort((a, b) => a.pay_date.localeCompare(b.pay_date))[0]

  return {
    total_employees,
    monthly_payroll_cents,
    ytd_payroll_cents,
    next_pay_date: futureRun?.pay_date ?? null,
  }
}
