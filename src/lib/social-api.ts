/**
 * Social posts API client — /api/social routes.
 */

const API = '/api/social'

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'x'

export type SocialPostStatus = 'draft' | 'scheduled' | 'published' | 'failed'

export type SocialPost = {
  id: string
  brand: string
  platforms: SocialPlatform[]
  content: string
  media_urls: string[]
  scheduled_at: string | null
  published_at: string | null
  status: SocialPostStatus
  external_ids: Record<string, string>
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

export type CreatePostInput = {
  content: string
  platforms?: SocialPlatform[]
  media_urls?: string[]
  scheduled_at?: string | null
  notes?: string
  brand?: string
}

export type UpdatePostInput = Partial<Omit<CreatePostInput, 'brand'>> & {
  status?: SocialPostStatus
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
}

export const STATUS_COLORS: Record<SocialPostStatus, string> = {
  draft: 'var(--theme-muted)',
  scheduled: 'var(--theme-accent)',
  published: 'var(--theme-success)',
  failed: 'var(--theme-danger)',
}

export async function fetchPosts(params?: {
  status?: string
  platform?: string
  brand?: string
}): Promise<SocialPost[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.platform) qs.set('platform', params.platform)
  if (params?.brand) qs.set('brand', params.brand)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load posts (${res.status})`)
  const data = (await res.json()) as { posts?: SocialPost[] }
  return Array.isArray(data.posts) ? data.posts : []
}

export async function createPost(input: CreatePostInput): Promise<SocialPost> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create post (${res.status})`)
  }
  const data = (await res.json()) as { post: SocialPost }
  return data.post
}

export async function updatePost(
  id: string,
  updates: UpdatePostInput,
): Promise<SocialPost> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update post (${res.status})`)
  }
  const data = (await res.json()) as { post: SocialPost }
  return data.post
}

export async function publishPost(
  id: string,
): Promise<{ post: SocialPost; error?: string }> {
  const res = await fetch(`${API}/${id}?action=publish`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const data = (await res.json()) as { post?: SocialPost; error?: string }
  if (!res.ok && !data.post) {
    throw new Error(data.error || `Failed to publish post (${res.status})`)
  }
  return { post: data.post as SocialPost, error: data.error }
}

export async function deletePost(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete post (${res.status})`)
}

// ── Native channel publishing (per-brand, env-driven) ─────────────────────────

/** Platforms that can be published directly to a connected account. */
export type PublishPlatform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok'

export type ChannelStatus = Record<PublishPlatform, boolean>

export type PlatformPublishResult = {
  platform: PublishPlatform
  ok: boolean
  id?: string
  url?: string
  error?: string
}

export const PUBLISH_PLATFORMS: PublishPlatform[] = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
]

export async function fetchChannels(brand?: string): Promise<ChannelStatus> {
  const qs = brand ? `?brand=${encodeURIComponent(brand)}` : ''
  const res = await fetch(`${API}/channels${qs}`)
  if (!res.ok) throw new Error(`Failed to load channels (${res.status})`)
  const data = (await res.json()) as { channels?: Partial<ChannelStatus> }
  return {
    facebook: Boolean(data.channels?.facebook),
    instagram: Boolean(data.channels?.instagram),
    linkedin: Boolean(data.channels?.linkedin),
    tiktok: Boolean(data.channels?.tiktok),
  }
}

export async function publishToChannels(input: {
  brand?: string
  platforms: PublishPlatform[]
  text: string
  media_urls?: string[]
  link?: string
  post_id?: string
}): Promise<{ post: SocialPost | null; results: PlatformPublishResult[] }> {
  const res = await fetch(`${API}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json().catch(() => ({}))) as {
    post?: SocialPost | null
    results?: PlatformPublishResult[]
    error?: string
  }
  if (res.status === 400 || (!data.results && data.error)) {
    throw new Error(data.error || `Failed to publish (${res.status})`)
  }
  return { post: data.post ?? null, results: data.results ?? [] }
}
