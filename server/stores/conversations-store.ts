import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Conversations store — the omnichannel inbox backbone (Phase 4).
 *
 * File-backed JSON store (mirrors tasks-store / contacts-store). Each
 * conversation carries an embedded message list. Swappable for Postgres
 * later without changing the exported API.
 */

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
  /** Agent-authored messages start as drafts awaiting human approval. */
  draft: boolean
  created_at: string
}

export type ConversationRecord = {
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

type ConvFile = { conversations: ConversationRecord[] }

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const CONV_FILE = path.join(CLAUDE_HOME, 'conversations.json')

const CHANNELS: ConvChannel[] = [
  'webchat',
  'sms',
  'whatsapp',
  'email',
  'social',
  'manual',
]
const STATUSES: ConvStatus[] = ['open', 'pending', 'snoozed', 'closed']
const ROLES: MessageRole[] = ['contact', 'agent', 'human', 'system']

export function isConvChannel(v: unknown): v is ConvChannel {
  return typeof v === 'string' && CHANNELS.includes(v as ConvChannel)
}
export function isConvStatus(v: unknown): v is ConvStatus {
  return typeof v === 'string' && STATUSES.includes(v as ConvStatus)
}
export function isMessageRole(v: unknown): v is MessageRole {
  return typeof v === 'string' && ROLES.includes(v as MessageRole)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(CONV_FILE)) {
    fs.writeFileSync(
      CONV_FILE,
      JSON.stringify({ conversations: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): ConvFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(CONV_FILE, 'utf-8').trim()
    if (!raw) return { conversations: [] }
    const parsed = JSON.parse(raw) as Partial<ConvFile>
    return {
      conversations: Array.isArray(parsed.conversations)
        ? parsed.conversations
        : [],
    }
  } catch {
    return { conversations: [] }
  }
}

function writeFile(data: ConvFile): void {
  ensureFile()
  // Atomic write (temp + rename) — avoids corrupt/half-written JSON under
  // concurrent writes from the public web-chat ingest endpoint.
  const tmp = `${CONV_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, CONV_FILE)
}

function preview(body: string): string {
  const s = body.replace(/\s+/g, ' ').trim()
  return s.length <= 140 ? s : `${s.slice(0, 140).trimEnd()}…`
}

function normMessage(m: Partial<ConvMessage>): ConvMessage {
  return {
    id: typeof m.id === 'string' && m.id ? m.id : randomUUID(),
    role: isMessageRole(m.role) ? m.role : 'contact',
    author: m.author ?? null,
    body: typeof m.body === 'string' ? m.body : '',
    draft: m.draft === true,
    created_at:
      typeof m.created_at === 'string' ? m.created_at : new Date().toISOString(),
  }
}

function normConv(
  c: Omit<Partial<ConversationRecord>, 'messages'> & {
    messages?: Partial<ConvMessage>[]
  } & Pick<ConversationRecord, 'id' | 'created_at' | 'updated_at'>,
): ConversationRecord {
  const messages = Array.isArray(c.messages)
    ? c.messages.map(normMessage)
    : []
  const last = messages[messages.length - 1]
  return {
    id: c.id,
    contact_id: c.contact_id ?? null,
    contact_name: c.contact_name ?? null,
    channel: isConvChannel(c.channel) ? c.channel : 'webchat',
    subject: c.subject ?? null,
    status: isConvStatus(c.status) ? c.status : 'open',
    assignee: c.assignee ?? null,
    unread: c.unread === true,
    last_message_at: last ? last.created_at : (c.last_message_at ?? null),
    last_message_preview: last
      ? preview(last.body)
      : (c.last_message_preview ?? ''),
    messages,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }
}

export function listConversations(filters?: {
  status?: string | null
  channel?: string | null
}): ConversationRecord[] {
  let convs = readFile().conversations.map(normConv)
  if (filters?.status) convs = convs.filter((c) => c.status === filters.status)
  if (filters?.channel)
    convs = convs.filter((c) => c.channel === filters.channel)
  // Return list view WITHOUT full message bodies to keep payloads small.
  return convs
    .map((c) => ({ ...c, messages: [] as ConvMessage[] }))
    .sort((a, b) =>
      (b.last_message_at ?? b.created_at).localeCompare(
        a.last_message_at ?? a.created_at,
      ),
    )
}

export function getConversation(id: string): ConversationRecord | null {
  return (
    readFile().conversations.map(normConv).find((c) => c.id === id) ?? null
  )
}

/**
 * Find the most recent non-closed conversation for a contact on a channel.
 * Used by inbound adapters (web chat, SMS) to thread messages instead of
 * spawning a new conversation per message.
 */
export function findOpenConversationByContact(
  contactId: string,
  channel: ConvChannel,
): ConversationRecord | null {
  return (
    readFile()
      .conversations.map(normConv)
      .filter(
        (c) =>
          c.contact_id === contactId &&
          c.channel === channel &&
          c.status !== 'closed',
      )
      .sort((a, b) =>
        (b.last_message_at ?? b.created_at).localeCompare(
          a.last_message_at ?? a.created_at,
        ),
      )[0] ?? null
  )
}

export function createConversation(input: {
  contact_id?: string | null
  contact_name?: string | null
  channel?: ConvChannel
  subject?: string | null
  status?: ConvStatus
  assignee?: string | null
  messages?: Partial<ConvMessage>[]
}): ConversationRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const conv = normConv({
    id: randomUUID(),
    contact_id: input.contact_id ?? null,
    contact_name: input.contact_name ?? null,
    channel: input.channel,
    subject: input.subject ?? null,
    status: input.status,
    assignee: input.assignee ?? null,
    unread: true,
    messages: input.messages ?? [],
    created_at: now,
    updated_at: now,
  })
  file.conversations.push(conv)
  writeFile({ conversations: file.conversations.map(normConv) })
  return conv
}

export function addMessage(
  conversationId: string,
  message: {
    role: MessageRole
    body: string
    author?: string | null
    draft?: boolean
  },
): ConversationRecord | null {
  const file = readFile()
  const index = file.conversations.findIndex((c) => c.id === conversationId)
  if (index === -1) return null
  const conv = normConv(file.conversations[index] as ConversationRecord)
  const msg = normMessage({
    role: message.role,
    body: message.body,
    author: message.author ?? null,
    draft: message.draft === true,
    created_at: new Date().toISOString(),
  })
  conv.messages.push(msg)
  conv.updated_at = new Date().toISOString()
  // Inbound contact messages mark the thread unread; agent/human replies clear it.
  conv.unread = msg.role === 'contact'
  const next = normConv(conv)
  file.conversations[index] = next
  writeFile({ conversations: file.conversations.map(normConv) })
  return next
}

export function updateConversation(
  id: string,
  updates: {
    status?: ConvStatus
    assignee?: string | null
    unread?: boolean
    subject?: string | null
    contact_id?: string | null
    contact_name?: string | null
  },
): ConversationRecord | null {
  const file = readFile()
  const index = file.conversations.findIndex((c) => c.id === id)
  if (index === -1) return null
  const current = normConv(file.conversations[index] as ConversationRecord)
  const next = normConv({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  })
  file.conversations[index] = next
  writeFile({ conversations: file.conversations.map(normConv) })
  return next
}

/** Promote a draft agent message to a sent message (human approved it). */
export function approveDraft(
  conversationId: string,
  messageId: string,
): ConversationRecord | null {
  const file = readFile()
  const index = file.conversations.findIndex((c) => c.id === conversationId)
  if (index === -1) return null
  const conv = normConv(file.conversations[index] as ConversationRecord)
  const m = conv.messages.find((x) => x.id === messageId)
  if (!m) return null
  m.draft = false
  conv.updated_at = new Date().toISOString()
  const next = normConv(conv)
  file.conversations[index] = next
  writeFile({ conversations: file.conversations.map(normConv) })
  return next
}

export const CONV_CHANNELS = CHANNELS
export const CONV_STATUSES = STATUSES
