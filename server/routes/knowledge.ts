import type { Hono } from 'hono'
import {
  createKnowledge, deleteKnowledge, getKnowledge, isKnowledgeCategory,
  listKnowledge, updateKnowledge,
} from '../stores/knowledge-store'

export function registerKnowledge(app: Hono): void {
  app.get('/api/knowledge', (c) => {
    const u = new URL(c.req.url)
    return c.json({
      entries: listKnowledge({
        brand: u.searchParams.get('brand'),
        category: u.searchParams.get('category'),
        search: u.searchParams.get('search'),
      }),
    })
  })

  app.post('/api/knowledge', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (!isKnowledgeCategory(b.category)) return c.json({ error: 'valid category is required' }, 400)
    if (typeof b.title !== 'string' || !b.title.trim()) return c.json({ error: 'title is required' }, 400)
    if (typeof b.body !== 'string' || !b.body.trim()) return c.json({ error: 'body is required' }, 400)
    const entry = createKnowledge({
      category: b.category,
      title: b.title.trim(),
      body: b.body.trim(),
      tags: Array.isArray(b.tags) ? (b.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
      pinned: b.pinned === true,
      brand: typeof b.brand === 'string' ? b.brand : undefined,
    })
    return c.json({ entry }, 201)
  })

  app.get('/api/knowledge/:id', (c) => {
    const entry = getKnowledge(c.req.param('id'))
    return entry ? c.json({ entry }) : c.json({ error: 'Not found' }, 404)
  })

  app.patch('/api/knowledge/:id', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const entry = updateKnowledge(c.req.param('id'), {
      category: isKnowledgeCategory(b.category) ? b.category : undefined,
      title: typeof b.title === 'string' ? b.title.trim() : undefined,
      body: typeof b.body === 'string' ? b.body.trim() : undefined,
      tags: Array.isArray(b.tags) ? (b.tags as unknown[]).filter((t): t is string => typeof t === 'string') : undefined,
      pinned: typeof b.pinned === 'boolean' ? b.pinned : undefined,
    })
    return entry ? c.json({ entry }) : c.json({ error: 'Not found' }, 404)
  })

  app.delete('/api/knowledge/:id', (c) =>
    deleteKnowledge(c.req.param('id'))
      ? c.json({ ok: true })
      : c.json({ error: 'Not found' }, 404))
}
