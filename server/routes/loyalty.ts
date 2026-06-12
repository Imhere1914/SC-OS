import { Hono } from 'hono'
import {
  getLoyaltyProgram,
  upsertLoyaltyProgram,
  listAccounts,
  getLoyaltyAccount,
  awardPoints,
  redeemPoints,
  adjustPoints,
  listTransactions,
} from '../stores/loyalty-store'

export function registerLoyalty(app: Hono) {
  // ── Program ─────────────────────────────────────────────────────────────────

  app.get('/api/loyalty/program', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    return c.json(getLoyaltyProgram(brand))
  })

  app.put('/api/loyalty/program', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const body = await c.req.json() as Record<string, unknown>
    const program = upsertLoyaltyProgram(brand, body)
    return c.json(program)
  })

  // ── Accounts ─────────────────────────────────────────────────────────────────

  app.get('/api/loyalty/accounts', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const accounts = listAccounts(brand)
    const program = getLoyaltyProgram(brand)
    const tiersMap = Object.fromEntries(program.tiers.map(t => [t.id, t]))
    const enriched = accounts.map(a => ({ ...a, tier: tiersMap[a.tier_id] ?? null }))
    return c.json({ accounts: enriched })
  })

  app.get('/api/loyalty/accounts/:contactId', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const contactId = c.req.param('contactId')
    const account = getLoyaltyAccount(brand, contactId)
    if (!account) return c.json({ error: 'Not found' }, 404)
    const program = getLoyaltyProgram(brand)
    const tier = program.tiers.find(t => t.id === account.tier_id) ?? null
    return c.json({ ...account, tier })
  })

  // ── Award ────────────────────────────────────────────────────────────────────

  app.post('/api/loyalty/accounts/:contactId/award', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const contactId = c.req.param('contactId')
    const body = await c.req.json() as {
      points: number
      description: string
      reference_id?: string
      contact_name?: string
    }
    const contactName = body.contact_name ?? contactId
    const account = awardPoints(brand, contactId, contactName, body.points, body.description, body.reference_id)
    return c.json(account)
  })

  // ── Redeem ───────────────────────────────────────────────────────────────────

  app.post('/api/loyalty/accounts/:contactId/redeem', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const contactId = c.req.param('contactId')
    const body = await c.req.json() as { points: number; description: string }
    const account = redeemPoints(brand, contactId, body.points, body.description)
    if (!account) return c.json({ error: 'Insufficient points or account not found' }, 400)
    return c.json(account)
  })

  // ── Adjust ───────────────────────────────────────────────────────────────────

  app.post('/api/loyalty/accounts/:contactId/adjust', async (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const contactId = c.req.param('contactId')
    const body = await c.req.json() as { points: number; description: string }
    const account = adjustPoints(brand, contactId, body.points, body.description)
    return c.json(account)
  })

  // ── Transactions ─────────────────────────────────────────────────────────────

  app.get('/api/loyalty/transactions', (c) => {
    const brand = c.req.query('brand') ?? (process.env.BRAND ?? 'default')
    const contactId = c.req.query('contact_id')
    const transactions = listTransactions(brand, contactId)
    return c.json({ transactions })
  })
}
