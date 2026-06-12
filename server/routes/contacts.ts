import type { Hono } from 'hono'
import {
  createContact, deleteContact, getContact, isContactSource,
  isContactStage, listContacts, updateContact,
  type ContactStage,
} from '../stores/contacts-store'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'
import { triggerAutomations } from '../lib/automation-engine'
import { eventBus } from '../lib/event-bus'
import { computeHealthScores } from '../lib/health-score'
import { paginate, paginationParams } from '../lib/paginate'

const BRAND = process.env.BRAND ?? 'default'

export function registerContacts(app: Hono): void {
  app.get('/api/contacts', (c) => {
    const url = new URL(c.req.url)
    const allContacts = listContacts({ stage: url.searchParams.get('stage'), source: url.searchParams.get('source'), search: url.searchParams.get('search') })
    const { limit, offset } = paginationParams({ limit: c.req.query('limit'), offset: c.req.query('offset') })
    const paginatedResult = paginate(allContacts, limit, offset)
    return c.json({ contacts: paginatedResult.data, total: paginatedResult.total, has_more: paginatedResult.has_more })
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
      custom_fields: (body.custom_fields && typeof body.custom_fields === 'object' && !Array.isArray(body.custom_fields))
        ? Object.fromEntries(Object.entries(body.custom_fields as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
        : {},
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
    void eventBus.emit({
      type: 'contact.created',
      brand: BRAND,
      entity_id: contact.id,
      entity_type: 'contact',
      data: { name: contact.name, email: contact.email ?? '', source: contact.source ?? '', actor: 'user' },
      occurred_at: new Date().toISOString(),
    })
    return c.json({ contact }, 201)
  })

  // ── Bulk CSV import ──────────────────────────────────────────────────────────
  app.post('/api/contacts/import', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { rows?: unknown[]; brand?: string }
    if (!Array.isArray(body.rows)) return c.json({ error: 'rows array required' }, 400)

    // Normalize a row: resolve case-insensitive field aliases
    function normalizeRow(raw: Record<string, unknown>): Record<string, string> {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw)) {
        const key = k.toLowerCase().trim().replace(/[\s_-]+/g, '_')
        const val = typeof v === 'string' ? v.trim() : String(v ?? '').trim()
        // Map aliases to canonical field names
        const canonical =
          key === 'full_name' || key === 'contact' || key === 'firstname' || key === 'first_name' ? 'name'
          : key === 'mobile' || key === 'telephone' || key === 'tel' ? 'phone'
          : key === 'organization' || key === 'organisation' || key === 'business' ? 'company'
          : key === 'location' || key === 'town' || key === 'region' ? 'city'
          : key === 'lead_source' ? 'source'
          : key === 'score' || key === 'leadscore' ? 'lead_score'
          : key
        // Keep first non-empty value for a canonical field; merge name parts
        if (canonical === 'name' && out['name']) out['name'] = out['name'] + ' ' + val
        else if (!out[canonical]) out[canonical] = val
      }
      return out
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < body.rows.length; i++) {
      const row = normalizeRow(body.rows[i] as Record<string, unknown>)
      const name = row['name']?.trim()
      if (!name) { skipped++; continue }
      try {
        const contact = createContact({
          name,
          brand: body.brand ?? BRAND,
          email: row['email'] || null,
          phone: row['phone'] || null,
          company: row['company'] || null,
          stage: isContactStage(row['stage']) ? row['stage'] : 'lead',
          source: 'import',
          tags: row['tags'] ? row['tags'].split(',').map((t) => t.trim()).filter(Boolean) : [],
          notes: row['notes'] || '',
          custom_fields: {
            ...(row['city'] ? { city: row['city'] } : {}),
            ...(row['lead_score'] ? { lead_score: row['lead_score'] } : {}),
          },
        })
        appendActivity({ contact_id: contact.id, type: 'contact_created', description: 'Imported via CSV' })
        imported++
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`)
      }
    }

    if (imported > 0) {
      appendNotification({ brand: BRAND, message: `${imported} contacts imported`, context_summary: `${skipped} rows skipped` })
    }

    return c.json({ imported, skipped, errors }, imported > 0 ? 201 : 400)
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
      custom_fields: (body.custom_fields && typeof body.custom_fields === 'object' && !Array.isArray(body.custom_fields))
        ? Object.fromEntries(Object.entries(body.custom_fields as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
        : undefined,
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

  // ── Bulk operations ───────────────────────────────────────────────────────────
  app.post('/api/contacts/bulk', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : []
    if (!ids.length) return c.json({ error: 'ids required' }, 400)

    if (body.action === 'delete') {
      let deleted = 0
      for (const id of ids) { if (deleteContact(id)) deleted++ }
      return c.json({ deleted })
    }
    if (body.action === 'stage' && isContactStage(body.stage)) {
      let updated = 0
      for (const id of ids) {
        const prev = getContact(id)
        const contact = updateContact(id, { stage: body.stage as ContactStage })
        if (contact && prev && prev.stage !== contact.stage) {
          appendActivity({ contact_id: id, type: 'stage_changed', description: `Stage: ${prev.stage} → ${contact.stage}` })
          updated++
        }
      }
      return c.json({ updated })
    }
    if (body.action === 'tag' && typeof body.tag === 'string') {
      let updated = 0
      for (const id of ids) {
        const existing = getContact(id)
        if (existing && !existing.tags.includes(body.tag as string)) {
          updateContact(id, { tags: [...existing.tags, body.tag as string] })
          appendActivity({ contact_id: id, type: 'tag_added', description: `Tag added: ${body.tag}` })
          updated++
        }
      }
      return c.json({ updated })
    }
    return c.json({ error: 'unknown action' }, 400)
  })

  // ── Customer health scores ────────────────────────────────────────────────────
  app.get('/api/contacts/health', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const scores = await computeHealthScores(brand)
    return c.json(scores)
  })

  // ── Merge two contacts ────────────────────────────────────────────────────────
  // keepId: the contact to keep (primary). deleteId: absorb then delete.
  app.post('/api/contacts/merge', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const keepId = typeof body.keepId === 'string' ? body.keepId : null
    const deleteId = typeof body.deleteId === 'string' ? body.deleteId : null
    if (!keepId || !deleteId) return c.json({ error: 'keepId and deleteId required' }, 400)

    const keep = getContact(keepId)
    const remove = getContact(deleteId)
    if (!keep || !remove) return c.json({ error: 'One or both contacts not found' }, 404)

    // Merge fields: take non-null from secondary if primary is null
    const merged = updateContact(keepId, {
      email:   keep.email   ?? remove.email,
      phone:   keep.phone   ?? remove.phone,
      company: keep.company ?? remove.company,
      tags:    [...new Set([...keep.tags, ...remove.tags])],
      notes:   [keep.notes, remove.notes].filter(Boolean).join('\n\n---\n\n'),
    })

    if (!merged) return c.json({ error: 'Merge failed' }, 500)

    // Re-assign conversations linked to the deleted contact (best-effort)
    try {
      const convStore = await import('../stores/conversations-store')
      convStore.listConversations({})
        .filter(cv => (cv as unknown as { contact_id?: string }).contact_id === deleteId)
        .forEach(cv => convStore.updateConversation(cv.id, { contact_id: keepId, contact_name: merged.name }))
    } catch { /* non-fatal */ }

    deleteContact(deleteId)
    appendActivity({ contact_id: keepId, type: 'custom', description: `Merged duplicate contact "${remove.name}"` })

    return c.json({ contact: merged })
  })
}
