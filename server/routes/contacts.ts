import type { Hono } from 'hono'
import {
  createContact, deleteContact, getContact, isContactSource,
  isContactStage, listContacts, updateContact,
} from '../stores/contacts-store'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'
import { triggerAutomations } from '../lib/automation-engine'

const BRAND = process.env.BRAND ?? 'default'

export function registerContacts(app: Hono): void {
  app.get('/api/contacts', (c) => {
    const url = new URL(c.req.url)
    return c.json({ contacts: listContacts({ stage: url.searchParams.get('stage'), source: url.searchParams.get('source'), search: url.searchParams.get('search') }) })
  })

  app.post('/api/contacts', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.name || typeof body.name !== 'string') return c.json({ error: 'name is required' }, 400)
    const contact = createContact({
      name: body.name,
      email: typeof body.email === 'string' ? body.email : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      company: typeof body.company === 'string' ? body.company : null,
      stage: isContactStage(body.stage) ? body.stage : undefined,
      source: isContactSource(body.source) ? body.source : undefined,
      tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [],
      notes: typeof body.notes === 'string' ? body.notes : '',
      owner: typeof body.owner === 'string' ? body.owner : null,
    })
    // Log activity
    appendActivity({ contact_id: contact.id, type: 'contact_created', description: `Contact created (source: ${contact.source})` })
    // Notification
    appendNotification({ brand: BRAND, message: `New contact: ${contact.name}`, context_summary: contact.email ?? contact.phone ?? '' })
    // Fire automation trigger (non-blocking)
    void triggerAutomations('new_contact', {
      contact_id: contact.id,
      contact_name: contact.name,
      contact_email: contact.email ?? undefined,
      contact_stage: contact.stage,
      contact_tags: contact.tags,
      contact_source: contact.source ?? undefined,
    })
    return c.json({ contact }, 201)
  })

  // ── Bulk CSV import ──────────────────────────────────────────────────────────
  app.post('/api/contacts/import', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { rows?: unknown[] }
    if (!Array.isArray(body.rows)) return c.json({ error: 'rows array required' }, 400)

    const created: ReturnType<typeof createContact>[] = []
    const errors: Array<{ index: number; error: string }> = []

    for (let i = 0; i < body.rows.length; i++) {
      const row = body.rows[i] as Record<string, unknown>
      if (!row.name || typeof row.name !== 'string') {
        errors.push({ index: i, error: 'missing name' }); continue
      }
      try {
        const contact = createContact({
          name: row.name,
          email: typeof row.email === 'string' ? row.email : null,
          phone: typeof row.phone === 'string' ? row.phone : null,
          company: typeof row.company === 'string' ? row.company : null,
          stage: isContactStage(row.stage) ? row.stage : 'lead',
          source: 'import',
          tags: typeof row.tags === 'string' ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
          notes: typeof row.notes === 'string' ? row.notes : '',
        })
        appendActivity({ contact_id: contact.id, type: 'contact_created', description: 'Imported via CSV' })
        created.push(contact)
      } catch (e) {
        errors.push({ index: i, error: e instanceof Error ? e.message : 'Unknown error' })
      }
    }

    if (created.length > 0) {
      appendNotification({ brand: BRAND, message: `${created.length} contacts imported`, context_summary: `${errors.length} rows skipped` })
    }

    return c.json({ created: created.length, errors }, created.length > 0 ? 201 : 400)
  })

  app.get('/api/contacts/:id', (c) => {
    const contact = getContact(c.req.param('id'))
    return contact ? c.json({ contact }) : c.json({ error: 'Contact not found' }, 404)
  })

  app.patch('/api/contacts/:id', async (c) => {
    const id = c.req.param('id')
    const prev = getContact(id)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const contact = updateContact(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      email: body.email === null || typeof body.email === 'string' ? (body.email as string | null) : undefined,
      phone: body.phone === null || typeof body.phone === 'string' ? (body.phone as string | null) : undefined,
      company: body.company === null || typeof body.company === 'string' ? (body.company as string | null) : undefined,
      stage: isContactStage(body.stage) ? body.stage : undefined,
      source: isContactSource(body.source) ? body.source : undefined,
      tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      owner: body.owner === null || typeof body.owner === 'string' ? (body.owner as string | null) : undefined,
    })
    if (!contact) return c.json({ error: 'Contact not found' }, 404)

    // Log stage changes
    if (prev && contact.stage !== prev.stage) {
      appendActivity({ contact_id: id, type: 'stage_changed', description: `Stage: ${prev.stage} → ${contact.stage}` })
      void triggerAutomations('contact_stage_changed', {
        contact_id: contact.id,
        contact_name: contact.name,
        contact_email: contact.email ?? undefined,
        contact_stage: contact.stage,
        contact_tags: contact.tags,
        contact_source: contact.source ?? undefined,
        previous_stage: prev.stage,
      })
    }
    // Log note updates
    if (prev && typeof body.notes === 'string' && body.notes !== prev.notes) {
      appendActivity({ contact_id: id, type: 'note_updated', description: 'Notes updated' })
    }

    return c.json({ contact })
  })

  app.delete('/api/contacts/:id', (c) => {
    const ok = deleteContact(c.req.param('id'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'Contact not found' }, 404)
  })
}
