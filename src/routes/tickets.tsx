import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  SentIcon,
  Ticket01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

export const Route = createFileRoute('/tickets')({ component: TicketsScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

interface TicketReply {
  id: string
  ticket_id: string
  author: string
  is_internal: boolean
  body: string
  created_at: string
}

interface TicketRecord {
  id: string
  brand: string
  subject: string
  body: string
  status: TicketStatus
  priority: TicketPriority
  contact_id?: string
  contact_name?: string
  contact_email?: string
  assignee?: string
  tags?: string[]
  replies: TicketReply[]
  created_at: string
  updated_at: string
  resolved_at?: string
  first_response_at?: string
}

interface TicketStats {
  open: number
  in_progress: number
  waiting: number
  resolved: number
  total: number
  urgent: number
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

// ── Colors ────────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<TicketStatus, string> = {
  open: '#3b82f6',
  in_progress: '#8b5cf6',
  waiting: '#f59e0b',
  resolved: '#10b981',
  closed: '#94a3b8',
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
}

const PRIORITY_COLOR: Record<TicketPriority, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#94a3b8',
}

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

// Colored dot + tinted pill badge
function TintBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── API ────────────────────────────────────────────────────────────────────────

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json()
}

// ── New Ticket Modal ───────────────────────────────────────────────────────────

function NewTicketModal({
  brandId,
  onClose,
  onCreated,
}: {
  brandId: string
  onClose: () => void
  onCreated: (ticket: TicketRecord) => void
}) {
  const [subject, setSubject] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim()) { toast('Subject is required', { type: 'error' }); return }
    setSaving(true)
    try {
      const ticket = await apiFetch(`/api/tickets?brand=${brandId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, contact_name: contactName, contact_email: contactEmail, priority, body, brand: brandId }),
      }) as TicketRecord
      onCreated(ticket)
      onClose()
    } catch (err) {
      toast(String(err), { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const fieldCls =
    'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] transition-all duration-150'
  const sectionLabelCls =
    'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Ticket01Icon} size={17} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--theme-text)]">New Ticket</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Open a help-desk request</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <label className={sectionLabelCls}>Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject *"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={sectionLabelCls}>Contact</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Contact name"
                className={fieldCls}
              />
              <input
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="Contact email"
                type="email"
                className={fieldCls}
              />
            </div>
          </div>
          <div>
            <label className={sectionLabelCls}>Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TicketPriority)}
              className={fieldCls}
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className={sectionLabelCls}>Details</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe the issue…"
              rows={4}
              className={`${fieldCls} resize-none`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--theme-border)] px-4 py-2 text-[13px] text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              {saving ? 'Creating…' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Ticket Detail ──────────────────────────────────────────────────────────────

function TicketDetail({
  ticket,
  brandId,
  onUpdated,
}: {
  ticket: TicketRecord
  brandId: string
  onUpdated: (t: TicketRecord) => void
}) {
  const qc = useQueryClient()
  const [replyBody, setReplyBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [editingAssignee, setEditingAssignee] = useState(ticket.assignee ?? '')
  const threadRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when replies change
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [ticket.replies.length])

  const patchTicket = async (patch: Partial<TicketRecord>) => {
    try {
      const updated = await apiFetch(`/api/tickets/${ticket.id}?brand=${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }) as TicketRecord
      onUpdated(updated)
      void qc.invalidateQueries({ queryKey: ['tickets', brandId] })
      void qc.invalidateQueries({ queryKey: ['ticket-stats', brandId] })
    } catch (err) {
      toast(String(err), { type: 'error' })
    }
  }

  const sendReply = async () => {
    if (!replyBody.trim()) return
    setSendingReply(true)
    try {
      const updated = await apiFetch(`/api/tickets/${ticket.id}/reply?brand=${brandId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody, is_internal: isInternal }),
      }) as TicketRecord
      setReplyBody('')
      onUpdated(updated)
      void qc.invalidateQueries({ queryKey: ['tickets', brandId] })
    } catch (err) {
      toast(String(err), { type: 'error' })
    } finally {
      setSendingReply(false)
    }
  }

  const removeTag = async (tag: string) => {
    const tags = (ticket.tags ?? []).filter(t => t !== tag)
    await patchTicket({ tags })
  }

  const addTag = async () => {
    if (!newTag.trim()) return
    const tags = [...(ticket.tags ?? []), newTag.trim()]
    await patchTicket({ tags })
    setNewTag('')
  }

  const saveAssignee = async () => {
    await patchTicket({ assignee: editingAssignee || undefined })
  }

  // Build conversation items: body as first "customer" message + replies
  const messages = [
    { id: '__body', author: ticket.contact_name || 'Customer', is_internal: false, body: ticket.body, created_at: ticket.created_at, isFirst: true },
    ...ticket.replies.map(r => ({ ...r, isFirst: false })),
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--theme-border)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold leading-snug text-[var(--theme-text)]">{ticket.subject}</h2>
          <TintBadge color={STATUS_COLOR[ticket.status]} label={STATUS_LABEL[ticket.status]} />
          <TintBadge color={PRIORITY_COLOR[ticket.priority]} label={PRIORITY_LABEL[ticket.priority]} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Status */}
          <select
            value={ticket.status}
            onChange={e => void patchTicket({ status: e.target.value as TicketStatus })}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-2 py-1 text-[12px] text-[var(--theme-text)] transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          >
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          {/* Priority */}
          <select
            value={ticket.priority}
            onChange={e => void patchTicket({ priority: e.target.value as TicketPriority })}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-2 py-1 text-[12px] text-[var(--theme-text)] transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          >
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map(p => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
          {/* Assignee */}
          <input
            value={editingAssignee}
            onChange={e => setEditingAssignee(e.target.value)}
            onBlur={saveAssignee}
            onKeyDown={e => { if (e.key === 'Enter') void saveAssignee() }}
            placeholder="Assignee"
            className="w-28 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-2 py-1 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
        </div>

        {/* Tags */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(ticket.tags ?? []).map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                color: 'var(--theme-accent)',
                border: '1px solid color-mix(in srgb, var(--theme-accent) 25%, transparent)',
              }}
            >
              {tag}
              <button onClick={() => void removeTag(tag)} className="transition-opacity hover:opacity-70">
                <HugeiconsIcon icon={Cancel01Icon} size={10} />
              </button>
            </span>
          ))}
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addTag() } }}
            placeholder="+ tag"
            className="w-16 rounded-full border border-dashed border-[var(--theme-border)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--theme-muted)] focus:outline-none"
          />
        </div>

        {/* Contact info */}
        {(ticket.contact_name || ticket.contact_email) && (
          <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--theme-muted)]">
            {ticket.contact_name && <span className="font-medium text-[var(--theme-text)]">{ticket.contact_name}</span>}
            {ticket.contact_email && <span>{ticket.contact_email}</span>}
          </div>
        )}
      </div>

      {/* Conversation thread */}
      <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.filter(m => m.body).map(msg => {
          const isAgent = !msg.isFirst && (msg.author === 'Agent' || (msg as TicketReply).author !== ticket.contact_name)
          const isIntNote = !msg.isFirst && (msg as TicketReply).is_internal

          return (
            <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[13px] shadow-sm ${
                  isIntNote
                    ? 'rounded-tl-sm'
                    : isAgent
                    ? 'rounded-tr-sm text-white'
                    : 'rounded-tl-sm border border-[var(--theme-border)] bg-[var(--theme-hover)] text-[var(--theme-text)]'
                }`}
                style={
                  isIntNote
                    ? {
                        background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))',
                        border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
                        color: 'var(--theme-text)',
                      }
                    : isAgent
                    ? { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }
                    : undefined
                }
              >
                {isIntNote && (
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f59e0b' }} />
                    Internal Note
                  </p>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                <p
                  className={`mt-1 text-[10px] ${isAgent && !isIntNote ? 'text-white/70' : 'text-[var(--theme-muted)]'}`}
                >
                  {msg.author} · {fmtDate(msg.created_at)} {fmtTime(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        {messages.length === 1 && !messages[0].body && (
          <p className="text-center text-[12px] text-[var(--theme-muted)]">No messages yet.</p>
        )}
      </div>

      {/* Reply composer */}
      <div className="shrink-0 space-y-2 border-t border-[var(--theme-border)] p-4">
        <textarea
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          placeholder={isInternal ? 'Write an internal note…' : 'Reply to customer…'}
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        />
        <div className="flex items-center justify-between">
          {/* Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-0.5">
            <button
              onClick={() => setIsInternal(false)}
              className="rounded-md px-3 py-1 text-[11px] font-medium transition-all duration-150"
              style={
                !isInternal
                  ? {
                      background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                      color: 'var(--theme-accent)',
                    }
                  : { color: 'var(--theme-muted)' }
              }
            >
              Reply to customer
            </button>
            <button
              onClick={() => setIsInternal(true)}
              className="rounded-md px-3 py-1 text-[11px] font-medium transition-all duration-150"
              style={
                isInternal
                  ? {
                      background: 'color-mix(in srgb, #f59e0b 14%, var(--theme-card))',
                      color: '#f59e0b',
                    }
                  : { color: 'var(--theme-muted)' }
              }
            >
              Internal Note
            </button>
          </div>
          <button
            onClick={sendReply}
            disabled={sendingReply || !replyBody.trim()}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={SentIcon} size={14} />
            {sendingReply ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Screen ────────────────────────────────────────────────────────────────

const STAT_CARD_DEFS: { key: keyof TicketStats; label: string; color: string }[] = [
  { key: 'open', label: 'Open', color: '#3b82f6' },
  { key: 'in_progress', label: 'In Progress', color: '#8b5cf6' },
  { key: 'waiting', label: 'Waiting', color: '#f59e0b' },
  { key: 'resolved', label: 'Resolved', color: '#10b981' },
]

function TicketsScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  // Local cache of selected ticket (updated optimistically)
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null)

  const { data: statsData } = useQuery<TicketStats>({
    queryKey: ['ticket-stats', brand.id],
    queryFn: () => apiFetch(`/api/tickets/stats?brand=${brand.id}`) as Promise<TicketStats>,
    refetchInterval: 30_000,
  })

  const params = new URLSearchParams({ brand: brand.id })
  if (statusFilter !== 'all') params.set('status', statusFilter)
  if (priorityFilter !== 'all') params.set('priority', priorityFilter)

  const { data: ticketsData, isLoading } = useQuery<{ tickets: TicketRecord[] }>({
    queryKey: ['tickets', brand.id, statusFilter, priorityFilter],
    queryFn: () => apiFetch(`/api/tickets?${params.toString()}`) as Promise<{ tickets: TicketRecord[] }>,
    refetchInterval: 15_000,
  })

  const tickets = ticketsData?.tickets ?? []

  // Keep selected ticket in sync with list data
  useEffect(() => {
    if (selectedId) {
      const found = tickets.find(t => t.id === selectedId)
      if (found) setSelectedTicket(found)
    }
  }, [tickets, selectedId])

  const handleSelect = (ticket: TicketRecord) => {
    setSelectedId(ticket.id)
    setSelectedTicket(ticket)
  }

  const handleCreated = (ticket: TicketRecord) => {
    void qc.invalidateQueries({ queryKey: ['tickets', brand.id] })
    void qc.invalidateQueries({ queryKey: ['ticket-stats', brand.id] })
    setSelectedId(ticket.id)
    setSelectedTicket(ticket)
    toast('Ticket created')
  }

  const handleUpdated = (ticket: TicketRecord) => {
    setSelectedTicket(ticket)
    void qc.invalidateQueries({ queryKey: ['tickets', brand.id] })
    void qc.invalidateQueries({ queryKey: ['ticket-stats', brand.id] })
  }

  const stats = statsData

  return (
    <div className="flex h-full">
      {/* ── Left panel ──────────────────────────────────── */}
      <div
        className="flex w-72 shrink-0 flex-col border-r"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        {/* Stats strip */}
        <div className="border-b border-[var(--theme-border)] p-3">
          <div className="grid grid-cols-2 gap-2">
            {STAT_CARD_DEFS.map(stat => (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-xl border border-[var(--theme-border)] px-2.5 py-2 transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
                style={{ background: 'var(--theme-card)', backdropFilter: 'blur(10px)' }}
              >
                <div
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{
                    background: `linear-gradient(180deg, ${stat.color}, color-mix(in srgb, ${stat.color} 40%, transparent))`,
                  }}
                />
                <div className="min-w-0 pl-1.5">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
                    {stat.label}
                  </p>
                  <p className="text-[15px] font-bold tabular-nums leading-tight text-[var(--theme-text)]">
                    {stats?.[stat.key] ?? 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2 border-b border-[var(--theme-border)] p-3">
          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as TicketStatus | 'all')}
              className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-hover))] px-2 py-1.5 text-[12px] text-[var(--theme-text)] transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting">Waiting</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white transition-all duration-150 hover:-translate-y-px"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              title="New ticket"
            >
              <HugeiconsIcon icon={Add01Icon} size={16} />
            </button>
          </div>
          {/* Priority segmented control */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-0.5">
            {(['all', 'urgent', 'high', 'medium', 'low'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className="flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-all duration-150"
                style={
                  priorityFilter === p
                    ? {
                        background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                        color: 'var(--theme-accent)',
                      }
                    : { color: 'var(--theme-muted)' }
                }
              >
                {p === 'all' ? 'All' : PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--theme-hover) 60%, transparent)' }}
                />
              ))}
            </div>
          )}
          {!isLoading && tickets.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
                }}
              >
                <HugeiconsIcon icon={Ticket01Icon} size={18} style={{ color: 'var(--theme-accent)' }} />
              </div>
              <p className="text-[12px] font-semibold text-[var(--theme-text)]">No tickets found</p>
              <p className="text-[11px] text-[var(--theme-muted)]">Try a different filter or create one.</p>
            </div>
          )}
          {tickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => handleSelect(ticket)}
              className="group w-full border-b border-[var(--theme-border)] px-3 py-2.5 text-left transition-all duration-150 hover:-translate-y-px hover:shadow-sm focus-within:shadow-sm"
              style={
                selectedId === ticket.id
                  ? { background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))' }
                  : { background: 'transparent' }
              }
              onMouseEnter={e => {
                if (selectedId !== ticket.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-hover)'
              }}
              onMouseLeave={e => {
                if (selectedId !== ticket.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: PRIORITY_COLOR[ticket.priority],
                    boxShadow: `0 0 4px color-mix(in srgb, ${PRIORITY_COLOR[ticket.priority]} 60%, transparent)`,
                  }}
                  title={PRIORITY_LABEL[ticket.priority]}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--theme-text)]">
                      {ticket.subject}
                    </p>
                    <span className="shrink-0 rounded-md p-0.5 text-[var(--theme-muted)] opacity-0 transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                      <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {ticket.contact_name && (
                      <span className="truncate text-[11px] text-[var(--theme-muted)]">
                        {ticket.contact_name}
                      </span>
                    )}
                    <TintBadge color={STATUS_COLOR[ticket.status]} label={STATUS_LABEL[ticket.status]} />
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums text-[var(--theme-muted)]">
                      {relativeTime(ticket.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ background: 'var(--theme-card)' }}>
        {selectedTicket ? (
          <TicketDetail
            key={selectedTicket.id}
            ticket={selectedTicket}
            brandId={brand.id}
            onUpdated={handleUpdated}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
              }}
            >
              <HugeiconsIcon icon={Ticket01Icon} size={26} style={{ color: 'var(--theme-accent)' }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[var(--theme-text)]">Select a ticket</p>
              <p className="text-[12px] text-[var(--theme-muted)]">Choose a ticket from the list to view details</p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-1 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Add01Icon} size={15} />
              New Ticket
            </button>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewTicketModal
          brandId={brand.id}
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
