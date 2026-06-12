import type { Hono } from 'hono'
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listContracts,
  getContract,
  getContractByToken,
  createContract,
  updateContract,
  deleteContract,
  signContract,
} from '../stores/contracts-store'
import { appendActivity } from '../stores/activity-store'
import { appendNotification } from '../stores/notifications-store'
import { getBrandId } from '../lib/brand'

export function registerContracts(app: Hono) {
  // ── Templates ─────────────────────────────────────────────────────────────

  app.get('/api/contracts/templates', (c) => {
    const brand = getBrandId(c)
    return c.json(listTemplates(brand))
  })

  app.post('/api/contracts/templates', async (c) => {
    const body = await c.req.json()
    const brand = body.brand ?? getBrandId(c)
    if (!body.name?.trim()) return c.json({ error: 'name required' }, 400)
    const template = createTemplate(brand, body)
    return c.json(template, 201)
  })

  app.get('/api/contracts/templates/:id', (c) => {
    const brand = getBrandId(c)
    const template = getTemplate(brand, c.req.param('id'))
    if (!template) return c.json({ error: 'not found' }, 404)
    return c.json(template)
  })

  app.patch('/api/contracts/templates/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? getBrandId(c)
    const updated = updateTemplate(brand, id, body)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  app.delete('/api/contracts/templates/:id', (c) => {
    const id = c.req.param('id')
    const brand = getBrandId(c)
    const ok = deleteTemplate(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ── Public: sign by token — MUST be before /:id routes ───────────────────

  app.get('/api/contracts/sign/:token', (c) => {
    const token = c.req.param('token')
    const contract = getContractByToken(token)
    if (!contract) return c.json({ error: 'not found' }, 404)
    // Return safe subset
    return c.json({
      id: contract.id,
      title: contract.title,
      contact_name: contract.contact_name,
      body_html: contract.body_html,
      status: contract.status,
      signed_at: contract.signed_at,
      signature_name: contract.signature_name,
      expires_at: contract.expires_at,
    })
  })

  app.post('/api/contracts/sign/:token', async (c) => {
    const token = c.req.param('token')
    const contract = getContractByToken(token)
    if (!contract) return c.json({ error: 'not found' }, 404)
    if (contract.status === 'signed') {
      return c.json({ error: 'Contract already signed' }, 409)
    }
    if (contract.status === 'expired' || contract.status === 'cancelled') {
      return c.json({ error: 'Contract is no longer available for signing' }, 410)
    }
    const body = await c.req.json().catch(() => ({})) as { signature_data?: string; signature_name?: string }
    if (!body.signature_data || !body.signature_name) {
      return c.json({ error: 'signature_data and signature_name required' }, 400)
    }
    if (body.signature_data.length > 2_000_000 || body.signature_name.length > 200) {
      return c.json({ error: 'signature payload too large' }, 400)
    }
    const ip =
      c.req.header('x-forwarded-for') ??
      c.req.header('x-real-ip') ??
      'unknown'
    const signed = signContract(contract.brand, contract.id, body.signature_data, body.signature_name, ip)
    if (!signed) return c.json({ error: 'sign failed' }, 500)

    if (signed.contact_id) {
      appendActivity({
        contact_id: signed.contact_id,
        type: 'custom',
        description: `Contract "${signed.title}" signed by ${body.signature_name}`,
      })
    }
    appendNotification({
      brand: signed.brand,
      message: `Contract signed: ${signed.title}`,
      context_summary: body.signature_name ? `Signed by ${body.signature_name}` : '',
    })
    return c.json({ ok: true, signed_at: signed.signed_at })
  })

  // ── Contracts CRUD ────────────────────────────────────────────────────────

  app.get('/api/contracts', (c) => {
    const brand = getBrandId(c)
    return c.json(listContracts(brand))
  })

  app.post('/api/contracts', async (c) => {
    const body = await c.req.json()
    const brand = body.brand ?? getBrandId(c)
    if (!body.title?.trim()) return c.json({ error: 'title required' }, 400)
    const contract = createContract(brand, body)
    if (contract.contact_id) {
      appendActivity({
        contact_id: contract.contact_id,
        type: 'custom',
        description: `Contract "${contract.title}" created`,
      })
    }
    appendNotification({
      brand,
      message: `Contract created: ${contract.title}`,
      context_summary: contract.contact_name ? `For ${contract.contact_name}` : '',
    })
    return c.json(contract, 201)
  })

  app.get('/api/contracts/:id', (c) => {
    const brand = getBrandId(c)
    const contract = getContract(brand, c.req.param('id'))
    if (!contract) return c.json({ error: 'not found' }, 404)
    return c.json(contract)
  })

  app.patch('/api/contracts/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? getBrandId(c)
    const updated = updateContract(brand, id, body)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  app.delete('/api/contracts/:id', (c) => {
    const id = c.req.param('id')
    const brand = getBrandId(c)
    const ok = deleteContract(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ── Send — mark as sent ───────────────────────────────────────────────────

  app.post('/api/contracts/:id/send', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({})) as Record<string, string>
    const brand = body.brand ?? getBrandId(c)
    const contract = getContract(brand, id)
    if (!contract) return c.json({ error: 'not found' }, 404)
    const now = new Date().toISOString()
    const updated = updateContract(brand, id, {
      status: 'sent',
      sent_at: contract.sent_at ?? now,
    })
    if (!updated) return c.json({ error: 'update failed' }, 500)
    if (updated.contact_id) {
      appendActivity({
        contact_id: updated.contact_id,
        type: 'custom',
        description: `Contract "${updated.title}" sent`,
      })
    }
    appendNotification({
      brand,
      message: `Contract sent: ${updated.title}`,
      context_summary: updated.contact_name ? `To ${updated.contact_name}` : '',
    })
    return c.json(updated)
  })
}
