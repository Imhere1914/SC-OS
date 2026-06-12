import type { Hono } from 'hono'
import {
  listTimeEntries,
  getTimeEntry,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getTimeSummary,
  type TimeEntry,
} from '../stores/time-entries-store'

export function registerTimeEntries(app: Hono) {
  // List entries
  app.get('/api/time-entries', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const { project_id, contact_id, billed, from, to } = c.req.query() as Record<string, string>
    const entries = listTimeEntries(brand, {
      project_id: project_id || undefined,
      contact_id: contact_id || undefined,
      billed: billed !== undefined ? billed === 'true' : undefined,
      from: from || undefined,
      to: to || undefined,
    })
    return c.json(entries)
  })

  // Summary
  app.get('/api/time-entries/summary', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const { project_id, from, to } = c.req.query() as Record<string, string>
    return c.json(getTimeSummary(brand, {
      project_id: project_id || undefined,
      from: from || undefined,
      to: to || undefined,
    }))
  })

  // Get one
  app.get('/api/time-entries/:id', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const entry = getTimeEntry(brand, c.req.param('id'))
    if (!entry) return c.json({ error: 'Not found' }, 404)
    return c.json(entry)
  })

  // Create
  app.post('/api/time-entries', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<TimeEntry>
    if (!body.description || body.duration_minutes === undefined) {
      return c.json({ error: 'description and duration_minutes required' }, 400)
    }
    const entry = createTimeEntry(brand, {
      description: body.description,
      duration_minutes: Number(body.duration_minutes),
      billable: body.billable ?? true,
      billed: body.billed ?? false,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      project_id: body.project_id,
      project_name: body.project_name,
      contact_id: body.contact_id,
      contact_name: body.contact_name,
      hourly_rate: body.hourly_rate,
      started_at: body.started_at,
      invoice_id: body.invoice_id,
    })
    return c.json(entry, 201)
  })

  // Update
  app.patch('/api/time-entries/:id', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<TimeEntry>
    const updated = updateTimeEntry(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  })

  // Delete
  app.delete('/api/time-entries/:id', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const ok = deleteTimeEntry(brand, c.req.param('id'))
    if (!ok) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  })

  // Mark billed (bulk)
  app.post('/api/time-entries/mark-billed', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as { ids: string[]; invoice_id?: string }
    const updated = (body.ids ?? []).map((id) =>
      updateTimeEntry(brand, id, { billed: true, invoice_id: body.invoice_id })
    ).filter(Boolean)
    return c.json({ updated: updated.length })
  })
}
