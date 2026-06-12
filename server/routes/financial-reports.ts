import { Hono } from 'hono'
import {
  generatePL,
  generateBalanceSheet,
  generateARaging,
  generateCashFlow,
} from '../lib/financial-reports'

function currentYearRange(): { from: string; to: string } {
  const year = new Date().getFullYear()
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function registerFinancialReports(app: Hono) {
  // GET /api/reports/pl?from=&to=
  app.get('/api/reports/pl', (c) => {
    try {
      const brand = c.req.header('x-brand') ?? 'default'
      const defaults = currentYearRange()
      const from = c.req.query('from') ?? defaults.from
      const to = c.req.query('to') ?? defaults.to
      const report = generatePL(brand, { from, to })
      return c.json(report)
    } catch (err) {
      console.error('[financial-reports] P&L error:', err)
      return c.json({ error: 'Failed to generate P&L report' }, 500)
    }
  })

  // GET /api/reports/balance-sheet?as_of=
  app.get('/api/reports/balance-sheet', (c) => {
    try {
      const brand = c.req.header('x-brand') ?? 'default'
      const asOf = c.req.query('as_of') ?? todayStr()
      const report = generateBalanceSheet(brand, asOf)
      return c.json(report)
    } catch (err) {
      console.error('[financial-reports] Balance sheet error:', err)
      return c.json({ error: 'Failed to generate balance sheet' }, 500)
    }
  })

  // GET /api/reports/ar-aging
  app.get('/api/reports/ar-aging', (c) => {
    try {
      const brand = c.req.header('x-brand') ?? 'default'
      const report = generateARaging(brand)
      return c.json(report)
    } catch (err) {
      console.error('[financial-reports] AR aging error:', err)
      return c.json({ error: 'Failed to generate AR aging report' }, 500)
    }
  })

  // GET /api/reports/cash-flow?from=&to=
  app.get('/api/reports/cash-flow', (c) => {
    try {
      const brand = c.req.header('x-brand') ?? 'default'
      const defaults = currentYearRange()
      const from = c.req.query('from') ?? defaults.from
      const to = c.req.query('to') ?? defaults.to
      const report = generateCashFlow(brand, { from, to })
      return c.json(report)
    } catch (err) {
      console.error('[financial-reports] Cash flow error:', err)
      return c.json({ error: 'Failed to generate cash flow report' }, 500)
    }
  })
}
