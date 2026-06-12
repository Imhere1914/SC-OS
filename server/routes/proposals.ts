import type { Hono } from 'hono'
import {
  listProposals,
  getProposal,
  createProposal,
  updateProposal,
  deleteProposal,
} from '../stores/proposals-store'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'
import { eventBus } from '../lib/event-bus'

const BRAND = process.env.BRAND ?? 'default'

export function registerProposals(app: Hono) {
  // ── List ──────────────────────────────────────────────────────────────────
  app.get('/api/proposals', (c) => {
    const brand = c.req.query('brand')
    return c.json(listProposals(brand))
  })

  // ── Get one ───────────────────────────────────────────────────────────────
  app.get('/api/proposals/:id', (c) => {
    const brand = c.req.query('brand')
    const proposal = getProposal(c.req.param('id'), brand)
    if (!proposal) return c.json({ error: 'not found' }, 404)
    return c.json(proposal)
  })

  // ── Create ────────────────────────────────────────────────────────────────
  app.post('/api/proposals', async (c) => {
    const body = await c.req.json()
    if (!body.title?.trim()) return c.json({ error: 'title required' }, 400)
    const proposal = createProposal(body)
    if (proposal.contact_id) {
      appendActivity({
        contact_id: proposal.contact_id,
        type: 'custom',
        description: `Proposal "${proposal.title}" created`,
      })
    }
    appendNotification({
      brand: BRAND,
      message: `Proposal created: ${proposal.title}`,
      context_summary: proposal.contact_name ? `For ${proposal.contact_name}` : '',
    })
    return c.json(proposal, 201)
  })

  // ── Update ────────────────────────────────────────────────────────────────
  app.patch('/api/proposals/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand')
    const prev = getProposal(id, brand)
    if (!prev) return c.json({ error: 'not found' }, 404)
    const updated = updateProposal(id, body, brand)
    if (!updated) return c.json({ error: 'not found' }, 404)
    // Log status transitions
    if (prev.status !== updated.status) {
      if (updated.contact_id) {
        appendActivity({
          contact_id: updated.contact_id,
          type: 'custom',
          description: `Proposal "${updated.title}" status changed to ${updated.status}`,
        })
      }
      appendNotification({
        brand: BRAND,
        message: `Proposal ${updated.status}: ${updated.title}`,
        context_summary: updated.contact_name ? `For ${updated.contact_name}` : '',
      })
    }
    return c.json(updated)
  })

  // ── Delete ────────────────────────────────────────────────────────────────
  app.delete('/api/proposals/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = deleteProposal(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ── Send — mark as sent (+ optionally email link) ─────────────────────────
  app.post('/api/proposals/:id/send', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({})) as Record<string, string>
    const brand = body.brand ?? c.req.query('brand')
    const proposal = getProposal(id, brand)
    if (!proposal) return c.json({ error: 'not found' }, 404)
    if (proposal.status !== 'draft') {
      return c.json({ error: 'Proposal is not in draft status' }, 409)
    }
    const updated = updateProposal(id, { status: 'sent' }, brand)
    if (!updated) return c.json({ error: 'update failed' }, 500)
    if (updated.contact_id) {
      appendActivity({
        contact_id: updated.contact_id,
        type: 'custom',
        description: `Proposal "${updated.title}" sent`,
      })
    }
    appendNotification({
      brand: BRAND,
      message: `Proposal sent: ${updated.title}`,
      context_summary: updated.contact_name ? `To ${updated.contact_name}` : '',
    })
    return c.json(updated)
  })

  // ── Public view — no auth, marks viewed ──────────────────────────────────
  app.get('/api/proposals/:id/public', (c) => {
    const proposal = getProposal(c.req.param('id'))
    if (!proposal) return c.json({ error: 'not found' }, 404)
    // Mark as viewed if it's in 'sent' status
    if (proposal.status === 'sent') {
      updateProposal(proposal.id, { status: 'viewed' }, proposal.brand)
    }
    return c.json({
      id: proposal.id,
      title: proposal.title,
      brand: proposal.brand,
      contact_name: proposal.contact_name,
      contact_email: proposal.contact_email,
      status: proposal.status,
      sections: proposal.sections,
      valid_until: proposal.valid_until,
      notes: proposal.notes,
      created_at: proposal.created_at,
      signing_required: proposal.signing_required,
      signed_at: proposal.signed_at,
      signature_name: proposal.signature_name,
    })
  })

  // ── Respond — PUBLIC, no auth needed (hit by clients) ─────────────────────
  // Only accepts accept/decline and only from an outstanding (sent/viewed)
  // proposal — the public GET above moves sent → viewed on first load.
  app.post('/api/proposals/:id/respond', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({})) as { action?: string }
    if (body.action !== 'accept' && body.action !== 'decline') {
      return c.json({ error: "action must be 'accept' or 'decline'" }, 400)
    }
    const proposal = getProposal(id)
    if (!proposal) return c.json({ error: 'not found' }, 404)
    if (proposal.status !== 'sent' && proposal.status !== 'viewed') {
      return c.json({ error: 'Proposal is not awaiting a response' }, 409)
    }

    const status = body.action === 'accept' ? 'accepted' : 'declined'
    const updated = updateProposal(id, { status }, proposal.brand)
    if (!updated) return c.json({ error: 'update failed' }, 500)

    if (updated.contact_id) {
      appendActivity({
        contact_id: updated.contact_id,
        type: 'custom',
        description: `Proposal "${updated.title}" ${status} by client`,
      })
    }
    appendNotification({
      brand: BRAND,
      message: `Proposal ${status}: ${updated.title}`,
      context_summary: updated.contact_name ? `For ${updated.contact_name}` : '',
    })
    return c.json(updated)
  })

  // ── Sign — PUBLIC, no auth needed (hit by clients) ────────────────────────
  app.post('/api/proposals/:id/sign', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({})) as {
      signature_data?: string
      signature_name?: string
      signature_email?: string
    }
    if (!body.signature_data || !body.signature_name || !body.signature_email) {
      return c.json({ error: 'signature_data, signature_name, and signature_email are required' }, 400)
    }
    if (
      body.signature_data.length > 2_000_000 ||
      body.signature_name.length > 200 ||
      body.signature_email.length > 320
    ) {
      return c.json({ error: 'signature payload too large' }, 400)
    }
    const proposal = getProposal(id)
    if (!proposal) return c.json({ error: 'not found' }, 404)

    const ip =
      c.req.header('x-forwarded-for') ??
      c.req.header('x-real-ip') ??
      'unknown'

    const updates: Parameters<typeof updateProposal>[1] = {
      signature_data: body.signature_data,
      signature_name: body.signature_name,
      signature_email: body.signature_email,
      signature_ip: ip,
      signed_at: new Date().toISOString(),
    }
    // Accept the proposal if it was in sent/viewed state
    if (proposal.status === 'sent' || proposal.status === 'viewed') {
      updates.status = 'accepted'
    }

    const updated = updateProposal(id, updates, proposal.brand)
    if (!updated) return c.json({ error: 'update failed' }, 500)

    // Log activity
    if (updated.contact_id) {
      appendActivity({
        contact_id: updated.contact_id,
        type: 'custom',
        description: `Proposal "${updated.title}" signed by ${body.signature_name}`,
      })
    }

    appendNotification({
      brand: BRAND,
      message: `Proposal signed: ${updated.title}`,
      context_summary: body.signature_name ? `Signed by ${body.signature_name}` : '',
    })
    void eventBus.emit({
      type: 'proposal.signed',
      brand: updated.brand ?? BRAND,
      entity_id: updated.id,
      entity_type: 'proposal',
      data: { title: updated.title, contact_name: updated.contact_name ?? '', contact_email: updated.contact_email ?? '', contact_id: updated.contact_id ?? '', signature_name: body.signature_name, actor: body.signature_name },
      occurred_at: new Date().toISOString(),
    })

    return c.json(updated)
  })
}
