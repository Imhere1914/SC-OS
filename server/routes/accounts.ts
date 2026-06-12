import type { Hono } from 'hono'
import type { AccountType, JournalEntry } from '../stores/accounts-store'
import {
  createAccount,
  createJournalEntry,
  deleteAccount,
  getAccount,
  getTrialBalance,
  listAccounts,
  listJournalEntries,
  updateAccount,
} from '../stores/accounts-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerAccounts(app: Hono) {
  // Trial balance — must come before /:id
  app.get('/api/accounts/trial-balance', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    return c.json(getTrialBalance(brand))
  })

  // List accounts
  app.get('/api/accounts', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const type = c.req.query('type') as AccountType | undefined
    const activeOnly = c.req.query('active_only') === 'true'
    return c.json(listAccounts(brand, { type, active_only: activeOnly }))
  })

  // Single account
  app.get('/api/accounts/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const record = getAccount(brand, id)
    if (!record) return c.json({ error: 'Account not found' }, 404)
    return c.json(record)
  })

  // Create account
  app.post('/api/accounts', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json() as Partial<Parameters<typeof createAccount>[1]>
    if (!body.code?.trim()) return c.json({ error: 'code required' }, 400)
    if (!body.name?.trim()) return c.json({ error: 'name required' }, 400)
    if (!body.type) return c.json({ error: 'type required' }, 400)
    if (!body.subtype) return c.json({ error: 'subtype required' }, 400)
    const result = createAccount(brand, {
      code: body.code,
      name: body.name,
      type: body.type,
      subtype: body.subtype,
      description: body.description,
      is_active: body.is_active ?? true,
      is_system: body.is_system ?? false,
      parent_id: body.parent_id,
    })
    if ('error' in result) return c.json(result, 400)
    return c.json(result, 201)
  })

  // Update account
  app.patch('/api/accounts/:id', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const body = await c.req.json() as Parameters<typeof updateAccount>[2]
    const result = updateAccount(brand, id, body)
    if (result === undefined) return c.json({ error: 'Account not found' }, 404)
    if ('error' in result) return c.json(result, 400)
    return c.json(result)
  })

  // Delete account
  app.delete('/api/accounts/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const result = deleteAccount(brand, id)
    if ('error' in result) {
      const status = result.error.includes('System accounts') ? 409 : 400
      return c.json(result, status)
    }
    return c.json(result)
  })

  // List journal entries
  app.get('/api/journal-entries', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const from = c.req.query('from')
    const to = c.req.query('to')
    const account_id = c.req.query('account_id')
    const source = c.req.query('source') as JournalEntry['source'] | undefined
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
    return c.json(listJournalEntries(brand, { from, to, account_id, source, limit }))
  })

  // Create journal entry
  app.post('/api/journal-entries', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json() as Omit<JournalEntry, 'id' | 'brand' | 'created_at'>
    if (!body.date) return c.json({ error: 'date required' }, 400)
    if (!body.description?.trim()) return c.json({ error: 'description required' }, 400)
    if (!Array.isArray(body.lines) || body.lines.length < 2) {
      return c.json({ error: 'at least 2 lines required' }, 400)
    }
    const result = createJournalEntry(brand, body)
    if ('error' in result) return c.json(result, 400)
    return c.json(result, 201)
  })
}
