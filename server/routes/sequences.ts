import type { Hono } from 'hono'
import {
  listSequences,
  getSequence,
  createSequence,
  updateSequence,
  deleteSequence,
  listEnrollments,
  enrollContact,
  unenroll,
  updateEnrollment,
} from '../stores/sequences-store'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerSequences(app: Hono) {
  // ── Sequences ──────────────────────────────────────────────────────────────

  app.get('/api/sequences', (c) => {
    const brand = c.req.query('brand')
    return c.json({ sequences: listSequences(brand) })
  })

  app.get('/api/sequences/:id', (c) => {
    const seq = getSequence(c.req.param('id'))
    if (!seq) return c.json({ error: 'not found' }, 404)
    return c.json(seq)
  })

  app.post('/api/sequences', async (c) => {
    const body = await c.req.json()
    if (!body.name?.trim()) return c.json({ error: 'name required' }, 400)
    const seq = createSequence({ ...body, brand: body.brand ?? BRAND })
    appendNotification({ brand: BRAND, message: `Sequence created: ${seq.name}`, context_summary: `${seq.steps.length} step(s)` })
    return c.json(seq, 201)
  })

  app.patch('/api/sequences/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand')
    const seq = updateSequence(id, body, brand)
    if (!seq) return c.json({ error: 'not found' }, 404)
    return c.json(seq)
  })

  app.delete('/api/sequences/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = deleteSequence(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ── Enrollments ────────────────────────────────────────────────────────────

  app.get('/api/sequences/:id/enrollments', (c) => {
    const sequence_id = c.req.param('id')
    const brand = c.req.query('brand')
    const enrollments = listEnrollments({ sequence_id, brand })
    return c.json({ enrollments })
  })

  // Enroll a contact
  app.post('/api/sequences/:id/enroll', async (c) => {
    const seq = getSequence(c.req.param('id'))
    if (!seq) return c.json({ error: 'sequence not found' }, 404)
    if (!seq.steps.length) return c.json({ error: 'sequence has no steps' }, 400)

    const body = await c.req.json() as {
      contact_id?: string
      contact_email: string
      contact_name: string
      brand?: string
    }
    if (!body.contact_email?.includes('@')) return c.json({ error: 'valid contact_email required' }, 400)
    if (!body.contact_name?.trim()) return c.json({ error: 'contact_name required' }, 400)

    const enrollment = enrollContact(seq, {
      sequence_id: seq.id,
      contact_id: body.contact_id,
      contact_email: body.contact_email,
      contact_name: body.contact_name,
      brand: body.brand ?? BRAND,
    })
    if (!enrollment) return c.json({ error: 'Could not enroll (no steps or already enrolled)' }, 409)

    if (body.contact_id) {
      appendActivity({
        contact_id: body.contact_id,
        type: 'sequence_enrolled',
        description: `Enrolled in sequence "${seq.name}"`,
      })
    }

    return c.json(enrollment, 201)
  })

  // Unenroll (cancel) an enrollment
  app.delete('/api/enrollments/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = unenroll(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // Pause / resume an enrollment
  app.patch('/api/enrollments/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json() as { status?: string }
    const brand = c.req.query('brand')
    const updated = updateEnrollment(
      id,
      { status: body.status as 'active' | 'unsubscribed' },
      brand,
    )
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // List all enrollments (across sequences) — for dashboard/monitoring
  app.get('/api/enrollments', (c) => {
    const brand = c.req.query('brand')
    const status = c.req.query('status') as 'active' | 'completed' | 'unsubscribed' | 'bounced' | undefined
    const sequence_id = c.req.query('sequence_id')
    const enrollments = listEnrollments({ brand, status, sequence_id })
    return c.json({ enrollments })
  })
}
