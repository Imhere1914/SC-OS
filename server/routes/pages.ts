import type { Hono } from 'hono'
import {
  createPage, deletePage, getPage, getPublishedPageBySlug, isPageTemplate,
  listPages, publishPage, unpublishPage, updatePage,
} from '../stores/pages-store'

export function registerPages(app: Hono): void {
  app.get('/api/pages', (c) => {
    const u = new URL(c.req.url)
    return c.json({ pages: listPages({ status: u.searchParams.get('status'), brand: u.searchParams.get('brand') }) })
  })
  app.post('/api/pages', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.title !== 'string' || !b.title) return c.json({ error: 'title is required' }, 400)
    const page = createPage({
      title: b.title,
      slug: typeof b.slug === 'string' ? b.slug : undefined,
      template: isPageTemplate(b.template) ? b.template : undefined,
      fields: b.fields && typeof b.fields === 'object' ? (b.fields as Record<string, string>) : {},
      accent_color: typeof b.accent_color === 'string' ? b.accent_color : undefined,
      brand: typeof b.brand === 'string' ? b.brand : undefined,
    })
    return c.json({ page }, 201)
  })
  // PUBLIC published-page lookup (no auth) for the /p/<slug> renderer
  app.get('/api/pages/public/:slug', (c) => {
    const page = getPublishedPageBySlug(c.req.param('slug'))
    return page ? c.json({ page }) : c.json({ error: 'Not found' }, 404)
  })
  app.get('/api/pages/:id', (c) => {
    const p = getPage(c.req.param('id'))
    return p ? c.json({ page: p }) : c.json({ error: 'Not found' }, 404)
  })
  app.patch('/api/pages/:id', async (c) => {
    const id = c.req.param('id')
    const action = new URL(c.req.url).searchParams.get('action')
    if (action === 'publish') { const p = publishPage(id); return p ? c.json({ page: p }) : c.json({ error: 'Not found' }, 404) }
    if (action === 'unpublish') { const p = unpublishPage(id); return p ? c.json({ page: p }) : c.json({ error: 'Not found' }, 404) }
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const p = updatePage(id, {
      title: typeof b.title === 'string' ? b.title : undefined,
      slug: typeof b.slug === 'string' ? b.slug : undefined,
      fields: b.fields && typeof b.fields === 'object' ? (b.fields as Record<string, string>) : undefined,
      accent_color: typeof b.accent_color === 'string' ? b.accent_color : undefined,
    })
    return p ? c.json({ page: p }) : c.json({ error: 'Not found' }, 404)
  })
  app.delete('/api/pages/:id', (c) =>
    deletePage(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
