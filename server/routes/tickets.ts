import type { Hono } from 'hono'
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  addReply,
  deleteTicket,
  getTicketStats,
  type TicketStatus,
  type TicketPriority,
} from '../stores/tickets-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerTickets(app: Hono) {
  // GET /api/tickets — list with optional filters
  app.get('/api/tickets', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const status = c.req.query('status') as TicketStatus | undefined
    const priority = c.req.query('priority') as TicketPriority | undefined
    const assignee = c.req.query('assignee')
    const tickets = listTickets(brand, {
      status: status || undefined,
      priority: priority || undefined,
      assignee: assignee || undefined,
    })
    return c.json({ tickets })
  })

  // GET /api/tickets/stats — stats (must come before /:id)
  app.get('/api/tickets/stats', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    return c.json(getTicketStats(brand))
  })

  // GET /api/tickets/:id — single ticket with replies
  app.get('/api/tickets/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const ticket = getTicket(brand, c.req.param('id'))
    if (!ticket) return c.json({ error: 'not found' }, 404)
    return c.json(ticket)
  })

  // POST /api/tickets — create
  app.post('/api/tickets', async (c) => {
    const body = await c.req.json()
    const brand = body.brand ?? BRAND
    if (!body.subject?.trim()) return c.json({ error: 'subject required' }, 400)
    const ticket = createTicket(brand, {
      subject: body.subject,
      body: body.body ?? '',
      status: body.status ?? 'open',
      priority: body.priority ?? 'medium',
      contact_id: body.contact_id,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      assignee: body.assignee,
      tags: body.tags,
    })
    return c.json(ticket, 201)
  })

  // PATCH /api/tickets/:id — update status, priority, assignee, tags
  app.patch('/api/tickets/:id', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json()
    const updated = updateTicket(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // DELETE /api/tickets/:id
  app.delete('/api/tickets/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const ok = deleteTicket(brand, c.req.param('id'))
    if (!ok) return c.json({ error: 'not found' }, 404)
    return c.json({ ok: true })
  })

  // POST /api/tickets/:id/reply
  app.post('/api/tickets/:id/reply', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json()
    if (!body.body?.trim()) return c.json({ error: 'body required' }, 400)
    const updated = addReply(brand, c.req.param('id'), {
      body: body.body,
      author: body.author ?? 'Agent',
      is_internal: body.is_internal ?? false,
    })
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })
}
