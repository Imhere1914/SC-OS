/**
 * Conversations API client — native /api/conversations routes.
 */

const API = '/api/conversations'

export type ConvChannel =
  | 'webchat'
  | 'sms'
  | 'whatsapp'
  | 'email'
  | 'social'
  | 'manual'
export type ConvStatus = 'open' | 'pending' | 'snoozed' | 'closed'
export type MessageRole = 'contact' | 'agent' | 'human' | 'system'

export type ConvMessage = {
  id: string
  role: MessageRole
  author: string | null
  body: string
  draft: boolean
  created_at: string
}

export type Conversation = {
  id: string
  contact_id: string | null
  contact_name: string | null
  channel: ConvChannel
  subject: string | null
  status: ConvStatus
  assignee: string | null
  unread: boolean
  last_message_at: string | null
  last_message_preview: string
  messages: ConvMessage[]
  created_at: string
  updated_at: string
}

export const CHANNEL_LABELS: Record<ConvChannel, string> = {
  webchat: 'Web Chat',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
  social: 'Social',
  manual: 'Manual',
}

export async function fetchConversations(params?: {
  status?: string
  channel?: string
}): Promise<Conversation[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.channel) qs.set('channel', params.channel)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load conversations (${res.status})`)
  const data = (await res.json()) as { conversations?: Conversation[] }
  return Array.isArray(data.conversations) ? data.conversations : []
}

export async function fetchConversation(id: string): Promise<Conversation> {
  const res = await fetch(`${API}/${id}`)
  if (!res.ok) throw new Error(`Failed to load conversation (${res.status})`)
  const data = (await res.json()) as { conversation: Conversation }
  return data.conversation
}

export async function sendMessage(
  id: string,
  message: {
    body: string
    role?: MessageRole
    author?: string | null
    draft?: boolean
  },
): Promise<Conversation> {
  const res = await fetch(`${API}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to send (${res.status})`)
  }
  const data = (await res.json()) as { conversation: Conversation }
  return data.conversation
}

export async function approveDraft(
  id: string,
  messageId: string,
): Promise<{ conversation: Conversation; send_warning?: string }> {
  const res = await fetch(`${API}/${id}?action=approve-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId }),
  })
  if (!res.ok) throw new Error(`Failed to approve draft (${res.status})`)
  const data = (await res.json()) as { conversation: Conversation; send_warning?: string }
  return data
}

export async function updateConversation(
  id: string,
  updates: { status?: ConvStatus; assignee?: string | null; unread?: boolean },
): Promise<Conversation> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`Failed to update conversation (${res.status})`)
  const data = (await res.json()) as { conversation: Conversation }
  return data.conversation
}

/** Ask the agent to draft a reply for this conversation (saved as a draft message). */
export async function requestAgentDraft(id: string): Promise<Conversation> {
  const res = await fetch(`/api/webchat/agent-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: id }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Agent draft failed (${res.status})`)
  }
  const data = (await res.json()) as { conversation: Conversation }
  return data.conversation
}
