import type { Hono } from 'hono'
import {
  createPost, deletePost, getPost, isSocialPlatform, isSocialPostStatus,
  listPosts, markFailed, markPublished, updatePost,
} from '../stores/social-store'
import { publishPost } from '../stores/social-publisher'

export function registerSocial(app: Hono): void {
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
