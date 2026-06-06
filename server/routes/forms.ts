import type { Hono } from 'hono'
import {
  createForm,
  deleteForm,
  listForms,
  updateForm,
} from '../stores/forms-store'
import { listContacts, createContact, updateContact } from '../stores/contacts-store'
import { triggerAutomations } from '../lib/automation-engine'

export function registerForms(app: Hono) {
  // List
  app.get('/api/forms', (c) => {
    const brand = c.req.query('brand')
    return c.json(listForms(brand))
  })

  // Create
  app.post('/api/forms', async (c) => {
    const body = await c.req.json()
    if (!body.name?.trim()) return c.json({ error: 'name required' }, 400)
    const form = createForm({
      brand: body.brand,
      name: body.name.trim(),
      description: body.description ?? '',
      fields: body.fields ?? [],
      status: body.status ?? 'draft',
    })
    return c.json(form, 201)
  })

  // Update
  app.patch('/api/forms/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand')
    const updated = updateForm(id, body, brand)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // Delete
  app.delete('/api/forms/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = deleteForm(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ── Public submission endpoint ─────────────────────────────────────────────
  // POST /api/forms/:id/submit — accepts { fields: Record<string, string> }
  // Upserts a contact if an email field is present, fires form_submitted trigger.
  app.post('/api/forms/:id/submit', async (c) => {
    const id = c.req.param('id')
    const brand = process.env.BRAND ?? c.req.query('brand') ?? 'default'

    // Find the form (check brand-scoped file first, then global)
    const forms = listForms(brand !== 'default' ? brand : undefined)
    const form = forms.find(f => f.id === id)
    if (!form) return c.json({ error: 'form not found' }, 404)
    if (form.status !== 'active') return c.json({ error: 'form is not active' }, 400)

    const body = await c.req.json().catch(() => ({})) as { fields?: Record<string, string> }
    const fields = body.fields ?? {}

    // Extract well-known fields from submitted values
    const emailVal = Object.entries(fields).find(([, v]) => typeof v === 'string' && v.includes('@'))?.[1]
    const nameVal = Object.entries(fields).find(([k]) => k.toLowerCase().includes('name'))?.[1]
    const phoneVal = Object.entries(fields).find(([k]) => k.toLowerCase().includes('phone'))?.[1]

    let contactId: string | undefined
    let contactEmail: string | undefined = emailVal
    let contactName: string | undefined = nameVal

    // Upsert contact if we have an email
    if (emailVal) {
      const existing = listContacts({}).find(c => c.email?.toLowerCase() === emailVal.toLowerCase())
      if (existing) {
        // Update existing contact with any new info
        if (nameVal && !existing.name) updateContact(existing.id, { name: nameVal })
        if (phoneVal && !existing.phone) updateContact(existing.id, { phone: phoneVal })
        contactId = existing.id
        contactName = contactName ?? existing.name
      } else {
        // Create new lead contact
        const contact = createContact({
          name: nameVal ?? emailVal.split('@')[0],
          email: emailVal,
          phone: phoneVal ?? null,
          brand,
          stage: 'lead',
          source: 'webchat',
          tags: [`form:${form.name}`],
          notes: `Submitted form: ${form.name}`,
          company: null,
          owner: null,
        })
        contactId = contact.id
        contactEmail = contact.email ?? undefined
        contactName = contact.name
      }
    }

    // Update submission count
    updateForm(id, { submissions_count: (form.submissions_count ?? 0) + 1 }, brand !== 'default' ? brand : undefined)

    // Fire automation
    void triggerAutomations('form_submitted', {
      contact_id: contactId,
      contact_name: contactName,
      contact_email: contactEmail,
      form_id: form.id,
      form_name: form.name,
      ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [`form_${k}`, v])),
    })

    return c.json({ ok: true, contact_id: contactId })
  })
}
