/**
 * Prospecting pipeline routes.
 *
 * Inbound (machine-to-machine, API-key auth — NOT session):
 *   POST /api/prospecting/inbound   — external prospecting tool POSTs leads
 *
 * Admin (session auth):
 *   GET    /api/prospecting              — list prospects
 *   GET    /api/prospecting/stats        — aggregate stats
 *   PATCH  /api/prospecting/:id          — update status / notes
 *   POST   /api/prospecting/:id/convert  — manually create a deal from a prospect
 *   DELETE /api/prospecting/:id          — delete a prospect
 */
import type { Hono } from 'hono'
import {
  listProspects, getProspect, createProspect, updateProspect, deleteProspect,
  getProspectStats,
  type ProspectInput, type ProspectStatus, type ProspectRecord,
} from '../stores/prospects-store'
import { validateApiKey } from '../stores/api-keys-store'
import { createContact } from '../stores/contacts-store'
import { createDeal } from '../stores/deals-store'
import { eventBus } from '../lib/event-bus'

const DEFAULT_BRAND = process.env.BRAND ?? 'sc'

// Score threshold at/above which a deal is auto-created on inbound.
const DEAL_SCORE_THRESHOLD = 60

function parseLeadBody(body: Record<string, unknown>): ProspectInput | null {
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) return null
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const num = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
    return undefined
  }
  const custom = (body.custom && typeof body.custom === 'object' && !Array.isArray(body.custom))
    ? Object.fromEntries(Object.entries(body.custom as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
    : undefined
  return {
    name: body.name.trim(),
    email: str(body.email),
    phone: str(body.phone),
    company: str(body.company),
    title: str(body.title),
    website: str(body.website),
    industry: str(body.industry),
    location: str(body.location),
    employee_count: num(body.employee_count),
    source: str(body.source),
    campaign: str(body.campaign),
    notes: str(body.notes),
    custom,
    raw_payload: body,
  }
}

/** Create a contact + (optionally) a deal for a prospect, link them back, and emit events. */
async function autoRoute(
  brand: string,
  prospect: ProspectRecord,
  data: ProspectInput,
  makeDeal: boolean,
): Promise<{ contact_id: string; deal_id?: string }> {
  // Always create a Contact.
  const contact = createContact({
    brand,
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    company: data.company ?? null,
    stage: 'lead',
    source: 'import',
    tags: ['prospect', prospect.source],
    notes: data.notes ?? '',
    custom_fields: {
      ...(data.title ? { title: data.title } : {}),
      ...(data.website ? { website: data.website } : {}),
      ...(data.industry ? { industry: data.industry } : {}),
      ...(data.location ? { location: data.location } : {}),
      prospect_score: String(prospect.score),
      prospect_tier: prospect.tier,
    },
  })

  void eventBus.emit({
    type: 'contact.created',
    brand,
    entity_id: contact.id,
    entity_type: 'contact',
    data: { name: contact.name, email: contact.email ?? '', source: contact.source ?? '', actor: 'prospecting' },
    occurred_at: new Date().toISOString(),
  })

  let deal_id: string | undefined
  if (makeDeal) {
    const title = `${data.company || data.name} — inbound`
    const deal = createDeal({
      brand,
      title,
      contact_id: contact.id,
      contact_name: data.name,
      stage: 'lead',
      tags: ['prospect', prospect.source],
      notes: `Auto-created from inbound prospect (score ${prospect.score}, ${prospect.tier}).`,
    })
    deal_id = deal.id
    void eventBus.emit({
      type: 'deal.created',
      brand,
      entity_id: deal.id,
      entity_type: 'deal',
      data: { title: deal.title, value: deal.value, contact_name: deal.contact_name ?? '', actor: 'prospecting' },
      occurred_at: new Date().toISOString(),
    })
  }

  return { contact_id: contact.id, deal_id }
}

export function registerProspecting(app: Hono): void {
  // ── Inbound (API-key auth) ──────────────────────────────────────────────────
  app.post('/api/prospecting/inbound', async (c) => {
    // API-key auth — header x-api-key or Authorization: Bearer <key>.
    const headerKey = c.req.header('x-api-key')
    const authHeader = c.req.header('authorization') ?? ''
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : undefined
    const rawKey = headerKey?.trim() || bearer
    if (!rawKey) return c.json({ error: 'Missing API key' }, 401)

    const validated = validateApiKey(rawKey)
    if (!validated) return c.json({ error: 'Invalid API key' }, 401)

    // Brand resolves from the key record, overridable by ?brand= or body.brand, default sc.
    let body: Record<string, unknown>
    try {
      body = (await c.req.json()) as Record<string, unknown>
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const brand =
      validated.brand ||
      c.req.query('brand') ||
      (typeof body.brand === 'string' ? body.brand : undefined) ||
      DEFAULT_BRAND

    try {
      const lead = parseLeadBody(body)
      if (!lead) return c.json({ error: 'name is required' }, 400)
      if (!lead.source) lead.source = 'codex-prospecting'

      const prospect = createProspect(brand, lead)
      const { contact_id, deal_id } = await autoRoute(brand, prospect, lead, prospect.score >= DEAL_SCORE_THRESHOLD)

      updateProspect(brand, prospect.id, {
        contact_id,
        deal_id,
        status: 'reviewed',
      })

      return c.json({
        ok: true,
        prospect_id: prospect.id,
        contact_id,
        deal_id,
        score: prospect.score,
        tier: prospect.tier,
      })
    } catch {
      return c.json({ error: 'Failed to process lead' }, 500)
    }
  })

  // ── Admin: list ──────────────────────────────────────────────────────────────
  app.get('/api/prospecting', (c) => {
    const brand = c.req.query('brand') ?? DEFAULT_BRAND
    const status = c.req.query('status') ?? undefined
    const tier = c.req.query('tier') ?? undefined
    const limitRaw = c.req.query('limit')
    const limit = limitRaw && Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : undefined
    const prospects = listProspects(brand, { status, tier, limit })
    return c.json({ prospects })
  })

  // ── Admin: stats ─────────────────────────────────────────────────────────────
  app.get('/api/prospecting/stats', (c) => {
    const brand = c.req.query('brand') ?? DEFAULT_BRAND
    return c.json(getProspectStats(brand))
  })

  // ── Admin: update (status / notes) ───────────────────────────────────────────
  app.patch('/api/prospecting/:id', async (c) => {
    const brand = c.req.query('brand') ?? DEFAULT_BRAND
    const id = c.req.param('id')
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const updates: Partial<Pick<ProspectRecord, 'status' | 'notes'>> = {}
    const STATUSES: ProspectStatus[] = ['new', 'reviewed', 'converted', 'dismissed']
    if (typeof body.status === 'string' && STATUSES.includes(body.status as ProspectStatus)) {
      updates.status = body.status as ProspectStatus
    }
    if (typeof body.notes === 'string') updates.notes = body.notes
    const updated = updateProspect(brand, id, updates)
    if (!updated) return c.json({ error: 'Prospect not found' }, 404)
    return c.json({ prospect: updated })
  })

  // ── Admin: convert to deal ───────────────────────────────────────────────────
  app.post('/api/prospecting/:id/convert', (c) => {
    const brand = c.req.query('brand') ?? DEFAULT_BRAND
    const id = c.req.param('id')
    const prospect = getProspect(brand, id)
    if (!prospect) return c.json({ error: 'Prospect not found' }, 404)
    if (prospect.deal_id) return c.json({ error: 'Prospect already has a deal', deal_id: prospect.deal_id }, 409)

    // Ensure there is a contact to link.
    let contact_id = prospect.contact_id
    if (!contact_id) {
      const contact = createContact({
        brand,
        name: prospect.name,
        email: prospect.email ?? null,
        phone: prospect.phone ?? null,
        company: prospect.company ?? null,
        stage: 'lead',
        source: 'import',
        tags: ['prospect', prospect.source],
        notes: prospect.notes ?? '',
      })
      contact_id = contact.id
      void eventBus.emit({
        type: 'contact.created',
        brand,
        entity_id: contact.id,
        entity_type: 'contact',
        data: { name: contact.name, email: contact.email ?? '', source: contact.source ?? '', actor: 'prospecting' },
        occurred_at: new Date().toISOString(),
      })
    }

    const deal = createDeal({
      brand,
      title: `${prospect.company || prospect.name} — inbound`,
      contact_id,
      contact_name: prospect.name,
      stage: 'lead',
      tags: ['prospect', prospect.source],
      notes: `Converted from prospect (score ${prospect.score}, ${prospect.tier}).`,
    })
    void eventBus.emit({
      type: 'deal.created',
      brand,
      entity_id: deal.id,
      entity_type: 'deal',
      data: { title: deal.title, value: deal.value, contact_name: deal.contact_name ?? '', actor: 'prospecting' },
      occurred_at: new Date().toISOString(),
    })

    const updated = updateProspect(brand, id, { contact_id, deal_id: deal.id, status: 'converted' })
    return c.json({ ok: true, prospect: updated, contact_id, deal_id: deal.id })
  })

  // ── Admin: delete ────────────────────────────────────────────────────────────
  app.delete('/api/prospecting/:id', (c) => {
    const brand = c.req.query('brand') ?? DEFAULT_BRAND
    const ok = deleteProspect(brand, c.req.param('id'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'Prospect not found' }, 404)
  })
}
