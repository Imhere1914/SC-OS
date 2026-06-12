import type { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { getBrandId } from '../lib/brand'
import {
  listCategories, listSessions, getSession, createSession, updateSession,
  deleteSession, publishSession, unpublishSession,
  addCard, updateCard, removeCard, reorderCards,
  getProgress, getOrCreateProgress, completeSession, getNextSession, getWellnessStats,
  getEngagementStats,
  getDailyPlanView, completeDailyTask, setFocusArea, listFocusAreas,
  setReminderPrefs,
  listActions, migrateSessionMeta,
  CATEGORIES,
} from '../stores/wellness-store'
import type { WellnessCard, WellnessProgress } from '../stores/wellness-store'

let _migratedBrands: Set<string> | null = null
function ensureSessionMeta(brand: string): void {
  if (!_migratedBrands) _migratedBrands = new Set()
  if (_migratedBrands.has(brand)) return
  migrateSessionMeta(brand)
  _migratedBrands.add(brand)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function progressSummary(p: WellnessProgress) {
  const levelMap: Record<string, number> = {}
  for (const cat of CATEGORIES) {
    levelMap[cat.key] = p.category_progress[cat.key]?.level ?? 1
  }
  return {
    streak_days: p.streak_days,
    longest_streak: p.longest_streak,
    total_points: p.total_points,
    total_sessions: p.total_sessions,
    level_map: levelMap,
  }
}

export function registerWellness(app: Hono): void {
  // ── Public (no auth) ──────────────────────────────────────────────────────────

  app.get('/api/wellness/categories', (c) => {
    return c.json({ categories: listCategories() })
  })

  app.get('/api/wellness/today', (c) => {
    const brand = getBrandId(c)
    const token = c.req.query('token')
    const next = getNextSession(brand, token ?? '__none__')
    if (!token) {
      return c.json({ next_session: next, progress_summary: null })
    }
    const progress = getProgress(brand, token)
    return c.json({ next_session: next, progress_summary: progressSummary(progress) })
  })

  app.post('/api/wellness/start', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const token = nanoid()
    const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 200) : undefined
    const email = typeof b.email === 'string' && b.email.trim() ? b.email.trim().slice(0, 320) : undefined
    const progress = getOrCreateProgress(brand, token, name, email)
    return c.json({ token, progress }, 201)
  })

  app.post('/api/wellness/complete', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const token = typeof b.token === 'string' ? b.token : ''
    const sessionId = typeof b.session_id === 'string' ? b.session_id : ''
    if (!token) return c.json({ error: 'token is required' }, 400)
    if (!sessionId) return c.json({ error: 'session_id is required' }, 400)
    let reflections: Record<string, string> | undefined
    if (b.reflections && typeof b.reflections === 'object' && !Array.isArray(b.reflections)) {
      reflections = {}
      for (const [k, v] of Object.entries(b.reflections as Record<string, unknown>)) {
        if (Object.keys(reflections).length >= 100) break
        if (typeof v === 'string') reflections[k] = v.slice(0, 10_000)
      }
    }
    const result = completeSession(brand, token, sessionId, todayISO(), reflections)
    if (!result) return c.json({ error: 'Session not found' }, 404)
    return c.json(result)
  })

  // ── Daily Plan engine (public) ─────────────────────────────────────────────────

  app.get('/api/wellness/plan/today', (c) => {
    const brand = getBrandId(c)
    const token = c.req.query('token')
    if (!token) return c.json({ error: 'token is required' }, 400)
    ensureSessionMeta(brand)
    const view = getDailyPlanView(brand, token, todayISO())
    return c.json(view)
  })

  app.post('/api/wellness/reminders', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const token = typeof b.token === 'string' ? b.token : ''
    if (!token) return c.json({ error: 'token is required' }, 400)
    const optIn = b.opt_in === true
    const email = typeof b.email === 'string' ? b.email.trim() : undefined
    const progress = setReminderPrefs(brand, token, optIn, email)
    return c.json({
      reminder_email_opt_in: progress.reminder_email_opt_in === true,
      reminder_email: progress.reminder_email ?? progress.patient_email ?? null,
    })
  })

  app.post('/api/wellness/plan/complete-task', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const token = typeof b.token === 'string' ? b.token : ''
    if (!token) return c.json({ error: 'token is required' }, 400)
    if (typeof b.item_index !== 'number') return c.json({ error: 'item_index is required' }, 400)
    ensureSessionMeta(brand)
    const result = completeDailyTask(brand, token, b.item_index, todayISO())
    if (!result) return c.json({ error: 'Plan or item not found' }, 404)
    return c.json(result)
  })

  app.post('/api/wellness/focus', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const token = typeof b.token === 'string' ? b.token : ''
    if (!token) return c.json({ error: 'token is required' }, 400)
    const focusArea = typeof b.focus_area === 'string' ? b.focus_area : null
    const progress = setFocusArea(brand, token, focusArea)
    return c.json({ focus_area: progress.focus_area ?? null })
  })

  app.get('/api/wellness/focus-areas', (c) => {
    return c.json({ focus_areas: listFocusAreas() })
  })

  app.get('/api/wellness/session/:id', (c) => {
    const brand = getBrandId(c)
    const session = getSession(brand, c.req.param('id'))
    if (!session || session.status !== 'published') return c.json({ error: 'Not found' }, 404)
    return c.json({ session })
  })

  app.get('/api/wellness/progress', (c) => {
    const brand = getBrandId(c)
    const token = c.req.query('token')
    if (!token) return c.json({ error: 'token is required' }, 400)
    const progress = getProgress(brand, token)
    return c.json({ progress, summary: progressSummary(progress) })
  })

  // ── Admin (authenticated) ─────────────────────────────────────────────────────

  app.get('/api/wellness/admin/sessions', (c) => {
    const brand = getBrandId(c)
    const status = c.req.query('status') ?? undefined
    return c.json({ sessions: listSessions(brand, { status }) })
  })

  app.post('/api/wellness/admin/sessions', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const session = createSession(brand, {
      category_key: typeof b.category_key === 'string' ? b.category_key : undefined,
      title: typeof b.title === 'string' ? b.title.trim() : undefined,
      subtitle: typeof b.subtitle === 'string' ? b.subtitle.trim() : undefined,
      order: typeof b.order === 'number' ? b.order : undefined,
      est_minutes: typeof b.est_minutes === 'number' ? b.est_minutes : undefined,
      points: typeof b.points === 'number' ? b.points : undefined,
      cards: Array.isArray(b.cards) ? (b.cards as WellnessCard[]) : undefined,
    })
    return c.json({ session }, 201)
  })

  app.patch('/api/wellness/admin/sessions/:id', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const updates: Record<string, unknown> = {}
    if (typeof b.category_key === 'string') updates.category_key = b.category_key
    if (typeof b.title === 'string') updates.title = b.title.trim()
    if (typeof b.subtitle === 'string') updates.subtitle = b.subtitle.trim()
    if (typeof b.order === 'number') updates.order = b.order
    if (typeof b.est_minutes === 'number') updates.est_minutes = b.est_minutes
    if (typeof b.points === 'number') updates.points = b.points
    if (b.status === 'draft' || b.status === 'published') updates.status = b.status
    if (Array.isArray(b.cards)) updates.cards = b.cards as WellnessCard[]
    const session = updateSession(brand, c.req.param('id'), updates as Parameters<typeof updateSession>[2])
    return session ? c.json({ session }) : c.json({ error: 'Not found' }, 404)
  })

  app.delete('/api/wellness/admin/sessions/:id', (c) => {
    const brand = getBrandId(c)
    return deleteSession(brand, c.req.param('id'))
      ? c.json({ ok: true })
      : c.json({ error: 'Not found' }, 404)
  })

  app.post('/api/wellness/admin/sessions/:id/publish', (c) => {
    const brand = getBrandId(c)
    const session = publishSession(brand, c.req.param('id'))
    return session ? c.json({ session }) : c.json({ error: 'Not found' }, 404)
  })

  app.post('/api/wellness/admin/sessions/:id/unpublish', (c) => {
    const brand = getBrandId(c)
    const session = unpublishSession(brand, c.req.param('id'))
    return session ? c.json({ session }) : c.json({ error: 'Not found' }, 404)
  })

  // ── Admin: Card CRUD ──────────────────────────────────────────────────────────

  app.post('/api/wellness/admin/sessions/:id/cards', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const session = addCard(brand, c.req.param('id'), b as Partial<WellnessCard>)
    return session ? c.json({ session }, 201) : c.json({ error: 'Session not found' }, 404)
  })

  app.patch('/api/wellness/admin/sessions/:id/cards/:cardId', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const session = updateCard(brand, c.req.param('id'), c.req.param('cardId'), b as Partial<WellnessCard>)
    return session ? c.json({ session }) : c.json({ error: 'Not found' }, 404)
  })

  app.delete('/api/wellness/admin/sessions/:id/cards/:cardId', (c) => {
    const brand = getBrandId(c)
    const session = removeCard(brand, c.req.param('id'), c.req.param('cardId'))
    return session ? c.json({ session }) : c.json({ error: 'Not found' }, 404)
  })

  app.post('/api/wellness/admin/sessions/:id/cards/reorder', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : getBrandId(c)
    const orderedIds = Array.isArray(b.ordered_ids)
      ? (b.ordered_ids as unknown[]).filter((x): x is string => typeof x === 'string')
      : []
    const session = reorderCards(brand, c.req.param('id'), orderedIds)
    return session ? c.json({ session }) : c.json({ error: 'Not found' }, 404)
  })

  // ── Admin: Stats ──────────────────────────────────────────────────────────────

  app.get('/api/wellness/admin/stats', (c) => {
    const brand = getBrandId(c)
    return c.json({ stats: getWellnessStats(brand) })
  })

  app.get('/api/wellness/admin/engagement', (c) => {
    const brand = getBrandId(c)
    return c.json({ engagement: getEngagementStats(brand) })
  })

  app.get('/api/wellness/admin/actions', (c) => {
    return c.json({ actions: listActions() })
  })
}
