
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AiMagicIcon,
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Comment01Icon,
  Globe02Icon,
  InboxIcon,
  Mail01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  Search01Icon,
  SentIcon,
  SmartPhone01Icon,
  WhatsappIcon,
} from '@hugeicons/core-free-icons'
import {
  CHANNEL_LABELS,
  approveDraft,
  createConversation,
  fetchConversation,
  fetchConversations,
  requestAgentDraft,
  sendMessage,
  updateConversation,
} from '@/lib/conversations-api'
import type { Conversation, ConvChannel, ConvStatus } from '@/lib/conversations-api'
import { fetchContacts } from '@/lib/contacts-api'
import { sendSms } from '@/lib/sms-api'
import { sendWhatsApp } from '@/lib/whatsapp-api'
import { toast } from '@/components/toast'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'

const LIST_KEY = ['platform', 'conversations'] as const
const convKey = (id: string) => ['platform', 'conversation', id] as const
const CONTACTS_KEY = ['platform', 'contacts', 'for-conv'] as const

const COMPOSE_CHANNELS: ConvChannel[] = ['manual', 'email', 'sms', 'whatsapp']

// ── Design helpers (presentational only) ──────────────────────────────────────

const grad = (c: string) =>
  `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 65%, #000))`
const chipGlow = (c: string) =>
  `0 2px 8px color-mix(in srgb, ${c} 38%, transparent)`

const AI_PURPLE = '#8b5cf6'

const CHANNEL_META: Record<ConvChannel, { icon: typeof Globe02Icon; color: string }> = {
  webchat: { icon: Globe02Icon, color: '#0ea5e9' },
  sms: { icon: SmartPhone01Icon, color: '#3b82f6' },
  whatsapp: { icon: WhatsappIcon, color: '#10b981' },
  email: { icon: Mail01Icon, color: '#8b5cf6' },
  social: { icon: Comment01Icon, color: '#f97316' },
  manual: { icon: PencilEdit02Icon, color: '#f59e0b' },
}

function ChannelBadge({ channel }: { channel: ConvChannel }) {
  const meta = CHANNEL_META[channel]
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${meta.color} 12%, var(--theme-card))`,
        color: meta.color,
      }}
    >
      <HugeiconsIcon icon={meta.icon} size={10} />
      {CHANNEL_LABELS[channel]}
    </span>
  )
}

function dateLabel(value: string): string {
  const d = new Date(value)
  const now = new Date()
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (sameDay(d, now)) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Quick-compose modal ───────────────────────────────────────────────────────

function QuickComposeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const brand = useBrand()
  const [contactSearch, setContactSearch] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactName, setContactName] = useState('')
  const [channel, setChannel] = useState<ConvChannel>('manual')
  const [subject, setSubject] = useState('')
  const [firstMsg, setFirstMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const contactsQuery = useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: () => fetchContacts(),
    staleTime: 60_000,
  })

  const matchedContacts = useMemo(() => {
    if (!contactSearch.trim()) return []
    const q = contactSearch.toLowerCase()
    return (contactsQuery.data ?? [])
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [contactsQuery.data, contactSearch])

  const selectContact = (id: string, name: string) => {
    setContactId(id)
    setContactName(name)
    setContactSearch(name)
    setShowDropdown(false)
  }

  const submit = async () => {
    setSaving(true)
    try {
      const conv = await createConversation({
        contact_id: contactId,
        contact_name: contactName.trim() || null,
        channel,
        subject: subject.trim() || null,
      })
      if (firstMsg.trim()) {
        await sendMessage(conv.id, { body: firstMsg.trim(), role: 'human', draft: false })
      }
      onCreated(conv.id)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create', { type: 'error' })
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        style={{ backdropFilter: 'blur(16px)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) }}
            >
              <HugeiconsIcon icon={InboxIcon} size={15} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text)]">New Conversation</h3>
              <p className="text-[10px] text-[var(--theme-muted)]">Reach a contact on any channel</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-[var(--theme-muted)]" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {/* Contact picker */}
          <div className="relative">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">To (contact)</label>
            <div className="relative">
              <HugeiconsIcon icon={Search01Icon} size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
              <input
                ref={searchRef}
                value={contactSearch}
                onChange={e => {
                  setContactSearch(e.target.value)
                  setContactId(null)
                  setContactName(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                placeholder="Search contacts or type a name…"
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] py-1.5 pl-7 pr-3 text-xs text-[var(--theme-text)] transition-all duration-150 placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
            {showDropdown && matchedContacts.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-0.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-1 shadow-xl" style={{ backdropFilter: 'blur(10px)' }}>
                {matchedContacts.map(c => (
                  <button key={c.id} onMouseDown={() => selectContact(c.id, c.name)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--theme-hover)]">
                    <span className="text-xs font-medium text-[var(--theme-text)]">{c.name}</span>
                    {c.email && <span className="text-[10px] text-[var(--theme-muted)]">{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Channel */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">Channel</label>
            <div className="flex flex-wrap gap-1.5">
              {COMPOSE_CHANNELS.map(ch => (
                <button key={ch} onClick={() => setChannel(ch)}
                  className={cn('flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                    channel === ch ? 'border-transparent text-white' : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]')}
                  style={channel === ch ? { background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) } : undefined}>
                  <HugeiconsIcon icon={CHANNEL_META[ch].icon} size={11} />
                  {CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">Subject (optional)</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="What's this about?"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] transition-all duration-150 placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]" />
          </div>

          {/* First message */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">First message (optional)</label>
            <textarea value={firstMsg} onChange={e => setFirstMsg(e.target.value)} rows={3}
              placeholder="Type your opening message…"
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-xs text-[var(--theme-text)] transition-all duration-150 placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
          <button onClick={() => void submit()} disabled={!contactName.trim() || saving}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:opacity-90 disabled:opacity-50"
            style={{ background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) }}>
            <HugeiconsIcon icon={SentIcon} size={12} />
            {saving ? 'Creating…' : 'Start conversation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SMS compose modal ─────────────────────────────────────────────────────────

function SmsComposeModal({
  onClose,
  onSent,
}: {
  onClose: () => void
  onSent: (conversationId: string) => void
}) {
  const brand = useBrand()
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    const cleanTo = to.trim()
    const cleanBody = body.trim()
    if (!cleanTo || !cleanBody) return
    setSending(true)
    try {
      const result = await sendSms(cleanTo, cleanBody)
      if (!result.ok) {
        toast(result.error ?? 'Failed to send SMS', { type: 'error' })
        setSending(false)
        return
      }
      toast('SMS sent')
      onClose()
      if (result.conversation_id) onSent(result.conversation_id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send SMS', { type: 'error' })
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        style={{ backdropFilter: 'blur(16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: grad(CHANNEL_META.sms.color), boxShadow: chipGlow(CHANNEL_META.sms.color) }}
            >
              <HugeiconsIcon icon={SmartPhone01Icon} size={15} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text)]">New SMS</h3>
              <p className="text-[10px] text-[var(--theme-muted)]">Text any phone number directly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {/* Phone number */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">
              To (phone number)
            </label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+1 555 000 0000"
              type="tel"
              autoFocus
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] transition-all duration-150 placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Message body */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Type your SMS…"
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-xs text-[var(--theme-text)] transition-all duration-150 placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  void submit()
                }
              }}
            />
            <p className="mt-0.5 text-right text-[10px] tabular-nums text-[var(--theme-muted)]">
              {body.length} / 160
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!to.trim() || !body.trim() || sending}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:opacity-90 disabled:opacity-50"
            style={{ background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) }}
          >
            <HugeiconsIcon icon={SmartPhone01Icon} size={12} />
            {sending ? 'Sending…' : 'Send SMS'}
          </button>
        </div>
      </div>
    </div>
  )
}

function timeAgo(value: string | null): string {
  if (!value) return ''
  try {
    const diff = Date.now() - new Date(value).getTime()
    if (diff < 60_000) return 'now'
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`
    return new Date(value).toLocaleDateString()
  } catch {
    return ''
  }
}

// ── WhatsApp compose modal ────────────────────────────────────────────────────
function WhatsAppComposeModal({
  onClose,
  onSent,
}: { onClose: () => void; onSent: (conversationId: string) => void }) {
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    const cleanTo = to.trim()
    const cleanBody = body.trim()
    if (!cleanTo || !cleanBody) return
    setSending(true)
    try {
      const result = await sendWhatsApp(cleanTo, cleanBody)
      if (!result.ok) {
        toast(result.error ?? 'Failed to send WhatsApp message', { type: 'error' })
        setSending(false)
        return
      }
      toast('WhatsApp message sent')
      onClose()
      if (result.conversation_id) onSent(result.conversation_id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send', { type: 'error' })
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl" style={{ backdropFilter: 'blur(16px)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: grad('#25d366'), boxShadow: chipGlow('#25d366') }}
            >
              <HugeiconsIcon icon={WhatsappIcon} size={15} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text)]">New WhatsApp</h3>
              <p className="text-[10px] text-[var(--theme-muted)]">Message any WhatsApp number</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-[var(--theme-muted)]" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">Phone number (with country code)</label>
            <input
              type="tel"
              placeholder="+1 555 000 0000"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[#25d366]"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">Message</label>
            <textarea
              placeholder="Type a message…"
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[#25d366]"
            />
            <p className="mt-1 text-right text-[10px] tabular-nums text-[var(--theme-muted)]">{body.length} chars · ⌘↵ send</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-3 py-1.5 text-xs text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]">Cancel</button>
          <button
            onClick={submit}
            disabled={sending || !to.trim() || !body.trim()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:opacity-90 disabled:opacity-40"
            style={{ background: grad('#25d366'), boxShadow: chipGlow('#25d366') }}
          >
            <HugeiconsIcon icon={SentIcon} size={12} />
            {sending ? 'Sending…' : 'Send WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_OPTIONS: ConvStatus[] = ['open', 'pending', 'snoozed', 'closed']

export function ConversationsScreen() {
  const brand = useBrand()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [showSmsCompose, setShowSmsCompose] = useState(false)
  const [showWaCompose, setShowWaCompose] = useState(false)

  const listQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => fetchConversations(),
    refetchInterval: 20_000,
  })

  const convQuery = useQuery({
    queryKey: selectedId ? convKey(selectedId) : ['platform', 'conversation', 'none'],
    queryFn: () => fetchConversation(selectedId as string),
    enabled: !!selectedId,
    refetchInterval: selectedId ? 15_000 : false,
  })

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    if (selectedId)
      void queryClient.invalidateQueries({ queryKey: convKey(selectedId) })
  }

  const sendMutation = useMutation({
    mutationFn: (p: { id: string; body: string }) =>
      sendMessage(p.id, { body: p.body, role: 'human', draft: false }),
    onSuccess: () => {
      setReply('')
      refreshAll()
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to send', {
        type: 'error',
      }),
  })

  const draftMutation = useMutation({
    mutationFn: (id: string) => requestAgentDraft(id),
    onSuccess: () => {
      refreshAll()
      toast('Agent drafted a reply — review before sending')
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Agent draft failed', {
        type: 'error',
      }),
  })

  const approveMutation = useMutation({
    mutationFn: (p: { id: string; messageId: string }) =>
      approveDraft(p.id, p.messageId),
    onSuccess: (result) => {
      refreshAll()
      if (result.send_warning) {
        toast(`Draft approved — delivery note: ${result.send_warning}`, { type: 'error' })
      } else {
        toast('Reply approved & sent')
      }
    },
  })

  const statusMutation = useMutation({
    mutationFn: (p: { id: string; status: ConvStatus }) =>
      updateConversation(p.id, { status: p.status }),
    onSuccess: refreshAll,
  })

  const conversations = listQuery.data ?? []
  const selected = convQuery.data ?? null

  const sortedMessages = useMemo(
    () => selected?.messages ?? [],
    [selected],
  )

  return (
    <div className="flex h-full min-h-0 bg-surface text-ink">
      {/* Thread list */}
      <aside
        className={cn(
          'flex w-full flex-col border-r md:w-80',
          selectedId ? 'hidden md:flex' : 'flex',
        )}
        style={{
          background: 'var(--theme-sidebar-bg)',
          borderColor: 'var(--theme-sidebar-border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) }}
            >
              <HugeiconsIcon icon={InboxIcon} size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--theme-text)]">
                Conversations
              </h1>
              <p className="text-[10px] tabular-nums text-[var(--theme-muted)]">
                {conversations.length} thread{conversations.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:opacity-90"
              style={{ background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) }}
              title="New conversation"
            >
              <HugeiconsIcon icon={Add01Icon} size={13} />
              New
            </button>
            <button
              onClick={() => setShowSmsCompose(true)}
              className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
              title="New SMS"
            >
              <HugeiconsIcon icon={SmartPhone01Icon} size={13} style={{ color: CHANNEL_META.sms.color }} />
              SMS
            </button>
            <button
              onClick={() => setShowWaCompose(true)}
              className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--theme-text)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
              title="New WhatsApp"
            >
              <HugeiconsIcon icon={WhatsappIcon} size={13} className="text-[#25d366]" />
              WA
            </button>
            <button
              onClick={refreshAll}
              className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
              title="Refresh"
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={15}
                className="text-[var(--theme-muted)]"
              />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {listQuery.isLoading ? (
            <div className="animate-pulse space-y-0">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex flex-col gap-1.5 border-b border-[var(--theme-border)] px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-3 w-28 rounded bg-[var(--theme-card)] opacity-60" />
                    <div className="h-2.5 w-8 rounded bg-[var(--theme-card)] opacity-40" />
                  </div>
                  <div className="h-2.5 w-3/4 rounded bg-[var(--theme-card)] opacity-40" />
                </div>
              ))}
            </div>
          ) : listQuery.isError ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: `linear-gradient(135deg, color-mix(in srgb, #ef4444 14%, var(--theme-card)), color-mix(in srgb, #ef4444 5%, var(--theme-card)))` }}
              >
                <HugeiconsIcon icon={AlertCircleIcon} size={22} style={{ color: '#ef4444' }} />
              </div>
              <p className="text-sm font-semibold text-[var(--theme-text)]">Couldn't load conversations</p>
              <p className="mt-1 text-xs text-[var(--theme-muted)]">Check your connection and try again.</p>
              <button
                onClick={() => void listQuery.refetch()}
                className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:opacity-90"
                style={{ background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) }}
              >
                <HugeiconsIcon icon={RefreshIcon} size={12} />
                Retry
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${brand.accentColor} 16%, var(--theme-card)), color-mix(in srgb, ${brand.accentColor} 5%, var(--theme-card)))`,
                }}
              >
                <HugeiconsIcon icon={InboxIcon} size={26} style={{ color: brand.accentColor }} />
              </div>
              <p className="text-sm font-semibold text-[var(--theme-text)]">All caught up!</p>
              <p className="mt-1 text-xs text-[var(--theme-muted)]">
                Web-chat, SMS, and WhatsApp messages will land here.
              </p>
              <button
                onClick={() => setShowCompose(true)}
                className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:opacity-90"
                style={{ background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) }}
              >
                <HugeiconsIcon icon={Add01Icon} size={12} />
                Start a conversation
              </button>
            </div>
          ) : (
            conversations.map((c: Conversation) => {
              const isActive = selectedId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="flex w-full flex-col gap-1 border-b border-[var(--theme-border)] px-4 py-3 text-left transition-all duration-150 hover:bg-[var(--theme-hover)]"
                  style={{
                    boxShadow: isActive ? `inset 3px 0 0 ${brand.accentColor}` : undefined,
                    background: isActive
                      ? `color-mix(in srgb, ${brand.accentColor} 8%, transparent)`
                      : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {c.unread && (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background: brand.accentColor,
                            boxShadow: `0 0 6px color-mix(in srgb, ${brand.accentColor} 60%, transparent)`,
                          }}
                        />
                      )}
                      <span
                        className={cn(
                          'truncate text-sm text-[var(--theme-text)]',
                          c.unread ? 'font-bold' : 'font-medium',
                        )}
                      >
                        {c.contact_name || 'Unknown'}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-[var(--theme-muted)]">
                      {timeAgo(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChannelBadge channel={c.channel} />
                    <span
                      className={cn(
                        'truncate text-xs text-[var(--theme-muted)]',
                        c.unread && 'font-medium text-[var(--theme-text)]',
                      )}
                    >
                      {c.last_message_preview || 'No messages'}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Thread view */}
      <main
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          selectedId ? 'flex' : 'hidden md:flex',
        )}
      >
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${brand.accentColor} 14%, var(--theme-card)), color-mix(in srgb, ${brand.accentColor} 4%, var(--theme-card)))`,
              }}
            >
              <HugeiconsIcon icon={InboxIcon} size={26} style={{ color: brand.accentColor, opacity: 0.8 }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--theme-text)]">Select a conversation</p>
              <p className="mt-1 text-xs text-[var(--theme-muted)]">Pick a thread from the inbox to read and reply.</p>
            </div>
          </div>
        ) : (
          <>
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{
                background: 'var(--theme-sidebar-bg)',
                borderColor: 'var(--theme-sidebar-border)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg px-2 py-1 text-xs text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] md:hidden"
                >
                  ← Back
                </button>
                <div>
                  <p className="text-sm font-semibold text-[var(--theme-text)]">
                    {selected.contact_name || 'Unknown'}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <ChannelBadge channel={selected.channel} />
                  </div>
                </div>
              </div>
              <select
                value={selected.status}
                onChange={(e) =>
                  statusMutation.mutate({
                    id: selected.id,
                    status: e.target.value as ConvStatus,
                  })
                }
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs capitalize text-[var(--theme-text)] transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {sortedMessages.map((m, i) => {
                const isInbound = m.role === 'contact'
                const prev = i > 0 ? sortedMessages[i - 1] : null
                const showDivider =
                  !prev || dateLabel(prev.created_at) !== dateLabel(m.created_at)
                return (
                  <div key={m.id}>
                    {showDivider && (
                      <div className="mb-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-[var(--theme-border)]" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--theme-muted)]">
                          {dateLabel(m.created_at)}
                        </span>
                        <div className="h-px flex-1 bg-[var(--theme-border)]" />
                      </div>
                    )}
                    <div
                      className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}
                    >
                      {m.draft ? (
                        /* Agent draft — distinct AI-tinted card, controls preserved */
                        <div
                          className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                          style={{
                            background: `color-mix(in srgb, ${AI_PURPLE} 9%, var(--theme-card))`,
                            border: `1px solid color-mix(in srgb, ${AI_PURPLE} 35%, var(--theme-border))`,
                            color: 'var(--theme-text)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: `0 2px 10px color-mix(in srgb, ${AI_PURPLE} 14%, transparent)`,
                          }}
                        >
                          <div
                            className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: AI_PURPLE }}
                          >
                            <HugeiconsIcon icon={AiMagicIcon} size={11} />
                            Agent draft — review
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.body}
                          </p>
                          <div className="mt-1.5 flex items-center justify-end gap-2 text-[9px] text-[var(--theme-muted)]">
                            <span className="uppercase tracking-wide">{m.role}</span>
                            <span className="tabular-nums">{timeAgo(m.created_at)}</span>
                            <button
                              onClick={() =>
                                approveMutation.mutate({
                                  id: selected.id,
                                  messageId: m.id,
                                })
                              }
                              className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-white transition-all duration-150 hover:opacity-90"
                              style={{ background: grad(AI_PURPLE), boxShadow: chipGlow(AI_PURPLE) }}
                            >
                              <HugeiconsIcon
                                icon={CheckmarkCircle01Icon}
                                size={10}
                              />
                              Approve & send
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                          style={
                            isInbound
                              ? {
                                  background: 'var(--theme-card)',
                                  border: '1px solid var(--theme-border)',
                                  color: 'var(--theme-text)',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                  backdropFilter: 'blur(10px)',
                                  borderBottomLeftRadius: '6px',
                                }
                              : {
                                  background: grad(brand.accentColor),
                                  color: 'white',
                                  boxShadow: `0 2px 14px color-mix(in srgb, ${brand.accentColor} 30%, transparent)`,
                                  borderBottomRightRadius: '6px',
                                }
                          }
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.body}
                          </p>
                          <div className="mt-1 flex items-center justify-end gap-2 text-[9px] opacity-70">
                            <span className="uppercase tracking-wide">{m.role}</span>
                            <span className="tabular-nums">{timeAgo(m.created_at)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              className="border-t p-3"
              style={{
                background: 'var(--theme-sidebar-bg)',
                borderColor: 'var(--theme-sidebar-border)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => draftMutation.mutate(selected.id)}
                  disabled={draftMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-150 hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: `color-mix(in srgb, ${AI_PURPLE} 9%, var(--theme-card))`,
                    borderColor: `color-mix(in srgb, ${AI_PURPLE} 35%, var(--theme-border))`,
                    color: AI_PURPLE,
                  }}
                >
                  <HugeiconsIcon icon={AiMagicIcon} size={13} />
                  {draftMutation.isPending ? 'Drafting…' : 'Ask agent to draft'}
                </button>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a reply… (⌘⏎ to send)"
                  rows={2}
                  className="flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none transition-all duration-150"
                  style={{
                    background: 'var(--theme-input)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--theme-accent)'
                    e.currentTarget.style.boxShadow = 'var(--theme-glow)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--theme-border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      if (reply.trim())
                        sendMutation.mutate({ id: selected.id, body: reply })
                    }
                  }}
                />
                <button
                  onClick={() =>
                    reply.trim() &&
                    sendMutation.mutate({ id: selected.id, body: reply })
                  }
                  disabled={!reply.trim() || sendMutation.isPending}
                  className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-white transition-all duration-150 hover:opacity-90 disabled:opacity-50"
                  style={{ background: grad(brand.accentColor), boxShadow: chipGlow(brand.accentColor) }}
                >
                  <HugeiconsIcon icon={SentIcon} size={14} />
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {showCompose && (
        <QuickComposeModal
          onClose={() => setShowCompose(false)}
          onCreated={(id) => {
            void queryClient.invalidateQueries({ queryKey: LIST_KEY })
            setSelectedId(id)
          }}
        />
      )}

      {showWaCompose && (
        <WhatsAppComposeModal
          onClose={() => setShowWaCompose(false)}
          onSent={(id) => {
            void queryClient.invalidateQueries({ queryKey: LIST_KEY })
            setSelectedId(id)
          }}
        />
      )}

      {showSmsCompose && (
        <SmsComposeModal
          onClose={() => setShowSmsCompose(false)}
          onSent={(id) => {
            void queryClient.invalidateQueries({ queryKey: LIST_KEY })
            setSelectedId(id)
          }}
        />
      )}
    </div>
  )
}
