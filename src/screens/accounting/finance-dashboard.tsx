import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CoinsDollarIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  BankIcon,
  Invoice01Icon,
  MoneyBag01Icon,
  Add01Icon,
  Analytics03Icon,
  Calculator01Icon,
  ReceiptDollarIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cinema, type CinemaPalette } from '@/lib/brand-cinema'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PLReport {
  total_income_cents: number
  total_expenses_cents: number
  net_income_cents: number
  gross_margin_pct: number
}

interface ARAgingBuckets {
  current: { total_cents: number }
  days_1_30: { total_cents: number }
  days_31_60: { total_cents: number }
  days_61_90: { total_cents: number }
  days_90_plus: { total_cents: number }
}

interface ARAgingReport {
  total_outstanding_cents: number
  buckets: ARAgingBuckets
}

interface BillsSummary {
  total_open_cents: number
  total_overdue_cents: number
  total_paid_this_month_cents: number
  bills_due_this_week: number
}

interface BankAccount {
  id: string
  name: string
  current_balance_cents: number
  category: string
}

interface PayrollSummary {
  total_employees: number
  monthly_payroll_cents: number
  ytd_payroll_cents: number
}

interface JournalEntry {
  id: string
  date: string
  description: string
  source: string
  lines?: { debit_cents?: number; credit_cents?: number }[]
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-2xl border p-5', className)}
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div className="h-3 w-24 rounded-full bg-[var(--theme-hover)] mb-3" />
      <div className="h-8 w-32 rounded-full bg-[var(--theme-hover)] mb-2" />
      <div className="h-2 w-20 rounded-full bg-[var(--theme-hover)]" />
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: boolean
  positive?: boolean
  negative?: boolean
  /** Hero treatment — brand-gradient text + stronger glow framing. */
  hero?: boolean
  cine: CinemaPalette
  children?: React.ReactNode
}

function StatCard({ label, value, sub, accent, positive, negative, hero, cine, children }: StatCardProps) {
  // Hero value paints with the brand gradient; positive/negative keep semantic
  // color but the card frame carries the brand glow.
  const valueStyle: React.CSSProperties = hero
    ? {
        backgroundImage: cine.gradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      }
    : accent
      ? { color: cine.accent }
      : {}

  return (
    <div
      className="fin-stat group relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-1 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: 'var(--theme-card)',
        borderColor: hero ? `color-mix(in srgb, ${cine.accent} 38%, var(--theme-border))` : 'var(--theme-border)',
        backdropFilter: 'blur(10px)',
        boxShadow: hero ? `0 10px 30px -12px ${cine.glow}55, inset 0 1px 0 ${cine.accent}14` : undefined,
        ['--fin-glow' as string]: cine.glow,
      }}
    >
      {/* brand-gradient accent rail (top) — animates in on mount */}
      <span
        className="fin-rail absolute inset-x-0 top-0 h-[3px]"
        style={{ background: cine.gradient, opacity: hero ? 1 : 0.7 }}
      />
      {/* soft brand wash for the hero */}
      {hero && (
        <span
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full"
          style={{ background: `radial-gradient(circle, ${cine.glow}33, transparent 70%)`, filter: 'blur(6px)' }}
        />
      )}
      <p className="relative text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">{label}</p>
      <p
        className={cn(
          'relative font-bold leading-none mt-1 tabular-nums',
          hero ? 'text-[32px]' : 'text-[26px]',
          !hero && positive ? 'text-emerald-600 dark:text-emerald-400' : '',
          !hero && negative ? 'text-red-500 dark:text-red-400' : '',
          !hero && !accent && !positive && !negative ? 'text-[var(--theme-text)]' : '',
        )}
        style={valueStyle}
      >
        {value}
      </p>
      {sub && <p className="relative text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      {children}
    </div>
  )
}

// ── Quick Action Card ─────────────────────────────────────────────────────────

interface QuickActionProps {
  icon: typeof Add01Icon
  label: string
  to: string
  cine: CinemaPalette
}

function QuickAction({ icon, label, to, cine }: QuickActionProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => void navigate({ to: to as '/' })}
      className="fin-tile group relative flex flex-col items-center gap-2.5 overflow-hidden rounded-2xl border p-4 text-center transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
        ['--fin-glow' as string]: cine.glow,
      }}
    >
      {/* brand-gradient cover that blooms in on hover */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: `linear-gradient(160deg, ${cine.accent}1f, ${cine.accent2}10 60%, transparent)` }}
      />
      <span
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-white transition-transform duration-200 group-hover:scale-105"
        style={{
          background: cine.gradient,
          boxShadow: `0 4px 12px ${cine.glow}40`,
        }}
      >
        <HugeiconsIcon icon={icon} size={20} />
      </span>
      <span className="relative text-[12px] font-medium text-[var(--theme-text)]">{label}</span>
      <HugeiconsIcon icon={ArrowRight01Icon} size={12} className="relative text-[var(--theme-muted)] transition-colors group-hover:text-[var(--theme-text)]" />
    </button>
  )
}

// ── Aging Bar ─────────────────────────────────────────────────────────────────

interface AgingBarProps {
  label: string
  cents: number
  total: number
  color: string
}

function AgingBar({ label, cents, total, color }: AgingBarProps) {
  const pct = total > 0 ? Math.round((cents / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-[var(--theme-muted)]">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--theme-hover)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="w-16 text-right text-[11px] font-medium text-[var(--theme-text)]">{fmtMoneyShort(cents)}</span>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function FinanceDashboard() {
  const brand = useBrand()
  const cine = cinema(brand.id)
  const [period, setPeriod] = useState<'mtd' | 'ytd'>('mtd')

  const today = new Date().toISOString().slice(0, 10)
  const d = new Date()
  const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${d.getFullYear()}-01-01`
  const from = period === 'mtd' ? monthStart : yearStart

  const lastUpdated = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const plQuery = useQuery<PLReport>({
    queryKey: ['pl', brand.id, from],
    queryFn: () => fetch(`/api/reports/pl?from=${from}&to=${today}&brand=${brand.id}`).then(r => r.json()),
  })

  const arQuery = useQuery<ARAgingReport>({
    queryKey: ['ar-aging', brand.id],
    queryFn: () => fetch(`/api/reports/ar-aging?brand=${brand.id}`).then(r => r.json()),
  })

  const apQuery = useQuery<BillsSummary>({
    queryKey: ['bills-summary', brand.id],
    queryFn: () => fetch(`/api/bills/summary?brand=${brand.id}`).then(r => r.json()),
  })

  const bankQuery = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts', brand.id],
    queryFn: () => fetch(`/api/banking/accounts?brand=${brand.id}`).then(r => r.json()),
  })

  const payrollQuery = useQuery<PayrollSummary>({
    queryKey: ['payroll-summary', brand.id],
    queryFn: () => fetch(`/api/payroll/summary?brand=${brand.id}`).then(r => r.json()),
  })

  const journalQuery = useQuery<JournalEntry[]>({
    queryKey: ['journal-recent', brand.id],
    queryFn: () => fetch(`/api/journal-entries?limit=5&brand=${brand.id}`).then(r => r.json()),
  })

  // ── Derived values ───────────────────────────────────────────────────────────

  const accounts = Array.isArray(bankQuery.data) ? bankQuery.data : []
  const cashTotal = accounts.reduce((s, a) => s + a.current_balance_cents, 0)

  const pl = plQuery.data
  const ar = arQuery.data
  const ap = apQuery.data
  const payroll = payrollQuery.data
  const entries = Array.isArray(journalQuery.data) ? journalQuery.data : []

  const arTotal = ar?.total_outstanding_cents ?? 0
  const apTotal = ap?.total_open_cents ?? 0
  const moneyIn = (pl?.total_income_cents ?? 0) + arTotal
  const moneyOut = (pl?.total_expenses_cents ?? 0) + apTotal
  const netPosition = cashTotal + arTotal - apTotal

  const incomeBar = pl
    ? Math.round((pl.total_income_cents / Math.max(pl.total_income_cents + pl.total_expenses_cents, 1)) * 100)
    : 50

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 pb-20 md:pb-8 space-y-6">

        {/* ── Cinematic header band ──────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-3xl border p-6"
          style={{
            borderColor: `color-mix(in srgb, ${cine.accent} 28%, var(--theme-border))`,
            background: `linear-gradient(135deg, ${cine.accent}1f, ${cine.accent2}12 55%, var(--theme-card) 100%), var(--theme-card)`,
            boxShadow: `0 18px 50px -24px ${cine.glow}66`,
          }}
        >
          {/* soft brand glow bloom */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full"
            style={{ background: `radial-gradient(circle, ${cine.glow}40, transparent 70%)`, filter: 'blur(8px)' }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{ background: cine.gradient, boxShadow: `0 6px 18px ${cine.glow}55` }}
              >
                <HugeiconsIcon icon={CoinsDollarIcon} size={22} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted)]">
                  Financial Overview
                </p>
                <h1
                  className="text-[34px] font-bold leading-none tracking-tight tabular-nums"
                  style={{
                    backgroundImage: cine.gradient,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  }}
                >
                  {bankQuery.isLoading || arQuery.isLoading || apQuery.isLoading
                    ? '—'
                    : fmtMoneyShort(netPosition)}
                </h1>
                <p className="mt-1 text-[11px] text-[var(--theme-muted)]">
                  Net position · Cash + AR − AP · updated {lastUpdated}
                </p>
              </div>
            </div>

            {/* Period toggle — refined glass segmented control */}
            <div
              className="flex shrink-0 rounded-xl border p-1 gap-1 backdrop-blur-md"
              style={{
                background: `color-mix(in srgb, ${cine.accent} 6%, var(--theme-card))`,
                borderColor: `color-mix(in srgb, ${cine.accent} 22%, var(--theme-border))`,
              }}
            >
              {(['mtd', 'ytd'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-[12px] font-semibold transition-all duration-150',
                    period === p ? 'text-white' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                  )}
                  style={period === p ? { background: cine.gradient, boxShadow: `0 4px 12px ${cine.glow}55` } : undefined}
                >
                  {p === 'mtd' ? 'MTD' : 'YTD'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 1: Cash Position ───────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
            Cash Position
          </h2>
          {bankQuery.isLoading || plQuery.isLoading || arQuery.isLoading || apQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              {/* Cash & Bank */}
              <StatCard
                cine={cine}
                label="Cash & Bank"
                value={fmtMoneyShort(cashTotal)}
                sub={`${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
                positive={cashTotal >= 0}
                negative={cashTotal < 0}
              >
                {accounts.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--theme-border)' }}>
                    {accounts.slice(0, 4).map(acc => (
                      <div key={acc.id} className="flex items-center justify-between">
                        <span className="truncate text-[11px] text-[var(--theme-muted)]">{acc.name}</span>
                        <span className={cn('shrink-0 text-[11px] font-medium ml-2', acc.current_balance_cents >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                          {fmtMoneyShort(acc.current_balance_cents)}
                        </span>
                      </div>
                    ))}
                    {accounts.length > 4 && (
                      <p className="text-[10px] text-[var(--theme-muted)]">+{accounts.length - 4} more</p>
                    )}
                  </div>
                )}
              </StatCard>

              {/* Money In */}
              <StatCard
                cine={cine}
                label={`Money In (${period.toUpperCase()})`}
                value={fmtMoneyShort(moneyIn)}
                sub={`AR outstanding: ${fmtMoneyShort(arTotal)}`}
                positive
              >
                {pl && (
                  <div className="mt-2 text-[11px] text-[var(--theme-muted)]">
                    Income: {fmtMoneyShort(pl.total_income_cents)}
                  </div>
                )}
              </StatCard>

              {/* Money Out */}
              <StatCard
                cine={cine}
                label={`Money Out (${period.toUpperCase()})`}
                value={fmtMoneyShort(moneyOut)}
                sub={`Open bills: ${fmtMoneyShort(apTotal)}`}
                negative
              >
                {pl && (
                  <div className="mt-2 text-[11px] text-[var(--theme-muted)]">
                    Expenses: {fmtMoneyShort(pl.total_expenses_cents)}
                  </div>
                )}
              </StatCard>

              {/* Net Position — the hero card */}
              <StatCard
                cine={cine}
                hero
                label="Net Position"
                value={fmtMoneyShort(netPosition)}
                sub="Cash + AR − AP"
                positive={netPosition >= 0}
                negative={netPosition < 0}
              >
                <div className="mt-2 flex items-center gap-1">
                  <HugeiconsIcon
                    icon={netPosition >= 0 ? ArrowUp01Icon : ArrowDown01Icon}
                    size={14}
                    className={netPosition >= 0 ? 'text-emerald-500' : 'text-red-500'}
                  />
                  <span className="text-[11px] text-[var(--theme-muted)]">
                    {netPosition >= 0 ? 'Positive' : 'Negative'} position
                  </span>
                </div>
              </StatCard>
            </div>
          )}
        </div>

        {/* ── Row 2: P&L Snapshot ────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
            P&amp;L Snapshot — {period === 'mtd' ? 'Month to Date' : 'Year to Date'}
          </h2>
          {plQuery.isLoading ? (
            <SkeletonCard className="h-24" />
          ) : pl ? (
            <div
              className="rounded-2xl border p-5"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            >
              {/* Summary row */}
              <div className="flex flex-wrap items-center gap-6 mb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Income</p>
                  <p className="text-[18px] font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(pl.total_income_cents)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Expenses</p>
                  <p className="text-[18px] font-bold text-red-500">{fmtMoney(pl.total_expenses_cents)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Net</p>
                  <div className="flex items-center gap-1.5">
                    <HugeiconsIcon
                      icon={pl.net_income_cents >= 0 ? ArrowUp01Icon : ArrowDown01Icon}
                      size={16}
                      className={pl.net_income_cents >= 0 ? 'text-emerald-500' : 'text-red-500'}
                    />
                    <p className={cn('text-[18px] font-bold', pl.net_income_cents >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                      {fmtMoney(pl.net_income_cents)}
                    </p>
                  </div>
                </div>
                <div
                  className="ml-auto rounded-xl border px-4 py-2 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${cine.accent}1c, ${cine.accent2}10)`,
                    borderColor: `color-mix(in srgb, ${cine.accent} 26%, var(--theme-border))`,
                  }}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Gross Margin</p>
                  <p
                    className="text-[18px] font-bold tabular-nums"
                    style={{
                      backgroundImage: cine.gradient,
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent',
                    }}
                  >
                    {pl.gross_margin_pct.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Income vs Expenses bar — polished gradient */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-[var(--theme-muted)] mb-1">
                  <span>Income vs Expenses</span>
                  <span className="tabular-nums">{incomeBar}% income share</span>
                </div>
                <div
                  className="flex h-3 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--theme-hover)', boxShadow: `inset 0 1px 2px ${cine.glow}14` }}
                >
                  <div
                    className="h-full rounded-l-full transition-all duration-500"
                    style={{ width: `${incomeBar}%`, background: 'linear-gradient(90deg,#16a34a,#22c55e)' }}
                  />
                  <div
                    className="h-full rounded-r-full transition-all duration-500"
                    style={{ width: `${100 - incomeBar}%`, background: 'linear-gradient(90deg,#ef4444,#f87171)' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--theme-muted)]">
                  <span style={{ color: '#22c55e' }}>■ Income</span>
                  <span style={{ color: '#ef4444' }}>■ Expenses</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl border p-8 text-center"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            >
              <p className="text-[12px] text-[var(--theme-muted)]">No P&L data for this period</p>
            </div>
          )}
        </div>

        {/* ── Row 3: AR Aging + AP/Bills ────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* AR Aging */}
          <div
            className="fin-panel relative overflow-hidden rounded-2xl border p-5"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', ['--fin-glow' as string]: cine.glow }}
          >
            <span className="fin-rail absolute inset-x-0 top-0 h-[3px]" style={{ background: cine.gradient, opacity: 0.55 }} />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[var(--theme-text)]">AR Aging</h3>
              <Link
                to="/financials"
                className="flex items-center gap-1 text-[11px] font-medium hover:underline"
                style={{ color: cine.accent }}
              >
                View AR Report <HugeiconsIcon icon={ArrowRight01Icon} size={11} />
              </Link>
            </div>

            {arQuery.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="h-4 animate-pulse rounded-full bg-[var(--theme-hover)]" />
                ))}
              </div>
            ) : ar ? (
              <>
                <div className="mb-3 flex items-baseline gap-2">
                  <span
                    className="text-[22px] font-bold tabular-nums"
                    style={{
                      backgroundImage: cine.gradient,
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent',
                    }}
                  >
                    {fmtMoneyShort(ar.total_outstanding_cents)}
                  </span>
                  <span className="text-[11px] text-[var(--theme-muted)]">total outstanding</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Current', cents: ar.buckets.current.total_cents, color: '#22c55e' },
                    { label: '1–30d', cents: ar.buckets.days_1_30.total_cents, color: '#f59e0b' },
                    { label: '31–60d', cents: ar.buckets.days_31_60.total_cents, color: '#f97316' },
                    { label: '61–90d', cents: ar.buckets.days_61_90.total_cents, color: '#ef4444' },
                    { label: '90+d', cents: ar.buckets.days_90_plus.total_cents, color: '#b91c1c' },
                  ].map(b => (
                    <AgingBar key={b.label} label={b.label} cents={b.cents} total={ar.total_outstanding_cents} color={b.color} />
                  ))}
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-[12px] text-[var(--theme-muted)]">No AR data</p>
            )}
          </div>

          {/* AP / Bills */}
          <div
            className="fin-panel relative overflow-hidden rounded-2xl border p-5"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', ['--fin-glow' as string]: cine.glow }}
          >
            <span className="fin-rail absolute inset-x-0 top-0 h-[3px]" style={{ background: cine.gradient, opacity: 0.55 }} />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[var(--theme-text)]">AP &amp; Bills</h3>
              <Link
                to="/bills"
                className="flex items-center gap-1 text-[11px] font-medium hover:underline"
                style={{ color: cine.accent }}
              >
                View Bills <HugeiconsIcon icon={ArrowRight01Icon} size={11} />
              </Link>
            </div>

            {apQuery.isLoading || payrollQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-5 animate-pulse rounded-full bg-[var(--theme-hover)]" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  {
                    label: 'Total Open Bills',
                    value: fmtMoneyShort(ap?.total_open_cents ?? 0),
                    color: 'text-[var(--theme-text)]',
                  },
                  {
                    label: 'Overdue',
                    value: fmtMoneyShort(ap?.total_overdue_cents ?? 0),
                    color: 'text-red-500 dark:text-red-400',
                  },
                  {
                    label: 'Due This Week',
                    value: `${ap?.bills_due_this_week ?? 0} bill${(ap?.bills_due_this_week ?? 0) !== 1 ? 's' : ''}`,
                    color: 'text-amber-600 dark:text-amber-400',
                  },
                  {
                    label: 'Paid This Month',
                    value: fmtMoneyShort(ap?.total_paid_this_month_cents ?? 0),
                    color: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    label: 'Monthly Payroll',
                    value: fmtMoneyShort(payroll?.monthly_payroll_cents ?? 0),
                    color: 'text-[var(--theme-text)]',
                  },
                  {
                    label: 'Employees',
                    value: `${payroll?.total_employees ?? 0}`,
                    color: 'text-[var(--theme-muted)]',
                  },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: 'var(--theme-border)' }}>
                    <span className="text-[12px] text-[var(--theme-muted)]">{row.label}</span>
                    <span className={cn('text-[13px] font-semibold', row.color)}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Quick Actions ───────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
            Quick Actions
          </h2>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            <QuickAction cine={cine} icon={Add01Icon} label="New Invoice" to="/payments" />
            <QuickAction cine={cine} icon={Invoice01Icon} label="Record Bill" to="/bills" />
            <QuickAction cine={cine} icon={BankIcon} label="Add Transaction" to="/banking" />
            <QuickAction cine={cine} icon={MoneyBag01Icon} label="Run Payroll" to="/payroll" />
            <QuickAction cine={cine} icon={Analytics03Icon} label="View P&L" to="/financials" />
            <QuickAction cine={cine} icon={ReceiptDollarIcon} label="Reconcile Bank" to="/banking" />
          </div>
        </div>

        {/* ── Row 5: Recent Journal Entries ─────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
              Recent Journal Entries
            </h2>
            <Link
              to="/accounts"
              className="flex items-center gap-1 text-[11px] font-medium hover:underline"
              style={{ color: cine.accent }}
            >
              View All <HugeiconsIcon icon={ArrowRight01Icon} size={11} />
            </Link>
          </div>

          <div
            className="fin-panel relative rounded-2xl border overflow-hidden"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', ['--fin-glow' as string]: cine.glow }}
          >
            <span className="fin-rail absolute inset-x-0 top-0 z-10 h-[3px]" style={{ background: cine.gradient, opacity: 0.55 }} />
            {journalQuery.isLoading ? (
              <div className="p-4 space-y-3">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="h-4 animate-pulse rounded-full bg-[var(--theme-hover)]" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center">
                <div
                  className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: cine.gradient, boxShadow: `0 4px 12px ${cine.glow}45` }}
                >
                  <HugeiconsIcon icon={Calculator01Icon} size={18} />
                </div>
                <p className="text-[12px] text-[var(--theme-muted)]">No journal entries yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--theme-hover)' }}>
                      {['Date', 'Description', 'Source', 'Amount'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => {
                      const maxCents = entry.lines
                        ? Math.max(...entry.lines.map(l => Math.max(l.debit_cents ?? 0, l.credit_cents ?? 0)))
                        : 0
                      return (
                        <tr
                          key={entry.id}
                          style={{ borderTop: i > 0 ? '1px solid var(--theme-border)' : undefined }}
                          className="hover:bg-[var(--theme-hover)] transition-colors"
                        >
                          <td className="px-4 py-2.5 text-[12px] text-[var(--theme-muted)] whitespace-nowrap">
                            {fmtDate(entry.date)}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-[var(--theme-text)] max-w-[200px] truncate">
                            {entry.description}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                              style={{
                                background: `color-mix(in srgb, ${cine.accent} 14%, var(--theme-card))`,
                                color: cine.accent,
                                border: `1px solid color-mix(in srgb, ${cine.accent} 22%, transparent)`,
                              }}
                            >
                              {entry.source?.replace(/_/g, ' ') ?? 'manual'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-[var(--theme-text)]">
                            {maxCents > 0 ? fmtMoneyShort(maxCents) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
