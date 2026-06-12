import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  MessageNotificationIcon,
  SmsCodeIcon,
  WhatsappIcon,
  UserGroupIcon,
  TagIcon,
  SentIcon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons'
import { toast } from '@/components/toast'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'
import { listSegments } from '@/lib/segments-api'
import type { Segment } from '@/lib/segments-api'

// ── Types ─────────────────────────────────────────────────────────────────────

type BroadcastChannel = 'sms' | 'whatsapp'
type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'failed'

interface Broadcast {
  id: string
  brand: string
  name: string
  channel: BroadcastChannel
  body: string
  segment_id?: string
  target_tags?: string[]
  status: BroadcastStatus
  total_recipients: number
  sent_count: number
  failed_count: number
  scheduled_at?: string
  sent_at?: string
  created_at: string
  updated_at: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchBroadcasts(brand: string): Promise<Broadcast[]> {
  const res = await fetch(`/api/broadcasts?brand=${brand}`)
  const d = (await res.json()) as { broadcasts?: Broadcast[] }
  return d.broadcasts ?? []
}

async function createBroadcast(data: {
  brand: string
  name: string
  channel: BroadcastChannel
  body: string
  segment_id?: string
  target_tags?: string[]
}): Promise<Broadcast> {
  const res = await fetch('/api/broadcasts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error?: string }
    throw new Error(err.error ?? 'Failed to create broadcast')
  }
  const d = (await res.json()) as { broadcast: Broadcast }
  return d.broadcast
}

async function sendBroadcast(id: string, brand: string): Promise<{ sent: number; failed: number }> {
  const res = await fetch(`/api/broadcasts/${id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand }),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error?: string }
    throw new Error(err.error ?? 'Send failed')
  }
  return res.json() as Promise<{ sent: number; failed: number }>
}

async function deleteBroadcast(id: string, brand: string): Promise<void> {
  await fetch(`/api/broadcasts/${id}?brand=${brand}`, { method: 'DELETE' })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(v: string | null | undefined): string {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return v }
}

const STATUS_CONFIG: Record<BroadcastStatus, { label: string; color: string }> = {
  draft:   { label: 'Draft',   color: '#94a3b8' },
  sending: { label: 'Sending', color: '#f59e0b' },
  sent:    { label: 'Sent',    color: '#10b981' },
  failed:  { label: 'Failed',  color: '#ef4444' },
}

const CHANNEL_CONFIG: Record<BroadcastChannel, { label: string; color: string; bg: string }> = {
  sms:      { label: 'SMS',       color: '#3b82f6', bg: 'color-mix(in srgb, #3b82f6 12%, var(--theme-card))' },
  whatsapp: { label: 'WhatsApp',  color: '#10b981', bg: 'color-mix(in srgb, #10b981 12%, var(--theme-card))' },
}

// ── Design tokens (shared vocabulary with Payments / Payroll) ─────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

// Status as colored dot + soft tinted badge
function StatusBadge({ status }: { status: BroadcastStatus }) {
  const { label, color } = STATUS_CONFIG[status]
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
      {label}
    </span>
  )
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  channel: BroadcastChannel
  audienceMode: 'all' | 'tags' | 'segment'
  selectedTags: string[]
  segment_id: string
  body: string
}

const EMPTY_FORM: FormState = {
  name: '',
  channel: 'sms',
  audienceMode: 'all',
  selectedTags: [],
  segment_id: '',
  body: '',
}

const SMS_LIMIT = 160

// ── New Broadcast Modal ────────────────────────────────────────────────────────

function NewBroadcastModal({
  open,
  onClose,
  onCreated,
  brand,
  allTags,
  segments,
}: {
  open: boolean
  onClose: () => void
  onCreated: (b: Broadcast) => void
  brand: string
  allTags: string[]
  segments: Segment[]
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setConfirm(false) }
  }, [open])

  if (!open) return null

  const charCount = form.body.length
  const smsWarning = form.channel === 'sms' && charCount > SMS_LIMIT

  const toggleTag = (tag: string) =>
    setForm(f => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter(t => t !== tag)
        : [...f.selectedTags, tag],
    }))

  const insertVar = (v: string) =>
    setForm(f => ({ ...f, body: f.body + v }))

  const handleSendNow = async () => {
    if (!form.name.trim()) { toast('Name is required', { type: 'error' }); return }
    if (!form.body.trim()) { toast('Message body is required', { type: 'error' }); return }
    if (!confirm) {
      setConfirm(true)
      return
    }
    setBusy(true)
    try {
      const payload: Parameters<typeof createBroadcast>[0] = {
        brand,
        name: form.name,
        channel: form.channel,
        body: form.body,
      }
      if (form.audienceMode === 'tags' && form.selectedTags.length > 0) {
        payload.target_tags = form.selectedTags
      }
      if (form.audienceMode === 'segment' && form.segment_id) {
        payload.segment_id = form.segment_id
      }
      const created = await createBroadcast(payload)
      onCreated(created)
      const result = await sendBroadcast(created.id, brand)
      toast(`Sent to ${result.sent} contact${result.sent !== 1 ? 's' : ''}${result.failed > 0 ? ` (${result.failed} failed)` : ''}`)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Send failed', { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={MessageNotificationIcon} size={16} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[var(--theme-text)]">New Broadcast</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">One message, every matching contact</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-[var(--theme-muted)]" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Broadcast Name
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Summer Sale Announcement"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Channel — segmented control */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Channel
            </label>
            <div className="flex rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] p-1">
              {(['sms', 'whatsapp'] as BroadcastChannel[]).map(ch => {
                const cfg = CHANNEL_CONFIG[ch]
                const active = form.channel === ch
                return (
                  <button
                    key={ch}
                    onClick={() => setForm(f => ({ ...f, channel: ch }))}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-[12px] font-semibold transition-all duration-150',
                      active ? '' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                    )}
                    style={
                      active
                        ? {
                            background: cfg.bg,
                            color: cfg.color,
                            border: `1px solid color-mix(in srgb, ${cfg.color} 30%, transparent)`,
                          }
                        : { border: '1px solid transparent' }
                    }
                  >
                    <HugeiconsIcon
                      icon={ch === 'sms' ? SmsCodeIcon : WhatsappIcon}
                      size={14}
                      style={{ color: cfg.color }}
                    />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Audience
            </label>
            <div className="flex rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] p-1">
              {(['all', 'tags', 'segment'] as const).map(mode => {
                const active = form.audienceMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => setForm(f => ({ ...f, audienceMode: mode }))}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold capitalize transition-all duration-150',
                      active ? '' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                    )}
                    style={
                      active
                        ? {
                            background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                            color: 'var(--theme-accent)',
                            border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                          }
                        : { border: '1px solid transparent' }
                    }
                  >
                    {mode === 'all' ? 'All Contacts' : mode === 'tags' ? 'By Tags' : 'By Segment'}
                  </button>
                )
              })}
            </div>

            {form.audienceMode === 'tags' && (
              <div className="mt-2">
                {allTags.length === 0 ? (
                  <p className="text-[11px] text-[var(--theme-muted)]">No tags found. Add tags to contacts first.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map(tag => {
                      const selected = form.selectedTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-150"
                          style={
                            selected
                              ? {
                                  background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                                  color: 'var(--theme-accent)',
                                  border: '1px solid color-mix(in srgb, var(--theme-accent) 35%, transparent)',
                                }
                              : {
                                  color: 'var(--theme-muted)',
                                  border: '1px solid var(--theme-border)',
                                }
                          }
                        >
                          <HugeiconsIcon icon={TagIcon} size={9} />
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {form.audienceMode === 'segment' && (
              <div className="mt-2">
                <select
                  value={form.segment_id}
                  onChange={e => setForm(f => ({ ...f, segment_id: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[12px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                >
                  <option value="">— Select segment —</option>
                  {segments.map(seg => (
                    <option key={seg.id} value={seg.id}>{seg.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                Message
              </label>
              <span className={cn(
                'text-[10px]',
                smsWarning ? 'font-semibold text-amber-500' : 'text-[var(--theme-muted)]',
              )}>
                {charCount}{form.channel === 'sms' ? ` / ${SMS_LIMIT}` : ''} chars
              </span>
            </div>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={4}
              placeholder="Hi {{first_name}}, we have an exclusive offer for you…"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] resize-none"
            />
            {smsWarning && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-500">
                <HugeiconsIcon icon={AlertCircleIcon} size={10} />
                Message exceeds 160 chars — will send as multiple SMS segments
              </p>
            )}
            {/* Variable chips */}
            <div className="mt-2 flex gap-1.5">
              <span className="text-[10px] text-[var(--theme-muted)] self-center">Insert:</span>
              {['{{contact_name}}', '{{first_name}}'].map(v => (
                <button
                  key={v}
                  onClick={() => insertVar(v)}
                  className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-hover)] px-2 py-0.5 font-mono text-[10px] text-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)] transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm area */}
          {confirm && (
            <div
              className="rounded-xl border p-3 text-[12px]"
              style={{
                borderColor: 'color-mix(in srgb, var(--theme-accent) 40%, transparent)',
                background: 'color-mix(in srgb, var(--theme-accent) 8%, var(--theme-card))',
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
                >
                  <HugeiconsIcon icon={SentIcon} size={14} />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                    Recipients
                  </p>
                  <p className="font-bold tabular-nums text-[var(--theme-text)]">
                    {form.audienceMode === 'tags' && form.selectedTags.length > 0
                      ? `Contacts tagged: ${form.selectedTags.join(', ')}`
                      : form.audienceMode === 'segment' && form.segment_id
                      ? segments.find(s => s.id === form.segment_id)?.name ?? 'Selected segment'
                      : 'All contacts with a phone number'}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[var(--theme-muted)]">
                Ready to send via {CHANNEL_CONFIG[form.channel].label}. Click "Confirm Send" to proceed.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--theme-border)] py-2.5 text-[12px] font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendNow}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0"
              style={primaryBtnStyle}
            >
              {busy ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <HugeiconsIcon icon={SentIcon} size={13} />
              )}
              {confirm ? 'Confirm Send' : 'Send Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Broadcast Card ────────────────────────────────────────────────────────────

function BroadcastCard({
  broadcast,
  onDelete,
}: {
  broadcast: Broadcast
  onDelete: (id: string) => void
}) {
  const ch = CHANNEL_CONFIG[broadcast.channel]

  return (
    <div
      className="group rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <div className="flex items-start gap-3">
        {/* Channel icon */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: ch.bg,
            color: ch.color,
            border: `1px solid color-mix(in srgb, ${ch.color} 22%, transparent)`,
          }}
        >
          <HugeiconsIcon
            icon={broadcast.channel === 'sms' ? SmsCodeIcon : WhatsappIcon}
            size={16}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-[var(--theme-text)]">
              {broadcast.name}
            </p>
            {/* Channel badge */}
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: ch.bg, color: ch.color }}
            >
              {ch.label}
            </span>
            {/* Status badge */}
            <span className="ml-auto">
              <StatusBadge status={broadcast.status} />
            </span>
          </div>

          {/* Body preview */}
          <p className="mt-1 line-clamp-2 text-[11px] text-[var(--theme-muted)]">
            {broadcast.body || <span className="italic">No message body</span>}
          </p>

          {/* Stats row */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] tabular-nums text-[var(--theme-muted)]">
            {broadcast.total_recipients > 0 && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={UserGroupIcon} size={11} />
                {broadcast.total_recipients} recipient{broadcast.total_recipients !== 1 ? 's' : ''}
              </span>
            )}
            {broadcast.sent_count > 0 && (
              <span className="flex items-center gap-1" style={{ color: '#10b981' }}>
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={11} />
                {broadcast.sent_count} sent
              </span>
            )}
            {broadcast.failed_count > 0 && (
              <span className="flex items-center gap-1" style={{ color: '#ef4444' }}>
                <HugeiconsIcon icon={AlertCircleIcon} size={11} />
                {broadcast.failed_count} failed
              </span>
            )}
            {broadcast.sent_at && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Clock01Icon} size={11} />
                {formatDate(broadcast.sent_at)}
              </span>
            )}
          </div>
        </div>

        {/* Delete — revealed on row hover, kept visible for keyboard focus */}
        <button
          onClick={() => onDelete(broadcast.id)}
          className="shrink-0 rounded-lg p-1.5 text-[var(--theme-muted)] opacity-0 transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          title="Delete"
        >
          <HugeiconsIcon icon={Delete01Icon} size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function BroadcastScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['broadcasts', brand.id],
    queryFn: () => fetchBroadcasts(brand.id),
    staleTime: 15_000,
  })

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', brand.id, 'tags'],
    queryFn: async () => {
      const res = await fetch(`/api/contacts?brand=${brand.id}`)
      const d = (await res.json()) as { contacts?: Array<{ tags: string[] }> }
      return d.contacts ?? []
    },
    staleTime: 60_000,
  })

  const { data: segments = [] } = useQuery({
    queryKey: ['segments', brand.id],
    queryFn: () => listSegments(brand.id),
    staleTime: 60_000,
  })

  // Collect unique tags across all contacts
  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags))).sort()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBroadcast(id, brand.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['broadcasts', brand.id] })
      toast('Broadcast deleted')
    },
    onError: () => toast('Failed to delete', { type: 'error' }),
  })

  const handleCreated = () => {
    void qc.invalidateQueries({ queryKey: ['broadcasts', brand.id] })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={MessageNotificationIcon} size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Broadcast</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">
              {broadcasts.length > 0
                ? `${broadcasts.length} broadcast${broadcasts.length === 1 ? '' : 's'} · SMS or WhatsApp to your contacts`
                : 'Send SMS or WhatsApp to your contacts'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          <HugeiconsIcon icon={Add01Icon} size={13} />
          New Broadcast
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid animate-pulse gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[108px] rounded-2xl bg-[var(--theme-card)] opacity-60" />
            ))}
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 16%, var(--theme-card)), color-mix(in srgb, #000 12%, var(--theme-card)))',
                color: 'var(--theme-accent)',
              }}
            >
              <HugeiconsIcon icon={MessageNotificationIcon} size={24} />
            </div>
            <p className="text-[13px] font-semibold text-[var(--theme-text)]">
              No broadcasts yet
            </p>
            <p className="text-[11px] text-[var(--theme-muted)]">
              Create your first broadcast to reach contacts via SMS or WhatsApp.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className={cn(primaryBtnCls, 'mt-2')}
              style={primaryBtnStyle}
            >
              <HugeiconsIcon icon={Add01Icon} size={13} />
              New Broadcast
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {broadcasts.map(b => (
              <BroadcastCard
                key={b.id}
                broadcast={b}
                onDelete={id => {
                  if (confirm('Delete this broadcast?')) deleteMutation.mutate(id)
                }}
              />
            ))}
          </div>
        )}
      </div>

      <NewBroadcastModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        brand={brand.id}
        allTags={allTags}
        segments={segments}
      />
    </div>
  )
}
