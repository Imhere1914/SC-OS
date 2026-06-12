import type { Hono } from 'hono'
import {
  createBankAccount,
  createTransaction,
  deleteBankAccount,
  deleteTransaction,
  getBankAccount,
  getAccountStatement,
  importTransactions,
  listBankAccounts,
  listTransactions,
  reconcileAccount,
  updateBankAccount,
  updateTransaction,
} from '../stores/bank-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerBanking(app: Hono) {
  // ── Accounts ────────────────────────────────────────────────────────────────

  app.get('/api/banking/accounts', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    return c.json(listBankAccounts(brand))
  })

  app.post('/api/banking/accounts', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json()
    if (!body.name?.trim()) return c.json({ error: 'name required' }, 400)
    if (!body.category) return c.json({ error: 'category required' }, 400)
    const account = createBankAccount(brand, {
      name: body.name,
      institution: body.institution,
      account_number_last4: body.account_number_last4,
      category: body.category,
      currency: body.currency ?? 'USD',
      opening_balance_cents: body.opening_balance_cents ?? 0,
      is_active: body.is_active ?? true,
      color: body.color,
    })
    return c.json(account, 201)
  })

  app.patch('/api/banking/accounts/:id', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const body = await c.req.json()
    const updated = updateBankAccount(brand, id, body)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  app.delete('/api/banking/accounts/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const ok = deleteBankAccount(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ── Transactions ────────────────────────────────────────────────────────────

  app.get('/api/banking/transactions', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const account_id = c.req.query('account_id')
    const from = c.req.query('from')
    const to = c.req.query('to')
    const is_reconciled = c.req.query('is_reconciled')
    const type = c.req.query('type') as 'debit' | 'credit' | undefined
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
    return c.json(listTransactions(brand, {
      account_id,
      from,
      to,
      is_reconciled: is_reconciled !== undefined ? is_reconciled === 'true' : undefined,
      type,
      limit,
    }))
  })

  app.post('/api/banking/transactions', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json()
    if (!body.account_id) return c.json({ error: 'account_id required' }, 400)
    if (!body.description?.trim()) return c.json({ error: 'description required' }, 400)
    if (!body.amount_cents || body.amount_cents <= 0) return c.json({ error: 'amount_cents must be positive' }, 400)
    if (!body.type || !['debit', 'credit'].includes(body.type)) return c.json({ error: 'type must be debit or credit' }, 400)
    const account = getBankAccount(brand, body.account_id)
    if (!account) return c.json({ error: 'account not found' }, 404)
    const txn = createTransaction(brand, {
      account_id: body.account_id,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      description: body.description,
      payee: body.payee,
      amount_cents: body.amount_cents,
      type: body.type,
      category: body.category,
      category_name: body.category_name,
      reference: body.reference,
      memo: body.memo,
      is_reconciled: false,
      source: 'manual',
      linked_invoice_id: body.linked_invoice_id,
      linked_bill_id: body.linked_bill_id,
    })
    return c.json(txn, 201)
  })

  app.patch('/api/banking/transactions/:id', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const body = await c.req.json()
    const updated = updateTransaction(brand, id, body)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  app.delete('/api/banking/transactions/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const ok = deleteTransaction(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  app.post('/api/banking/transactions/import', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json()
    if (!body.account_id) return c.json({ error: 'account_id required' }, 400)
    if (!Array.isArray(body.transactions) || body.transactions.length === 0)
      return c.json({ error: 'transactions array required' }, 400)
    const account = getBankAccount(brand, body.account_id)
    if (!account) return c.json({ error: 'account not found' }, 404)
    const result = importTransactions(brand, body.account_id, body.transactions)
    return c.json(result, 201)
  })

  // ── Reconciliation ──────────────────────────────────────────────────────────

  app.post('/api/banking/reconcile', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json()
    if (!body.account_id) return c.json({ error: 'account_id required' }, 400)
    if (!body.statement_date) return c.json({ error: 'statement_date required' }, 400)
    if (body.statement_balance_cents === undefined) return c.json({ error: 'statement_balance_cents required' }, 400)
    if (!Array.isArray(body.cleared_transaction_ids)) return c.json({ error: 'cleared_transaction_ids array required' }, 400)
    const account = getBankAccount(brand, body.account_id)
    if (!account) return c.json({ error: 'account not found' }, 404)
    const record = reconcileAccount(brand, body.account_id, body.statement_date, body.statement_balance_cents, body.cleared_transaction_ids)
    return c.json(record, 201)
  })

  // ── Statement ───────────────────────────────────────────────────────────────

  app.get('/api/banking/statement', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const account_id = c.req.query('account_id')
    const from = c.req.query('from')
    const to = c.req.query('to')
    if (!account_id) return c.json({ error: 'account_id required' }, 400)
    const rows = getAccountStatement(
      brand,
      account_id,
      from ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
      to ?? new Date().toISOString().slice(0, 10),
    )
    return c.json(rows)
  })
}
