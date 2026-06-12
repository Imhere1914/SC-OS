/**
 * Contact detail — aggregated 360° view.
 * GET /api/contacts/:id/detail
 * Returns the contact + all linked records (conversations, appointments, invoices).
 */
import type { Hono } from 'hono'
import { getContact } from '../stores/contacts-store'
import { listConversations } from '../stores/conversations-store'
import { listAppointments } from '../stores/appointments-store'
import { listInvoices } from '../stores/invoices-store'
import { listActivityForContact } from '../stores/activity-store'

export function registerContactDetail(app: Hono): void {
  app.get('/api/contacts/:id/detail', (c) => {
    const id = c.req.param('id')
    const contact = getContact(id)
    if (!contact) return c.json({ error: 'Contact not found' }, 404)

    const conversations = listConversations({}).filter(
      (cv) => cv.contact_id === id || cv.contact_name === contact.name,
    ).slice(0, 20)

    const appointments = listAppointments({}).filter(
      (a) => a.contact_id === id,
    ).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at)).slice(0, 20)

    const invoices = listInvoices(contact.brand).filter(
      (i) => i.contact_id === id || i.contact_email === contact.email,
    ).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 20)

    const storedActivity = listActivityForContact(id, 100)

    // Synthesise a unified timeline from all sources
    type TimelineEvent = {
      id: string; type: string; description: string; meta?: Record<string, string>; created_at: string
    }
    const timeline: TimelineEvent[] = [...storedActivity]

    // Add conversation events not already in store
    for (const cv of conversations) {
      const syntheticId = `conv-${cv.id}`
      if (!storedActivity.some(e => e.meta?.conversation_id === cv.id)) {
        timeline.push({
          id: syntheticId,
          type: 'conversation_started',
          description: `${cv.channel.charAt(0).toUpperCase() + cv.channel.slice(1)} conversation${cv.subject ? `: "${cv.subject}"` : ''} (${cv.status})`,
          meta: { conversation_id: cv.id },
          created_at: (cv as { created_at?: string }).created_at ?? cv.updated_at,
        })
      }
    }

    // Add appointment events not already in store
    for (const a of appointments) {
      const syntheticId = `appt-${a.id}`
      if (!storedActivity.some(e => e.meta?.appointment_id === a.id)) {
        timeline.push({
          id: syntheticId,
          type: a.status === 'completed' ? 'appointment_completed' : 'appointment_created',
          description: `Appointment: ${a.title} on ${new Date(a.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          meta: { appointment_id: a.id, status: a.status },
          created_at: a.starts_at,
        })
      }
    }

    // Add invoice events not already in store
    for (const inv of invoices) {
      if (!storedActivity.some(e => e.meta?.invoice_id === inv.id)) {
        timeline.push({
          id: `inv-${inv.id}`,
          type: inv.status === 'paid' ? 'invoice_paid' : 'invoice_created',
          description: `Invoice ${inv.invoice_number} — $${inv.total.toFixed(2)} (${inv.status})`,
          meta: { invoice_id: inv.id },
          created_at: inv.created_at,
        })
      }
    }

    // Sort newest first
    timeline.sort((a, b) => b.created_at.localeCompare(a.created_at))

    return c.json({ contact, conversations, appointments, invoices, activity: timeline.slice(0, 50) })
  })

}
