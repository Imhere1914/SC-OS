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

    const activity = listActivityForContact(id, 40)
    return c.json({ contact, conversations, appointments, invoices, activity })
  })

  // ── Global search ─────────────────────────────────────────────────────────
  // GET /api/search?q=term&brand=xxx
  // Returns hits grouped by type (contacts, conversations, appointments, invoices).
  app.get('/api/search', (c) => {
    const url = new URL(c.req.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase().trim()
    const brand = url.searchParams.get('brand')
    if (!q || q.length < 2) return c.json({ hits: [] })

    const bf = (b?: string | null) => !brand || !b || b === brand || b === 'default'

    type Hit = {
      id: string
      type: 'contact' | 'conversation' | 'appointment' | 'invoice'
      title: string
      sub: string
      link: string
    }

    const hits: Hit[] = []

    // Contacts
    const { listContacts } = require('../stores/contacts-store') as typeof import('../stores/contacts-store')
    for (const ct of listContacts({})) {
      if (!bf(ct.brand)) continue
      if (!`${ct.name} ${ct.email ?? ''} ${ct.company ?? ''} ${ct.tags.join(' ')}`.toLowerCase().includes(q)) continue
      hits.push({ id: ct.id, type: 'contact', title: ct.name, sub: ct.email ?? ct.phone ?? ct.company ?? ct.stage, link: `/contacts/${ct.id}` })
    }

    // Conversations
    for (const cv of listConversations({})) {
      if (!bf((cv as { brand?: string }).brand)) continue
      if (!`${cv.contact_name ?? ''} ${cv.subject ?? ''} ${cv.channel}`.toLowerCase().includes(q)) continue
      hits.push({ id: cv.id, type: 'conversation', title: cv.contact_name ?? 'Unknown', sub: cv.subject ?? cv.channel, link: '/conversations' })
    }

    // Appointments
    for (const a of listAppointments({})) {
      if (!bf((a as { brand?: string }).brand)) continue
      if (!`${a.title} ${a.contact_name ?? ''} ${a.notes}`.toLowerCase().includes(q)) continue
      hits.push({ id: a.id, type: 'appointment', title: a.title, sub: a.contact_name ?? '', link: '/appointments' })
    }

    // Invoices
    for (const inv of listInvoices(brand ?? undefined)) {
      if (!`${inv.invoice_number} ${inv.contact_name} ${inv.contact_email ?? ''}`.toLowerCase().includes(q)) continue
      hits.push({ id: inv.id, type: 'invoice', title: `${inv.invoice_number} — ${inv.contact_name}`, sub: `$${inv.total.toFixed(2)} · ${inv.status}`, link: '/payments' })
    }

    return c.json({ hits: hits.slice(0, 20) })
  })
}
