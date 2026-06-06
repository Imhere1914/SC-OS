
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiMagicIcon,
  CheckmarkCircle01Icon,
  InboxIcon,
  RefreshIcon,
  SentIcon,
} from '@hugeicons/core-free-icons'
import {
  CHANNEL_LABELS,
  approveDraft,
  fetchConversation,
  fetchConversations,
  requestAgentDraft,
  sendMessage,
  updateConversation,
} from '@/lib/conversations-api'
import type { Conversation, ConvStatus } from '@/lib/conversations-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'

const LIST_KEY = ['platform', 'conversations'] as const
const convKey = (id: string) => ['platform', 'conversation', id] as const

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

const STATUS_OPTIONS: ConvStatus[] = ['open', 'pending', 'snoozed', 'closed']

export function ConversationsScreen() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')

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
          'flex w-full flex-col border-r border-[var(--theme-border)] md:w-80',
          selectedId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={InboxIcon}
              size={18}
              className="text-[var(--theme-accent)]"
            />
            <h1 className="text-sm font-semibold text-[var(--theme-text)]">
              Conversations
            </h1>
            <span className="text-xs text-[var(--theme-muted)]">
              ({conversations.length})
            </span>
          </div>
          <button
            onClick={refreshAll}
            className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
            title="Refresh"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              size={15}
              className="text-[var(--theme-muted)]"
            />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {listQuery.isLoading ? (
            <p className="p-4 text-xs text-[var(--theme-muted)]">Loading…</p>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-[var(--theme-muted)]">
              <HugeiconsIcon
                icon={InboxIcon}
                size={28}
                className="mb-2 opacity-40"
              />
              <p className="text-sm font-medium">Inbox is empty</p>
              <p className="mt-1 text-xs">
                Web-chat, SMS, and WhatsApp messages will land here.
              </p>
            </div>
          ) : (
            conversations.map((c: Conversation) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'flex w-full flex-col gap-1 border-b border-[var(--theme-border)] px-4 py-3 text-left transition-colors hover:bg-[var(--theme-hover)]',
                  selectedId === c.id && 'bg-[var(--theme-hover)]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.unread && (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: 'var(--theme-accent)' }}
                      />
                    )}
                    <span className="truncate text-sm font-medium text-[var(--theme-text)]">
                      {c.contact_name || 'Unknown'}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] text-[var(--theme-muted)]">
                    {timeAgo(c.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
                    style={{
                      background: 'var(--theme-bg)',
                      color: 'var(--theme-muted)',
                    }}
                  >
                    {CHANNEL_LABELS[c.channel]}
                  </span>
                  <span className="truncate text-xs text-[var(--theme-muted)]">
                    {c.last_message_preview || 'No messages'}
                  </span>
                </div>
              </button>
            ))
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
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--theme-muted)]">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg px-2 py-1 text-xs text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] md:hidden"
                >
                  ← Back
                </button>
                <div>
                  <p className="text-sm font-semibold text-[var(--theme-text)]">
                    {selected.contact_name || 'Unknown'}
                  </p>
                  <p className="text-[10px] text-[var(--theme-muted)]">
                    {CHANNEL_LABELS[selected.channel]}
                  </p>
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
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1 text-xs text-[var(--theme-text)]"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {sortedMessages.map((m) => {
                const isInbound = m.role === 'contact'
                return (
                  <div
                    key={m.id}
                    className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                        isInbound
                          ? 'bg-[var(--theme-card)] text-[var(--theme-text)]'
                          : 'text-white',
                        m.draft && 'ring-2 ring-[var(--theme-warning)]',
                      )}
                      style={
                        !isInbound
                          ? { background: 'var(--theme-accent)' }
                          : undefined
                      }
                    >
                      {m.draft && (
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-warning)]">
                          <HugeiconsIcon icon={AiMagicIcon} size={11} />
                          Draft — review
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {m.body}
                      </p>
                      <div className="mt-1 flex items-center justify-end gap-2 text-[9px] opacity-70">
                        <span>{m.role}</span>
                        <span>{timeAgo(m.created_at)}</span>
                        {m.draft && (
                          <button
                            onClick={() =>
                              approveMutation.mutate({
                                id: selected.id,
                                messageId: m.id,
                              })
                            }
                            className="flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 font-medium hover:bg-white/30"
                          >
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              size={10}
                            />
                            Approve & send
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-[var(--theme-border)] p-3">
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => draftMutation.mutate(selected.id)}
                  disabled={draftMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-2.5 py-1 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-hover)] disabled:opacity-50"
                >
                  <HugeiconsIcon icon={AiMagicIcon} size={13} />
                  {draftMutation.isPending ? 'Drafting…' : 'Ask agent to draft'}
                </button>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a reply…"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
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
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--theme-accent)' }}
                >
                  <HugeiconsIcon icon={SentIcon} size={14} />
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
