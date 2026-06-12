import type { Hono } from 'hono'
import {
  listTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  approveTestimonial,
  getApprovedTestimonials,
} from '../stores/testimonials-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerTestimonials(app: Hono) {
  // ── Public endpoints (no auth) ──────────────────────────────────────────────

  // Public approved testimonials (for embedding/widget)
  app.get('/api/testimonials/public', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    return c.json(getApprovedTestimonials(brand))
  })

  // Public form submission
  app.post('/api/testimonials/submit', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    if (!body.author_name?.trim()) return c.json({ error: 'author_name required' }, 400)
    if (!body.body?.trim()) return c.json({ error: 'body required' }, 400)
    if (String(body.author_name).length > 200 || String(body.body).length > 5000) {
      return c.json({ error: 'input too long' }, 400)
    }
    if (Array.isArray(body.tags) && body.tags.length > 50) {
      return c.json({ error: 'too many tags' }, 400)
    }
    const brand = body.brand ?? BRAND
    createTestimonial(brand, {
      author_name: body.author_name.trim(),
      author_title: body.author_title?.trim() || undefined,
      author_company: body.author_company?.trim() || undefined,
      body: body.body.trim(),
      rating: body.rating ? Number(body.rating) : undefined,
      source: 'form',
      status: 'pending',
      featured: false,
      contact_id: body.contact_id,
      tags: body.tags,
    })
    return c.json({ ok: true })
  })

  // ── Authenticated endpoints ─────────────────────────────────────────────────

  // List all (query: ?status=&featured=)
  app.get('/api/testimonials', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const status = c.req.query('status')
    const featuredQ = c.req.query('featured')
    const featured = featuredQ === 'true' ? true : featuredQ === 'false' ? false : undefined
    return c.json(listTestimonials(brand, { status, featured }))
  })

  // Create manually
  app.post('/api/testimonials', async (c) => {
    const body = await c.req.json()
    if (!body.author_name?.trim()) return c.json({ error: 'author_name required' }, 400)
    if (!body.body?.trim()) return c.json({ error: 'body required' }, 400)
    const brand = body.brand ?? BRAND
    const record = createTestimonial(brand, {
      author_name: body.author_name.trim(),
      author_title: body.author_title?.trim() || undefined,
      author_company: body.author_company?.trim() || undefined,
      author_avatar_url: body.author_avatar_url?.trim() || undefined,
      body: body.body.trim(),
      rating: body.rating ? Number(body.rating) : undefined,
      source: 'manual',
      status: body.status ?? 'approved',
      featured: body.featured ?? false,
      contact_id: body.contact_id,
      tags: body.tags,
    })
    return c.json(record, 201)
  })

  // Update (approve, reject, feature, edit)
  app.patch('/api/testimonials/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand') ?? BRAND

    if (body.action === 'approve') {
      const record = approveTestimonial(brand, id)
      if (!record) return c.json({ error: 'not found' }, 404)
      return c.json(record)
    }

    const updated = updateTestimonial(brand, id, {
      author_name: body.author_name,
      author_title: body.author_title,
      author_company: body.author_company,
      author_avatar_url: body.author_avatar_url,
      body: body.body,
      rating: body.rating !== undefined ? Number(body.rating) : undefined,
      status: body.status,
      featured: body.featured,
      contact_id: body.contact_id,
      tags: body.tags,
    })
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // Delete
  app.delete('/api/testimonials/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand') ?? BRAND
    const ok = deleteTestimonial(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })
}
