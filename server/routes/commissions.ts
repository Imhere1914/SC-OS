import type { Hono } from 'hono'
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  listCommissions,
  createCommission,
  updateCommission,
  deleteCommission,
  getCommissionSummary,
  type CommissionRule,
  type CommissionRecord,
} from '../stores/commissions-store'

export function registerCommissions(app: Hono) {
  // ── Rules ────────────────────────────────────────────────────────────────────

  app.get('/api/commissions/rules', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    return c.json(listRules(brand))
  })

  app.post('/api/commissions/rules', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<CommissionRule>
    if (!body.name || !body.assignee || body.rate_pct === undefined || !body.applies_to) {
      return c.json({ error: 'name, assignee, rate_pct, and applies_to required' }, 400)
    }
    const rule = createRule(brand, {
      name: body.name,
      assignee: body.assignee,
      rate_pct: Number(body.rate_pct),
      applies_to: body.applies_to,
      active: body.active ?? true,
    })
    return c.json(rule, 201)
  })

  app.patch('/api/commissions/rules/:id', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<CommissionRule>
    const updated = updateRule(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  })

  app.delete('/api/commissions/rules/:id', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const ok = deleteRule(brand, c.req.param('id'))
    if (!ok) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  })

  // ── Summary — must come before /:id ──────────────────────────────────────────

  app.get('/api/commissions/summary', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    return c.json(getCommissionSummary(brand))
  })

  // ── Bulk actions — must come before /:id ─────────────────────────────────────

  app.post('/api/commissions/bulk-approve', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as { ids: string[] }
    if (!Array.isArray(body.ids)) return c.json({ error: 'ids array required' }, 400)
    const updated = body.ids
      .map(id => updateCommission(brand, id, { status: 'approved' }))
      .filter(Boolean)
    return c.json({ updated: updated.length })
  })

  app.post('/api/commissions/bulk-pay', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as { ids: string[] }
    if (!Array.isArray(body.ids)) return c.json({ error: 'ids array required' }, 400)
    const now = new Date().toISOString()
    const updated = body.ids
      .map(id => updateCommission(brand, id, { status: 'paid', paid_at: now }))
      .filter(Boolean)
    return c.json({ updated: updated.length })
  })

  // ── Commissions ───────────────────────────────────────────────────────────────

  app.get('/api/commissions', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const { assignee, status, from, to } = c.req.query() as Record<string, string>
    const records = listCommissions(brand, {
      assignee: assignee || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    })
    return c.json(records)
  })

  app.post('/api/commissions', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<CommissionRecord>
    if (
      !body.assignee ||
      !body.reference_type ||
      !body.reference_id ||
      !body.reference_label ||
      body.amount_cents === undefined ||
      body.rate_pct === undefined
    ) {
      return c.json(
        { error: 'assignee, reference_type, reference_id, reference_label, amount_cents, and rate_pct required' },
        400,
      )
    }
    const rate = Number(body.rate_pct)
    const commission_cents = Math.round((Number(body.amount_cents) * rate) / 100)
    const record = createCommission(brand, {
      rule_id: body.rule_id,
      assignee: body.assignee,
      reference_type: body.reference_type,
      reference_id: body.reference_id,
      reference_label: body.reference_label,
      amount_cents: Number(body.amount_cents),
      commission_cents,
      rate_pct: rate,
      status: body.status ?? 'pending',
      notes: body.notes,
    })
    return c.json(record, 201)
  })

  app.patch('/api/commissions/:id', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<CommissionRecord>
    // Auto-set paid_at when status transitions to paid
    if (body.status === 'paid' && !body.paid_at) {
      body.paid_at = new Date().toISOString()
    }
    const updated = updateCommission(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  })

  app.delete('/api/commissions/:id', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const ok = deleteCommission(brand, c.req.param('id'))
    if (!ok) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  })
}
