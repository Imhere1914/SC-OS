import type { Hono } from 'hono'
import {
  createAppointment, deleteAppointment, getAppointment, isAppointmentStatus,
  listAppointments, updateAppointment,
} from '../stores/appointments-store'

export function registerAppointments(app: Hono): void {
  app.get('/api/appointments', (c) => {
    const u = new URL(c.req.url)
    return c.json({ appointments: listAppointments({
      status: u.searchParams.get('status'), brand: u.searchParams.get('brand'),
      contact_id: u.searchParams.get('contact_id'), when: u.searchParams.get('when'),
    }) })
  })
  app.post('/api/appointments', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.title !== 'string' || !b.title) return c.json({ error: 'title is required' }, 400)
    if (typeof b.starts_at !== 'string' || !b.starts_at) return c.json({ error: 'starts_at is required' }, 400)
    const appointment = createAppointment({
      title: b.title, starts_at: b.starts_at,
      ends_at: typeof b.ends_at === 'string' ? b.ends_at : null,
      contact_id: typeof b.contact_id === 'string' ? b.contact_id : null,
      contact_name: typeof b.contact_name === 'string' ? b.contact_name : null,
      status: isAppointmentStatus(b.status) ? b.status : undefined,
      location: typeof b.location === 'string' ? b.location : '',
      notes: typeof b.notes === 'string' ? b.notes : '',
      brand: typeof b.brand === 'string' ? b.brand : undefined,
    })
    return c.json({ appointment }, 201)
  })
  app.get('/api/appointments/:id', (c) => {
    const a = getAppointment(c.req.param('id'))
    return a ? c.json({ appointment: a }) : c.json({ error: 'Not found' }, 404)
  })
  app.patch('/api/appointments/:id', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const a = updateAppointment(c.req.param('id'), {
      title: typeof b.title === 'string' ? b.title : undefined,
      starts_at: typeof b.starts_at === 'string' ? b.starts_at : undefined,
      ends_at: b.ends_at === null || typeof b.ends_at === 'string' ? (b.ends_at as string | null) : undefined,
      contact_id: b.contact_id === null || typeof b.contact_id === 'string' ? (b.contact_id as string | null) : undefined,
      contact_name: b.contact_name === null || typeof b.contact_name === 'string' ? (b.contact_name as string | null) : undefined,
      status: isAppointmentStatus(b.status) ? b.status : undefined,
      location: typeof b.location === 'string' ? b.location : undefined,
      notes: typeof b.notes === 'string' ? b.notes : undefined,
    })
    return a ? c.json({ appointment: a }) : c.json({ error: 'Not found' }, 404)
  })
  app.delete('/api/appointments/:id', (c) =>
    deleteAppointment(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
