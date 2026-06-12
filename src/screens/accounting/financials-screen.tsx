import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Analytics03Icon,
  Download04Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DateRange { from: string; to: string }

interface PLReport {
  period: DateRange
  income: { account: string; account_name: string; amount_cents: number }[]
  total_income_cents: number
  expenses: { category: string; amount_cents: number }[]
  total_expenses_cents: number
  net_income_cents: number
  gross_margin_pct: number
}

interface BalanceSheetReport {
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

interface ARAgingItem {
  invoice_id: string
  invoice_number?: string
  contact_name: string
  amount_cents: number
  due_date: string
  days_overdue: number
}

interface ARAgingBucket {
  invoices: ARAgingItem[]
  total_cents: number
}

interface ARAgingReport {
  as_of: string
  buckets: {
    current: ARAgingBucket
    days_1_30: ARAgingBucket
    days_31_60: ARAgingBucket
    days_61_90: ARAgingBucket
    days_90_plus: ARAgingBucket
  }
  total_outstanding_cents: number
}

interface CashFlowMonth {
  month: string
  inflows_cents: number
  outflows_cents: number
  net_cents: number
}

interface CashFlowReport {
  period: DateRange
  operating_inflows_cents: number
  operating_outflows_cents: number
  net_operating_cents: number
  monthly: CashFlowMonth[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(cents: number): string {
  const abs = Math.abs(cents)
  const formatted = '$' + (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return cents < 0 ? `(${formatted})` : formatted
}

function fmtMoneyShort(cents: number): string {
  const abs = Math.abs(cents)
  let str: string
  if (abs >= 1_000_000_00) {
    str = '$' + (abs / 1_000_000_00).toFixed(1) + 'M'
  } else if (abs >= 1_000_00) {
    str = '$' + (abs / 1_000_00).toFixed(1) + 'K'
  } else {
    str = '$' + (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  return cents < 0 ? `(${str})` : str
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function fmtMonth(ym: string): string {
  try {
    return new Date(ym + '-01T12:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  } catch { return ym }
}

function yearStart(): string {
  return `${new Date().getFullYear()}-01-01`
}

function yearEnd(): string {
  return `${new Date().getFullYear()}-12-31`
}

function monthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function monthEnd(): string {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

function quarterStart(): string {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3)
  return `${d.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`
}

function quarterEnd(): string {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3)
  const endMonth = (q + 1) * 3
  const last = new Date(d.getFullYear(), endMonth, 0)
  return last.toISOString().slice(0, 10)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function capitalize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── CSV export helpers ────────────────────────────────────────────────────────

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Shared design tokens ──────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const ghostBtnCls = 'flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--theme-muted)] transition-all duration-150 hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]'

// ── Shared UI components ──────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-2xl border p-5', className)}
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ title, total, totalColor }: { title: string; total: string; totalColor?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{title}</h3>
      <span className="text-[14px] font-bold tabular-nums" style={{ color: totalColor ?? 'var(--theme-text)' }}>{total}</span>
    </div>
  )
}

function AccountRow({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-[var(--theme-border)]/60 py-1.5 transition-colors last:border-0',
        bold ? 'mt-1 border-t-2 border-b-0 pt-2' : 'hover:bg-[var(--theme-hover)]',
      )}
      style={bold ? { borderTopColor: 'var(--theme-border)' } : undefined}
    >
      <span className={cn('text-[13px]', bold ? 'font-semibold text-[var(--theme-text)]' : 'text-[var(--theme-muted)]')}>{label}</span>
      <span className={cn('text-[13px] tabular-nums', bold ? 'font-bold text-[var(--theme-text)]' : 'text-[var(--theme-text)]')}>{fmtMoney(amount)}</span>
    </div>
  )
}

// Skeleton blocks shaped like report cards
function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-72 rounded-lg" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 rounded-2xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
        <div className="h-48 rounded-2xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
      </div>
      <div className="h-20 rounded-2xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
    </div>
  )
}

// ── Period selector ───────────────────────────────────────────────────────────

type PeriodPreset = 'month' | 'quarter' | 'year' | 'custom'

interface PeriodSelectorProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

function PeriodSelector({ from, to, onChange }: PeriodSelectorProps) {
  const [preset, setPreset] = useState<PeriodPreset>('year')

  const select = (p: PeriodPreset) => {
    setPreset(p)
    if (p === 'month') onChange(monthStart(), monthEnd())
    else if (p === 'quarter') onChange(quarterStart(), quarterEnd())
    else if (p === 'year') onChange(yearStart(), yearEnd())
  }

  const inputCls = "rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-[12px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
        {(['month', 'quarter', 'year', 'custom'] as PeriodPreset[]).map(p => (
          <button
            key={p}
            onClick={() => select(p)}
            className={cn('rounded-lg px-3 py-1 text-[11px] font-semibold transition-all',
              preset === p ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
            style={preset === p ? {
              background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
              color: 'var(--theme-accent)',
            } : undefined}
          >
            {p === 'month' ? 'This Month' : p === 'quarter' ? 'This Quarter' : p === 'year' ? 'This Year' : 'Custom'}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <>
          <input
            className={inputCls}
            type="date"
            value={from}
            onChange={e => onChange(e.target.value, to)}
          />
          <span className="text-[12px] text-[var(--theme-muted)]">to</span>
          <input
            className={inputCls}
            type="date"
            value={to}
            onChange={e => onChange(from, e.target.value)}
          />
        </>
      )}
    </div>
  )
}

// ── Tab 1: P&L ────────────────────────────────────────────────────────────────

function PLTab() {
  const brand = useBrand()
  const [from, setFrom] = useState(yearStart())
  const [to, setTo] = useState(yearEnd())

  const { data: report, isLoading } = useQuery<PLReport>({
    queryKey: ['report-pl', brand.id, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/pl?from=${from}&to=${to}`, {
        headers: { 'x-brand': brand.id },
      })
      if (!res.ok) throw new Error('Failed to fetch P&L')
      return res.json()
    },
  })

  const exportCsv = () => {
    if (!report) return
    const rows: string[][] = [
      ['Profit & Loss Report'],
      [`Period: ${from} to ${to}`],
      [],
      ['INCOME'],
      ['Account', 'Amount'],
      ...report.income.map(i => [i.account_name, String(i.amount_cents / 100)]),
      ['Total Income', String(report.total_income_cents / 100)],
      [],
      ['EXPENSES'],
      ['Category', 'Amount'],
      ...report.expenses.map(e => [capitalize(e.category), String(e.amount_cents / 100)]),
      ['Total Expenses', String(report.total_expenses_cents / 100)],
      [],
      ['Net Income', String(report.net_income_cents / 100)],
      ['Gross Margin %', String(report.gross_margin_pct)],
    ]
    downloadCsv(`pl-${from}-${to}.csv`, rows)
  }

  if (isLoading) {
    return <ReportSkeleton />
  }

  const netPositive = (report?.net_income_cents ?? 0) >= 0
  const netColor = netPositive ? '#10b981' : '#ef4444'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <button onClick={exportCsv} className={ghostBtnCls}>
          <HugeiconsIcon icon={Download04Icon} size={13} />
          Export CSV
        </button>
      </div>

      {/* Gross Margin badge */}
      {report && (
        <div className="flex items-center gap-4">
          <div
            className="rounded-xl border px-4 py-2 text-center"
            style={{
              background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
              borderColor: 'color-mix(in srgb, var(--theme-accent) 25%, transparent)',
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Gross Margin</p>
            <p className="text-[24px] font-bold leading-tight tabular-nums" style={{ color: 'var(--theme-accent)' }}>
              {report.gross_margin_pct.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Income */}
        <SectionCard>
          <SectionHeader
            title="Income"
            total={fmtMoney(report?.total_income_cents ?? 0)}
            totalColor="#10b981"
          />
          {(report?.income ?? []).length === 0 ? (
            <p className="py-4 text-center text-[12px] text-[var(--theme-muted)]">No income recorded this period</p>
          ) : (
            <div>
              {(report?.income ?? []).map(item => (
                <AccountRow key={item.account} label={item.account_name} amount={item.amount_cents} />
              ))}
              <AccountRow label="Total Income" amount={report?.total_income_cents ?? 0} bold />
            </div>
          )}
        </SectionCard>

        {/* Expenses */}
        <SectionCard>
          <SectionHeader
            title="Expenses"
            total={fmtMoney(report?.total_expenses_cents ?? 0)}
            totalColor="#ef4444"
          />
          {(report?.expenses ?? []).length === 0 ? (
            <p className="py-4 text-center text-[12px] text-[var(--theme-muted)]">No expenses recorded this period</p>
          ) : (
            <div>
              {(report?.expenses ?? []).map(item => (
                <AccountRow key={item.category} label={capitalize(item.category)} amount={item.amount_cents} />
              ))}
              <AccountRow label="Total Expenses" amount={report?.total_expenses_cents ?? 0} bold />
            </div>
          )}
        </SectionCard>
      </div>

      {/* Net Income — hero number */}
      {report && (
        <div
          className="relative overflow-hidden rounded-2xl border p-5"
          style={{
            background: `color-mix(in srgb, ${netColor} 7%, var(--theme-card))`,
            borderColor: `color-mix(in srgb, ${netColor} 30%, transparent)`,
            boxShadow: `0 2px 14px color-mix(in srgb, ${netColor} 18%, transparent)`,
          }}
        >
          <div
            className="absolute left-0 top-0 h-full w-[3px]"
            style={{ background: `linear-gradient(180deg, ${netColor}, color-mix(in srgb, ${netColor} 40%, transparent))` }}
          />
          <div className="flex items-center justify-between pl-1.5">
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${netColor}, color-mix(in srgb, ${netColor} 65%, #000))`,
                  boxShadow: `0 2px 8px color-mix(in srgb, ${netColor} 38%, transparent)`,
                }}
              >
                <HugeiconsIcon
                  icon={netPositive ? ArrowUp01Icon : ArrowDown01Icon}
                  size={16}
                  className="text-white"
                />
              </span>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Net Income</span>
                <span className="text-[13px] font-semibold text-[var(--theme-text)]">{netPositive ? 'Profit' : 'Loss'} this period</span>
              </div>
            </div>
            <span className="text-[32px] font-bold leading-none tabular-nums" style={{ color: netColor }}>
              {fmtMoney(report.net_income_cents)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Balance Sheet ──────────────────────────────────────────────────────

function BalanceSheetTab() {
  const brand = useBrand()
  const [asOf, setAsOf] = useState(todayStr())

  const { data: report, isLoading } = useQuery<BalanceSheetReport>({
    queryKey: ['report-balance-sheet', brand.id, asOf],
    queryFn: async () => {
      const res = await fetch(`/api/reports/balance-sheet?as_of=${asOf}`, {
        headers: { 'x-brand': brand.id },
      })
      if (!res.ok) throw new Error('Failed to fetch balance sheet')
      return res.json()
    },
  })

  const inputCls = "rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-[12px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"

  if (isLoading) {
    return <ReportSkeleton />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[12px] font-medium text-[var(--theme-muted)]">As of date</label>
        <input className={inputCls} type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
        {report && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
            style={report.is_balanced
              ? {
                  background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))',
                  borderColor: 'color-mix(in srgb, #10b981 40%, transparent)',
                  color: '#10b981',
                  boxShadow: '0 0 12px color-mix(in srgb, #10b981 40%, transparent)',
                }
              : {
                  background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))',
                  borderColor: 'color-mix(in srgb, #f59e0b 40%, transparent)',
                  color: '#f59e0b',
                }}
          >
            <HugeiconsIcon icon={report.is_balanced ? CheckmarkCircle01Icon : Alert01Icon} size={13} />
            {report.is_balanced ? 'Balanced' : 'Not Balanced'}
          </span>
        )}
      </div>

      {report && (
        <div className="space-y-4">
          {/* Assets */}
          <SectionCard>
            <SectionHeader title="Assets" total={fmtMoney(report.total_assets_cents)} />
            {report.assets.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-[var(--theme-muted)]">No asset accounts</p>
            ) : (
              <div>
                {report.assets.map(a => (
                  <AccountRow key={a.account_code} label={`${a.account_code} · ${a.account_name}`} amount={a.balance_cents} />
                ))}
                <AccountRow label="Total Assets" amount={report.total_assets_cents} bold />
              </div>
            )}
          </SectionCard>

          {/* Liabilities */}
          <SectionCard>
            <SectionHeader title="Liabilities" total={fmtMoney(report.total_liabilities_cents)} totalColor="#ef4444" />
            {report.liabilities.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-[var(--theme-muted)]">No liabilities</p>
            ) : (
              <div>
                {report.liabilities.map(l => (
                  <AccountRow key={l.account_code} label={`${l.account_code} · ${l.account_name}`} amount={l.balance_cents} />
                ))}
                <AccountRow label="Total Liabilities" amount={report.total_liabilities_cents} bold />
              </div>
            )}
          </SectionCard>

          {/* Equity */}
          <SectionCard>
            <SectionHeader title="Equity" total={fmtMoney(report.total_equity_cents)} totalColor="var(--theme-accent)" />
            {report.equity.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-[var(--theme-muted)]">No equity accounts</p>
            ) : (
              <div>
                {report.equity.map(e => (
                  <AccountRow key={e.account_code} label={`${e.account_code} · ${e.account_name}`} amount={e.balance_cents} />
                ))}
                <AccountRow label="Total Equity" amount={report.total_equity_cents} bold />
              </div>
            )}
          </SectionCard>

          {/* L+E total */}
          <SectionCard>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-[var(--theme-text)]">Total Liabilities &amp; Equity</span>
              <span className="text-[20px] font-bold tabular-nums text-[var(--theme-text)]">{fmtMoney(report.liabilities_and_equity_cents)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="text-[12px] text-[var(--theme-muted)]">Total Assets</span>
              <span className="text-[12px] tabular-nums text-[var(--theme-muted)]">{fmtMoney(report.total_assets_cents)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[12px] text-[var(--theme-muted)]">Difference</span>
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: report.is_balanced ? '#10b981' : '#f59e0b' }}>
                {fmtMoney(report.total_assets_cents - report.liabilities_and_equity_cents)}
              </span>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: AR Aging ───────────────────────────────────────────────────────────

interface AgingBucketCardProps {
  label: string
  bucket: ARAgingBucket
  color: string
  expanded: boolean
  onToggle: () => void
}

function AgingBucketCard({ label, bucket, color, expanded, onToggle }: AgingBucketCardProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="relative w-full overflow-hidden rounded-xl border p-4 text-left transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
        style={{
          background: 'var(--theme-card)',
          borderColor: expanded ? `color-mix(in srgb, ${color} 45%, transparent)` : 'var(--theme-border)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
          style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
        />
        <div className="flex items-center justify-between pl-1.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</p>
            <p className="mt-1 text-[20px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{fmtMoneyShort(bucket.total_cents)}</p>
            <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{bucket.invoices.length} invoice{bucket.invoices.length !== 1 ? 's' : ''}</p>
          </div>
          <HugeiconsIcon
            icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
            size={16}
            className="text-[var(--theme-muted)]"
          />
        </div>
      </button>

      {expanded && bucket.invoices.length > 0 && (
        <div
          className="mt-1 overflow-hidden rounded-2xl border"
          style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--theme-hover)' }}>
                {['Contact', 'Invoice #', 'Due Date', 'Days Overdue', 'Amount'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bucket.invoices.map((inv, i) => {
                const dc = inv.days_overdue === 0 ? '#10b981' : inv.days_overdue <= 30 ? '#f59e0b' : inv.days_overdue <= 60 ? '#f97316' : '#ef4444'
                return (
                  <tr
                    key={inv.invoice_id}
                    className="transition-colors hover:bg-[var(--theme-hover)]"
                    style={{ borderTop: i > 0 ? '1px solid var(--theme-border)' : undefined }}
                  >
                    <td className="px-3 py-2 text-[12px] font-medium text-[var(--theme-text)]">{inv.contact_name}</td>
                    <td className="px-3 py-2 text-[12px] text-[var(--theme-muted)]">{inv.invoice_number ?? '—'}</td>
                    <td className="px-3 py-2 text-[12px] tabular-nums text-[var(--theme-muted)]">{fmtDate(inv.due_date)}</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: `color-mix(in srgb, ${dc} 12%, var(--theme-card))`,
                          color: dc,
                          border: `1px solid color-mix(in srgb, ${dc} 30%, transparent)`,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dc }} />
                        {inv.days_overdue === 0 ? 'Current' : `${inv.days_overdue}d`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-semibold tabular-nums text-[var(--theme-text)]">{fmtMoney(inv.amount_cents)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ARAgingTab() {
  const brand = useBrand()
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: report, isLoading } = useQuery<ARAgingReport>({
    queryKey: ['report-ar-aging', brand.id],
    queryFn: async () => {
      const res = await fetch('/api/reports/ar-aging', {
        headers: { 'x-brand': brand.id },
      })
      if (!res.ok) throw new Error('Failed to fetch AR aging')
      return res.json()
    },
  })

  const exportCsv = () => {
    if (!report) return
    const rows: string[][] = [
      ['AR Aging Report', `As of ${report.as_of}`],
      [],
      ['Bucket', 'Contact', 'Invoice #', 'Due Date', 'Days Overdue', 'Amount'],
    ]
    const bucketEntries: [string, ARAgingBucket][] = [
      ['Current', report.buckets.current],
      ['1-30 Days', report.buckets.days_1_30],
      ['31-60 Days', report.buckets.days_31_60],
      ['61-90 Days', report.buckets.days_61_90],
      ['90+ Days', report.buckets.days_90_plus],
    ]
    for (const [label, bucket] of bucketEntries) {
      for (const inv of bucket.invoices) {
        rows.push([label, inv.contact_name, inv.invoice_number ?? '', inv.due_date, String(inv.days_overdue), String(inv.amount_cents / 100)])
      }
    }
    downloadCsv(`ar-aging-${report.as_of}.csv`, rows)
  }

  if (isLoading) {
    return <ReportSkeleton />
  }

  const bucketDefs: { key: string; label: string; color: string; bucket: ARAgingBucket }[] = report
    ? [
        { key: 'current', label: 'Current', color: '#10b981', bucket: report.buckets.current },
        { key: '1-30', label: '1–30 Days', color: '#f59e0b', bucket: report.buckets.days_1_30 },
        { key: '31-60', label: '31–60 Days', color: '#f97316', bucket: report.buckets.days_31_60 },
        { key: '61-90', label: '61–90 Days', color: '#ef4444', bucket: report.buckets.days_61_90 },
        { key: '90+', label: '90+ Days', color: '#b91c1c', bucket: report.buckets.days_90_plus },
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-[var(--theme-muted)]">As of {report ? fmtDate(report.as_of) : '—'}</p>
        </div>
        <div className="flex items-center gap-3">
          {report && (
            <div
              className="rounded-xl border px-4 py-2 text-center"
              style={{
                background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
                borderColor: 'color-mix(in srgb, var(--theme-accent) 25%, transparent)',
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Total Outstanding</p>
              <p className="text-[20px] font-bold leading-tight tabular-nums" style={{ color: 'var(--theme-accent)' }}>
                {fmtMoneyShort(report.total_outstanding_cents)}
              </p>
            </div>
          )}
          <button onClick={exportCsv} className={ghostBtnCls}>
            <HugeiconsIcon icon={Download04Icon} size={13} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {bucketDefs.map(({ key, label, color, bucket }) => (
          <AgingBucketCard
            key={key}
            label={label}
            bucket={bucket}
            color={color}
            expanded={expanded === key}
            onToggle={() => setExpanded(expanded === key ? null : key)}
          />
        ))}
      </div>

      {/* Expanded bucket detail — shown below cards */}
      {expanded && report && (
        <div className="mt-2">
          {bucketDefs
            .filter(b => b.key === expanded && b.bucket.invoices.length > 0)
            .map(({ key, label, bucket, color }) => (
              <AgingBucketCard
                key={key + '-detail'}
                label={label}
                bucket={bucket}
                color={color}
                expanded={true}
                onToggle={() => setExpanded(null)}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// ── Tab 4: Cash Flow ──────────────────────────────────────────────────────────

function CashFlowTab() {
  const brand = useBrand()
  const [from, setFrom] = useState(yearStart())
  const [to, setTo] = useState(yearEnd())

  const { data: report, isLoading } = useQuery<CashFlowReport>({
    queryKey: ['report-cash-flow', brand.id, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/cash-flow?from=${from}&to=${to}`, {
        headers: { 'x-brand': brand.id },
      })
      if (!res.ok) throw new Error('Failed to fetch cash flow')
      return res.json()
    },
  })

  const maxVal = report
    ? Math.max(...report.monthly.map(m => Math.max(m.inflows_cents, m.outflows_cents)), 1)
    : 1

  if (isLoading) {
    return <ReportSkeleton />
  }

  return (
    <div className="space-y-4">
      <PeriodSelector from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />

      {/* Summary cards */}
      {report && (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: 'Total Inflows', value: report.operating_inflows_cents, color: '#10b981' },
            { label: 'Total Outflows', value: report.operating_outflows_cents, color: '#ef4444' },
            { label: 'Net Cash Flow', value: report.net_operating_cents, color: report.net_operating_cents >= 0 ? '#10b981' : '#ef4444' },
          ].map(card => (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-1 hover:shadow-md"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(8px)' }}
            >
              <div
                className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
                style={{ background: `linear-gradient(180deg, ${card.color}, color-mix(in srgb, ${card.color} 40%, transparent))` }}
              />
              <div className="pl-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{card.label}</p>
                <p className="mt-1 text-[22px] font-bold leading-none tabular-nums" style={{ color: card.color }}>{fmtMoneyShort(card.value)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bar chart */}
      {report && report.monthly.length > 0 && (
        <SectionCard>
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Monthly Cash Flow</h3>
          <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 140 }}>
            {report.monthly.map(m => {
              const inH = Math.max(4, Math.round((m.inflows_cents / maxVal) * 100))
              const outH = Math.max(4, Math.round((m.outflows_cents / maxVal) * 100))
              const netPos = m.net_cents >= 0
              return (
                <div key={m.month} className="group flex min-w-[40px] flex-1 flex-col items-center gap-1">
                  {/* Hover value label */}
                  <div className="text-[9px] font-semibold tabular-nums text-[var(--theme-text)] opacity-0 transition-opacity group-hover:opacity-100">
                    {fmtMoneyShort(m.net_cents)}
                  </div>
                  {/* Bars */}
                  <div className="flex w-full items-end justify-center gap-0.5" style={{ height: 100 }}>
                    <div
                      title={`Inflows: ${fmtMoney(m.inflows_cents)}`}
                      className="flex-1 rounded-t-md transition-all duration-500"
                      style={{
                        height: `${inH}%`,
                        background: 'linear-gradient(180deg, #10b981, color-mix(in srgb, #10b981 55%, #000))',
                        boxShadow: '0 2px 6px color-mix(in srgb, #10b981 25%, transparent)',
                        opacity: 0.85,
                      }}
                    />
                    <div
                      title={`Outflows: ${fmtMoney(m.outflows_cents)}`}
                      className="flex-1 rounded-t-md transition-all duration-500"
                      style={{
                        height: `${outH}%`,
                        background: 'linear-gradient(180deg, #ef4444, color-mix(in srgb, #ef4444 55%, #000))',
                        boxShadow: '0 2px 6px color-mix(in srgb, #ef4444 25%, transparent)',
                        opacity: 0.85,
                      }}
                    />
                    <div
                      title={`Net: ${fmtMoney(m.net_cents)}`}
                      className="w-1 rounded-t transition-all duration-500"
                      style={{
                        height: `${Math.max(4, Math.round((Math.abs(m.net_cents) / maxVal) * 100))}%`,
                        background: netPos
                          ? 'linear-gradient(180deg, #0ea5e9, color-mix(in srgb, #0ea5e9 55%, #000))'
                          : 'linear-gradient(180deg, #a855f7, color-mix(in srgb, #a855f7 55%, #000))',
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">{m.month.slice(5)}</span>
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {[
              { color: '#10b981', label: 'Inflows' },
              { color: '#ef4444', label: 'Outflows' },
              { color: '#0ea5e9', label: 'Net' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                <span className="text-[11px] text-[var(--theme-muted)]">{l.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Monthly table */}
      {report && report.monthly.length > 0 && (
        <SectionCard>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Monthly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Month', 'Inflows', 'Outflows', 'Net'].map(h => (
                    <th key={h} className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.monthly.map((m, i) => (
                  <tr
                    key={m.month}
                    className="transition-colors hover:bg-[var(--theme-hover)]"
                    style={{ borderTop: i > 0 ? '1px solid var(--theme-border)' : undefined }}
                  >
                    <td className="py-2 pr-4 text-[13px] text-[var(--theme-text)]">{fmtMonth(m.month)}</td>
                    <td className="py-2 pr-4 text-[13px] font-medium tabular-nums" style={{ color: '#10b981' }}>{fmtMoney(m.inflows_cents)}</td>
                    <td className="py-2 pr-4 text-[13px] font-medium tabular-nums" style={{ color: '#ef4444' }}>{fmtMoney(m.outflows_cents)}</td>
                    <td className="py-2 text-[13px] font-bold tabular-nums" style={{ color: m.net_cents >= 0 ? '#10b981' : '#ef4444' }}>
                      {fmtMoney(m.net_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Tab = 'pl' | 'balance-sheet' | 'ar-aging' | 'cash-flow'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pl', label: 'Profit & Loss' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'ar-aging', label: 'AR Aging' },
  { id: 'cash-flow', label: 'Cash Flow' },
]

export function FinancialsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('pl')

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-20 md:pb-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Analytics03Icon} size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-[var(--theme-text)]">Financial Reports</h1>
            <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">P&amp;L, Balance Sheet, AR Aging, Cash Flow</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex w-fit gap-1 overflow-x-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'min-w-max whitespace-nowrap rounded-lg px-4 py-1.5 text-[12px] font-semibold transition-all',
                activeTab === tab.id ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
              )}
              style={activeTab === tab.id ? {
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
              } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'pl' && <PLTab />}
        {activeTab === 'balance-sheet' && <BalanceSheetTab />}
        {activeTab === 'ar-aging' && <ARAgingTab />}
        {activeTab === 'cash-flow' && <CashFlowTab />}
      </div>
    </div>
  )
}
