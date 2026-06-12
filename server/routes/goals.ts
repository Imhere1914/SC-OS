import type { Hono } from 'hono'
import {
  createGoal,
  deleteGoal,
  getGoal,
  listGoals,
  updateGoal,
  updateKeyResult,
  type GoalPeriod,
  type GoalStatus,
} from '../stores/goals-store'

const VALID_PERIODS: GoalPeriod[] = ['Q1', 'Q2', 'Q3', 'Q4', 'annual', 'custom']
const VALID_STATUSES: GoalStatus[] = ['on_track', 'at_risk', 'behind', 'completed', 'cancelled']

function getBrand(_c: unknown, query?: string | null): string {
  return query ?? process.env.BRAND ?? 'default'
}

export function registerGoals(app: Hono): void {
  // GET /api/goals — list
  app.get('/api/goals', (c) => {
    const u = new URL(c.req.url)
    const brand = getBrand(c, u.searchParams.get('brand'))
    const period = u.searchParams.get('period') as GoalPeriod | null
    const year = u.searchParams.has('year') ? Number(u.searchParams.get('year')) : undefined
    const status = u.searchParams.get('status') as GoalStatus | null
    return c.json({
      goals: listGoals(brand, {
        period: period && VALID_PERIODS.includes(period) ? period : undefined,
        year: year && !isNaN(year) ? year : undefined,
        status: status && VALID_STATUSES.includes(status) ? status : undefined,
      }),
    })
  })

  // GET /api/goals/:id
  app.get('/api/goals/:id', (c) => {
    const u = new URL(c.req.url)
    const brand = getBrand(c, u.searchParams.get('brand'))
    const goal = getGoal(brand, c.req.param('id'))
    return goal ? c.json({ goal }) : c.json({ error: 'Not found' }, 404)
  })

  // POST /api/goals
  app.post('/api/goals', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : (process.env.BRAND ?? 'default')

    if (typeof b.title !== 'string' || !b.title.trim()) {
      return c.json({ error: 'title is required' }, 400)
    }
    if (!VALID_PERIODS.includes(b.period as GoalPeriod)) {
      return c.json({ error: 'valid period (Q1/Q2/Q3/Q4/annual/custom) is required' }, 400)
    }

    const goal = createGoal(brand, {
      title: b.title.trim(),
      description: typeof b.description === 'string' ? b.description : undefined,
      period: b.period as GoalPeriod,
      year: typeof b.year === 'number' ? b.year : new Date().getFullYear(),
      custom_start: typeof b.custom_start === 'string' ? b.custom_start : undefined,
      custom_end: typeof b.custom_end === 'string' ? b.custom_end : undefined,
      owner: typeof b.owner === 'string' ? b.owner : undefined,
      status: VALID_STATUSES.includes(b.status as GoalStatus) ? b.status as GoalStatus : undefined,
      key_results: Array.isArray(b.key_results)
        ? (b.key_results as Array<Record<string, unknown>>).map(kr => ({
            title: typeof kr.title === 'string' ? kr.title : '',
            target_value: typeof kr.target_value === 'number' ? kr.target_value : 0,
            current_value: typeof kr.current_value === 'number' ? kr.current_value : 0,
            unit: typeof kr.unit === 'string' ? kr.unit : '',
            status: VALID_STATUSES.includes(kr.status as GoalStatus) ? kr.status as GoalStatus : undefined,
            due_date: typeof kr.due_date === 'string' ? kr.due_date : undefined,
          }))
        : [],
    })
    return c.json({ goal }, 201)
  })

  // PATCH /api/goals/:id
  app.patch('/api/goals/:id', async (c) => {
    const u = new URL(c.req.url)
    const brand = getBrand(c, u.searchParams.get('brand'))
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

    const goal = updateGoal(brand, c.req.param('id'), {
      title: typeof b.title === 'string' ? b.title.trim() : undefined,
      description: typeof b.description === 'string' ? b.description : undefined,
      period: VALID_PERIODS.includes(b.period as GoalPeriod) ? b.period as GoalPeriod : undefined,
      year: typeof b.year === 'number' ? b.year : undefined,
      custom_start: typeof b.custom_start === 'string' ? b.custom_start : undefined,
      custom_end: typeof b.custom_end === 'string' ? b.custom_end : undefined,
      owner: typeof b.owner === 'string' ? b.owner : undefined,
      status: VALID_STATUSES.includes(b.status as GoalStatus) ? b.status as GoalStatus : undefined,
      key_results: Array.isArray(b.key_results) ? b.key_results as never : undefined,
    })
    return goal ? c.json({ goal }) : c.json({ error: 'Not found' }, 404)
  })

  // DELETE /api/goals/:id
  app.delete('/api/goals/:id', (c) => {
    const u = new URL(c.req.url)
    const brand = getBrand(c, u.searchParams.get('brand'))
    return deleteGoal(brand, c.req.param('id'))
      ? c.json({ ok: true })
      : c.json({ error: 'Not found' }, 404)
  })

  // PATCH /api/goals/:id/kr/:krId — update a key result
  app.patch('/api/goals/:id/kr/:krId', async (c) => {
    const u = new URL(c.req.url)
    const brand = getBrand(c, u.searchParams.get('brand'))
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

    const goal = updateKeyResult(brand, c.req.param('id'), c.req.param('krId'), {
      current_value: typeof b.current_value === 'number' ? b.current_value : undefined,
      target_value: typeof b.target_value === 'number' ? b.target_value : undefined,
      title: typeof b.title === 'string' ? b.title : undefined,
      unit: typeof b.unit === 'string' ? b.unit : undefined,
      status: VALID_STATUSES.includes(b.status as GoalStatus) ? b.status as GoalStatus : undefined,
      due_date: typeof b.due_date === 'string' ? b.due_date : undefined,
    })
    return goal ? c.json({ goal }) : c.json({ error: 'Not found' }, 404)
  })
}
