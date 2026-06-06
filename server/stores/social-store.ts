import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Social posts store (Phase 4c).
 * File-backed JSON, same conventions as contacts/conversations stores.
 * Swap for Postgres when the platform host is live — API unchanged.
 */

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'x'

export type SocialPostStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'failed'

export type SocialPost = {
  id: string
  /** Brand this post belongs to (matches BRAND env: 'sc' | 'hfm') */
  brand: string
  platforms: SocialPlatform[]
  /** Main caption / post text */
  content: string
  /** URLs of attached media (images/video — resolved after generation) */
  media_urls: string[]
  /** ISO string — null means unscheduled draft */
  scheduled_at: string | null
  /** ISO string — set when actually published */
  published_at: string | null
  status: SocialPostStatus
  /** Platform-returned post IDs after successful publish */
  external_ids: Record<string, string>
  /** Notes for the review step */
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

type SocialFile = { posts: SocialPost[] }

type PostFilters = {
  status?: string | null
  platform?: string | null
  brand?: string | null
}

type CreatePostInput = Partial<SocialPost> & { content: string }
type UpdatePostInput = Partial<Omit<SocialPost, 'id' | 'created_at' | 'created_by'>>

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const POSTS_FILE = path.join(CLAUDE_HOME, 'social-posts.json')

const PLATFORMS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'x',
]
const STATUSES: SocialPostStatus[] = [
  'draft',
  'scheduled',
  'published',
  'failed',
]

export function isSocialPlatform(v: unknown): v is SocialPlatform {
  return typeof v === 'string' && PLATFORMS.includes(v as SocialPlatform)
}

export function isSocialPostStatus(v: unknown): v is SocialPostStatus {
  return typeof v === 'string' && STATUSES.includes(v as SocialPostStatus)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(POSTS_FILE)) {
    fs.writeFileSync(
      POSTS_FILE,
      JSON.stringify({ posts: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): SocialFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(POSTS_FILE, 'utf-8').trim()
    if (!raw) return { posts: [] }
    const parsed = JSON.parse(raw) as Partial<SocialFile>
    return { posts: Array.isArray(parsed.posts) ? parsed.posts : [] }
  } catch {
    return { posts: [] }
  }
}

function writeFile(data: SocialFile): void {
  ensureFile()
  const tmp = `${POSTS_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, POSTS_FILE)
}

function normalize(
  p: Partial<SocialPost> &
    Pick<SocialPost, 'id' | 'content' | 'created_at' | 'updated_at'>,
): SocialPost {
  return {
    id: p.id,
    brand:
      typeof p.brand === 'string' ? p.brand : process.env.BRAND ?? 'default',
    platforms: Array.isArray(p.platforms)
      ? p.platforms.filter(isSocialPlatform)
      : [],
    content: p.content,
    media_urls: Array.isArray(p.media_urls)
      ? p.media_urls.filter((u): u is string => typeof u === 'string')
      : [],
    scheduled_at: p.scheduled_at ?? null,
    published_at: p.published_at ?? null,
    status: isSocialPostStatus(p.status) ? p.status : 'draft',
    external_ids:
      p.external_ids && typeof p.external_ids === 'object'
        ? Object.fromEntries(
            Object.entries(p.external_ids).filter(
              ([, v]) => typeof v === 'string',
            ) as Array<[string, string]>,
          )
        : {},
    notes: typeof p.notes === 'string' ? p.notes : '',
    created_by:
      typeof p.created_by === 'string' && p.created_by ? p.created_by : 'user',
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

export function listPosts(filters: PostFilters = {}): SocialPost[] {
  let posts = readFile().posts.map(normalize)
  if (filters.status) posts = posts.filter((p) => p.status === filters.status)
  if (filters.brand) posts = posts.filter((p) => p.brand === filters.brand)
  if (filters.platform) {
    posts = posts.filter((p) =>
      p.platforms.includes(filters.platform as SocialPlatform),
    )
  }
  return posts.sort((a, b) => {
    // Scheduled posts first (ascending), then drafts newest-first
    if (a.scheduled_at && b.scheduled_at) {
      return a.scheduled_at.localeCompare(b.scheduled_at)
    }
    if (a.scheduled_at) return -1
    if (b.scheduled_at) return 1
    return b.created_at.localeCompare(a.created_at)
  })
}

export function getPost(id: string): SocialPost | null {
  return readFile().posts.map(normalize).find((p) => p.id === id) ?? null
}

export function createPost(input: CreatePostInput): SocialPost {
  const file = readFile()
  const now = new Date().toISOString()
  const post = normalize({
    id: randomUUID(),
    brand: typeof input.brand === 'string' ? input.brand : undefined,
    platforms: input.platforms,
    content: input.content,
    media_urls: input.media_urls,
    scheduled_at: input.scheduled_at ?? null,
    published_at: null,
    status: input.scheduled_at ? 'scheduled' : 'draft',
    external_ids: {},
    notes: input.notes,
    created_by: input.created_by ?? 'user',
    created_at: now,
    updated_at: now,
  })
  file.posts.push(post)
  writeFile({ posts: file.posts.map(normalize) })
  return post
}

export function updatePost(
  id: string,
  updates: UpdatePostInput,
): SocialPost | null {
  const file = readFile()
  const index = file.posts.findIndex((p) => p.id === id)
  if (index === -1) return null
  const current = normalize(file.posts[index] as SocialPost)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    created_by: current.created_by,
    updated_at: new Date().toISOString(),
    content:
      typeof updates.content === 'string' ? updates.content : current.content,
  })
  file.posts[index] = next
  writeFile({ posts: file.posts.map(normalize) })
  return next
}

export function markPublished(
  id: string,
  externalIds: Record<string, string>,
): SocialPost | null {
  return updatePost(id, {
    status: 'published',
    published_at: new Date().toISOString(),
    external_ids: externalIds,
  })
}

export function markFailed(id: string, note: string): SocialPost | null {
  return updatePost(id, { status: 'failed', notes: note })
}

export function deletePost(id: string): boolean {
  const file = readFile()
  const next = file.posts.filter((p) => p.id !== id)
  if (next.length === file.posts.length) return false
  writeFile({ posts: next.map((p) => normalize(p as SocialPost)) })
  return true
}

export const SOCIAL_PLATFORMS = PLATFORMS
export const SOCIAL_STATUSES = STATUSES
