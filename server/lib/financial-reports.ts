import { listInvoices } from '../stores/invoices-store'
import { listExpenses } from '../stores/expenses-store'
import { listBills } from '../stores/bills-store'
import { listBankAccounts } from '../stores/bank-store'
import { listAccounts } from '../stores/accounts-store'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DateRange { from: string; to: string }

export interface PLReport {
  period: DateRange
  income: { account: string; account_name: string; amount_cents: number }[]
  total_income_cents: number
  expenses: { category: string; amount_cents: number }[]
  total_expenses_cents: number
  net_income_cents: number
  gross_margin_pct: number
}

export interface BalanceSheetReport {
  as_of: string
  assets: { account_code: string; account_name: string; balance_cents: number }[]
  total_assets_cents: number
  liabilities: { account_code: string; account_name: string; balance_cents: number }[]
  total_liabilities_cents: number
  equity: { account_code: string; account_name: string; balance_cents: number }[]
  total_equity_cents: number
  liabilities_and_equity_cents: number
  is_balanced: boolean
}

export interface ARAgingItem {
  invoice_id: string
  invoice_number?: string
  contact_name: string
  amount_cents: number
  due_date: string
  days_overdue: number
}

export interface ARAgingReport {
  as_of: string
  buckets: {
    current: { invoices: ARAgingItem[]; total_cents: number }
    days_1_30: { invoices: ARAgingItem[]; total_cents: number }
    days_31_60: { invoices: ARAgingItem[]; total_cents: number }
    days_61_90: { invoices: ARAgingItem[]; total_cents: number }
    days_90_plus: { invoices: ARAgingItem[]; total_cents: number }
  }
  total_outstanding_cents: number
}

export interface CashFlowReport {
  period: DateRange
  operating_inflows_cents: number
  operating_outflows_cents: number
  net_operating_cents: number
  monthly: { month: string; inflows_cents: number; outflows_cents: number; net_cents: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dollarsToCents(amount: number): number {
  return Math.round(amount * 100)
}

function inRange(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  return d >= from && d <= to
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // YYYY-MM
}

function monthsBetween(from: string, to: string): string[] {
  const months: string[] = []
  const start = new Date(from + '-01')
  const end = new Date(to.slice(0, 7) + '-01')
  const cur = new Date(start)
  while (cur <= end) {
    months.push(cur.toISOString().slice(0, 7))
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

// ── P&L ───────────────────────────────────────────────────────────────────────

export function generatePL(brand: string, range: DateRange): PLReport {
  try {
    // Income: paid invoices within range
    const invoices = listInvoices(brand)
    const paidInvoices = invoices.filter(inv => {
      if (inv.status !== 'paid') return false
      // Use paid_at if available, otherwise created_at
      const dateToCheck = inv.paid_at ?? inv.created_at
      return inRange(dateToCheck, range.from, range.to)
    })

    // Sum income — use account 4000 / Services Revenue as default grouping
    const totalIncomeDollars = paidInvoices.reduce((sum, inv) => sum + (inv.total ?? 0), 0)
    const total_income_cents = dollarsToCents(totalIncomeDollars)

    const income = total_income_cents > 0
      ? [{ account: '4000', account_name: 'Services Revenue', amount_cents: total_income_cents }]
      : []

    // Expenses: expense records within range
    const expenseRecords = listExpenses(brand, { from: range.from, to: range.to })
    const expenseByCategory: Record<string, number> = {}
    for (const exp of expenseRecords) {
      expenseByCategory[exp.category] = (expenseByCategory[exp.category] ?? 0) + exp.amount_cents
    }

    // Bills paid within range
    const bills = listBills(brand, { status: 'paid' })
    for (const bill of bills) {
      if (!bill.payments) continue
      for (const payment of bill.payments) {
        if (inRange(payment.payment_date, range.from, range.to)) {
          const cat = bill.expense_account ?? 'other'
          expenseByCategory[cat] = (expenseByCategory[cat] ?? 0) + payment.amount_cents
        }
      }
    }

    const expenses = Object.entries(expenseByCategory).map(([category, amount_cents]) => ({
      category,
      amount_cents,
    })).sort((a, b) => b.amount_cents - a.amount_cents)

    const total_expenses_cents = expenses.reduce((s, e) => s + e.amount_cents, 0)
    const net_income_cents = total_income_cents - total_expenses_cents
    const gross_margin_pct = total_income_cents > 0
      ? Math.round((net_income_cents / total_income_cents) * 10000) / 100
      : 0

    return {
      period: range,
      income,
      total_income_cents,
      expenses,
      total_expenses_cents,
      net_income_cents,
      gross_margin_pct,
    }
  } catch {
    return {
      period: range,
      income: [],
      total_income_cents: 0,
      expenses: [],
      total_expenses_cents: 0,
      net_income_cents: 0,
      gross_margin_pct: 0,
    }
  }
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export function generateBalanceSheet(brand: string, asOf: string): BalanceSheetReport {
  try {
    const chartAccounts = listAccounts(brand)

    // AR: unpaid invoices (sent status)
    const invoices = listInvoices(brand)
    const arTotal = invoices
      .filter(inv => inv.status === 'sent')
      .reduce((sum, inv) => sum + dollarsToCents(inv.total ?? 0), 0)

    // AP: unpaid bills
    const bills = listBills(brand)
    const apTotal = bills
      .filter(b => b.status === 'open' || b.status === 'overdue' || b.status === 'partial')
      .reduce((sum, b) => sum + b.amount_due_cents, 0)

    // Bank accounts
    const bankAccounts = listBankAccounts(brand)
    const bankTotal = bankAccounts
      .filter(a => a.is_active && (a.category === 'checking' || a.category === 'savings' || a.category === 'cash'))
      .reduce((sum, a) => sum + a.current_balance_cents, 0)

    // Build assets
    const assets: BalanceSheetReport['assets'] = []

    // Cash/Bank from bank accounts
    if (bankTotal !== 0) {
      assets.push({ account_code: '1000', account_name: 'Cash & Bank Accounts', balance_cents: bankTotal })
    }

    // AR
    if (arTotal > 0) {
      assets.push({ account_code: '1100', account_name: 'Accounts Receivable', balance_cents: arTotal })
    }

    // Other asset accounts from chart of accounts
    const assetAccounts = chartAccounts.filter(a =>
      a.type === 'asset' &&
      a.subtype !== 'checking' &&
      a.subtype !== 'savings' &&
      a.subtype !== 'accounts_receivable' &&
      a.balance_cents !== 0
    )
    for (const acct of assetAccounts) {
      assets.push({ account_code: acct.code, account_name: acct.name, balance_cents: acct.balance_cents })
    }

    const total_assets_cents = assets.reduce((s, a) => s + a.balance_cents, 0)

    // Build liabilities
    const liabilities: BalanceSheetReport['liabilities'] = []

    if (apTotal > 0) {
      liabilities.push({ account_code: '2000', account_name: 'Accounts Payable', balance_cents: apTotal })
    }

    const liabilityAccounts = chartAccounts.filter(a =>
      a.type === 'liability' &&
      a.subtype !== 'accounts_payable' &&
      a.balance_cents !== 0
    )
    for (const acct of liabilityAccounts) {
      liabilities.push({ account_code: acct.code, account_name: acct.name, balance_cents: acct.balance_cents })
    }

    const total_liabilities_cents = liabilities.reduce((s, a) => s + a.balance_cents, 0)

    // Build equity
    const equity: BalanceSheetReport['equity'] = []

    // Retained earnings = cumulative net income (all-time P&L)
    const allPaidInvoices = invoices.filter(inv => inv.status === 'paid')
    const totalRevenue = dollarsToCents(allPaidInvoices.reduce((s, inv) => s + (inv.total ?? 0), 0))
    const allExpenses = listExpenses(brand)
    const totalExpensesAll = allExpenses.reduce((s, e) => s + e.amount_cents, 0)
    const paidBillsAll = listBills(brand, { status: 'paid' })
    const totalBillsPaid = paidBillsAll.reduce((s, b) => s + b.amount_paid_cents, 0)
    const retainedEarnings = totalRevenue - totalExpensesAll - totalBillsPaid

    if (retainedEarnings !== 0) {
      equity.push({ account_code: '3200', account_name: 'Retained Earnings', balance_cents: retainedEarnings })
    }

    const equityAccounts = chartAccounts.filter(a =>
      a.type === 'equity' &&
      a.subtype !== 'retained_earnings' &&
      a.balance_cents !== 0
    )
    for (const acct of equityAccounts) {
      equity.push({ account_code: acct.code, account_name: acct.name, balance_cents: acct.balance_cents })
    }

    const total_equity_cents = equity.reduce((s, a) => s + a.balance_cents, 0)
    const liabilities_and_equity_cents = total_liabilities_cents + total_equity_cents
    const is_balanced = Math.abs(total_assets_cents - liabilities_and_equity_cents) < 2 // 2 cent tolerance for rounding

    return {
      as_of: asOf,
      assets,
      total_assets_cents,
      liabilities,
      total_liabilities_cents,
      equity,
      total_equity_cents,
      liabilities_and_equity_cents,
      is_balanced,
    }
  } catch {
    return {
      as_of: asOf,
      assets: [],
      total_assets_cents: 0,
      liabilities: [],
      total_liabilities_cents: 0,
      equity: [],
      total_equity_cents: 0,
      liabilities_and_equity_cents: 0,
      is_balanced: true,
    }
  }
}

// ── AR Aging ──────────────────────────────────────────────────────────────────

export function generateARaging(brand: string): ARAgingReport {
  try {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    const invoices = listInvoices(brand)
    const unpaid = invoices.filter(inv => inv.status === 'sent')

    const emptyBucket = () => ({ invoices: [] as ARAgingItem[], total_cents: 0 })
    const buckets = {
      current: emptyBucket(),
      days_1_30: emptyBucket(),
      days_31_60: emptyBucket(),
      days_61_90: emptyBucket(),
      days_90_plus: emptyBucket(),
    }

    for (const inv of unpaid) {
      const dueDate = inv.due_date ?? inv.created_at.slice(0, 10)
      const due = new Date(dueDate + 'T12:00:00')
      const diffMs = today.getTime() - due.getTime()
      const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      const amount_cents = dollarsToCents(inv.total ?? 0)

      const item: ARAgingItem = {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        contact_name: inv.contact_name,
        amount_cents,
        due_date: dueDate,
        days_overdue: daysOverdue,
      }

      if (dueDate >= todayStr) {
        buckets.current.invoices.push(item)
        buckets.current.total_cents += amount_cents
      } else if (daysOverdue <= 30) {
        buckets.days_1_30.invoices.push(item)
        buckets.days_1_30.total_cents += amount_cents
      } else if (daysOverdue <= 60) {
        buckets.days_31_60.invoices.push(item)
        buckets.days_31_60.total_cents += amount_cents
      } else if (daysOverdue <= 90) {
        buckets.days_61_90.invoices.push(item)
        buckets.days_61_90.total_cents += amount_cents
      } else {
        buckets.days_90_plus.invoices.push(item)
        buckets.days_90_plus.total_cents += amount_cents
      }
    }

    const total_outstanding_cents =
      buckets.current.total_cents +
      buckets.days_1_30.total_cents +
      buckets.days_31_60.total_cents +
      buckets.days_61_90.total_cents +
      buckets.days_90_plus.total_cents

    return { as_of: todayStr, buckets, total_outstanding_cents }
  } catch {
    const emptyBucket = () => ({ invoices: [] as ARAgingItem[], total_cents: 0 })
    return {
      as_of: new Date().toISOString().slice(0, 10),
      buckets: {
        current: emptyBucket(),
        days_1_30: emptyBucket(),
        days_31_60: emptyBucket(),
        days_61_90: emptyBucket(),
        days_90_plus: emptyBucket(),
      },
      total_outstanding_cents: 0,
    }
  }
}

// ── Cash Flow ─────────────────────────────────────────────────────────────────

export function generateCashFlow(brand: string, range: DateRange): CashFlowReport {
  try {
    const months = monthsBetween(range.from, range.to)
    const monthMap: Record<string, { inflows_cents: number; outflows_cents: number }> = {}
    for (const m of months) {
      monthMap[m] = { inflows_cents: 0, outflows_cents: 0 }
    }

    // Inflows: paid invoices
    const invoices = listInvoices(brand)
    for (const inv of invoices) {
      if (inv.status !== 'paid') continue
      const dateToCheck = inv.paid_at ?? inv.created_at
      if (!inRange(dateToCheck, range.from, range.to)) continue
      const mk = monthKey(dateToCheck.slice(0, 10))
      if (monthMap[mk]) {
        monthMap[mk].inflows_cents += dollarsToCents(inv.total ?? 0)
      }
    }

    // Outflows: bill payments
    const bills = listBills(brand)
    for (const bill of bills) {
      if (!bill.payments) continue
      for (const payment of bill.payments) {
        if (!inRange(payment.payment_date, range.from, range.to)) continue
        const mk = monthKey(payment.payment_date)
        if (monthMap[mk]) {
          monthMap[mk].outflows_cents += payment.amount_cents
        }
      }
    }

    // Outflows: expenses
    const expenses = listExpenses(brand, { from: range.from, to: range.to })
    for (const exp of expenses) {
      const mk = monthKey(exp.date)
      if (monthMap[mk]) {
        monthMap[mk].outflows_cents += exp.amount_cents
      }
    }

    const monthly = months.map(month => {
      const data = monthMap[month] ?? { inflows_cents: 0, outflows_cents: 0 }
      return {
        month,
        inflows_cents: data.inflows_cents,
        outflows_cents: data.outflows_cents,
        net_cents: data.inflows_cents - data.outflows_cents,
      }
    })

    const operating_inflows_cents = monthly.reduce((s, m) => s + m.inflows_cents, 0)
    const operating_outflows_cents = monthly.reduce((s, m) => s + m.outflows_cents, 0)

    return {
      period: range,
      operating_inflows_cents,
      operating_outflows_cents,
      net_operating_cents: operating_inflows_cents - operating_outflows_cents,
      monthly,
    }
  } catch {
    return {
      period: range,
      operating_inflows_cents: 0,
      operating_outflows_cents: 0,
      net_operating_cents: 0,
      monthly: [],
    }
  }
}
