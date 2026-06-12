import type { Hono } from 'hono'
import {
  listPortalTokens,
  getPortalToken,
  createPortalToken,
  deletePortalToken,
  touchPortalToken,
  type CreatePortalTokenInput,
} from '../stores/portal-store'
import { getContact } from '../stores/contacts-store'
import { listProjects } from '../stores/projects-store'
import { listInvoices } from '../stores/invoices-store'
import { listProposals } from '../stores/proposals-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerPortal(app: Hono) {
  // ── List tokens (auth-required — internal use) ────────────────────────────
  app.get('/api/portal/tokens', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    return c.json(listPortalTokens(brand))
  })

  // ── Create token ──────────────────────────────────────────────────────────
  app.post('/api/portal/tokens', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = (typeof body.brand === 'string' ? body.brand : BRAND)
    if (!body.contact_id || typeof body.contact_id !== 'string') {
      return c.json({ error: 'contact_id required' }, 400)
    }
    if (!body.label || typeof body.label !== 'string') {
      return c.json({ error: 'label required' }, 400)
    }
    const input: CreatePortalTokenInput = {
      contact_id: body.contact_id,
      label: body.label,
      expires_at: typeof body.expires_at === 'string' ? body.expires_at : undefined,
      show_projects: body.show_projects !== false,
      show_invoices: body.show_invoices !== false,
      show_proposals: body.show_proposals !== false,
    }
    const token = createPortalToken(brand, input)
    return c.json(token, 201)
  })

  // ── Delete token ──────────────────────────────────────────────────────────
  app.delete('/api/portal/tokens/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    try {
      deletePortalToken(brand, id)
      return c.json({ ok: true })
    } catch {
      return c.json({ error: 'not found' }, 404)
    }
  })

  // ── Public portal endpoint — no auth ─────────────────────────────────────
  app.get('/api/portal/:token', async (c) => {
    const tokenId = c.req.param('token')
    const tokenRecord = getPortalToken(tokenId)

    if (!tokenRecord) {
      return c.json({ error: 'Portal not found' }, 404)
    }

    // Check expiry
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return c.json({ error: 'Portal link expired' }, 410)
    }

    // Touch (update access stats) — fire and forget, don't fail request
    try { touchPortalToken(tokenId) } catch { /* ignore */ }

    const { contact_id, brand } = tokenRecord

    // Fetch contact
    const contact = getContact(contact_id) ?? null

    // Fetch related data filtered by contact_id and brand
    const projects = tokenRecord.show_projects
      ? listProjects({ contact_id, brand }).slice(0, 50)
      : []

    const invoices = tokenRecord.show_invoices
      ? listInvoices(brand).filter(inv => inv.contact_id === contact_id).slice(0, 50)
      : []

    const proposals = tokenRecord.show_proposals
      ? listProposals(brand).filter(p => p.contact_id === contact_id).slice(0, 50)
      : []

    return c.json({
      token: {
        label: tokenRecord.label,
        show_projects: tokenRecord.show_projects,
        show_invoices: tokenRecord.show_invoices,
        show_proposals: tokenRecord.show_proposals,
      },
      contact,
      projects,
      invoices,
      proposals,
    })
  })
}
