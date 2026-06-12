import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  CalendarCheckIn01Icon,
  CancelCircleIcon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  GoogleIcon,
  ListViewIcon,
  Location01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import { CalendarSyncPanel } from './calendar-sync-panel'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  createAppointment,
  deleteAppointment,
  fetchAppointments,
  updateAppointment,
} from '@/lib/appointments-api'
import type {
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
} from '@/lib/appointments-api'
import { fetchContacts } from '@/lib/contacts-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'appointments'] as const
const CONTACTS_KEY = ['platform', 'contacts', 'for-appts'] as const

const STATUSES: AppointmentStatus[] = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ──
const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch { return iso }
}

function formatTimeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch { return iso }
}

function dayLabel(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const off = d.getTimezoneOffset()
    const local = new Date(d.getTime() - off * 60_000)
    return local.toISOString().slice(0, 16)
  } catch { return '' }
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

// Status as colored dot + soft tinted badge
function ApptStatusBadge({ status }: { status: AppointmentStatus }) {
  const color = STATUS_COLORS[status]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

// Gradient-accented stat card
function StatCard({ label, value, sub, color, icon }: {
  label: string
  value: string
  sub?: string
  color: string
  icon: typeof Calendar01Icon
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
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

type FormState = {
  title: string; contact_id: string; starts_at: string; ends_at: string
  status: AppointmentStatus; location: string; notes: string
}

function ApptDialog({ open, initial, title, contacts, onClose, onSubmit, isSubmitting }: {
  open: boolean; initial: FormState; title: string; contacts: Array<{ id: string; name: string }>
  onClose: () => void; onSubmit: (form: FormState) => void; isSubmitting: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  useMemo(() => { if (open) setForm(initial) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const inputCls = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Calendar01Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
            <p className="text-[11px] text-[var(--theme-muted)]">Book time and link it to a contact</p>
          </div>
        </div>
        <div className="p-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Details</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Title</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Contact</label>
              <select value={form.contact_id} onChange={(e) => set('contact_id', e.target.value)} className={inputCls}>
                <option value="">— none —</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Schedule</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Starts</label>
                <input type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Ends (optional)</label>
                <input type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as AppointmentStatus)} className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Context</p>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Location</label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Office, video link, phone…" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--theme-muted)] transition-colors duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
            <button onClick={() => onSubmit(form)} disabled={!form.title.trim() || !form.starts_at || isSubmitting}
              className={primaryBtnCls} style={primaryBtnStyle}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Calendar month view ───────────────────────────────────────────────────────
function CalendarView({ appts, onNew, onEdit, accentColor }: {
  appts: Appointment[]
  onNew: (dateStr: string) => void
  onEdit: (a: Appointment) => void
  accentColor: string
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_HEADERS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  // Build day → appointments map
  const apptsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    appts.forEach(a => {
      const d = new Date(a.starts_at)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString()
        if (!map[key]) map[key] = []
        map[key].push(a)
      }
    })
    return map
  }, [appts, year, month])

  function prev() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  // Build grid cells: leading blanks + days
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]" style={{ backdropFilter: 'blur(10px)' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
        <button onClick={prev} className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]" title="Previous month">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={15} />
        </button>
        <h2 className="text-sm font-semibold text-[var(--theme-text)]">{MONTH_NAMES[month]} {year}</h2>
        <button onClick={next} className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]" title="Next month">
          <HugeiconsIcon icon={ArrowRight01Icon} size={15} />
        </button>
      </div>
      {/* Day headers */}
      <div
        className="grid grid-cols-7 border-b border-[var(--theme-border)]"
        style={{ background: 'color-mix(in srgb, var(--theme-accent) 4%, var(--theme-card))' }}
      >
        {DAY_HEADERS.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} className="border-b border-r border-[var(--theme-border)] min-h-[88px]" />
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const dayAppts = apptsByDay[day.toString()] ?? []
          return (
            <div
              key={day}
              onClick={() => { const d = new Date(year, month, day); onNew(d.toISOString().slice(0, 10)) }}
              className={cn(
                'group relative min-h-[88px] cursor-pointer border-b border-r border-[var(--theme-border)] p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]',
                (i + 1) % 7 === 0 && 'border-r-0',
              )}
              style={isToday ? {
                boxShadow: `inset 0 0 0 1.5px ${accentColor}`,
                background: `color-mix(in srgb, ${accentColor} 5%, transparent)`,
              } : undefined}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium',
                    isToday ? 'font-bold text-white' : 'text-[var(--theme-muted)]')}
                  style={isToday ? { background: accentColor, boxShadow: `0 1px 6px color-mix(in srgb, ${accentColor} 45%, transparent)` } : undefined}
                >
                  {day}
                </span>
                <span className="rounded-md p-0.5 text-[var(--theme-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <HugeiconsIcon icon={Add01Icon} size={11} />
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {dayAppts.slice(0, 3).map(a => {
                  const color = STATUS_COLORS[a.status]
                  return (
                    <button
                      key={a.id}
                      onClick={e => { e.stopPropagation(); onEdit(a) }}
                      className="flex w-full items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-left text-[9px] font-medium transition-all duration-150 hover:brightness-110"
                      style={{
                        background: `color-mix(in srgb, ${color} 14%, var(--theme-card))`,
                        color,
                        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
                      }}
                      title={a.title}
                    >
                      <span className="shrink-0 font-semibold tabular-nums">{formatTimeOnly(a.starts_at)}</span>
                      <span className="truncate">{a.title}</span>
                    </button>
                  )
                })}
                {dayAppts.length > 3 && (
                  <p className="pl-1.5 text-[8px] font-medium text-[var(--theme-muted)]">+{dayAppts.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function AppointmentsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const [activeTab, setActiveTab] = useState<'appointments' | 'google-calendar'>('appointments')
  const [whenFilter, setWhenFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming')
  const [showCreate, setShowCreate] = useState(false)
  const [createDate, setCreateDate] = useState<string | null>(null)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  const apptsQuery = useQuery({
    queryKey: [...QUERY_KEY, 'all'],
    queryFn: () => fetchAppointments({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
  })
  const allAppts = apptsQuery.data ?? []

  // Filtered for list view
  const listAppts = useMemo(() => {
    const now = new Date()
    if (whenFilter === 'upcoming') return allAppts.filter(a => new Date(a.starts_at) >= now)
    if (whenFilter === 'past') return allAppts.filter(a => new Date(a.starts_at) < now)
    return allAppts
  }, [allAppts, whenFilter])

  const contactsQuery = useQuery({ queryKey: CONTACTS_KEY, queryFn: () => fetchContacts(), staleTime: 60_000 })
  const contactOptions = useMemo(() => (contactsQuery.data ?? []).map((c) => ({ id: c.id, name: c.name })), [contactsQuery.data])
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) => createAppointment(input),
    onSuccess: () => { invalidate(); toast('Appointment saved'); setShowCreate(false); setCreateDate(null) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })
  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateAppointmentInput> }) => updateAppointment(p.id, p.updates),
    onSuccess: () => { invalidate(); toast('Appointment updated'); setEditing(null) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => { invalidate(); toast('Appointment deleted') },
  })

  // Group by day for list view
  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: Appointment[] }> = []
    let curLabel = ''
    for (const a of listAppts) {
      const label = dayLabel(a.starts_at)
      if (label !== curLabel) { groups.push({ label, items: [a] }); curLabel = label }
      else groups[groups.length - 1].items.push(a)
    }
    return groups
  }, [listAppts])

  // Display-only stats derived from loaded data
  const stats = useMemo(() => {
    const now = new Date()
    const upcoming = allAppts.filter(a => new Date(a.starts_at) >= now && a.status !== 'cancelled' && a.status !== 'no_show').length
    const todayCount = allAppts.filter(a => new Date(a.starts_at).toDateString() === now.toDateString()).length
    const completed = allAppts.filter(a => a.status === 'completed').length
    const cancelled = allAppts.filter(a => a.status === 'cancelled' || a.status === 'no_show').length
    return { upcoming, todayCount, completed, cancelled }
  }, [allAppts])

  const toDateInput = (dateStr: string | null) => {
    if (!dateStr) return toLocalInput(new Date().toISOString())
    return `${dateStr}T09:00`
  }

  const emptyForm = (dateStr?: string | null): FormState => ({
    title: '', contact_id: '', starts_at: toDateInput(dateStr ?? null), ends_at: '', status: 'scheduled', location: '', notes: '',
  })

  const toForm = (a: Appointment): FormState => ({
    title: a.title, contact_id: a.contact_id ?? '', starts_at: toLocalInput(a.starts_at), ends_at: toLocalInput(a.ends_at),
    status: a.status, location: a.location, notes: a.notes,
  })

  const fromForm = (f: FormState): CreateAppointmentInput => {
    const contact = contactOptions.find((c) => c.id === f.contact_id)
    return {
      title: f.title.trim(), contact_id: f.contact_id || null, contact_name: contact?.name ?? null,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : new Date().toISOString(),
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      status: f.status, location: f.location, notes: f.notes,
      brand: brand.id !== 'hermes' ? brand.id : undefined,
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Calendar01Icon} size={18} className="text-white" />
            </span>
            <div>
              <h1 className="text-[22px] font-bold leading-tight text-[var(--theme-text)]">Appointments</h1>
              <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">
                {apptsQuery.data
                  ? `${allAppts.length} appointment${allAppts.length !== 1 ? 's' : ''} · bookings linked to contacts`
                  : 'Bookings linked to contacts'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'appointments' && (
              <button onClick={invalidate} className="rounded-lg p-2 text-[var(--theme-muted)] transition-colors duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]" title="Refresh">
                <HugeiconsIcon icon={RefreshIcon} size={15} />
              </button>
            )}
            <button
              onClick={() => setActiveTab(activeTab === 'google-calendar' ? 'appointments' : 'google-calendar')}
              title="Google Calendar Sync"
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150',
                activeTab !== 'google-calendar' && 'border border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]',
              )}
              style={activeTab === 'google-calendar' ? { ...primaryBtnStyle, color: '#fff' } : undefined}
            >
              <HugeiconsIcon icon={GoogleIcon} size={13} />
              <span className="hidden sm:inline">Google Calendar</span>
            </button>
            {activeTab === 'appointments' && (
              <button onClick={() => { setCreateDate(null); setShowCreate(true) }} className={primaryBtnCls} style={primaryBtnStyle}>
                <HugeiconsIcon icon={Add01Icon} size={14} /> New
              </button>
            )}
          </div>
        </div>

        {/* Google Calendar Sync panel */}
        {activeTab === 'google-calendar' && <CalendarSyncPanel />}

        {activeTab === 'appointments' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Upcoming" value={String(stats.upcoming)} sub="on the books" color="#3b82f6" icon={CalendarCheckIn01Icon} />
              <StatCard label="Today" value={String(stats.todayCount)} sub="scheduled today" color="#8b5cf6" icon={Clock01Icon} />
              <StatCard label="Completed" value={String(stats.completed)} sub="all time" color="#10b981" icon={CheckmarkCircle01Icon} />
              <StatCard label="Cancelled / No-show" value={String(stats.cancelled)} sub="all time" color="#ef4444" icon={CancelCircleIcon} />
            </div>

            {/* Filters + view toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {viewMode === 'list' ? (
                <div className="flex w-fit gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
                  {(['upcoming', 'all', 'past'] as const).map((w) => (
                    <button key={w} onClick={() => setWhenFilter(w)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-[11px] font-semibold capitalize transition-all duration-150',
                        whenFilter === w ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                      )}
                      style={whenFilter === w ? {
                        background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                        color: 'var(--theme-accent)',
                      } : undefined}>
                      {w}
                    </button>
                  ))}
                </div>
              ) : <div />}
              <div className="flex gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
                <button onClick={() => setViewMode('list')} title="List view"
                  className={cn('rounded-lg px-2.5 py-1.5 transition-all duration-150', viewMode === 'list' ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
                  style={viewMode === 'list' ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' } : undefined}>
                  <HugeiconsIcon icon={ListViewIcon} size={13} />
                </button>
                <button onClick={() => setViewMode('calendar')} title="Calendar view"
                  className={cn('rounded-lg px-2.5 py-1.5 transition-all duration-150', viewMode === 'calendar' ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]')}
                  style={viewMode === 'calendar' ? { background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))', color: 'var(--theme-accent)' } : undefined}>
                  <HugeiconsIcon icon={ViewIcon} size={13} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Calendar view */}
        {activeTab === 'appointments' && viewMode === 'calendar' && (
          <CalendarView
            appts={allAppts}
            accentColor={brand.accentColor}
            onNew={(dateStr) => { setCreateDate(dateStr); setShowCreate(true) }}
            onEdit={(a) => setEditing(a)}
          />
        )}

        {/* List view */}
        {activeTab === 'appointments' && viewMode === 'list' && (
          <div className="flex-1 space-y-4">
            {apptsQuery.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[72px] animate-pulse rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] opacity-60" />
                ))}
              </div>
            ) : listAppts.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-xl border py-14 text-center"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                    color: 'var(--theme-accent)',
                  }}
                >
                  <HugeiconsIcon icon={Calendar01Icon} size={22} />
                </span>
                <p className="text-[13px] font-semibold text-[var(--theme-text)]">No {whenFilter} appointments</p>
                <p className="text-[11px] text-[var(--theme-muted)]">Book one and link it to a contact.</p>
                <button onClick={() => { setCreateDate(null); setShowCreate(true) }} className={cn(primaryBtnCls, 'mt-2')} style={primaryBtnStyle}>
                  <HugeiconsIcon icon={Add01Icon} size={13} /> New Appointment
                </button>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{group.label}</h2>
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {group.items.map((a) => (
                        <motion.div key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          onClick={() => setEditing(a)}
                          className="group flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                          style={{ backdropFilter: 'blur(10px)' }}>
                          {/* Time badge */}
                          <div
                            className="flex w-[68px] shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-2"
                            style={{
                              background: 'color-mix(in srgb, var(--theme-accent) 8%, var(--theme-card))',
                              borderColor: 'color-mix(in srgb, var(--theme-accent) 22%, var(--theme-border))',
                            }}
                          >
                            <span className="text-[13px] font-bold leading-tight tabular-nums text-[var(--theme-text)]">
                              {formatTimeOnly(a.starts_at)}
                            </span>
                            {a.ends_at && (
                              <span className="text-[9px] tabular-nums text-[var(--theme-muted)]">– {formatTimeOnly(a.ends_at)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">{a.title}</h3>
                              <ApptStatusBadge status={a.status} />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[var(--theme-muted)]">
                              <span className="tabular-nums">{formatWhen(a.starts_at)}</span>
                              {a.contact_name && (
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="flex items-center justify-center rounded-full text-[8px] font-bold text-white"
                                    style={{ height: 18, width: 18, background: ACCENT_GRADIENT }}
                                  >
                                    {initials(a.contact_name)}
                                  </span>
                                  {a.contact_name}
                                </span>
                              )}
                              {a.location && <span className="flex items-center gap-1"><HugeiconsIcon icon={Location01Icon} size={11} />{a.location}</span>}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                            <button onClick={(e) => { e.stopPropagation(); setEditing(a) }}
                              className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-[var(--theme-hover)]" title="Edit">
                              <HugeiconsIcon icon={PencilEdit02Icon} size={14} className="text-[var(--theme-muted)]" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${a.title}"?`)) deleteMutation.mutate(a.id) }}
                              className="rounded-lg p-1.5 transition-colors duration-150"
                              onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                              title="Delete">
                              <HugeiconsIcon icon={Delete01Icon} size={14} style={{ color: 'var(--theme-danger)' }} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ApptDialog open={showCreate} initial={emptyForm(createDate)} title="New Appointment" contacts={contactOptions}
        onClose={() => { setShowCreate(false); setCreateDate(null) }}
        onSubmit={(f) => createMutation.mutate(fromForm(f))} isSubmitting={createMutation.isPending} />
      <ApptDialog open={editing !== null} initial={editing ? toForm(editing) : emptyForm()}
        title="Edit Appointment" contacts={contactOptions}
        onClose={() => setEditing(null)}
        onSubmit={(f) => { if (editing) updateMutation.mutate({ id: editing.id, updates: fromForm(f) }) }}
        isSubmitting={updateMutation.isPending} />
    </div>
  )
}
