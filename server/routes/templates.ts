import type { Hono } from 'hono'
import {
  createTemplate, deleteTemplate, getTemplate, isTemplateCategory,
  listTemplates, updateTemplate,
} from '../stores/templates-store'

export function registerTemplates(app: Hono): void {
  app.get('/api/templates', (c) => {
    const u = new URL(c.req.url)
    return c.json({ templates: listTemplates({ category: u.searchParams.get('category'), brand: u.searchParams.get('brand') }) })
  })
  app.post('/api/templates', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (!b.name || typeof b.name !== 'string') return c.json({ error: 'name is required' }, 400)
    const template = createTemplate({
      name: b.name,
      category: isTemplateCategory(b.category) ? b.category : undefined,
      subject: typeof b.subject === 'string' ? b.subject : '',
      body: typeof b.body === 'string' ? b.body : '',
      tags: Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === 'string') : [],
      brand: typeof b.brand === 'string' ? b.brand : undefined,
    })
    return c.json({ template }, 201)
  })
  app.get('/api/templates/:id', (c) => {
    const t = getTemplate(c.req.param('id'))
    return t ? c.json({ template: t }) : c.json({ error: 'Not found' }, 404)
  })
  app.patch('/api/templates/:id', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const t = updateTemplate(c.req.param('id'), {
      name: typeof b.name === 'string' ? b.name : undefined,
      category: isTemplateCategory(b.category) ? b.category : undefined,
      subject: typeof b.subject === 'string' ? b.subject : undefined,
      body: typeof b.body === 'string' ? b.body : undefined,
      tags: Array.isArray(b.tags) ? b.tags.filter((x): x is string => typeof x === 'string') : undefined,
    })
    return t ? c.json({ template: t }) : c.json({ error: 'Not found' }, 404)
  })
  app.delete('/api/templates/:id', (c) =>
    deleteTemplate(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
