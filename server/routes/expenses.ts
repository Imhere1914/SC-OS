import type { Hono } from 'hono'
import {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  type ExpenseRecord,
  type ExpenseCategory,
} from '../stores/expenses-store'

export function registerExpenses(app: Hono) {
  // List
  app.get('/api/expenses', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const { category, from, to, reimbursable } = c.req.query() as Record<string, string>
    const records = listExpenses(brand, {
      category: category as ExpenseCategory | undefined || undefined,
      from: from || undefined,
      to: to || undefined,
      reimbursable: reimbursable !== undefined ? reimbursable === 'true' : undefined,
    })
    return c.json(records)
  })

  // Summary — must come before /:id
  app.get('/api/expenses/summary', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const { from, to } = c.req.query() as Record<string, string>
    return c.json(getExpenseSummary(brand, {
      from: from || undefined,
      to: to || undefined,
    }))
  })

  // Get one
  app.get('/api/expenses/:id', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const record = getExpense(brand, c.req.param('id'))
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json(record)
  })

  // Create
  app.post('/api/expenses', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<ExpenseRecord>
    if (!body.title || body.amount_cents === undefined || !body.category) {
      return c.json({ error: 'title, amount_cents, and category required' }, 400)
    }
    const record = createExpense(brand, {
      title: body.title,
      amount_cents: Number(body.amount_cents),
      category: body.category,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      vendor: body.vendor,
      notes: body.notes,
      receipt_url: body.receipt_url,
      project_id: body.project_id,
      project_name: body.project_name,
      reimbursable: body.reimbursable ?? false,
      reimbursed: body.reimbursed ?? false,
      tax_deductible: body.tax_deductible ?? false,
    })
    return c.json(record, 201)
  })

  // Update
  app.patch('/api/expenses/:id', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<ExpenseRecord>
    const updated = updateExpense(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  })

  // Delete
  app.delete('/api/expenses/:id', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const ok = deleteExpense(brand, c.req.param('id'))
    if (!ok) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  })
}
