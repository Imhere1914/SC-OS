import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { listTeamMembers, getTeamMember } from './team-store'

/**
 * Team Chat store — channels, DMs, messages, read markers.
 * File-backed JSON with atomic tmp+rename writes.
 * Channels:      team-chat/team-channels-{brand}.json
 * Messages:      team-chat/team-messages-{channelId}.json (per channel)
 * Read markers:  team-chat/team-read-markers-{brand}.json
 */

export type ChannelType = 'channel' | 'dm'

export interface ChatChannel {
  id: string
  brand: string
  type: ChannelType
  name: string
  description?: string
  member_ids: string[]
  is_private: boolean
  created_by?: string
  created_at: string
  updated_at: string
  last_message_preview?: string
  last_message_at?: string
}

export interface ChatMessage {
  id: string
  brand: string
  channel_id: string
  author_id: string
  author_name: string
  body: string
  mentions: string[]
  is_ai: boolean
  edited_at?: string
  created_at: string
}

export interface ReadMarker {
  member_id: string
  channel_id: string
  last_read_at: string
}

export interface CreateChannelInput {
  type?: ChannelType
  name: string
  description?: string
  member_ids?: string[]
  is_private?: boolean
  created_by?: string
}

export interface PostMessageInput {
  author_id: string
  author_name: string
  body: string
  is_ai?: boolean
}

const MAX_MESSAGES_PER_CHANNEL = 5000
const DEFAULT_PAGE_LIMIT = 50

function dataDir(): string {
  return process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
}

function chatDir(): string {
  const dir = join(dataDir(), 'team-chat')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function dbPath(name: string): string {
  return join(chatDir(), name)
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback
  try {
    const raw = readFileSync(filePath, 'utf-8').trim()
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  const dir = chatDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  renameSync(tmp, filePath)
}

// ── File helpers ──────────────────────────────────────────────────────────────

type ChannelsFile = { channels: ChatChannel[] }
type MessagesFile = { messages: ChatMessage[] }
type MarkersFile = { markers: ReadMarker[] }

function channelsPath(brand: string): string {
  return dbPath(`team-channels-${brand}.json`)
}

function messagesPath(channelId: string): string {
  return dbPath(`team-messages-${channelId}.json`)
}

function markersPath(brand: string): string {
  return dbPath(`team-read-markers-${brand}.json`)
}

function readChannels(brand: string): ChatChannel[] {
  const file = readJsonFile<ChannelsFile>(channelsPath(brand), { channels: [] })
  return Array.isArray(file.channels) ? file.channels : []
}

function writeChannels(brand: string, channels: ChatChannel[]): void {
  writeJsonFile(channelsPath(brand), { channels })
}

function readChannelMessages(channelId: string): ChatMessage[] {
  const file = readJsonFile<MessagesFile>(messagesPath(channelId), { messages: [] })
  return Array.isArray(file.messages) ? file.messages : []
}

function writeChannelMessages(channelId: string, messages: ChatMessage[]): void {
  writeJsonFile(messagesPath(channelId), { messages })
}

function readMarkers(brand: string): ReadMarker[] {
  const file = readJsonFile<MarkersFile>(markersPath(brand), { markers: [] })
  return Array.isArray(file.markers) ? file.markers : []
}

function writeMarkers(brand: string, markers: ReadMarker[]): void {
  writeJsonFile(markersPath(brand), { markers })
}

// ── Seeding ───────────────────────────────────────────────────────────────────

function seedChannelsIfEmpty(brand: string): ChatChannel[] {
  let channels = readChannels(brand)
  if (channels.length > 0) return channels
  const now = new Date().toISOString()
  channels = [
    {
      id: randomUUID(),
      brand,
      type: 'channel',
      name: '#general',
      description: 'Company-wide announcements and chatter',
      member_ids: [],
      is_private: false,
      created_at: now,
      updated_at: now,
    },
    {
      id: randomUUID(),
      brand,
      type: 'channel',
      name: '#random',
      description: 'Off-topic and watercooler',
      member_ids: [],
      is_private: false,
      created_at: now,
      updated_at: now,
    },
  ]
  writeChannels(brand, channels)
  return channels
}

// ── Channels ──────────────────────────────────────────────────────────────────

export function listChannels(brand: string, memberId?: string): ChatChannel[] {
  const channels = seedChannelsIfEmpty(brand)
  return channels
    .filter((ch) => {
      if (ch.type === 'channel' && !ch.is_private) return true
      if (!memberId) return false
      return ch.member_ids.includes(memberId)
    })
    .sort((a, b) =>
      (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at)
    )
}

export function getChannel(brand: string, id: string): ChatChannel | null {
  return seedChannelsIfEmpty(brand).find((ch) => ch.id === id) ?? null
}

export function createChannel(brand: string, data: CreateChannelInput): ChatChannel {
  const channels = seedChannelsIfEmpty(brand)
  const now = new Date().toISOString()
  const rawName = data.name.trim()
  const name =
    (data.type ?? 'channel') === 'channel' && !rawName.startsWith('#')
      ? `#${rawName}`
      : rawName
  const channel: ChatChannel = {
    id: randomUUID(),
    brand,
    type: data.type ?? 'channel',
    name,
    description: data.description,
    member_ids: Array.isArray(data.member_ids) ? data.member_ids : [],
    is_private: data.is_private === true,
    created_by: data.created_by,
    created_at: now,
    updated_at: now,
  }
  channels.push(channel)
  writeChannels(brand, channels)
  return channel
}

export function updateChannel(
  brand: string,
  id: string,
  data: Partial<Pick<ChatChannel, 'name' | 'description' | 'member_ids' | 'is_private'>>
): ChatChannel | null {
  const channels = seedChannelsIfEmpty(brand)
  const i = channels.findIndex((ch) => ch.id === id)
  if (i === -1) return null
  const current = channels[i]
  const next: ChatChannel = {
    ...current,
    name:
      typeof data.name === 'string' && data.name.trim()
        ? current.type === 'channel' && !data.name.trim().startsWith('#')
          ? `#${data.name.trim()}`
          : data.name.trim()
        : current.name,
    description: typeof data.description === 'string' ? data.description : current.description,
    member_ids: Array.isArray(data.member_ids) ? data.member_ids : current.member_ids,
    is_private: typeof data.is_private === 'boolean' ? data.is_private : current.is_private,
    updated_at: new Date().toISOString(),
  }
  channels[i] = next
  writeChannels(brand, channels)
  return next
}

export function deleteChannel(brand: string, id: string): boolean {
  const channels = seedChannelsIfEmpty(brand)
  const next = channels.filter((ch) => ch.id !== id)
  if (next.length === channels.length) return false
  writeChannels(brand, next)
  return true
}

export function getOrCreateDm(brand: string, memberIds: string[]): ChatChannel {
  const ids = [...new Set(memberIds)].sort()
  const channels = seedChannelsIfEmpty(brand)
  const existing = channels.find(
    (ch) =>
      ch.type === 'dm' &&
      ch.member_ids.length === ids.length &&
      [...ch.member_ids].sort().every((id, i) => id === ids[i])
  )
  if (existing) return existing

  const names = ids.map((id) => getTeamMember(id, brand)?.name ?? 'Unknown')
  const now = new Date().toISOString()
  const dm: ChatChannel = {
    id: randomUUID(),
    brand,
    type: 'dm',
    name: names.join(', '),
    member_ids: ids,
    is_private: true,
    created_at: now,
    updated_at: now,
  }
  channels.push(dm)
  writeChannels(brand, channels)
  return dm
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function listMessages(
  brand: string,
  channelId: string,
  opts?: { before?: string; limit?: number }
): ChatMessage[] {
  const all = readChannelMessages(channelId).filter((m) => m.brand === brand)
  const limit = Math.max(1, Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, 200))
  let end = all.length
  if (opts?.before) {
    const idx = all.findIndex((m) => m.id === opts.before)
    if (idx !== -1) end = idx
  }
  return all.slice(Math.max(0, end - limit), end)
}

function parseMentions(brand: string, body: string): string[] {
  const mentions: string[] = []
  const lower = body.toLowerCase()
  if (/@hermes\b/.test(lower)) mentions.push('hermes')
  for (const member of listTeamMembers(brand)) {
    const name = member.name.trim()
    if (!name) continue
    const full = `@${name.toLowerCase()}`
    const first = `@${name.split(/\s+/)[0].toLowerCase()}`
    if (lower.includes(full) || new RegExp(`${escapeRegExp(first)}\\b`).test(lower)) {
      mentions.push(member.id)
    }
  }
  return [...new Set(mentions)]
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function postMessage(
  brand: string,
  channelId: string,
  data: PostMessageInput
): ChatMessage | null {
  const channels = seedChannelsIfEmpty(brand)
  const i = channels.findIndex((ch) => ch.id === channelId)
  if (i === -1) return null

  const now = new Date().toISOString()
  const message: ChatMessage = {
    id: randomUUID(),
    brand,
    channel_id: channelId,
    author_id: data.author_id,
    author_name: data.author_name,
    body: data.body,
    mentions: parseMentions(brand, data.body),
    is_ai: data.is_ai === true,
    created_at: now,
  }

  let messages = readChannelMessages(channelId)
  messages.push(message)
  if (messages.length > MAX_MESSAGES_PER_CHANNEL) {
    messages = messages.slice(messages.length - MAX_MESSAGES_PER_CHANNEL)
  }
  writeChannelMessages(channelId, messages)

  channels[i] = {
    ...channels[i],
    updated_at: now,
    last_message_at: now,
    last_message_preview: `${data.author_name}: ${data.body.slice(0, 80)}`,
  }
  writeChannels(brand, channels)
  return message
}

export function editMessage(
  brand: string,
  channelId: string,
  messageId: string,
  body: string
): ChatMessage | null {
  const messages = readChannelMessages(channelId)
  const i = messages.findIndex((m) => m.id === messageId && m.brand === brand)
  if (i === -1) return null
  messages[i] = {
    ...messages[i],
    body,
    mentions: parseMentions(brand, body),
    edited_at: new Date().toISOString(),
  }
  writeChannelMessages(channelId, messages)
  return messages[i]
}

export function deleteMessage(brand: string, channelId: string, messageId: string): boolean {
  const messages = readChannelMessages(channelId)
  const next = messages.filter((m) => !(m.id === messageId && m.brand === brand))
  if (next.length === messages.length) return false
  writeChannelMessages(channelId, next)
  return true
}

// ── Read markers ──────────────────────────────────────────────────────────────

export function markRead(brand: string, memberId: string, channelId: string): ReadMarker {
  const markers = readMarkers(brand)
  const now = new Date().toISOString()
  const i = markers.findIndex((m) => m.member_id === memberId && m.channel_id === channelId)
  const marker: ReadMarker = { member_id: memberId, channel_id: channelId, last_read_at: now }
  if (i === -1) markers.push(marker)
  else markers[i] = marker
  writeMarkers(brand, markers)
  return marker
}

export function getUnreadCounts(brand: string, memberId: string): Record<string, number> {
  const channels = listChannels(brand, memberId)
  const markers = readMarkers(brand)
  const counts: Record<string, number> = {}
  for (const ch of channels) {
    if (!ch.last_message_at) continue
    const marker = markers.find(
      (m) => m.member_id === memberId && m.channel_id === ch.id
    )
    const lastRead = marker?.last_read_at ?? ''
    if (lastRead && ch.last_message_at <= lastRead) continue
    const unread = readChannelMessages(ch.id).filter(
      (m) => m.author_id !== memberId && (!lastRead || m.created_at > lastRead)
    ).length
    if (unread > 0) counts[ch.id] = unread
  }
  return counts
}
