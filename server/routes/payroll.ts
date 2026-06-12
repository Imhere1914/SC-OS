import type { Hono } from 'hono'
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  terminateEmployee,
  listPayRuns,
  getPayRun,
  calculatePayRun,
  approvePayRun,
  markPayRunPaid,
  getPayrollSummary,
  type EmployeeRecord,
  type EmployeeType,
  type PayRunRecord,
} from '../stores/payroll-store'

export function registerPayroll(app: Hono) {
  // ── Employees ──────────────────────────────────────────────────────────────

  app.get('/api/payroll/employees', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const { active_only, type } = c.req.query() as Record<string, string>
    const records = listEmployees(brand, {
      active_only: active_only === 'true' ? true : undefined,
      type: type as EmployeeType | undefined || undefined,
    })
    return c.json(records)
  })

  app.post('/api/payroll/employees', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<EmployeeRecord>
    if (!body.first_name || !body.last_name || !body.employee_type || !body.pay_schedule || !body.pay_type || body.pay_rate_cents === undefined) {
      return c.json({ error: 'first_name, last_name, employee_type, pay_schedule, pay_type, and pay_rate_cents required' }, 400)
    }
    const record = createEmployee(brand, {
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      employee_type: body.employee_type,
      job_title: body.job_title,
      department: body.department,
      pay_schedule: body.pay_schedule,
      pay_type: body.pay_type,
      pay_rate_cents: Number(body.pay_rate_cents),
      start_date: body.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: body.end_date,
      is_active: body.is_active ?? true,
      deductions: body.deductions ?? [],
      bank_account_last4: body.bank_account_last4,
      notes: body.notes,
    })
    return c.json(record, 201)
  })

  app.get('/api/payroll/employees/summary', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    return c.json(getPayrollSummary(brand))
  })

  app.get('/api/payroll/employees/:id', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const record = getEmployee(brand, c.req.param('id'))
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json(record)
  })

  app.patch('/api/payroll/employees/:id', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as Partial<EmployeeRecord>
    const updated = updateEmployee(brand, c.req.param('id'), body)
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  })

  app.post('/api/payroll/employees/:id/terminate', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as { end_date?: string }
    const end_date = body.end_date ?? new Date().toISOString().slice(0, 10)
    const updated = terminateEmployee(brand, c.req.param('id'), end_date)
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  })

  // ── Pay Runs ───────────────────────────────────────────────────────────────

  app.get('/api/payroll/runs', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const { status, year } = c.req.query() as Record<string, string>
    const records = listPayRuns(brand, {
      status: status as PayRunRecord['status'] | undefined || undefined,
      year: year ? Number(year) : undefined,
    })
    return c.json(records)
  })

  app.post('/api/payroll/runs/calculate', async (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const body = await c.req.json() as {
      pay_period_start?: string
      pay_period_end?: string
      pay_date?: string
      employee_ids?: string[]
    }
    if (!body.pay_period_start || !body.pay_period_end || !body.pay_date) {
      return c.json({ error: 'pay_period_start, pay_period_end, and pay_date required' }, 400)
    }
    const run = calculatePayRun(brand, body.pay_period_start, body.pay_period_end, body.pay_date, body.employee_ids)
    return c.json(run, 201)
  })

  app.get('/api/payroll/runs/:id', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const record = getPayRun(brand, c.req.param('id'))
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json(record)
  })

  app.post('/api/payroll/runs/:id/approve', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const updated = approvePayRun(brand, c.req.param('id'))
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  })

  app.post('/api/payroll/runs/:id/pay', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    const updated = markPayRunPaid(brand, c.req.param('id'))
    if (!updated) return c.json({ error: 'Not found' }, 404)
    return c.json(updated)
  })

  app.get('/api/payroll/summary', (c) => {
    const brand = c.req.header('x-brand') ?? 'sc'
    return c.json(getPayrollSummary(brand))
  })
}
