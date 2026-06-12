/**
 * Team Chat — internal Slack-style chat: channels, DMs, mentions, unread
 * tracking, and Hermes (the AI) available in-channel via @hermes.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AiMagicIcon,
  Cancel01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  SentIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  name: string
  avatar_color?: string
  active: boolean
}

interface Channel {
  id: string
  type: 'channel' | 'dm'
  name: string
  description?: string
  member_ids: string[]
  is_private: boolean
  last_message_at?: string
  unread_count: number
}

interface Message {
  id: string
  channel_id: string
  author_id: string
  author_name: string
  body: string
  mentions: string[]
  is_ai: boolean
  edited_at?: string
  created_at: string
}

interface Identity {
  id: string
  name: string
}

const IDENTITY_KEY = 'team_chat_identity'

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Identity>
    if (typeof p.id === 'string' && typeof p.name === 'string') return { id: p.id, name: p.name }
    return null
  } catch {
    return null
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dateLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, today)) return 'Today'
  if (same(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Render @mentions highlighted. */
function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(@[\w][\w.-]*)/g)
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span
            key={i}
            className="rounded px-0.5 font-medium"
            style={{ color: 'var(--theme-accent)', background: 'var(--theme-accent-soft)' }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

function Avatar({ name, color, isAi, size = 32 }: { name: string; color?: string; isAi?: boolean; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
      style={{
        width: size,
        height: size,
        background: isAi
          ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
          : (color ?? 'var(--theme-accent)'),
      }}
    >
      {isAi ? <HugeiconsIcon icon={AiMagicIcon} size={size * 0.5} /> : initials(name)}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function TeamChatScreen() {
  const brand = useBrand()
  const queryClient = useQueryClient()
  const [identity, setIdentity] = useState<Identity | null>(loadIdentity)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [showNewDm, setShowNewDm] = useState(false)
  const [showEditChannel, setShowEditChannel] = useState(false)
  const [showIdentityPicker, setShowIdentityPicker] = useState(false)
  const [hermesWaitingSince, setHermesWaitingSince] = useState<string | null>(null)

  const brandQ = `?brand=${brand.id}`

  const membersQuery = useQuery<TeamMember[]>({
    queryKey: ['team-chat', 'members', brand.id],
    queryFn: async () => {
      const res = await fetch(`/api/team${brandQ}`)
      if (!res.ok) throw new Error('Failed to load team')
      const d = (await res.json()) as { members?: TeamMember[] }
      return d.members ?? []
    },
  })
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])

  const channelsQuery = useQuery<Channel[]>({
    queryKey: ['team-chat', 'channels', brand.id, identity?.id],
    queryFn: async () => {
      const memberParam = identity ? `&member_id=${identity.id}` : ''
      const res = await fetch(`/api/team-chat/channels${brandQ}${memberParam}`)
      if (!res.ok) throw new Error('Failed to load channels')
      const d = (await res.json()) as { channels?: Channel[] }
      return d.channels ?? []
    },
    enabled: !!identity,
    refetchInterval: 5000,
  })
  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data])

  const regularChannels = channels.filter((ch) => ch.type === 'channel')
  const dms = channels.filter((ch) => ch.type === 'dm')

  // pick the first channel automatically
  useEffect(() => {
    if (!activeChannelId && regularChannels.length > 0) {
      setActiveChannelId(regularChannels[0].id)
    }
  }, [activeChannelId, regularChannels])

  const activeChannel = channels.find((ch) => ch.id === activeChannelId) ?? null

  const messagesQuery = useQuery<Message[]>({
    queryKey: ['team-chat', 'messages', brand.id, activeChannelId],
    queryFn: async () => {
      const res = await fetch(`/api/team-chat/channels/${activeChannelId}/messages${brandQ}&limit=100`)
      if (!res.ok) throw new Error('Failed to load messages')
      const d = (await res.json()) as { messages?: Message[] }
      return d.messages ?? []
    },
    enabled: !!activeChannelId && !!identity,
    refetchInterval: 3000,
  })
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data])

  // Mark read when the open channel's latest message changes
  const latestMessageId = messages.length > 0 ? messages[messages.length - 1].id : null
  useEffect(() => {
    if (!identity || !activeChannelId || !latestMessageId) return
    const t = setTimeout(() => {
      void fetch(`/api/team-chat/channels/${activeChannelId}/read${brandQ}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: identity.id }),
      }).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['team-chat', 'channels', brand.id] })
      })
    }, 400)
    return () => clearTimeout(t)
  }, [identity, activeChannelId, latestMessageId, brandQ, brand.id, queryClient])

  // Hermes typing indicator: clear when an AI message newer than the wait start appears, or after 20s
  useEffect(() => {
    if (!hermesWaitingSince) return
    const found = messages.some((m) => m.is_ai && m.created_at > hermesWaitingSince)
    if (found) {
      setHermesWaitingSince(null)
      return
    }
    const t = setTimeout(() => setHermesWaitingSince(null), 20_000)
    return () => clearTimeout(t)
  }, [hermesWaitingSince, messages])

  const saveIdentity = (m: TeamMember) => {
    const id: Identity = { id: m.id, name: m.name }
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id))
    setIdentity(id)
    setShowIdentityPicker(false)
  }

  // ── Setup states ──────────────────────────────────────────────────────────
  if (membersQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-[var(--theme-muted)]">Loading team…</p>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
          style={{ background: 'linear-gradient(135deg, var(--theme-accent), #000)' }}
        >
          <HugeiconsIcon icon={UserGroupIcon} size={22} />
        </div>
        <h2 className="text-[16px] font-semibold text-[var(--theme-text)]">Add team members first</h2>
        <p className="max-w-sm text-[12px] text-[var(--theme-muted)]">
          Team Chat is for your people. Add team members and then come back to start chatting —
          channels, DMs, and @hermes will be waiting.
        </p>
        <Link
          to="/team"
          className="rounded-lg px-4 py-2 text-[12px] font-semibold text-white"
          style={{ background: 'var(--theme-accent)' }}
        >
          Go to Team
        </Link>
      </div>
    )
  }

  if (!identity || showIdentityPicker) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-[16px] font-semibold text-[var(--theme-text)]">Who are you?</h2>
        <p className="text-[12px] text-[var(--theme-muted)]">Pick your identity so messages and unread counts are yours.</p>
        <div className="flex w-full max-w-xs flex-col gap-1.5">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => saveIdentity(m)}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-left transition-colors hover:bg-[var(--theme-hover)]"
            >
              <Avatar name={m.name} color={m.avatar_color} size={28} />
              <span className="text-[13px] font-medium text-[var(--theme-text)]">{m.name}</span>
            </button>
          ))}
        </div>
        {identity && (
          <button
            onClick={() => setShowIdentityPicker(false)}
            className="text-[11px] text-[var(--theme-muted)] underline"
          >
            Cancel
          </button>
        )}
      </div>
    )
  }

  const openDm = async (otherId: string) => {
    try {
      const res = await fetch(`/api/team-chat/dm${brandQ}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: [identity.id, otherId] }),
      })
      if (!res.ok) throw new Error('Failed to open DM')
      const d = (await res.json()) as { channel: Channel }
      await queryClient.invalidateQueries({ queryKey: ['team-chat', 'channels', brand.id] })
      setActiveChannelId(d.channel.id)
      setShowNewDm(false)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to open DM', { type: 'error' })
    }
  }

  const dmDisplayName = (ch: Channel): string => {
    const others = ch.member_ids.filter((id) => id !== identity.id)
    const names = others.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean)
    return names.length > 0 ? (names as string[]).join(', ') : ch.name
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="flex w-[240px] shrink-0 flex-col border-r border-[var(--theme-border)] bg-[var(--theme-card)]">
        <div className="flex items-center justify-between px-3.5 pb-2 pt-4">
          <h1 className="text-[14px] font-bold text-[var(--theme-text)]">Team Chat</h1>
          <button
            onClick={() => setShowNewChannel(true)}
            title="New channel"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
          >
            <HugeiconsIcon icon={Add01Icon} size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
            Channels
          </div>
          {regularChannels.map((ch) => (
            <ChannelRow
              key={ch.id}
              label={ch.name}
              unread={ch.unread_count}
              active={ch.id === activeChannelId}
              onClick={() => setActiveChannelId(ch.id)}
            />
          ))}

          <div className="mb-1 mt-4 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-70">
              Direct Messages
            </span>
          </div>
          {dms.map((ch) => (
            <ChannelRow
              key={ch.id}
              label={dmDisplayName(ch)}
              unread={ch.unread_count}
              active={ch.id === activeChannelId}
              onClick={() => setActiveChannelId(ch.id)}
            />
          ))}
          <button
            onClick={() => setShowNewDm(true)}
            className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
          >
            + New DM
          </button>
        </div>

        {/* Identity footer */}
        <div className="flex items-center gap-2 border-t border-[var(--theme-border)] px-3 py-2.5">
          <Avatar
            name={identity.name}
            color={members.find((m) => m.id === identity.id)?.avatar_color}
            size={26}
          />
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--theme-text)]">
            {identity.name}
          </span>
          <button
            onClick={() => setShowIdentityPicker(true)}
            className="shrink-0 text-[10px] text-[var(--theme-muted)] underline hover:text-[var(--theme-text)]"
          >
            change
          </button>
        </div>
      </div>

      {/* ── Main pane ── */}
      {activeChannel ? (
        <ChannelPane
          key={activeChannel.id}
          channel={activeChannel}
          displayName={activeChannel.type === 'dm' ? dmDisplayName(activeChannel) : activeChannel.name}
          identity={identity}
          members={members}
          messages={messages}
          brandQ={brandQ}
          brandId={brand.id}
          hermesWaiting={!!hermesWaitingSince}
          onSentMentioningHermes={(sentAt) => setHermesWaitingSince(sentAt)}
          onEditChannel={() => setShowEditChannel(true)}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[13px] text-[var(--theme-muted)]">Pick a channel to start chatting</p>
        </div>
      )}

      {/* ── Modals ── */}
      {showNewChannel && (
        <ChannelModal
          title="New Channel"
          members={members}
          brandQ={brandQ}
          identity={identity}
          onClose={() => setShowNewChannel(false)}
          onSaved={async (id) => {
            setShowNewChannel(false)
            await queryClient.invalidateQueries({ queryKey: ['team-chat', 'channels', brand.id] })
            if (id) setActiveChannelId(id)
          }}
        />
      )}
      {showEditChannel && activeChannel && (
        <ChannelModal
          title="Edit Channel"
          members={members}
          brandQ={brandQ}
          identity={identity}
          existing={activeChannel}
          onClose={() => setShowEditChannel(false)}
          onSaved={async () => {
            setShowEditChannel(false)
            await queryClient.invalidateQueries({ queryKey: ['team-chat', 'channels', brand.id] })
          }}
        />
      )}
      {showNewDm && (
        <Modal title="New Direct Message" onClose={() => setShowNewDm(false)}>
          <div className="flex flex-col gap-1.5">
            {members
              .filter((m) => m.id !== identity.id)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => void openDm(m.id)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--theme-hover)]"
                >
                  <Avatar name={m.name} color={m.avatar_color} size={26} />
                  <span className="text-[13px] text-[var(--theme-text)]">{m.name}</span>
                </button>
              ))}
            {members.filter((m) => m.id !== identity.id).length === 0 && (
              <p className="px-1 py-2 text-[12px] text-[var(--theme-muted)]">No other team members yet.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sidebar row ───────────────────────────────────────────────────────────────

function ChannelRow({
  label,
  unread,
  active,
  onClick,
}: {
  label: string
  unread: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors',
        active
          ? 'text-[var(--theme-accent)]'
          : unread > 0
            ? 'font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-hover)]'
            : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]'
      )}
      style={active ? { background: 'var(--theme-accent-soft)' } : undefined}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {unread > 0 && (
        <span
          className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white"
          style={{ background: 'var(--theme-accent)' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}

// ── Channel pane (header + messages + composer) ───────────────────────────────

function ChannelPane({
  channel,
  displayName,
  identity,
  members,
  messages,
  brandQ,
  brandId,
  hermesWaiting,
  onSentMentioningHermes,
  onEditChannel,
}: {
  channel: Channel
  displayName: string
  identity: Identity
  members: TeamMember[]
  messages: Message[]
  brandQ: string
  brandId: string
  hermesWaiting: boolean
  onSentMentioningHermes: (sentAt: string) => void
  onEditChannel: () => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef<string | null>(null)

  // Auto-scroll to bottom when new messages arrive
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : null
  useEffect(() => {
    if (lastId && lastId !== lastIdRef.current) {
      lastIdRef.current = lastId
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [lastId])

  const invalidateMessages = () =>
    queryClient.invalidateQueries({ queryKey: ['team-chat', 'messages', brandId, channel.id] })

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/team-chat/channels/${channel.id}/messages${brandQ}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_id: identity.id, author_name: identity.name, body }),
      })
      if (!res.ok) throw new Error('Failed to send message')
      return (await res.json()) as { message: Message }
    },
    onSuccess: (d) => {
      void invalidateMessages()
      if (d.message.mentions.includes('hermes')) onSentMentioningHermes(d.message.created_at)
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to send', { type: 'error' }),
  })

  const send = () => {
    const body = draft.trim()
    if (!body || sendMutation.isPending) return
    setDraft('')
    sendMutation.mutate(body)
  }

  const saveEdit = async (messageId: string) => {
    const body = editDraft.trim()
    if (!body) return
    try {
      const res = await fetch(`/api/team-chat/channels/${channel.id}/messages/${messageId}${brandQ}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error('Failed to edit message')
      setEditingId(null)
      await invalidateMessages()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to edit', { type: 'error' })
    }
  }

  const removeMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/team-chat/channels/${channel.id}/messages/${messageId}${brandQ}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete message')
      await invalidateMessages()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete', { type: 'error' })
    }
  }

  // Group messages: new group when author changes or >5 min gap; date dividers
  type Row =
    | { kind: 'date'; label: string; key: string }
    | { kind: 'message'; msg: Message; first: boolean }
  const rows: Row[] = []
  let prev: Message | null = null
  for (const m of messages) {
    if (!prev || dayKey(prev.created_at) !== dayKey(m.created_at)) {
      rows.push({ kind: 'date', label: dateLabel(m.created_at), key: `d-${m.id}` })
      prev = null
    }
    const first =
      !prev ||
      prev.author_id !== m.author_id ||
      new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000
    rows.push({ kind: 'message', msg: m, first })
    prev = m
  }

  const memberColor = (authorId: string) => members.find((m) => m.id === authorId)?.avatar_color

  const memberCount =
    channel.type === 'dm' || channel.is_private
      ? channel.member_ids.length
      : channel.member_ids.length > 0
        ? channel.member_ids.length
        : members.length

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--theme-border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[14px] font-bold text-[var(--theme-text)]">{displayName}</h2>
            <span className="shrink-0 text-[10px] text-[var(--theme-muted)]">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
          {channel.description && (
            <p className="truncate text-[11px] text-[var(--theme-muted)]">{channel.description}</p>
          )}
        </div>
        {channel.type === 'channel' && (
          <button
            onClick={onEditChannel}
            title="Edit channel"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-[12px] text-[var(--theme-muted)]">
              No messages yet — say hi, or ask @hermes something.
            </p>
          </div>
        )}
        {rows.map((row) =>
          row.kind === 'date' ? (
            <div key={row.key} className="my-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--theme-border)]" />
              <span className="text-[10px] font-semibold text-[var(--theme-muted)]">{row.label}</span>
              <div className="h-px flex-1 bg-[var(--theme-border)]" />
            </div>
          ) : (
            <div
              key={row.msg.id}
              className={cn(
                'group flex gap-2.5 rounded-lg px-2 hover:bg-[var(--theme-hover)]',
                row.first ? 'mt-2 pt-1.5' : 'mt-0'
              )}
            >
              <div className="w-8 shrink-0">
                {row.first && (
                  <Avatar
                    name={row.msg.author_name}
                    color={memberColor(row.msg.author_id)}
                    isAi={row.msg.is_ai}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                {row.first && (
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-[12.5px] font-bold"
                      style={{ color: row.msg.is_ai ? '#8b5cf6' : 'var(--theme-text)' }}
                    >
                      {row.msg.author_name}
                    </span>
                    <span className="text-[10px] text-[var(--theme-muted)]">
                      {timeLabel(row.msg.created_at)}
                    </span>
                  </div>
                )}
                {editingId === row.msg.id ? (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveEdit(row.msg.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-[12.5px] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    />
                    <button
                      onClick={() => void saveEdit(row.msg.id)}
                      className="rounded-md px-2 py-1 text-[10px] font-semibold text-white"
                      style={{ background: 'var(--theme-accent)' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md p-1 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="text-[12.5px] leading-relaxed text-[var(--theme-text)]">
                    <MessageBody body={row.msg.body} />
                    {row.msg.edited_at && (
                      <span className="ml-1.5 text-[9px] text-[var(--theme-muted)]">(edited)</span>
                    )}
                  </p>
                )}
              </div>
              {row.msg.author_id === identity.id && editingId !== row.msg.id && (
                <div className="hidden shrink-0 items-start gap-0.5 pt-1 group-hover:flex">
                  <button
                    onClick={() => {
                      setEditingId(row.msg.id)
                      setEditDraft(row.msg.body)
                    }}
                    title="Edit"
                    className="rounded-md p-1 text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} size={12} />
                  </button>
                  <button
                    onClick={() => void removeMessage(row.msg.id)}
                    title="Delete"
                    className="rounded-md p-1 text-[var(--theme-muted)] hover:text-red-500"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {hermesWaiting && (
          <div className="mt-2 flex items-center gap-2.5 px-2">
            <Avatar name="Hermes" isAi size={24} />
            <span className="text-[11px] italic text-[var(--theme-muted)]">Hermes is thinking…</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--theme-border)] p-3">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split('\n').length))}
            placeholder={`Message ${displayName} — use @hermes to ask the AI`}
            className="max-h-32 flex-1 resize-none bg-transparent text-[12.5px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sendMutation.isPending}
            title="Send"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
            style={{ background: 'var(--theme-accent)' }}
          >
            <HugeiconsIcon icon={SentIcon} size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[var(--theme-text)]">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ChannelModal({
  title,
  members,
  brandQ,
  identity,
  existing,
  onClose,
  onSaved,
}: {
  title: string
  members: TeamMember[]
  brandQ: string
  identity: Identity
  existing?: Channel
  onClose: () => void
  onSaved: (id?: string) => void | Promise<void>
}) {
  const [name, setName] = useState(existing?.name.replace(/^#/, '') ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false)
  const [memberIds, setMemberIds] = useState<string[]>(existing?.member_ids ?? [identity.id])
  const [saving, setSaving] = useState(false)

  const toggleMember = (id: string) =>
    setMemberIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const save = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
        member_ids: isPrivate ? memberIds : [],
        created_by: identity.id,
      }
      const url = existing
        ? `/api/team-chat/channels/${existing.id}${brandQ}`
        : `/api/team-chat/channels${brandQ}`
      const res = await fetch(url, {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(existing ? 'Failed to update channel' : 'Failed to create channel')
      const d = (await res.json()) as { channel?: Channel }
      toast(existing ? 'Channel updated' : 'Channel created')
      await onSaved(d.channel?.id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save channel', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
            Name
          </label>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5">
            <span className="text-[13px] text-[var(--theme-muted)]">#</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.replace(/^#/, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save()
              }}
              placeholder="marketing"
              className="flex-1 bg-transparent text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this channel about?"
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2.5 py-1.5 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-[var(--theme-text)]">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="accent-[var(--theme-accent)]"
          />
          Private channel
        </label>
        {isPrivate && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--theme-border)] p-1.5">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12px] text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
              >
                <input
                  type="checkbox"
                  checked={memberIds.includes(m.id)}
                  onChange={() => toggleMember(m.id)}
                  className="accent-[var(--theme-accent)]"
                />
                {m.name}
              </label>
            ))}
          </div>
        )}
        <button
          onClick={() => void save()}
          disabled={!name.trim() || saving}
          className="rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: 'var(--theme-accent)' }}
        >
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Channel'}
        </button>
      </div>
    </Modal>
  )
}
