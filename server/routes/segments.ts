import type { Hono } from 'hono'
import {
  listSegments,
  getSegment,
  createSegment,
  updateSegment,
  deleteSegment,
} from '../stores/segments-store'
import { listContacts } from '../stores/contacts-store'
import type { ContactRecord } from '../stores/contacts-store'
import type { SegmentFilter } from '../stores/segments-store'

const BRAND = process.env.BRAND ?? 'default'

// ── Filter engine ─────────────────────────────────────────────────────────────

function getFieldValue(contact: ContactRecord, field: string): string | undefined {
  if (field.startsWith('custom_fields.')) {
    const key = field.slice('custom_fields.'.length)
    return contact.custom_fields?.[key]
  }
  // Top-level field
  const v = (contact as Record<string, unknown>)[field]
  if (Array.isArray(v)) return v.join(',')
  return v != null ? String(v) : undefined
}

function matchesFilter(contact: ContactRecord, f: SegmentFilter): boolean {
  const val = getFieldValue(contact, f.field)
  const fval = (f.value ?? '').toLowerCase()

  switch (f.operator) {
    case 'is_set': return val != null && val !== ''
    case 'is_not_set': return val == null || val === ''
    case 'equals': return (val ?? '').toLowerCase() === fval
    case 'not_equals': return (val ?? '').toLowerCase() !== fval
    case 'contains': return (val ?? '').toLowerCase().includes(fval)
    case 'not_contains': return !(val ?? '').toLowerCase().includes(fval)
    case 'gt': return parseFloat(val ?? '0') > parseFloat(f.value ?? '0')
    case 'lt': return parseFloat(val ?? '0') < parseFloat(f.value ?? '0')
    default: return false
  }
}

function filterContacts(contacts: ContactRecord[], filters: SegmentFilter[]): ContactRecord[] {
  if (!filters.length) return contacts
  return contacts.filter(c => filters.every(f => matchesFilter(c, f)))
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerSegments(app: Hono) {
  app.get('/api/segments', (c) => {
    const brand = c.req.query('brand')
    return c.json({ segments: listSegments(brand) })
  })

  app.get('/api/segments/:id', (c) => {
    const seg = getSegment(c.req.param('id'))
    if (!seg) return c.json({ error: 'not found' }, 404)
    return c.json(seg)
  })

  // Preview matching contacts for a set of filters (without saving a segment)
  app.post('/api/segments/preview', async (c) => {
    const body = await c.req.json() as { filters: SegmentFilter[]; brand?: string }
    const contacts = listContacts()
    const matched = filterContacts(contacts, body.filters ?? [])
    return c.json({ count: matched.length, contacts: matched.slice(0, 50) })
  })

  app.post('/api/segments', async (c) => {
    const body = await c.req.json()
    if (!body.name?.trim()) return c.json({ error: 'name required' }, 400)
    const seg = createSegment({ ...body, brand: body.brand ?? BRAND })
    return c.json(seg, 201)
  })

  app.patch('/api/segments/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand')
    const seg = updateSegment(id, body, brand)
    if (!seg) return c.json({ error: 'not found' }, 404)
    return c.json(seg)
  })

  app.delete('/api/segments/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = deleteSegment(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // Resolve contacts in a saved segment
  app.get('/api/segments/:id/contacts', (c) => {
    const seg = getSegment(c.req.param('id'))
    if (!seg) return c.json({ error: 'not found' }, 404)
    const contacts = listContacts()
    const matched = filterContacts(contacts, seg.filters)
    return c.json({ count: matched.length, contacts: matched })
  })
}
