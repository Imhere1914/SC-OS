import type { Hono } from 'hono'
import {
  createPost, deletePost, getPost, isSocialPlatform, isSocialPostStatus,
  listPosts, markFailed, markPublished, updatePost,
} from '../stores/social-store'
import { publishPost } from '../stores/social-publisher'
import { getBrandId } from '../lib/brand'
import {
  channelStatus, isPublishPlatform, publishToPlatforms,
  type PublishPlatform,
} from '../lib/social-publishers'

export function registerSocial(app: Hono): void {
  // Which native channels are configured for this brand (drives UI connect-state)
  app.get('/api/social/channels', (c) => {
    const brand = getBrandId(c)
    return c.json({ brand, channels: channelStatus(brand) })
  })

  // Publish directly to the connected native channels (per-brand).
  app.post('/api/social/publish', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' && b.brand ? b.brand : getBrandId(c)
    const text = typeof b.text === 'string' ? b.text : ''
    if (!text.trim()) return c.json({ error: 'text is required' }, 400)

    const platforms: PublishPlatform[] = Array.isArray(b.platforms)
      ? b.platforms.filter(isPublishPlatform)
      : []
    if (platforms.length === 0) {
      return c.json({ error: 'at least one valid platform is required' }, 400)
    }

    const mediaUrls = Array.isArray(b.media_urls)
      ? b.media_urls.filter((u): u is string => typeof u === 'string')
      : []
    const link = typeof b.link === 'string' ? b.link : undefined

    // Resolve / create the store record this publish run is tied to.
    let postId = typeof b.post_id === 'string' ? b.post_id : null
    if (postId && !getPost(postId)) postId = null
    if (!postId) {
      const created = createPost({
        content: text,
        platforms: platforms.filter(isSocialPlatform),
        media_urls: mediaUrls,
        brand,
        notes: typeof b.notes === 'string' ? b.notes : '',
      })
      postId = created.id
    }

    const results = await publishToPlatforms(brand, platforms, { text, mediaUrls, link })

    const anyOk = results.some((r) => r.ok)
    const allOk = results.every((r) => r.ok)
    const externalIds: Record<string, string> = {}
    for (const r of results) if (r.ok && r.id) externalIds[r.platform] = r.id

    if (allOk) {
      markPublished(postId, externalIds)
    } else if (anyOk) {
      // Partial success: keep external ids, mark failed with a per-platform note.
      const note = results
        .filter((r) => !r.ok)
        .map((r) => `${r.platform}: ${r.error}`)
        .join('; ')
      updatePost(postId, { status: 'failed', external_ids: externalIds, notes: note })
    } else {
      markFailed(postId, results.map((r) => `${r.platform}: ${r.error}`).join('; '))
    }

    return c.json({ post: getPost(postId), results }, anyOk ? 200 : 502)
  })

  app.get('/api/social', (c) => {
    const u = new URL(c.req.url)
    return c.json({ posts: listPosts({
      status: u.searchParams.get('status'), platform: u.searchParams.get('platform'), brand: u.searchParams.get('brand'),
    }) })
  })
  app.post('/api/social', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.content !== 'string' || !b.content) return c.json({ error: 'content is required' }, 400)
    const post = createPost({
      content: b.content,
      platforms: Array.isArray(b.platforms) ? b.platforms.filter(isSocialPlatform) : [],
      media_urls: Array.isArray(b.media_urls) ? b.media_urls.filter((u): u is string => typeof u === 'string') : [],
      scheduled_at: typeof b.scheduled_at === 'string' ? b.scheduled_at : null,
      notes: typeof b.notes === 'string' ? b.notes : '',
      brand: typeof b.brand === 'string' ? b.brand : undefined,
      status: isSocialPostStatus(b.status) ? b.status : undefined,
    })
    return c.json({ post }, 201)
  })
  app.get('/api/social/:id', (c) => {
    const p = getPost(c.req.param('id'))
    return p ? c.json({ post: p }) : c.json({ error: 'Not found' }, 404)
  })
  app.patch('/api/social/:id', async (c) => {
    const id = c.req.param('id')
    const u = new URL(c.req.url)
    if (u.searchParams.get('action') === 'publish') {
      const existing = getPost(id)
      if (!existing) return c.json({ error: 'Not found' }, 404)
      if (existing.status === 'published') return c.json({ error: 'Already published' }, 409)
      const result = await publishPost({ platforms: existing.platforms, content: existing.content, mediaUrls: existing.media_urls, scheduledAt: null })
      if (!result.ok) { markFailed(id, result.error); return c.json({ error: result.error, post: getPost(id) }, 502) }
      return c.json({ post: markPublished(id, result.external_ids) })
    }
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const p = updatePost(id, {
      content: typeof b.content === 'string' ? b.content : undefined,
      platforms: Array.isArray(b.platforms) ? b.platforms.filter(isSocialPlatform) : undefined,
      media_urls: Array.isArray(b.media_urls) ? b.media_urls.filter((x): x is string => typeof x === 'string') : undefined,
      scheduled_at: b.scheduled_at === null || typeof b.scheduled_at === 'string' ? (b.scheduled_at as string | null) : undefined,
      status: isSocialPostStatus(b.status) ? b.status : undefined,
      notes: typeof b.notes === 'string' ? b.notes : undefined,
    })
    return p ? c.json({ post: p }) : c.json({ error: 'Not found' }, 404)
  })
  app.delete('/api/social/:id', (c) =>
    deletePost(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
