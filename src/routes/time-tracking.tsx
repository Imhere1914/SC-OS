import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Calendar03Icon,
  Clock01Icon,
  Delete01Icon,
  DollarCircleIcon,
  PencilEdit02Icon,
  PlayIcon,
  StopIcon,
  StopWatchIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

export const Route = createFileRoute('/time-tracking')({ component: TimeTrackingScreen })

// ── Types ────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string
  project_id?: string
  project_name?: string
  contact_id?: string
  contact_name?: string
  description: string
  duration_minutes: number
  billable: boolean
  billed: boolean
  hourly_rate?: number
  invoice_id?: string
  date: string
  started_at?: string
  created_at: string
  updated_at: string
}

interface TimeSummary {
  total_minutes: number
  billable_minutes: number
  unbilled_minutes: number
  unbilled_cents: number
  entry_count: number
}

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ─

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--theme-muted)]'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function fmtMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function fmtTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: {
  label: string
  value: string
  sub?: string
  color: string
  icon: typeof Clock01Icon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
        backdropFilter: 'blur(10px)',
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// ── Live Timer ────────────────────────────────────────────────────────────────

function LiveTimer({ onStop }: { onStop: (minutes: number) => void }) {
  const [seconds, setSeconds] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const iv = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--theme-border)] px-5 py-5 sm:px-6"
      style={{ background: 'var(--theme-card)', backdropFilter: 'blur(10px)' }}
    >
      {/* Breathing accent glow while running */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full motion-safe:animate-[breathe_3.2s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--theme-accent) 45%, #000) 0%, transparent 70%)',
          filter: 'blur(28px)',
        }}
      />
      <div className="relative flex flex-wrap items-center gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={StopWatchIcon} size={20} className="text-white" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full align-middle" style={{ background: 'var(--theme-accent)' }} />
            Timer running
          </p>
          <span className="block text-4xl font-bold leading-tight tabular-nums text-[var(--theme-text)] sm:text-5xl">
            {fmtTimer(seconds)}
          </span>
        </div>
        <button
          onClick={() => onStop(Math.max(1, Math.ceil(seconds / 60)))}
          className="ml-auto flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
          style={{
            background: 'linear-gradient(135deg, #ef4444, color-mix(in srgb, #ef4444 65%, #000))',
            boxShadow: '0 2px 8px color-mix(in srgb, #ef4444 38%, transparent)',
          }}
        >
          <HugeiconsIcon icon={StopIcon} size={13} />
          Stop
        </button>
      </div>
    </div>
  )
}

// ── Entry Form ────────────────────────────────────────────────────────────────

interface EntryForm {
  description: string
  date: string
  hours: string
  minutes: string
  billable: boolean
  hourly_rate: string
  project_name: string
  contact_name: string
}

const EMPTY_FORM: EntryForm = {
  description: '',
  date: new Date().toISOString().slice(0, 10),
  hours: '0',
  minutes: '30',
  billable: true,
  hourly_rate: '',
  project_name: '',
  contact_name: '',
}

function EntryModal({
  open,
  initial,
  title,
  onClose,
  onSubmit,
  isSaving,
  prefillMinutes,
}: {
  open: boolean
  initial: EntryForm
  title: string
  onClose: () => void
  onSubmit: (f: EntryForm) => void
  isSaving: boolean
  prefillMinutes?: number
}) {
  const [form, setForm] = useState<EntryForm>(initial)

  useEffect(() => {
    if (open) {
      const base = { ...initial }
      if (prefillMinutes !== undefined) {
        base.hours = String(Math.floor(prefillMinutes / 60))
        base.minutes = String(prefillMinutes % 60)
      }
      setForm(base)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header — gradient icon chip + bold title + muted subtitle */}
        <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Clock01Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
            <p className="text-[11px] text-[var(--theme-muted)]">Capture what you worked on and for how long</p>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <label className={labelCls}>Description *</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What did you work on?"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Duration</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={form.hours}
                  onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                  className="w-16 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-xs tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                  placeholder="h"
                />
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={form.minutes}
                  onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))}
                  className="w-16 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-xs tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                  placeholder="m"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Project (optional)</label>
              <input
                value={form.project_name}
                onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                placeholder="Project name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Client (optional)</label>
              <input
                value={form.contact_name}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Client name"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--theme-text)]">
              <input
                type="checkbox"
                checked={form.billable}
                onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))}
                className="rounded accent-[var(--theme-accent)]"
              />
              Billable
            </label>
            {form.billable && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--theme-muted)]">Rate:</span>
                <span className="text-xs text-[var(--theme-muted)]">$</span>
                <input
                  type="number"
                  min={0}
                  value={form.hourly_rate}
                  onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                  placeholder="0"
                  className="w-20 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs tabular-nums text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                />
                <span className="text-[11px] text-[var(--theme-muted)]">/hr</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3.5">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={isSaving || !form.description.trim()}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {isSaving ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TimeTrackingScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStopMinutes, setTimerStopMinutes] = useState<number | undefined>()
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [filterBillable, setFilterBillable] = useState<'all' | 'billable' | 'billed'>('all')

  const QUERY_KEY = ['time-entries', brand.id]
  const SUMMARY_KEY = ['time-summary', brand.id]

  const { data: entries = [] } = useQuery<TimeEntry[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch('/api/time-entries', { headers: { 'x-brand': brand.id } })
      return r.json() as Promise<TimeEntry[]>
    },
  })

  const { data: summary } = useQuery<TimeSummary>({
    queryKey: SUMMARY_KEY,
    queryFn: async () => {
      const r = await fetch('/api/time-entries/summary', { headers: { 'x-brand': brand.id } })
      return r.json() as Promise<TimeSummary>
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QUERY_KEY })
    void qc.invalidateQueries({ queryKey: SUMMARY_KEY })
  }

  const createMut = useMutation({
    mutationFn: async (f: EntryForm) => {
      const duration_minutes = (parseInt(f.hours || '0') * 60) + parseInt(f.minutes || '0')
      const r = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-brand': brand.id },
        body: JSON.stringify({
          description: f.description,
          date: f.date,
          duration_minutes,
          billable: f.billable,
          hourly_rate: f.hourly_rate ? Math.round(parseFloat(f.hourly_rate) * 100) : undefined,
          project_name: f.project_name || undefined,
          contact_name: f.contact_name || undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => { invalidate(); setShowAdd(false); setTimerStopMinutes(undefined); toast('Time entry logged') },
    onError: () => toast('Failed to save entry', { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: EntryForm }) => {
      const duration_minutes = (parseInt(f.hours || '0') * 60) + parseInt(f.minutes || '0')
      const r = await fetch(`/api/time-entries/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-brand': brand.id },
        body: JSON.stringify({
          description: f.description,
          date: f.date,
          duration_minutes,
          billable: f.billable,
          hourly_rate: f.hourly_rate ? Math.round(parseFloat(f.hourly_rate) * 100) : undefined,
          project_name: f.project_name || undefined,
          contact_name: f.contact_name || undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => { invalidate(); setEditEntry(null); toast('Entry updated') },
    onError: () => toast('Failed to update', { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/time-entries/${id}`, { method: 'DELETE', headers: { 'x-brand': brand.id } })
      if (!r.ok) throw new Error('Failed')
    },
    onSuccess: () => { invalidate(); toast('Entry deleted') },
    onError: () => toast('Failed to delete', { type: 'error' }),
  })

  const filtered = entries.filter(e => {
    if (filterBillable === 'billable') return e.billable && !e.billed
    if (filterBillable === 'billed') return e.billed
    return true
  })

  // Group by date
  const grouped = filtered.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Display-only rollups for the stat cards, derived from existing entry fields
  const now = new Date()
  const todayKey = localDateKey(now)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // Monday
  const weekStartKey = localDateKey(weekStart)
  const todayMinutes = entries.filter(e => e.date === todayKey).reduce((s, e) => s + e.duration_minutes, 0)
  const weekMinutes = entries.filter(e => e.date >= weekStartKey && e.date <= todayKey).reduce((s, e) => s + e.duration_minutes, 0)

  const editForm: EntryForm = editEntry ? {
    description: editEntry.description,
    date: editEntry.date,
    hours: String(Math.floor(editEntry.duration_minutes / 60)),
    minutes: String(editEntry.duration_minutes % 60),
    billable: editEntry.billable,
    hourly_rate: editEntry.hourly_rate ? String(editEntry.hourly_rate / 100) : '',
    project_name: editEntry.project_name ?? '',
    contact_name: editEntry.contact_name ?? '',
  } : EMPTY_FORM

  return (
    <div className="flex h-full flex-col">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Clock01Icon} size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">Time Tracking</h1>
            <p className="mt-0.5 text-[12px] text-[var(--theme-muted)]">
              {summary
                ? `${summary.entry_count} entr${summary.entry_count === 1 ? 'y' : 'ies'} · log hours and bill clients`
                : 'Log hours and bill clients'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!timerRunning && (
            <button
              onClick={() => setTimerRunning(true)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
              style={{
                background: 'linear-gradient(135deg, #10b981, color-mix(in srgb, #10b981 65%, #000))',
                boxShadow: '0 2px 8px color-mix(in srgb, #10b981 38%, transparent)',
              }}
            >
              <HugeiconsIcon icon={PlayIcon} size={13} />
              Start Timer
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className={primaryBtnCls} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={13} />
            Log Time
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Live timer — hero treatment */}
        {timerRunning && (
          <LiveTimer onStop={(mins) => {
            setTimerRunning(false)
            setTimerStopMinutes(mins)
            setShowAdd(true)
          }} />
        )}

        {/* Summary strip — stat cards */}
        {summary && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Today"
              value={fmtDuration(todayMinutes)}
              sub="tracked today"
              color="#3b82f6"
              icon={Clock01Icon}
            />
            <StatCard
              label="This Week"
              value={fmtDuration(weekMinutes)}
              sub="since Monday"
              color="#8b5cf6"
              icon={Calendar03Icon}
            />
            <StatCard
              label="Unbilled Value"
              value={fmtMoney(summary.unbilled_cents)}
              sub={`${fmtDuration(summary.unbilled_minutes)} unbilled`}
              color="#10b981"
              icon={DollarCircleIcon}
            />
          </div>
        )}

        {/* Filter tabs — segmented control */}
        <div className="flex w-fit items-center gap-0.5 rounded-lg border border-[var(--theme-border)] p-0.5" style={{ background: 'var(--theme-card)' }}>
          {(['all', 'billable', 'billed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterBillable(f)}
              className="rounded-md px-3 py-1 text-xs font-medium capitalize transition-all duration-150"
              style={filterBillable === f
                ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' }
                : { background: 'transparent', color: 'var(--theme-muted)' }}
            >
              {f === 'billable' ? 'Unbilled' : f === 'all' ? 'All Entries' : 'Billed'}
            </button>
          ))}
        </div>

        {/* Entries grouped by date */}
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))' }}>
              <HugeiconsIcon icon={StopWatchIcon} size={26} className="text-[var(--theme-accent)]" />
            </span>
            <p className="text-sm font-semibold text-[var(--theme-text)]">No time entries yet</p>
            <p className="mt-1 mb-4 text-xs text-[var(--theme-muted)]">Start the timer or log time manually</p>
            <button onClick={() => setShowAdd(true)} className={primaryBtnCls} style={primaryBtnStyle}>
              <HugeiconsIcon icon={Add01Icon} size={13} />
              Log Time
            </button>
          </div>
        ) : (
          sortedDates.map(date => {
            const dayEntries = grouped[date]
            const dayMinutes = dayEntries.reduce((s, e) => s + e.duration_minutes, 0)
            return (
              <div key={date}>
                {/* Date header — section label */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{fmtDate(date)}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-[var(--theme-muted)]">{fmtDuration(dayMinutes)}</span>
                </div>
                <div className="space-y-1.5">
                  {dayEntries.map(entry => (
                    <div
                      key={entry.id}
                      className="group flex items-center gap-3 rounded-xl border border-[var(--theme-border)] px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                      style={{ background: 'var(--theme-card)', backdropFilter: 'blur(10px)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="truncate text-xs font-medium text-[var(--theme-text)]">
                            {entry.description}
                          </span>
                          {entry.project_name && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                                color: 'var(--theme-accent)',
                                border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                              }}
                            >
                              {entry.project_name}
                            </span>
                          )}
                          {entry.contact_name && (
                            <span className="text-[10px] text-[var(--theme-muted)]">
                              · {entry.contact_name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {entry.billable && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                              style={{ background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))', color: '#10b981', border: '1px solid color-mix(in srgb, #10b981 30%, transparent)' }}
                            >
                              <span className="h-1 w-1 rounded-full" style={{ background: '#10b981' }} />
                              {entry.billed ? 'Billed' : entry.hourly_rate ? `${fmtMoney(Math.round((entry.duration_minutes / 60) * entry.hourly_rate))} unbilled` : 'Billable'}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Duration — right-aligned tabular-nums */}
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--theme-text)]">
                        {fmtDuration(entry.duration_minutes)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          onClick={() => setEditEntry(entry)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 hover:bg-[var(--theme-hover)]"
                          title="Edit"
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} size={13} className="text-[var(--theme-muted)]" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this time entry?')) deleteMut.mutate(entry.id)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 hover:bg-[var(--theme-hover)]"
                          title="Delete"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={13} style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add modal */}
      <EntryModal
        open={showAdd}
        initial={EMPTY_FORM}
        title="Log Time Entry"
        onClose={() => { setShowAdd(false); setTimerStopMinutes(undefined) }}
        onSubmit={(f) => createMut.mutate(f)}
        isSaving={createMut.isPending}
        prefillMinutes={timerStopMinutes}
      />

      {/* Edit modal */}
      {editEntry && (
        <EntryModal
          open={true}
          initial={editForm}
          title="Edit Time Entry"
          onClose={() => setEditEntry(null)}
          onSubmit={(f) => updateMut.mutate({ id: editEntry.id, f })}
          isSaving={updateMut.isPending}
        />
      )}
    </div>
  )
}
