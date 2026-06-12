import type { Hono } from 'hono'
import {
  listSurveys,
  getSurvey,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  addResponse,
  listResponses,
  getSurveyStats,
} from '../stores/surveys-store'

export function registerSurveys(app: Hono) {
  // ── Authenticated routes ─────────────────────────────────────────────────────

  // List surveys
  app.get('/api/surveys', (c) => {
    const brand = c.req.query('brand') ?? process.env.BRAND ?? 'default'
    return c.json(listSurveys(brand))
  })

  // Create survey
  app.post('/api/surveys', async (c) => {
    const brand = process.env.BRAND ?? 'default'
    const body = await c.req.json()
    if (!body.title?.trim()) return c.json({ error: 'title required' }, 400)
    const survey = createSurvey(brand, {
      title: body.title.trim(),
      description: body.description ?? '',
      questions: body.questions ?? [],
      status: body.status ?? 'draft',
    })
    return c.json(survey, 201)
  })

  // Update survey (including questions)
  app.patch('/api/surveys/:id', async (c) => {
    const id = c.req.param('id')
    const brand = process.env.BRAND ?? 'default'
    const body = await c.req.json()
    const updated = updateSurvey(brand, id, body)
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // Delete survey
  app.delete('/api/surveys/:id', (c) => {
    const id = c.req.param('id')
    const brand = process.env.BRAND ?? 'default'
    const ok = deleteSurvey(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // List responses
  app.get('/api/surveys/:id/responses', (c) => {
    const id = c.req.param('id')
    return c.json(listResponses(id))
  })

  // Stats
  app.get('/api/surveys/:id/stats', (c) => {
    const id = c.req.param('id')
    return c.json(getSurveyStats(id))
  })

  // ── Public routes (no auth) ──────────────────────────────────────────────────

  // Public survey data (for the public survey page)
  app.get('/api/surveys/:id/public', (c) => {
    const id = c.req.param('id')
    const survey = getSurvey(id)
    if (!survey) return c.json({ error: 'not found' }, 404)
    if (survey.status === 'closed') return c.json({ error: 'survey is closed' }, 410)
    // Return survey without response data
    const { response_count: _rc, ...publicSurvey } = survey
    return c.json(publicSurvey)
  })

  // Submit response (public)
  app.post('/api/surveys/:id/respond', async (c) => {
    const id = c.req.param('id')
    const survey = getSurvey(id)
    if (!survey) return c.json({ error: 'not found' }, 404)
    if (survey.status !== 'active') return c.json({ error: 'survey is not active' }, 400)

    const body = await c.req.json().catch(() => ({})) as {
      contact_id?: string
      contact_name?: string
      contact_email?: string
      answers?: Record<string, string | number | string[]>
    }

    const answers = body.answers ?? {}

    // Cap obviously unbounded input from the public survey ingest.
    if (Object.keys(answers).length > 200) return c.json({ error: 'too many answers' }, 400)
    for (const v of Object.values(answers)) {
      if (typeof v === 'string' && v.length > 10_000) return c.json({ error: 'answer too long' }, 400)
      if (Array.isArray(v) && v.length > 200) return c.json({ error: 'too many answer values' }, 400)
    }

    // Extract NPS score from any NPS question
    let nps_score: number | undefined
    for (const question of survey.questions) {
      if (question.type === 'nps') {
        const ans = answers[question.id]
        if (typeof ans === 'number') {
          nps_score = ans
          break
        }
      }
    }

    // Get IP from header
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined

    const response = addResponse(id, survey.brand, {
      survey_id: id,
      brand: survey.brand,
      contact_id: body.contact_id,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      answers,
      nps_score,
      ip,
    })

    return c.json({ ok: true, id: response.id })
  })
}
