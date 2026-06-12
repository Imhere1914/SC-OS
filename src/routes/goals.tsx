import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Cancel01Icon,
  Delete01Icon,
  PencilEdit02Icon,
  Target02Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { ScreenShell } from '@/components/screen-shell'

export const Route = createFileRoute('/goals')({ component: GoalsScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

type GoalStatus = 'on_track' | 'at_risk' | 'behind' | 'completed' | 'cancelled'
type GoalPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'annual' | 'custom'

interface KeyResult {
  id: string
  title: string
  target_value: number
  current_value: number
  unit: string
  progress: number
  status: GoalStatus
  due_date?: string
}

interface GoalRecord {
  id: string
  brand: string
  title: string
  description?: string
  period: GoalPeriod
  year: number
  custom_start?: string
  custom_end?: string
  owner?: string
  status: GoalStatus
  key_results: KeyResult[]
  overall_progress: number
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PERIODS: GoalPeriod[] = ['Q1', 'Q2', 'Q3', 'Q4', 'annual', 'custom']
const STATUSES: GoalStatus[] = ['on_track', 'at_risk', 'behind', 'completed', 'cancelled']

const STATUS_LABELS: Record<GoalStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  behind: 'Behind',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<GoalStatus, string> = {
  on_track: '#10b981',
  at_risk: '#f59e0b',
  behind: '#ef4444',
  completed: '#3b82f6',
  cancelled: '#9ca3af',
}

const accentGradient = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const accentGlow = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

function suggestedStatus(progress: number): GoalStatus {
  if (progress >= 100) return 'completed'
  if (progress >= 71) return 'on_track'
  if (progress >= 31) return 'at_risk'
  return 'behind'
}

// Status badge: colored dot + tinted pill
function StatusBadge({ status }: { status: GoalStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`, color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

// ── Empty form state ──────────────────────────────────────────────────────────

type KrForm = { title: string; target_value: string; unit: string; due_date: string }
type GoalForm = {
  title: string
  description: string
  period: GoalPeriod
  year: string
  owner: string
  status: GoalStatus
  key_results: KrForm[]
}

const emptyKr = (): KrForm => ({ title: '', target_value: '', unit: '', due_date: '' })
const emptyForm = (): GoalForm => ({
  title: '',
  description: '',
  period: 'Q1',
  year: String(new Date().getFullYear()),
  owner: '',
  status: 'on_track',
  key_results: [emptyKr()],
})

// ── Goal Modal ────────────────────────────────────────────────────────────────

function GoalModal({
  open,
  initial,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  initial?: GoalRecord
  onClose: () => void
  onSubmit: (data: GoalForm) => void
  isSubmitting: boolean
}) {
  const [form, setForm] = useState<GoalForm>(() => {
    if (!initial) return emptyForm()
    return {
      title: initial.title,
      description: initial.description ?? '',
      period: initial.period,
      year: String(initial.year),
      owner: initial.owner ?? '',
      status: initial.status,
      key_results: initial.key_results.length
        ? initial.key_results.map(kr => ({
            title: kr.title,
            target_value: String(kr.target_value),
            unit: kr.unit,
            due_date: kr.due_date ?? '',
          }))
        : [emptyKr()],
    }
  })

  if (!open) return null

  const set = <K extends keyof GoalForm>(k: K, v: GoalForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const setKr = (i: number, k: keyof KrForm, v: string) =>
    setForm(f => {
      const krs = [...f.key_results]
      krs[i] = { ...krs[i], [k]: v }
      return { ...f, key_results: krs }
    })

  const addKr = () => setForm(f => ({ ...f, key_results: [...f.key_results, emptyKr()] }))
  const removeKr = (i: number) =>
    setForm(f => ({ ...f, key_results: f.key_results.filter((_, idx) => idx !== i) }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGradient, boxShadow: accentGlow }}
            >
              <HugeiconsIcon icon={Target02Icon} size={16} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">
                {initial ? 'Edit Goal' : 'New Goal'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {initial ? 'Update objective and key results' : 'Define an objective and its key results'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-[var(--theme-muted)]" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Objective *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Grow monthly recurring revenue"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Optional context…"
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Period + Year + Owner */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Period</label>
              <select
                value={form.period}
                onChange={e => set('period', e.target.value as GoalPeriod)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-2 text-[13px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              >
                {PERIODS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Year</label>
              <input
                type="number"
                value={form.year}
                onChange={e => set('year', e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-2 text-[13px] tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Owner</label>
              <input
                value={form.owner}
                onChange={e => set('owner', e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value as GoalStatus)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            >
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          {/* Key Results */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Key Results</label>
              <button
                type="button"
                onClick={addKr}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150 hover:bg-[var(--theme-hover)]"
                style={{ color: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={12} /> Add Key Result
              </button>
            </div>
            <div className="space-y-2">
              {form.key_results.map((kr, i) => (
                <div
                  key={i}
                  className="rounded-xl border p-3"
                  style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={kr.title}
                      onChange={e => setKr(i, 'title', e.target.value)}
                      placeholder="Key result title…"
                      className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    />
                    {form.key_results.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeKr(i)}
                        className="rounded p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={12} className="text-[var(--theme-muted)]" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] text-[var(--theme-muted)]">Target</label>
                      <input
                        type="number"
                        value={kr.target_value}
                        onChange={e => setKr(i, 'target_value', e.target.value)}
                        placeholder="1000"
                        className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-[12px] tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-[var(--theme-muted)]">Unit</label>
                      <input
                        value={kr.unit}
                        onChange={e => setKr(i, 'unit', e.target.value)}
                        placeholder="leads, %, $"
                        className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-[var(--theme-muted)]">Due date</label>
                      <input
                        type="date"
                        value={kr.due_date}
                        onChange={e => setKr(i, 'due_date', e.target.value)}
                        className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-[12px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={isSubmitting || !form.title.trim()}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 disabled:opacity-50"
            style={{ background: accentGradient, boxShadow: accentGlow }}
          >
            {isSubmitting ? 'Saving…' : initial ? 'Save Changes' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ progress, color, height = 6 }: { progress: number; color: string; height?: number }) {
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: 'var(--theme-hover)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, progress))}%`,
          background: `linear-gradient(90deg, color-mix(in srgb, ${color} 65%, var(--theme-card)), ${color})`,
        }}
      />
    </div>
  )
}

// ── Progress ring (gradient) ──────────────────────────────────────────────────

function ProgressRing({ progress, color, id }: { progress: number; color: string; id: string }) {
  const size = 64
  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, progress))
  const gradId = `goal-ring-${id}`
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={`color-mix(in srgb, ${color} 55%, #000)`} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--theme-hover)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums"
        style={{ color }}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  )
}

// ── Inline KR editor ──────────────────────────────────────────────────────────

function KrRow({
  kr,
  goalId,
  brand,
  onUpdated,
}: {
  kr: KeyResult
  goalId: string
  brand: string
  onUpdated: (goal: GoalRecord) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(kr.current_value))
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (current_value: number) => {
      const data = await apiFetch<{ goal: GoalRecord }>(
        `/api/goals/${goalId}/kr/${kr.id}?brand=${brand}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_value }),
        },
      )
      return data.goal
    },
    onSuccess: (goal) => {
      onUpdated(goal)
      void qc.invalidateQueries({ queryKey: ['goals', brand] })
      setEditing(false)
      toast('Key result updated')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const commit = () => {
    const num = parseFloat(value)
    if (isNaN(num)) { setEditing(false); return }
    mutation.mutate(num)
  }

  const suggested = suggestedStatus(kr.progress)
  const color = STATUS_COLORS[kr.status]

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="truncate text-[12px] text-[var(--theme-text)]">{kr.title}</span>
          {kr.due_date && (
            <span className="shrink-0 text-[10px] tabular-nums text-[var(--theme-muted)]">
              {new Date(kr.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
        <ProgressBar progress={kr.progress} color={color} height={4} />
      </div>

      {/* current / target */}
      <div className="shrink-0 flex items-center gap-1">
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            className="w-16 rounded border border-[var(--theme-border)] bg-[var(--theme-input)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
        ) : (
          <button
            onClick={() => { setValue(String(kr.current_value)); setEditing(true) }}
            className="rounded px-1 py-0.5 text-[11px] font-medium tabular-nums text-[var(--theme-text)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
            title="Click to update"
          >
            {kr.current_value}
          </button>
        )}
        <span className="text-[11px] tabular-nums text-[var(--theme-muted)]">/ {kr.target_value} {kr.unit}</span>
      </div>

      {/* % */}
      <div className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color }}>
        {kr.progress}%
      </div>

      {/* auto-status suggestion */}
      {suggested !== kr.status && (
        <span className="hidden text-[9px] text-[var(--theme-muted)] xl:block">
          → {STATUS_LABELS[suggested]}
        </span>
      )}
    </div>
  )
}

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  brand,
  onEdit,
  onDelete,
  onGoalUpdated,
}: {
  goal: GoalRecord
  brand: string
  onEdit: () => void
  onDelete: () => void
  onGoalUpdated: (g: GoalRecord) => void
}) {
  const color = STATUS_COLORS[goal.status]
  const suggested = suggestedStatus(goal.overall_progress)

  return (
    <div
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border p-5 transition-all duration-150 hover:-translate-y-[1px] hover:shadow-lg"
      style={{
        background: 'var(--theme-card)',
        borderColor: `color-mix(in srgb, ${color} 22%, var(--theme-border))`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <ProgressRing progress={goal.overall_progress} color={color} id={goal.id} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {/* Period badge */}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                color: 'var(--theme-accent)',
              }}
            >
              {goal.period} {goal.year}
            </span>
            {/* Status badge */}
            <StatusBadge status={goal.status} />
            {/* Auto-status suggestion */}
            {suggested !== goal.status && (
              <span className="text-[10px] text-[var(--theme-muted)]">
                (suggest: {STATUS_LABELS[suggested]})
              </span>
            )}
          </div>
          <h3 className="text-[14px] font-semibold leading-snug text-[var(--theme-text)]">
            {goal.title}
          </h3>
          {goal.description && (
            <p className="mt-0.5 text-[12px] text-[var(--theme-muted)]">{goal.description}</p>
          )}
          {goal.owner && (
            <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">Owner: {goal.owner}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-all duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
            title="Edit"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-red-500"
            title="Delete"
          >
            <HugeiconsIcon icon={Delete01Icon} size={14} />
          </button>
        </div>
      </div>

      {/* Key Results */}
      {goal.key_results.length > 0 && (
        <div
          className="rounded-xl border px-3 py-2"
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Key Results
          </p>
          <div className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
            {goal.key_results.map(kr => (
              <KrRow
                key={kr.id}
                kr={kr}
                goalId={goal.id}
                brand={brand}
                onUpdated={onGoalUpdated}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

function GoalsScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [periodFilter, setPeriodFilter] = useState<GoalPeriod | 'all'>('all')
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()))
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GoalRecord | undefined>()

  const qKey = ['goals', brand.id, periodFilter, yearFilter] as const

  const { data, isLoading, refetch } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const params = new URLSearchParams({ brand: brand.id })
      if (periodFilter !== 'all') params.set('period', periodFilter)
      if (yearFilter) params.set('year', yearFilter)
      const d = await apiFetch<{ goals: GoalRecord[] }>(`/api/goals?${params}`)
      return d.goals
    },
  })

  const goals = data ?? []

  // Overview counts
  const onTrack = goals.filter(g => g.status === 'on_track').length
  const atRisk = goals.filter(g => g.status === 'at_risk').length
  const behind = goals.filter(g => g.status === 'behind').length

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (form: GoalForm) => {
      return apiFetch<{ goal: GoalRecord }>('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: brand.id,
          title: form.title,
          description: form.description || undefined,
          period: form.period,
          year: parseInt(form.year) || new Date().getFullYear(),
          owner: form.owner || undefined,
          status: form.status,
          key_results: form.key_results
            .filter(kr => kr.title.trim())
            .map(kr => ({
              title: kr.title,
              target_value: parseFloat(kr.target_value) || 0,
              unit: kr.unit,
              due_date: kr.due_date || undefined,
            })),
        }),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['goals', brand.id] })
      setModalOpen(false)
      toast('Goal created')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: GoalForm }) => {
      return apiFetch<{ goal: GoalRecord }>(`/api/goals/${id}?brand=${brand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          period: form.period,
          year: parseInt(form.year) || new Date().getFullYear(),
          owner: form.owner || undefined,
          status: form.status,
          key_results: form.key_results
            .filter(kr => kr.title.trim())
            .map((kr, i) => ({
              id: editTarget?.key_results[i]?.id,
              title: kr.title,
              target_value: parseFloat(kr.target_value) || 0,
              current_value: editTarget?.key_results[i]?.current_value ?? 0,
              unit: kr.unit,
              progress: editTarget?.key_results[i]?.progress ?? 0,
              status: editTarget?.key_results[i]?.status ?? 'on_track',
              due_date: kr.due_date || undefined,
            })),
        }),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['goals', brand.id] })
      setModalOpen(false)
      setEditTarget(undefined)
      toast('Goal updated')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/goals/${id}?brand=${brand.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['goals', brand.id] })
      toast('Goal deleted')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const handleGoalUpdated = (updated: GoalRecord) => {
    qc.setQueryData<GoalRecord[]>(qKey, old =>
      old ? old.map(g => g.id === updated.id ? updated : g) : [updated],
    )
  }

  const openNew = () => { setEditTarget(undefined); setModalOpen(true) }
  const openEdit = (g: GoalRecord) => { setEditTarget(g); setModalOpen(true) }

  const handleSubmit = (form: GoalForm) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, form })
    } else {
      createMutation.mutate(form)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 1 + i))

  return (
    <ScreenShell
      icon={Target02Icon}
      title="Goals & OKRs"
      subtitle="Track business objectives and key results"
      count={goals.length}
      onRefresh={() => void refetch()}
      action={
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-white transition-all duration-150"
          style={{ background: accentGradient, boxShadow: accentGlow }}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          New Goal
        </button>
      }
    >
      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* Period filter — segmented control */}
        <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}>
          {(['all', ...PERIODS] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriodFilter(p)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                periodFilter !== p && 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
              )}
              style={
                periodFilter === p
                  ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' }
                  : undefined
              }
            >
              {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Year selector */}
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-1.5 text-[12px] tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Overview strip */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'On Track', count: onTrack, color: STATUS_COLORS.on_track },
          { label: 'At Risk', count: atRisk, color: STATUS_COLORS.at_risk },
          { label: 'Behind', count: behind, color: STATUS_COLORS.behind },
        ].map(({ label, count, color }) => (
          <div
            key={label}
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border py-4 transition-all duration-150 hover:-translate-y-[1px]"
            style={{
              borderColor: `color-mix(in srgb, ${color} 30%, var(--theme-border))`,
              background: `linear-gradient(135deg, color-mix(in srgb, ${color} 12%, var(--theme-card)), color-mix(in srgb, ${color} 4%, var(--theme-card)))`,
              backdropFilter: 'blur(10px)',
            }}
          >
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />
            <span className="text-[22px] font-bold tabular-nums" style={{ color }}>{count}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</span>
          </div>
        ))}
      </div>

      {/* Goal cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--theme-card)] opacity-60" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border py-16 text-center"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={Target02Icon} size={24} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[var(--theme-text)]">No goals yet</p>
            <p className="text-[12px] text-[var(--theme-muted)]">Create your first objective to get started</p>
          </div>
          <button
            onClick={openNew}
            className="mt-1 flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150"
            style={{ background: accentGradient, boxShadow: accentGlow }}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} /> New Goal
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              brand={brand.id}
              onEdit={() => openEdit(goal)}
              onDelete={() => {
                if (confirm(`Delete "${goal.title}"?`)) deleteMutation.mutate(goal.id)
              }}
              onGoalUpdated={handleGoalUpdated}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <GoalModal
        open={modalOpen}
        initial={editTarget}
        onClose={() => { setModalOpen(false); setEditTarget(undefined) }}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </ScreenShell>
  )
}
