import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  PencilEdit02Icon,
  UserGroupIcon,
  Cancel01Icon,
  MoneyBag01Icon,
  Money01Icon,
  Calendar01Icon,
  Tick02Icon,
  ChartBarLineIcon,
} from '@hugeicons/core-free-icons'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type PaySchedule = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
type EmployeeType = 'full_time' | 'part_time' | 'contractor' | '1099'

interface Deduction {
  id: string
  name: string
  type: 'tax' | 'benefit' | 'garnishment' | 'other'
  calculation: 'fixed' | 'percent'
  amount: number
  is_employee_contribution: boolean
  is_employer_contribution: boolean
}

interface EmployeeRecord {
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

interface PayRunLine {
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

interface PayRunRecord {
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

interface PayrollSummary {
  total_employees: number
  monthly_payroll_cents: number
  ytd_payroll_cents: number
  next_pay_date: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const EMP_TYPE_LABELS: Record<EmployeeType, string> = {
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  contractor: 'Contractor',
  '1099': '1099',
}

const SCHEDULE_LABELS: Record<PaySchedule, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-Weekly',
  semimonthly: 'Semi-Monthly',
  monthly: 'Monthly',
}

// ── Shared design tokens ──────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const RUN_STATUS_COLORS: Record<PayRunRecord['status'], string> = {
  draft: '#94a3b8',
  approved: '#3b82f6',
  paid: '#10b981',
}

function StatusBadge({ status }: { status: PayRunRecord['status'] }) {
  const c = RUN_STATUS_COLORS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{
        background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`,
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {status}
    </span>
  )
}

const EMP_TYPE_COLORS: Record<EmployeeType, string> = {
  full_time: '#3b82f6',
  part_time: '#8b5cf6',
  contractor: '#f59e0b',
  '1099': '#6b7280',
}

function EmpTypeBadge({ type }: { type: EmployeeType }) {
  const c = EMP_TYPE_COLORS[type]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`,
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {EMP_TYPE_LABELS[type]}
    </span>
  )
}

// Gradient-accented stat card (mission-control vocabulary)
interface StatCardProps {
  label: string
  value: string
  sub?: string
  color: string
  icon: typeof Money01Icon
}

function StatCard({ label, value, sub, color, icon }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-1 hover:shadow-md"
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
      />
      <div className="pl-1.5">
        <span
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// Avatar initials circle in accent gradient
function Avatar({ first, last }: { first: string; last: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
    >
      {(first[0] ?? '').toUpperCase()}{(last[0] ?? '').toUpperCase()}
    </span>
  )
}

// Modal header with gradient icon chip
function ModalHeader({ icon, title, subtitle, onClose, badge }: {
  icon: typeof Money01Icon
  title: string
  subtitle?: string
  onClose: () => void
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={icon} size={16} className="text-white" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="text-[11px] text-[var(--theme-muted)]">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]">
        <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-[var(--theme-muted)]" />
      </button>
    </div>
  )
}

// Numbered step label for the Run Payroll modal
function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: ACCENT_GRADIENT }}
      >
        {n}
      </span>
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</span>
    </div>
  )
}

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'
const labelCls = 'block text-[11px] font-medium text-[var(--theme-muted)] mb-1'

// ── Default deductions ────────────────────────────────────────────────────────

const DEFAULT_DEDUCTIONS: Omit<Deduction, 'id'>[] = [
  { name: 'Federal Income Tax', type: 'tax', calculation: 'percent', amount: 22, is_employee_contribution: true, is_employer_contribution: false },
  { name: 'State Income Tax', type: 'tax', calculation: 'percent', amount: 5, is_employee_contribution: true, is_employer_contribution: false },
  { name: 'Social Security', type: 'tax', calculation: 'percent', amount: 6.2, is_employee_contribution: true, is_employer_contribution: true },
  { name: 'Medicare', type: 'tax', calculation: 'percent', amount: 1.45, is_employee_contribution: true, is_employer_contribution: true },
]

// ── Deduction editor ──────────────────────────────────────────────────────────

interface DeductionEditorProps {
  deductions: Deduction[]
  onChange: (deductions: Deduction[]) => void
}

function DeductionEditor({ deductions, onChange }: DeductionEditorProps) {
  const [showPresets, setShowPresets] = useState(false)

  const add = (preset?: Omit<Deduction, 'id'>) => {
    const base: Deduction = preset
      ? { id: Math.random().toString(36).slice(2), ...preset }
      : { id: Math.random().toString(36).slice(2), name: '', type: 'other', calculation: 'fixed', amount: 0, is_employee_contribution: true, is_employer_contribution: false }
    onChange([...deductions, base])
    setShowPresets(false)
  }

  const update = (idx: number, key: keyof Deduction, val: unknown) => {
    onChange(deductions.map((d, i) => i === idx ? { ...d, [key]: val } : d))
  }

  const remove = (idx: number) => {
    onChange(deductions.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Deductions</span>
        <div className="flex gap-1 relative">
          <button type="button" onClick={() => setShowPresets(p => !p)}
            className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]">
            Add Preset ▾
          </button>
          {showPresets && (
            <div className="absolute right-0 top-full z-10 w-52 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-1 shadow-xl">
              {DEFAULT_DEDUCTIONS.map((p, i) => (
                <button key={i} type="button" onClick={() => add(p)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] hover:bg-[var(--theme-hover)]">
                  <span className="text-[var(--theme-text)]">{p.name}</span>
                  <span className="text-[var(--theme-muted)]">{p.amount}%</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => add()}
            className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]">
            <HugeiconsIcon icon={Add01Icon} size={10} /> Custom
          </button>
        </div>
      </div>
      {deductions.map((d, idx) => (
        <div key={d.id} className="mb-2 rounded-xl border border-[var(--theme-border)] p-2.5"
          style={{ background: 'color-mix(in srgb, var(--theme-hover) 60%, var(--theme-card))' }}>
          <div className="grid grid-cols-2 gap-2 mb-1.5">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={d.name} onChange={e => update(idx, 'name', e.target.value)} placeholder="e.g. Health Insurance" />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={d.type} onChange={e => update(idx, 'type', e.target.value)}>
                <option value="tax">Tax</option>
                <option value="benefit">Benefit</option>
                <option value="garnishment">Garnishment</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Calculation</label>
              <select className={inputCls} value={d.calculation} onChange={e => update(idx, 'calculation', e.target.value)}>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input className={inputCls} type="number" min="0" step="any" value={d.amount}
                onChange={e => update(idx, 'amount', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1 pt-4">
              <label className="flex items-center gap-1 text-[10px] text-[var(--theme-muted)] cursor-pointer">
                <input type="checkbox" checked={d.is_employee_contribution}
                  onChange={e => update(idx, 'is_employee_contribution', e.target.checked)} />
                Employee
              </label>
              <label className="flex items-center gap-1 text-[10px] text-[var(--theme-muted)] cursor-pointer">
                <input type="checkbox" checked={d.is_employer_contribution}
                  onChange={e => update(idx, 'is_employer_contribution', e.target.checked)} />
                Employer
              </label>
            </div>
          </div>
          <button type="button" onClick={() => remove(idx)}
            className="mt-1.5 text-[10px] text-red-500 hover:underline">Remove</button>
        </div>
      ))}
    </div>
  )
}

// ── Employee Modal ─────────────────────────────────────────────────────────────

interface EmployeeModalProps {
  employee?: EmployeeRecord | null
  onClose: () => void
  onSave: (data: Partial<EmployeeRecord>) => void
}

function EmployeeModal({ employee, onClose, onSave }: EmployeeModalProps) {
  const [form, setForm] = useState({
    first_name: employee?.first_name ?? '',
    last_name: employee?.last_name ?? '',
    email: employee?.email ?? '',
    phone: employee?.phone ?? '',
    employee_type: (employee?.employee_type ?? 'full_time') as EmployeeType,
    job_title: employee?.job_title ?? '',
    department: employee?.department ?? '',
    pay_schedule: (employee?.pay_schedule ?? 'biweekly') as PaySchedule,
    pay_type: (employee?.pay_type ?? 'salary') as 'salary' | 'hourly',
    pay_rate: employee ? String(employee.pay_rate_cents / 100) : '',
    start_date: employee?.start_date ?? todayStr(),
    bank_account_last4: employee?.bank_account_last4 ?? '',
    notes: employee?.notes ?? '',
  })
  const [deductions, setDeductions] = useState<Deduction[]>(employee?.deductions ?? [])

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = () => {
    if (!form.first_name || !form.last_name || !form.pay_rate) {
      toast('First name, last name, and pay rate are required', { type: 'error' })
      return
    }
    onSave({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      employee_type: form.employee_type,
      job_title: form.job_title || undefined,
      department: form.department || undefined,
      pay_schedule: form.pay_schedule,
      pay_type: form.pay_type,
      pay_rate_cents: Math.round(parseFloat(form.pay_rate) * 100),
      start_date: form.start_date,
      bank_account_last4: form.bank_account_last4 || undefined,
      notes: form.notes || undefined,
      deductions,
      is_active: true,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] flex flex-col max-h-[90vh] shadow-2xl">
        <ModalHeader
          icon={UserGroupIcon}
          title={employee ? 'Edit Employee' : 'New Employee'}
          subtitle={employee ? `${employee.first_name} ${employee.last_name}` : 'Add a team member to payroll'}
          onClose={onClose}
        />
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name *</label>
              <input className={inputCls} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Jane" />
            </div>
            <div>
              <label className={labelCls}>Last Name *</label>
              <input className={inputCls} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@company.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className={labelCls}>Employee Type</label>
              <select className={inputCls} value={form.employee_type} onChange={e => set('employee_type', e.target.value)}>
                <option value="full_time">Full-Time</option>
                <option value="part_time">Part-Time</option>
                <option value="contractor">Contractor</option>
                <option value="1099">1099</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Job Title</label>
              <input className={inputCls} value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder="Software Engineer" />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <input className={inputCls} value={form.department} onChange={e => set('department', e.target.value)} placeholder="Engineering" />
            </div>
            <div>
              <label className={labelCls}>Start Date</label>
              <input className={inputCls} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Pay Schedule</label>
              <select className={inputCls} value={form.pay_schedule} onChange={e => set('pay_schedule', e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="semimonthly">Semi-Monthly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Pay Type</label>
              <select className={inputCls} value={form.pay_type} onChange={e => set('pay_type', e.target.value)}>
                <option value="salary">Salary</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Pay Rate ({form.pay_type === 'salary' ? 'annual salary $' : 'hourly rate $'})
              </label>
              <input className={inputCls} type="number" min="0" step="any" value={form.pay_rate}
                onChange={e => set('pay_rate', e.target.value)}
                placeholder={form.pay_type === 'salary' ? '60000' : '25'} />
            </div>
            <div>
              <label className={labelCls}>Bank Account Last 4</label>
              <input className={inputCls} value={form.bank_account_last4} onChange={e => set('bank_account_last4', e.target.value)} placeholder="1234" maxLength={4} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes..." />
          </div>
          <DeductionEditor deductions={deductions} onChange={setDeductions} />
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">Cancel</button>
          <button type="button" onClick={handleSave} className={primaryBtnCls} style={primaryBtnStyle}>
            {employee ? 'Save Changes' : 'Create Employee'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Run Payroll Modal ─────────────────────────────────────────────────────────

interface RunPayrollModalProps {
  employees: EmployeeRecord[]
  onClose: () => void
  onSaved: () => void
  brand: string
}

function RunPayrollModal({ employees, onClose, onSaved, brand }: RunPayrollModalProps) {
  const today = todayStr()
  const [periodStart, setPeriodStart] = useState(today)
  const [periodEnd, setPeriodEnd] = useState(today)
  const [payDate, setPayDate] = useState(today)
  const [selected, setSelected] = useState<Set<string>>(new Set(employees.map(e => e.id)))
  const [preview, setPreview] = useState<PayRunRecord | null>(null)
  const [calculating, setCalculating] = useState(false)

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setPreview(null)
  }

  const calculate = async () => {
    if (!periodStart || !periodEnd || !payDate) {
      toast('All date fields required', { type: 'error' })
      return
    }
    setCalculating(true)
    try {
      const res = await fetch('/api/payroll/runs/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-brand': brand },
        body: JSON.stringify({
          pay_period_start: periodStart,
          pay_period_end: periodEnd,
          pay_date: payDate,
          employee_ids: [...selected],
        }),
      })
      if (!res.ok) throw new Error('Calculate failed')
      const run = await res.json() as PayRunRecord
      setPreview(run)
    } catch {
      toast('Failed to calculate pay run', { type: 'error' })
    } finally {
      setCalculating(false)
    }
  }

  const saveDraft = () => {
    if (!preview) return
    toast(`Pay run ${preview.run_number} saved as draft`)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] flex flex-col max-h-[90vh] shadow-2xl">
        <ModalHeader
          icon={MoneyBag01Icon}
          title="Run Payroll"
          subtitle="Set the pay period, pick employees, then preview"
          onClose={onClose}
        />
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <StepLabel n={1} label="Pay Period" />
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-[var(--theme-border)] p-3"
              style={{ background: 'color-mix(in srgb, var(--theme-hover) 50%, var(--theme-card))' }}>
              <div>
                <label className={labelCls}>Period Start</label>
                <input className={inputCls} type="date" value={periodStart} onChange={e => { setPeriodStart(e.target.value); setPreview(null) }} />
              </div>
              <div>
                <label className={labelCls}>Period End</label>
                <input className={inputCls} type="date" value={periodEnd} onChange={e => { setPeriodEnd(e.target.value); setPreview(null) }} />
              </div>
              <div>
                <label className={labelCls}>Pay Date</label>
                <input className={inputCls} type="date" value={payDate} onChange={e => { setPayDate(e.target.value); setPreview(null) }} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <StepLabel n={2} label={`Employees · ${selected.size} selected`} />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setSelected(new Set(employees.map(e => e.id))); setPreview(null) }}
                  className="text-[10px] font-medium text-[var(--theme-accent)] hover:underline">All</button>
                <button type="button" onClick={() => { setSelected(new Set()); setPreview(null) }}
                  className="text-[10px] font-medium text-[var(--theme-muted)] hover:underline">None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto rounded-xl border border-[var(--theme-border)] p-2">
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 cursor-pointer rounded-lg px-1.5 py-1 transition-colors hover:bg-[var(--theme-hover)]">
                  <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggle(emp.id)} />
                  <span className="text-[11px] text-[var(--theme-text)]">{emp.first_name} {emp.last_name}</span>
                  <span className="text-[10px] text-[var(--theme-muted)]">{EMP_TYPE_LABELS[emp.employee_type]}</span>
                </label>
              ))}
              {employees.length === 0 && (
                <p className="col-span-2 text-center text-[11px] text-[var(--theme-muted)] py-2">No active employees</p>
              )}
            </div>
          </div>

          {!preview && (
            <button onClick={calculate} disabled={calculating || selected.size === 0}
              className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              style={primaryBtnStyle}>
              {calculating ? 'Calculating…' : 'Calculate Preview'}
            </button>
          )}

          {preview && (
            <div>
              <div className="flex items-center justify-between">
                <StepLabel n={3} label={`Preview — ${preview.run_number}`} />
                <button onClick={() => setPreview(null)} className="text-[10px] font-medium text-[var(--theme-muted)] hover:underline">Recalculate</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--theme-border)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-hover)]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Employee</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Gross</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Deductions</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map(line => (
                      <tr key={line.employee_id} className="border-b border-[var(--theme-border)] transition-colors hover:bg-[var(--theme-hover)]">
                        <td className="px-3 py-2 font-medium text-[var(--theme-text)]">{line.employee_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--theme-text)]">{fmtMoney(line.gross_pay_cents)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-500">-{fmtMoney(line.total_employee_deductions_cents)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: '#10b981' }}>{fmtMoney(line.net_pay_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[var(--theme-hover)]">
                      <td className="px-3 py-2 font-semibold text-[var(--theme-text)]">Total</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-[var(--theme-text)]">{fmtMoney(preview.total_gross_cents)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-red-500">-{fmtMoney(preview.total_deductions_cents)}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: '#10b981' }}>{fmtMoney(preview.total_net_cents)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">Cancel</button>
          {preview && (
            <button onClick={saveDraft} className={primaryBtnCls} style={primaryBtnStyle}>
              Save as Draft
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pay Run Detail Modal ───────────────────────────────────────────────────────

interface PayRunDetailProps {
  run: PayRunRecord
  onClose: () => void
}

function PayRunDetail({ run, onClose }: PayRunDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="w-full max-w-3xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] flex flex-col max-h-[90vh] shadow-2xl">
        <ModalHeader
          icon={MoneyBag01Icon}
          title={run.run_number}
          subtitle={`${fmtDate(run.pay_period_start)} – ${fmtDate(run.pay_period_end)}`}
          badge={<StatusBadge status={run.status} />}
          onClose={onClose}
        />
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {([
              ['Period', `${fmtDate(run.pay_period_start)} – ${fmtDate(run.pay_period_end)}`],
              ['Pay Date', fmtDate(run.pay_date)],
              ['Employees', String(run.lines.length)],
              ['Total Gross', fmtMoney(run.total_gross_cents)],
              ['Total Deductions', fmtMoney(run.total_deductions_cents)],
              ['Total Net', fmtMoney(run.total_net_cents)],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[var(--theme-border)] p-3"
                style={{ background: 'color-mix(in srgb, var(--theme-hover) 40%, var(--theme-card))' }}>
                <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</div>
                <div className="mt-0.5 text-[14px] font-bold tabular-nums text-[var(--theme-text)]">{value}</div>
              </div>
            ))}
          </div>
          {run.lines.map(line => (
            <div key={line.employee_id} className="rounded-xl border border-[var(--theme-border)] p-3 transition-colors hover:border-[var(--theme-accent)]">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-semibold text-[var(--theme-text)]">{line.employee_name}</span>
                  <span className="ml-2 text-[10px] capitalize text-[var(--theme-muted)]">
                    {line.pay_type}{line.hours_worked !== undefined ? ` · ${line.hours_worked}h` : ''}
                  </span>
                </div>
                <div className="flex gap-4 text-[11px] tabular-nums">
                  <span className="text-[var(--theme-muted)]">Gross: <strong className="text-[var(--theme-text)]">{fmtMoney(line.gross_pay_cents)}</strong></span>
                  <span className="text-[var(--theme-muted)]">Net: <strong style={{ color: '#10b981' }}>{fmtMoney(line.net_pay_cents)}</strong></span>
                </div>
              </div>
              {line.deductions.length > 0 && (
                <div className="space-y-1 border-t border-[var(--theme-border)] pt-2">
                  {line.deductions.map(d => (
                    <div key={d.deduction_id} className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--theme-muted)]">{d.name}</span>
                      <div className="flex gap-3 tabular-nums">
                        {d.employee_amount_cents > 0 && (
                          <span className="text-red-400">Emp: -{fmtMoney(d.employee_amount_cents)}</span>
                        )}
                        {d.employer_amount_cents > 0 && (
                          <span className="text-blue-400">Emp+: {fmtMoney(d.employer_amount_cents)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Pay Runs Tab ──────────────────────────────────────────────────────────────

function PayRunsTab() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [showRunModal, setShowRunModal] = useState(false)
  const [detailRun, setDetailRun] = useState<PayRunRecord | null>(null)

  const { data: summary } = useQuery<PayrollSummary>({
    queryKey: ['payroll', 'summary', brand.id],
    queryFn: () => fetch('/api/payroll/summary', { headers: { 'x-brand': brand.id } }).then(r => r.json()),
  })

  const { data: runs = [] } = useQuery<PayRunRecord[]>({
    queryKey: ['payroll', 'runs', brand.id],
    queryFn: () => fetch('/api/payroll/runs', { headers: { 'x-brand': brand.id } }).then(r => r.json()),
  })

  const { data: employees = [] } = useQuery<EmployeeRecord[]>({
    queryKey: ['payroll', 'employees', brand.id, 'active'],
    queryFn: () => fetch('/api/payroll/employees?active_only=true', { headers: { 'x-brand': brand.id } }).then(r => r.json()),
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/payroll/runs/${id}/approve`, { method: 'POST', headers: { 'x-brand': brand.id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['payroll'] }); toast('Pay run approved') },
    onError: () => toast('Failed to approve', { type: 'error' }),
  })

  const payMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/payroll/runs/${id}/pay`, { method: 'POST', headers: { 'x-brand': brand.id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['payroll'] }); toast('Pay run marked as paid') },
    onError: () => toast('Failed to mark paid', { type: 'error' }),
  })

  const summaryCards = [
    { label: 'Active Employees', value: String(summary?.total_employees ?? 0), icon: UserGroupIcon, color: '#0ea5e9', sub: 'on payroll' },
    { label: 'Monthly Payroll', value: fmtMoney(summary?.monthly_payroll_cents ?? 0), icon: Money01Icon, color: '#10b981', sub: 'estimated monthly cost' },
    { label: 'YTD Payroll', value: fmtMoney(summary?.ytd_payroll_cents ?? 0), icon: MoneyBag01Icon, color: '#8b5cf6', sub: 'gross paid this year' },
    { label: 'Next Pay Date', value: summary?.next_pay_date ? fmtDate(summary.next_pay_date) : '—', icon: Calendar01Icon, color: '#f97316', sub: 'upcoming run' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {summaryCards.map(c => (
          <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} icon={c.icon} color={c.color} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-75">Pay Runs</h3>
        <button onClick={() => setShowRunModal(true)} className={primaryBtnCls} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={13} /> Run Payroll
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--theme-border)]" style={{ background: 'var(--theme-hover)' }}>
              {['Run #', 'Period', 'Pay Date', 'Employees', 'Gross', 'Deductions', 'Net', 'Status', ''].map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map(run => (
              <tr key={run.id} className="group border-b border-[var(--theme-border)] transition-colors last:border-0 hover:bg-[var(--theme-hover)]">
                <td className="px-3 py-3 font-semibold text-[var(--theme-text)]">{run.run_number}</td>
                <td className="px-3 py-3 text-[var(--theme-muted)]">{fmtDate(run.pay_period_start)} – {fmtDate(run.pay_period_end)}</td>
                <td className="px-3 py-3 text-[var(--theme-text)]">{fmtDate(run.pay_date)}</td>
                <td className="px-3 py-3 text-center tabular-nums text-[var(--theme-text)]">{run.lines.length}</td>
                <td className="px-3 py-3 tabular-nums text-[var(--theme-text)]">{fmtMoney(run.total_gross_cents)}</td>
                <td className="px-3 py-3 tabular-nums text-red-500">-{fmtMoney(run.total_deductions_cents)}</td>
                <td className="px-3 py-3 font-semibold tabular-nums text-[var(--theme-text)]">{fmtMoney(run.total_net_cents)}</td>
                <td className="px-3 py-3"><StatusBadge status={run.status} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => setDetailRun(run)}
                      className="rounded-lg px-2 py-1 text-[10px] font-semibold text-[var(--theme-accent)] transition-colors hover:bg-[var(--theme-accent-soft)]">
                      View
                    </button>
                    {run.status === 'draft' && (
                      <button onClick={() => approveMut.mutate(run.id)}
                        className="rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors"
                        style={{ color: '#3b82f6' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #3b82f6 12%, var(--theme-card))' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        Approve
                      </button>
                    )}
                    {run.status === 'approved' && (
                      <button onClick={() => payMut.mutate(run.id)}
                        className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors"
                        style={{ color: '#10b981' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #10b981 12%, var(--theme-card))' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <HugeiconsIcon icon={Tick02Icon} size={10} /> Mark Paid
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                        color: 'var(--theme-accent)',
                      }}
                    >
                      <HugeiconsIcon icon={MoneyBag01Icon} size={22} />
                    </span>
                    <p className="text-[13px] font-semibold text-[var(--theme-text)]">No pay runs yet</p>
                    <p className="text-[11px] text-[var(--theme-muted)]">Run your first payroll to pay your team.</p>
                    <button onClick={() => setShowRunModal(true)} className={cn(primaryBtnCls, 'mt-2')} style={primaryBtnStyle}>
                      <HugeiconsIcon icon={Add01Icon} size={13} /> Run Payroll
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showRunModal && (
        <RunPayrollModal
          employees={employees}
          brand={brand.id}
          onClose={() => setShowRunModal(false)}
          onSaved={() => { setShowRunModal(false); void qc.invalidateQueries({ queryKey: ['payroll'] }) }}
        />
      )}

      {detailRun && <PayRunDetail run={detailRun} onClose={() => setDetailRun(null)} />}
    </div>
  )
}

// ── Employees Tab ─────────────────────────────────────────────────────────────

function EmployeesTab() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EmployeeRecord | null>(null)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')

  const { data: employees = [] } = useQuery<EmployeeRecord[]>({
    queryKey: ['payroll', 'employees', brand.id],
    queryFn: () => fetch('/api/payroll/employees', { headers: { 'x-brand': brand.id } }).then(r => r.json()),
  })

  const createMut = useMutation({
    mutationFn: (data: Partial<EmployeeRecord>) =>
      fetch('/api/payroll/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-brand': brand.id },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['payroll'] }); toast('Employee created'); setShowModal(false) },
    onError: () => toast('Failed to create employee', { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EmployeeRecord> }) =>
      fetch(`/api/payroll/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-brand': brand.id },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['payroll'] }); toast('Employee updated'); setEditing(null) },
    onError: () => toast('Failed to update employee', { type: 'error' }),
  })

  const terminateMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/payroll/employees/${id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-brand': brand.id },
        body: JSON.stringify({ end_date: todayStr() }),
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['payroll'] }); toast('Employee terminated') },
    onError: () => toast('Failed to terminate employee', { type: 'error' }),
  })

  const filtered = employees.filter(e => {
    if (filterActive === 'active') return e.is_active
    if (filterActive === 'inactive') return !e.is_active
    return true
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
          {(['all', 'active', 'inactive'] as const).map(v => (
            <button key={v} onClick={() => setFilterActive(v)}
              className={cn('rounded-lg px-3 py-1 text-[11px] font-semibold capitalize transition-all',
                filterActive === v ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
              style={filterActive === v ? {
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
              } : undefined}>
              {v}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true) }} className={primaryBtnCls} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={13} /> New Employee
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--theme-border)]" style={{ background: 'var(--theme-hover)' }}>
              {['Name', 'Type', 'Title / Dept', 'Pay', 'Schedule', 'YTD Gross', 'Status', ''].map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => {
              const annualCents = emp.pay_type === 'hourly' ? emp.pay_rate_cents * 2080 : emp.pay_rate_cents
              const ytdPct = annualCents > 0 ? Math.min(100, Math.round((emp.ytd_gross_cents / annualCents) * 100)) : 0
              return (
                <tr key={emp.id} className="group border-b border-[var(--theme-border)] transition-colors last:border-0 hover:bg-[var(--theme-hover)]">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar first={emp.first_name} last={emp.last_name} />
                      <div>
                        <div className="font-semibold text-[var(--theme-text)]">{emp.first_name} {emp.last_name}</div>
                        {emp.email && <div className="text-[10px] text-[var(--theme-muted)]">{emp.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><EmpTypeBadge type={emp.employee_type} /></td>
                  <td className="px-3 py-3 text-[var(--theme-muted)]">
                    {emp.job_title && <div className="text-[var(--theme-text)]">{emp.job_title}</div>}
                    {emp.department && <div className="text-[10px]">{emp.department}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-[13px] font-bold tabular-nums text-[var(--theme-text)]">
                      {fmtMoney(emp.pay_rate_cents)}
                      <span className="text-[10px] font-medium text-[var(--theme-muted)]">{emp.pay_type === 'hourly' ? '/hr' : '/yr'}</span>
                    </div>
                    <div className="text-[10px] capitalize text-[var(--theme-muted)]">{emp.pay_type}</div>
                  </td>
                  <td className="px-3 py-3 text-[var(--theme-muted)]">{SCHEDULE_LABELS[emp.pay_schedule]}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold tabular-nums text-[var(--theme-text)]">{fmtMoney(emp.ytd_gross_cents)}</div>
                    <div className="mt-1 h-1 w-16 overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${ytdPct}%`, background: 'linear-gradient(90deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))' }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: emp.is_active ? 'color-mix(in srgb, #10b981 12%, var(--theme-card))' : 'var(--theme-hover)',
                        color: emp.is_active ? '#10b981' : 'var(--theme-muted)',
                        border: `1px solid ${emp.is_active ? 'color-mix(in srgb, #10b981 30%, transparent)' : 'var(--theme-border)'}`,
                      }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: emp.is_active ? '#10b981' : 'var(--theme-muted)' }} />
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => { setEditing(emp); setShowModal(true) }}
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-accent-soft)]" title="Edit">
                        <HugeiconsIcon icon={PencilEdit02Icon} size={13} className="text-[var(--theme-accent)]" />
                      </button>
                      {emp.is_active && (
                        <button onClick={() => { if (confirm('Terminate this employee?')) terminateMut.mutate(emp.id) }}
                          className="rounded-lg p-1.5 transition-colors" title="Terminate"
                          onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                          <HugeiconsIcon icon={Delete01Icon} size={13} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                        color: 'var(--theme-accent)',
                      }}
                    >
                      <HugeiconsIcon icon={UserGroupIcon} size={22} />
                    </span>
                    <p className="text-[13px] font-semibold text-[var(--theme-text)]">No employees found</p>
                    <p className="text-[11px] text-[var(--theme-muted)]">Add your first team member to get started.</p>
                    <button onClick={() => { setEditing(null); setShowModal(true) }} className={cn(primaryBtnCls, 'mt-2')} style={primaryBtnStyle}>
                      <HugeiconsIcon icon={Add01Icon} size={13} /> New Employee
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <EmployeeModal
          employee={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={data => {
            if (editing) {
              updateMut.mutate({ id: editing.id, data })
            } else {
              createMut.mutate(data)
            }
          }}
        />
      )}
    </div>
  )
}

// ── Summary Tab ───────────────────────────────────────────────────────────────

function SummaryTab() {
  const brand = useBrand()

  const { data: employees = [] } = useQuery<EmployeeRecord[]>({
    queryKey: ['payroll', 'employees', brand.id],
    queryFn: () => fetch('/api/payroll/employees', { headers: { 'x-brand': brand.id } }).then(r => r.json()),
  })

  const { data: runs = [] } = useQuery<PayRunRecord[]>({
    queryKey: ['payroll', 'runs', brand.id],
    queryFn: () => fetch('/api/payroll/runs', { headers: { 'x-brand': brand.id } }).then(r => r.json()),
  })

  const typeBreakdown = (['full_time', 'part_time', 'contractor', '1099'] as EmployeeType[]).map(type => {
    const emps = employees.filter(e => e.employee_type === type && e.is_active)
    const cost = emps.reduce((s, e) => s + Math.round(e.pay_rate_cents / 12), 0)
    return { type, count: emps.length, cost }
  }).filter(r => r.count > 0)

  const monthlyData: Record<string, number> = {}
  for (const run of runs.filter(r => r.status === 'paid')) {
    const month = run.pay_date.slice(0, 7)
    monthlyData[month] = (monthlyData[month] ?? 0) + run.total_gross_cents
  }
  const monthEntries = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  const maxBar = Math.max(...monthEntries.map(([, v]) => v), 1)

  const deptMap: Record<string, { count: number; cost: number }> = {}
  for (const e of employees.filter(emp => emp.is_active && emp.department)) {
    const dept = e.department!
    if (!deptMap[dept]) deptMap[dept] = { count: 0, cost: 0 }
    deptMap[dept].count++
    deptMap[dept].cost += Math.round(e.pay_rate_cents / 12)
  }
  const maxDeptCost = Math.max(...Object.values(deptMap).map(d => d.cost), 1)
  const maxTypeCost = Math.max(...typeBreakdown.map(r => r.cost), 1)

  const dedMap: Record<string, number> = {}
  for (const e of employees) {
    for (const d of e.deductions) {
      dedMap[d.type] = (dedMap[d.type] ?? 0) + 1
    }
  }
  const maxDedCount = Math.max(...Object.values(dedMap), 1)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={ChartBarLineIcon} size={15} className="text-white" />
          </span>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">YTD Payroll by Month — Paid Runs</h3>
        </div>
        {monthEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                color: 'var(--theme-accent)',
              }}
            >
              <HugeiconsIcon icon={ChartBarLineIcon} size={22} />
            </span>
            <p className="text-[13px] font-semibold text-[var(--theme-text)]">No paid pay runs yet</p>
            <p className="text-[11px] text-[var(--theme-muted)]">Monthly totals appear here once runs are paid.</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-36">
            {monthEntries.map(([month, val]) => (
              <div key={month} className="group flex flex-1 flex-col items-center gap-1">
                <div className="text-[9px] font-semibold tabular-nums text-[var(--theme-text)] opacity-70 transition-opacity group-hover:opacity-100">{fmtMoney(val)}</div>
                <div className="w-full rounded-t-md transition-all duration-500 group-hover:opacity-100" style={{
                  height: `${Math.round((val / maxBar) * 100)}px`,
                  background: 'linear-gradient(180deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 55%, #000))',
                  boxShadow: '0 2px 6px color-mix(in srgb, var(--theme-accent) 25%, transparent)',
                  opacity: 0.85,
                  minHeight: '4px',
                }} />
                <div className="text-[9px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">{month.slice(5)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">Employee Breakdown</h3>
          {typeBreakdown.length === 0 ? (
            <p className="text-[11px] text-[var(--theme-muted)]">No active employees</p>
          ) : (
            <div className="space-y-3">
              {typeBreakdown.map(r => (
                <div key={r.type}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <EmpTypeBadge type={r.type} />
                      <span className="text-[11px] text-[var(--theme-muted)]">{r.count} employee{r.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-[12px] font-bold tabular-nums text-[var(--theme-text)]">{fmtMoney(r.cost)}<span className="text-[10px] font-medium text-[var(--theme-muted)]">/mo</span></span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((r.cost / maxTypeCost) * 100)}%`,
                        background: `linear-gradient(90deg, ${EMP_TYPE_COLORS[r.type]}, color-mix(in srgb, ${EMP_TYPE_COLORS[r.type]} 65%, #000))`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">By Department</h3>
          {Object.keys(deptMap).length === 0 ? (
            <p className="text-[11px] text-[var(--theme-muted)]">No department data set on employees</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(deptMap).sort(([, a], [, b]) => b.cost - a.cost).map(([dept, info]) => (
                <div key={dept}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[var(--theme-text)]">{dept}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--theme-muted)]">{info.count} people</span>
                      <span className="text-[12px] font-bold tabular-nums text-[var(--theme-text)]">{fmtMoney(info.cost)}<span className="text-[10px] font-medium text-[var(--theme-muted)]">/mo</span></span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((info.cost / maxDeptCost) * 100)}%`,
                        background: 'linear-gradient(90deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">Deduction Categories</h3>
          {Object.keys(dedMap).length === 0 ? (
            <p className="text-[11px] text-[var(--theme-muted)]">No deductions configured</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(dedMap).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                <div key={type}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="capitalize text-[12px] font-medium text-[var(--theme-text)]">{type}</span>
                    <span className="text-[10px] text-[var(--theme-muted)]">{count} deduction{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((count / maxDedCount) * 100)}%`,
                        background: 'linear-gradient(90deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type Tab = 'runs' | 'employees' | 'summary'

export function PayrollScreen() {
  const [tab, setTab] = useState<Tab>('runs')

  const TABS: { id: Tab; label: string }[] = [
    { id: 'runs', label: 'Pay Runs' },
    { id: 'employees', label: 'Employees' },
    { id: 'summary', label: 'Summary' },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={MoneyBag01Icon} size={18} className="text-white" />
            </span>
            <div>
              <h1 className="text-[22px] font-bold leading-tight text-[var(--theme-text)]">Payroll</h1>
              <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">Manage employee wages, deductions, and pay runs</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex w-fit gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('rounded-lg px-4 py-1.5 text-[12px] font-semibold transition-all',
                tab === t.id ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
              style={tab === t.id ? {
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
              } : undefined}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'runs' && <PayRunsTab />}
        {tab === 'employees' && <EmployeesTab />}
        {tab === 'summary' && <SummaryTab />}
      </div>
    </div>
  )
}
