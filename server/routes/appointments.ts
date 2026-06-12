import type { Hono } from 'hono'
import {
  createAppointment, deleteAppointment, getAppointment, isAppointmentStatus,
  listAppointments, updateAppointment,
} from '../stores/appointments-store'
import { getContact } from '../stores/contacts-store'
import { isEmailConfigured, sendEmail, renderTransactionalHtml } from '../stores/email-sender'
import { triggerAutomations } from '../lib/automation-engine'
import { eventBus } from '../lib/event-bus'

const BRAND = process.env.BRAND ?? 'default'
const BRAND_NAME =
  BRAND === 'hfm' ? 'Holistic Functional Care'
  : BRAND === 'sc' ? 'Simple Connect'
  : 'AI OS'

function formatApptTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    })
  } catch { return iso }
}

async function sendAppointmentConfirmation(appt: {
  title: string; starts_at: string; ends_at: string | null
  location: string; notes: string; contact_id: string | null
}) {
  if (!isEmailConfigured()) return
  if (!appt.contact_id) return
  const contact = getContact(appt.contact_id)
  if (!contact?.email) return

  const lines = [
    `Hi **${contact.name}**,`,
    `Your appointment has been confirmed.`,
    `**${appt.title}**`,
    `📅 ${formatApptTime(appt.starts_at)}`,
    ...(appt.ends_at ? [`⏱ Ends: ${formatApptTime(appt.ends_at)}`] : []),
    ...(appt.location ? [`📍 ${appt.location}`] : []),
    ...(appt.notes ? [`Notes: ${appt.notes}`] : []),
    `If you need to reschedule or have questions, reply to this email.`,
  ]

  await sendEmail({
    to: contact.email,
    subject: `Appointment confirmed: ${appt.title}`,
    html: renderTransactionalHtml({ brandName: BRAND_NAME, heading: 'Appointment Confirmed ✓', lines }),
  }).catch(e => console.warn('[appointments] confirmation email failed:', e))
}

async function sendAppointmentCancellation(appt: {
  title: string; starts_at: string; contact_id: string | null
}) {
  if (!isEmailConfigured()) return
  if (!appt.contact_id) return
  const contact = getContact(appt.contact_id)
  if (!contact?.email) return

  const lines = [
    `Hi **${contact.name}**,`,
    `Your appointment **${appt.title}** on ${formatApptTime(appt.starts_at)} has been cancelled.`,
    `Please contact us to reschedule.`,
  ]

  await sendEmail({
    to: contact.email,
    subject: `Appointment cancelled: ${appt.title}`,
    html: renderTransactionalHtml({ brandName: BRAND_NAME, heading: 'Appointment Cancelled', lines }),
  }).catch(e => console.warn('[appointments] cancellation email failed:', e))
}

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
    void triggerAutomations('new_appointment', {
      appointment_id: appointment.id,
      contact_id: appointment.contact_id ?? undefined,
      contact_name: appointment.contact_name ?? undefined,
    })
    void eventBus.emit({
      type: 'appointment.booked',
      brand: BRAND,
      entity_id: appointment.id,
      entity_type: 'appointment',
      data: { title: appointment.title, contact_id: appointment.contact_id ?? '', contact_name: appointment.contact_name ?? '', starts_at: appointment.starts_at, actor: 'user' },
      occurred_at: new Date().toISOString(),
    })
    void sendAppointmentConfirmation(appointment)
    return c.json({ appointment }, 201)
  })
  app.get('/api/appointments/:id', (c) => {
    const a = getAppointment(c.req.param('id'))
    return a ? c.json({ appointment: a }) : c.json({ error: 'Not found' }, 404)
  })
  app.patch('/api/appointments/:id', async (c) => {
    const id = c.req.param('id')
    const prev = getAppointment(id)
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const a = updateAppointment(id, {
      title: typeof b.title === 'string' ? b.title : undefined,
      starts_at: typeof b.starts_at === 'string' ? b.starts_at : undefined,
      ends_at: b.ends_at === null || typeof b.ends_at === 'string' ? (b.ends_at as string | null) : undefined,
      contact_id: b.contact_id === null || typeof b.contact_id === 'string' ? (b.contact_id as string | null) : undefined,
      contact_name: b.contact_name === null || typeof b.contact_name === 'string' ? (b.contact_name as string | null) : undefined,
      status: isAppointmentStatus(b.status) ? b.status : undefined,
      location: typeof b.location === 'string' ? b.location : undefined,
      notes: typeof b.notes === 'string' ? b.notes : undefined,
    })
    if (!a) return c.json({ error: 'Not found' }, 404)
    // Send cancellation email when status changes to cancelled
    if (prev && prev.status !== 'cancelled' && a.status === 'cancelled') {
      void sendAppointmentCancellation(a)
    }
    // Emit completed event
    if (prev && prev.status !== 'completed' && a.status === 'completed') {
      void eventBus.emit({
        type: 'appointment.completed',
        brand: BRAND,
        entity_id: a.id,
        entity_type: 'appointment',
        data: { title: a.title, contact_id: a.contact_id ?? '', contact_name: a.contact_name ?? '', actor: 'user' },
        occurred_at: new Date().toISOString(),
      })
    }
    return c.json({ appointment: a })
  })
  app.delete('/api/appointments/:id', (c) =>
    deleteAppointment(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
