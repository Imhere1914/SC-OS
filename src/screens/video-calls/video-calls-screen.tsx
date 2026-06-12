import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Calendar01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  Delete01Icon,
  LinkSquare02Icon,
  PencilEdit02Icon,
  Timer01Icon,
  Video01Icon,
} from '@hugeicons/core-free-icons'
import {
  createVideoCall,
  deleteVideoCall,
  fetchVideoCalls,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  updateVideoCall,
} from '@/lib/video-calls-api'
import type {
  CreateVideoCallInput,
  VideoCall,
  VideoCallPlatform,
  VideoCallStatus,
} from '@/lib/video-calls-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'video-calls'] as const

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const PLATFORMS: VideoCallPlatform[] = [
  'zoom',
  'google_meet',
  'teams',
  'whereby',
  'custom',
]

const JOIN_URL_HINTS: Record<VideoCallPlatform, string> = {
  zoom: 'https://zoom.us/j/...',
  google_meet: 'https://meet.google.com/...',
  teams: 'https://teams.microsoft.com/l/meetup-join/...',
  whereby: 'https://whereby.com/...',
  custom: 'https://...',
}

type FilterMode = 'upcoming' | 'today' | 'all'

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function fromLocalInput(local: string): string {
  if (!local) return ''
  try {
    return new Date(local).toISOString()
  } catch {
    return local
  }
}

function isToday(iso: string): boolean {
  try {
    const d = new Date(iso)
    const now = new Date()
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    )
  } catch {
    return false
  }
}

function isUpcoming(iso: string): boolean {
  try {
    return new Date(iso) >= new Date()
  } catch {
    return false
  }
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string
  value: number
  sub?: string
  color: string
  icon: typeof Video01Icon
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
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 38%, transparent)`,
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

// ── Platform badge — keeps platform color as a dot + tinted pill ────────────────
function PlatformBadge({ platform }: { platform: VideoCallPlatform }) {
  const color = PLATFORM_COLORS[platform]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {PLATFORM_LABELS[platform]}
    </span>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<VideoCallStatus, string> = {
  scheduled: '#3b82f6',
  ongoing: '#10b981',
  completed: '#94a3b8',
  cancelled: '#ef4444',
}

function StatusBadge({ status }: { status: VideoCallStatus }) {
  const color = STATUS_COLORS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Call card ──────────────────────────────────────────────────────────────────
function CallCard({
  call,
  onEdit,
  onDelete,
}: {
  call: VideoCall
  onEdit: (c: VideoCall) => void
  onDelete: (c: VideoCall) => void
}) {
  const copyLink = () => {
    navigator.clipboard.writeText(call.join_url).then(
      () => toast('Join link copied to clipboard'),
      () => toast('Failed to copy link', { type: 'error' }),
    )
  }

  const ghostBtn =
    'rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md focus-within:shadow-md"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <PlatformBadge platform={call.platform} />
            <StatusBadge status={call.status} />
          </div>
          <p className="truncate font-semibold text-[var(--theme-text)]">{call.title}</p>
          {call.contact_name && (
            <p className="mt-0.5 text-xs text-[var(--theme-muted)]">{call.contact_name}</p>
          )}
          {/* Prominent time pill */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
              style={{
                background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                color: 'var(--theme-accent)',
                border: '1px solid color-mix(in srgb, var(--theme-accent) 25%, transparent)',
              }}
            >
              <HugeiconsIcon icon={Calendar01Icon} size={12} />
              {formatWhen(call.scheduled_at)}
            </span>
            <span className="text-xs tabular-nums text-[var(--theme-muted)]">{call.duration_minutes} min</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--theme-muted)]">
            {call.meeting_id && <span className="tabular-nums">ID: {call.meeting_id}</span>}
            {call.passcode && <span className="tabular-nums">Passcode: {call.passcode}</span>}
          </div>
          {call.notes && (
            <p className="mt-1.5 line-clamp-2 text-xs text-[var(--theme-muted)]">{call.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={copyLink} title="Copy join link" className={ghostBtn}>
            <HugeiconsIcon icon={Copy01Icon} size={15} />
          </button>
          <a
            href={call.join_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open join link"
            className={ghostBtn}
          >
            <HugeiconsIcon icon={LinkSquare02Icon} size={15} />
          </a>
          <button
            onClick={() => onEdit(call)}
            title="Edit"
            className={cn(ghostBtn, 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100')}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} size={15} />
          </button>
          <button
            onClick={() => onDelete(call)}
            title="Delete"
            className="rounded-lg p-1.5 text-[var(--theme-muted)] opacity-0 transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-red-500 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
          >
            <HugeiconsIcon icon={Delete01Icon} size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────
type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; call: VideoCall }
  | null

function CallModal({
  state,
  onClose,
  onSave,
  saving,
}: {
  state: ModalState
  onClose: () => void
  onSave: (data: CreateVideoCallInput) => void
  saving: boolean
}) {
  const editing = state?.mode === 'edit' ? state.call : null

  const [title, setTitle] = useState(editing?.title ?? '')
  const [platform, setPlatform] = useState<VideoCallPlatform>(editing?.platform ?? 'zoom')
  const [joinUrl, setJoinUrl] = useState(editing?.join_url ?? '')
  const [hostUrl, setHostUrl] = useState(editing?.host_url ?? '')
  const [meetingId, setMeetingId] = useState(editing?.meeting_id ?? '')
  const [passcode, setPasscode] = useState(editing?.passcode ?? '')
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(editing?.scheduled_at ?? null))
  const [duration, setDuration] = useState(String(editing?.duration_minutes ?? 60))
  const [status, setStatus] = useState<VideoCallStatus>(editing?.status ?? 'scheduled')
  const [contactName, setContactName] = useState(editing?.contact_name ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast('Title is required', { type: 'error' }); return }
    if (!joinUrl.trim()) { toast('Join URL is required', { type: 'error' }); return }
    if (!scheduledAt) { toast('Scheduled time is required', { type: 'error' }); return }
    onSave({
      title: title.trim(),
      platform,
      join_url: joinUrl.trim(),
      host_url: hostUrl.trim() || null,
      meeting_id: meetingId.trim() || null,
      passcode: passcode.trim() || null,
      scheduled_at: fromLocalInput(scheduledAt),
      duration_minutes: parseInt(duration, 10) || 60,
      status,
      contact_name: contactName.trim() || null,
      notes: notes.trim(),
    })
  }

  const label = 'block mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]'
  const input =
    'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-sm text-[var(--theme-text)] transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] placeholder:text-[var(--theme-muted)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Video01Icon} size={17} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-[var(--theme-text)]">
              {editing ? 'Edit Video Call' : 'New Video Call'}
            </h2>
            <p className="text-[11px] text-[var(--theme-muted)]">
              {editing ? 'Update the meeting details' : 'Schedule a meeting link'}
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={label}>Title *</label>
            <input className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Onboarding call with Acme" />
          </div>

          <div>
            <label className={label}>Platform</label>
            <select className={input} value={platform} onChange={e => setPlatform(e.target.value as VideoCallPlatform)}>
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Join URL *</label>
            <input
              className={input}
              value={joinUrl}
              onChange={e => setJoinUrl(e.target.value)}
              placeholder={JOIN_URL_HINTS[platform]}
              type="url"
            />
          </div>

          <div>
            <label className={label}>Host URL (optional)</label>
            <input className={input} value={hostUrl} onChange={e => setHostUrl(e.target.value)} placeholder="Host/start link" type="url" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Meeting ID</label>
              <input className={input} value={meetingId} onChange={e => setMeetingId(e.target.value)} placeholder="123 456 7890" />
            </div>
            <div>
              <label className={label}>Passcode</label>
              <input className={input} value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="abc123" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Scheduled At *</label>
              <input className={input} type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
            </div>
            <div>
              <label className={label}>Duration (min)</label>
              <input className={input} type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={label}>Status</label>
            <select className={input} value={status} onChange={e => setStatus(e.target.value as VideoCallStatus)}>
              {(['scheduled', 'ongoing', 'completed', 'cancelled'] as VideoCallStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Contact Name</label>
            <input className={input} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. Jane Smith" />
          </div>

          <div>
            <label className={label}>Notes</label>
            <textarea className={cn(input, 'resize-none')} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Agenda, talking points…" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Call'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────
export function VideoCallsScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FilterMode>('upcoming')
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteTarget, setDeleteTarget] = useState<VideoCall | null>(null)

  const { data: calls = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, brand.id],
    queryFn: () => fetchVideoCalls(),
    refetchInterval: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY })

  const createMut = useMutation({
    mutationFn: (input: CreateVideoCallInput) => createVideoCall({ ...input, brand: brand.id }),
    onSuccess: () => { toast('Video call created'); setModal(null); void invalidate() },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateVideoCallInput }) =>
      updateVideoCall(id, data),
    onSuccess: () => { toast('Video call updated'); setModal(null); void invalidate() },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteVideoCall(id),
    onSuccess: () => { toast('Deleted'); setDeleteTarget(null); void invalidate() },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const handleSave = (data: CreateVideoCallInput) => {
    if (modal?.mode === 'edit') {
      updateMut.mutate({ id: modal.call.id, data })
    } else {
      createMut.mutate(data)
    }
  }

  // Stats
  const now = new Date().toISOString()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)

  const upcoming = calls.filter(c => c.scheduled_at >= now && c.status !== 'cancelled')
  const today = calls.filter(
    c =>
      c.scheduled_at >= todayStart.toISOString() &&
      c.scheduled_at <= todayEnd.toISOString() &&
      c.status !== 'cancelled',
  )
  const thisWeek = calls.filter(
    c =>
      c.scheduled_at >= now &&
      c.scheduled_at <= weekEnd.toISOString() &&
      c.status !== 'cancelled',
  )
  const completed = calls.filter(c => c.status === 'completed')

  // Filtered list
  const visible = calls.filter(c => {
    if (filter === 'upcoming') return isUpcoming(c.scheduled_at) && c.status !== 'cancelled'
    if (filter === 'today') return isToday(c.scheduled_at)
    return true
  })

  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Video01Icon} size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--theme-text)]">Video Calls</h1>
            <p className="text-xs text-[var(--theme-muted)]">Manage meeting links &amp; video sessions</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={Add01Icon} size={15} />
          New Call
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Upcoming" value={upcoming.length} sub="Scheduled ahead" color="#3b82f6" icon={Video01Icon} />
        <StatCard label="Today" value={today.length} sub="On the calendar" color="#f59e0b" icon={Clock01Icon} />
        <StatCard label="This Week" value={thisWeek.length} sub="Next 7 days" color="#8b5cf6" icon={Timer01Icon} />
        <StatCard label="Completed" value={completed.length} sub="All time" color="#10b981" icon={CheckmarkCircle02Icon} />
      </div>

      {/* Filter tabs */}
      <div className="flex w-fit gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-1">
        {(['upcoming', 'today', 'all'] as FilterMode[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all duration-150"
            style={
              filter === f
                ? {
                    background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                    color: 'var(--theme-accent)',
                  }
                : { color: 'var(--theme-muted)' }
            }
          >
            {f === 'upcoming' ? 'Upcoming' : f === 'today' ? 'Today' : 'All'}
          </button>
        ))}
      </div>

      {/* Call list */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
            }}
          >
            <HugeiconsIcon icon={Video01Icon} size={26} style={{ color: 'var(--theme-accent)' }} />
          </div>
          <p className="text-sm font-semibold text-[var(--theme-text)]">
            {filter === 'upcoming'
              ? 'No upcoming video calls'
              : filter === 'today'
                ? 'No calls scheduled today'
                : 'No video calls yet'}
          </p>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            Schedule a Call
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {visible.map(call => (
              <CallCard
                key={call.id}
                call={call}
                onEdit={c => setModal({ mode: 'edit', call: c })}
                onDelete={c => setDeleteTarget(c)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit modal */}
      <AnimatePresence>
        {modal && (
          <CallModal
            key={modal.mode}
            state={modal}
            onClose={() => setModal(null)}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-2xl"
            >
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, color-mix(in srgb, #ef4444 65%, #000))',
                    boxShadow: '0 2px 8px color-mix(in srgb, #ef4444 38%, transparent)',
                  }}
                >
                  <HugeiconsIcon icon={Delete01Icon} size={16} />
                </span>
                <div>
                  <h3 className="font-bold text-[var(--theme-text)]">Delete Video Call?</h3>
                  <p className="text-[11px] text-[var(--theme-muted)]">This cannot be undone</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-[var(--theme-muted)]">
                "{deleteTarget.title}" will be permanently deleted.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMut.mutate(deleteTarget.id)}
                  disabled={deleteMut.isPending}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-red-600 disabled:opacity-60"
                >
                  {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
