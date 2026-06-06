import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Avatars store — voice + chat identities for the brand's AI agents.
 * Each avatar is a presentation layer: a face (emoji/image), a voice, a
 * greeting, and an accent. Surfaces (chat, voice) reference these.
 * File-backed JSON; atomic writes; Postgres-swappable.
 */

export type AvatarSurface = 'chat' | 'voice' | 'both'

export type AvatarRecord = {
  id: string
  brand: string
  name: string
  /** Emoji or short glyph shown as the face (e.g. "🧑‍⚕️"). */
  emoji: string
  /** Optional image URL (overrides emoji when set). */
  image_url: string
  /** Browser SpeechSynthesis voice name (preview); maps to server TTS later. */
  voice_name: string
  /** Speaking rate 0.5–1.5. */
  voice_rate: number
  /** Spoken/typed greeting line. */
  greeting: string
  accent_color: string
  surface: AvatarSurface
  is_default: boolean
  created_at: string
  updated_at: string
}

type AvatarFile = { avatars: AvatarRecord[] }

type CreateInput = Partial<AvatarRecord> & { name: string }
type UpdateInput = Partial<Omit<AvatarRecord, 'id' | 'created_at'>>

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const AVATARS_FILE = path.join(CLAUDE_HOME, 'avatars.json')

const SURFACES: AvatarSurface[] = ['chat', 'voice', 'both']

export function isAvatarSurface(v: unknown): v is AvatarSurface {
  return typeof v === 'string' && SURFACES.includes(v as AvatarSurface)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(AVATARS_FILE)) {
    fs.writeFileSync(
      AVATARS_FILE,
      JSON.stringify({ avatars: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): AvatarFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(AVATARS_FILE, 'utf-8').trim()
    if (!raw) return { avatars: [] }
    const parsed = JSON.parse(raw) as Partial<AvatarFile>
    return { avatars: Array.isArray(parsed.avatars) ? parsed.avatars : [] }
  } catch {
    return { avatars: [] }
  }
}

function writeFile(data: AvatarFile): void {
  ensureFile()
  const tmp = `${AVATARS_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, AVATARS_FILE)
}

function clampRate(v: unknown): number {
  const n = typeof v === 'number' ? v : 1
  return Math.max(0.5, Math.min(1.5, n))
}

function normalize(
  a: Partial<AvatarRecord> &
    Pick<AvatarRecord, 'id' | 'name' | 'created_at' | 'updated_at'>,
): AvatarRecord {
  return {
    id: a.id,
    brand: typeof a.brand === 'string' ? a.brand : process.env.BRAND ?? 'default',
    name: a.name,
    emoji: typeof a.emoji === 'string' && a.emoji ? a.emoji : '🤖',
    image_url: typeof a.image_url === 'string' ? a.image_url : '',
    voice_name: typeof a.voice_name === 'string' ? a.voice_name : '',
    voice_rate: clampRate(a.voice_rate),
    greeting:
      typeof a.greeting === 'string' && a.greeting
        ? a.greeting
        : 'Hi! How can I help you today?',
    accent_color:
      typeof a.accent_color === 'string' ? a.accent_color : '#4A9EA1',
    surface: isAvatarSurface(a.surface) ? a.surface : 'both',
    is_default: a.is_default === true,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }
}

export function listAvatars(filters?: { brand?: string | null }): AvatarRecord[] {
  let avatars = readFile().avatars.map(normalize)
  if (filters?.brand) avatars = avatars.filter((a) => a.brand === filters.brand)
  return avatars.sort(
    (a, b) =>
      Number(b.is_default) - Number(a.is_default) ||
      a.created_at.localeCompare(b.created_at),
  )
}

export function getAvatar(id: string): AvatarRecord | null {
  return readFile().avatars.map(normalize).find((a) => a.id === id) ?? null
}

export function createAvatar(input: CreateInput): AvatarRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const avatar = normalize({
    id: randomUUID(),
    brand: typeof input.brand === 'string' ? input.brand : undefined,
    name: input.name,
    emoji: input.emoji,
    image_url: input.image_url,
    voice_name: input.voice_name,
    voice_rate: input.voice_rate,
    greeting: input.greeting,
    accent_color: input.accent_color,
    surface: input.surface,
    is_default: input.is_default,
    created_at: now,
    updated_at: now,
  })
  // If marked default, clear default on others (same brand)
  let avatars = file.avatars.map(normalize)
  if (avatar.is_default) {
    avatars = avatars.map((a) =>
      a.brand === avatar.brand ? { ...a, is_default: false } : a,
    )
  }
  avatars.push(avatar)
  writeFile({ avatars })
  return avatar
}

export function updateAvatar(id: string, updates: UpdateInput): AvatarRecord | null {
  const file = readFile()
  const index = file.avatars.findIndex((a) => a.id === id)
  if (index === -1) return null
  const current = normalize(file.avatars[index] as AvatarRecord)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    name: typeof updates.name === 'string' ? updates.name : current.name,
  })
  let avatars = file.avatars.map(normalize)
  if (next.is_default && !current.is_default) {
    avatars = avatars.map((a) =>
      a.brand === next.brand ? { ...a, is_default: false } : a,
    )
  }
  avatars[index] = next
  writeFile({ avatars })
  return next
}

export function deleteAvatar(id: string): boolean {
  const file = readFile()
  const next = file.avatars.filter((a) => a.id !== id)
  if (next.length === file.avatars.length) return false
  writeFile({ avatars: next.map((a) => normalize(a as AvatarRecord)) })
  return true
}

export const AVATAR_SURFACES = SURFACES
