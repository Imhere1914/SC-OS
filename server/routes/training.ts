import type { Hono } from 'hono'
import {
  addLesson, archiveModule, createModule, deleteModule, enroll,
  generateShareToken, getModule, getModuleBySlug, getModuleByToken,
  listEnrollments, listModules, publishModule, removeLesson,
  reorderLessons, slugify, updateLesson, updateModule, updateProgress,
} from '../stores/training-store'

export function registerTraining(app: Hono): void {
  // ── Admin: Modules ──────────────────────────────────────────────────────────

  app.get('/api/training/modules', (c) => {
    const u = new URL(c.req.url)
    const brand = u.searchParams.get('brand') ?? process.env.BRAND ?? 'default'
    const status = u.searchParams.get('status') ?? undefined
    const category = u.searchParams.get('category') ?? undefined
    return c.json({ modules: listModules(brand, { status, category }) })
  })

  app.post('/api/training/modules', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : 'default'
    if (!b.title || typeof b.title !== 'string') return c.json({ error: 'title is required' }, 400)
    const slug = typeof b.slug === 'string' && b.slug.trim()
      ? b.slug.trim()
      : slugify(b.title)
    const module = createModule(brand, {
      title: b.title.trim(),
      slug,
      description: typeof b.description === 'string' ? b.description.trim() : '',
      category: typeof b.category === 'string' ? b.category : 'Holistic Foundations',
      thumbnail_url: typeof b.thumbnail_url === 'string' ? b.thumbnail_url : undefined,
      instructor_name: typeof b.instructor_name === 'string' ? b.instructor_name : undefined,
      instructor_bio: typeof b.instructor_bio === 'string' ? b.instructor_bio : undefined,
      is_free: b.is_free !== false,
      price_cents: typeof b.price_cents === 'number' ? b.price_cents : undefined,
      tags: Array.isArray(b.tags) ? (b.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
    })
    return c.json({ module }, 201)
  })

  app.get('/api/training/modules/:id', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? 'default'
    const module = getModule(brand, c.req.param('id'))
    return module ? c.json({ module }) : c.json({ error: 'Not found' }, 404)
  })

  app.patch('/api/training/modules/:id', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : 'default'
    const updates: Record<string, unknown> = {}
    if (typeof b.title === 'string') updates.title = b.title.trim()
    if (typeof b.slug === 'string') updates.slug = b.slug.trim()
    if (typeof b.description === 'string') updates.description = b.description.trim()
    if (typeof b.category === 'string') updates.category = b.category
    if (typeof b.thumbnail_url === 'string') updates.thumbnail_url = b.thumbnail_url
    if (typeof b.instructor_name === 'string') updates.instructor_name = b.instructor_name
    if (typeof b.instructor_bio === 'string') updates.instructor_bio = b.instructor_bio
    if (typeof b.is_free === 'boolean') updates.is_free = b.is_free
    if (typeof b.price_cents === 'number') updates.price_cents = b.price_cents
    if (Array.isArray(b.tags)) updates.tags = (b.tags as unknown[]).filter((t): t is string => typeof t === 'string')
    const module = updateModule(brand, c.req.param('id'), updates as Parameters<typeof updateModule>[2])
    return module ? c.json({ module }) : c.json({ error: 'Not found' }, 404)
  })

  app.delete('/api/training/modules/:id', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? 'default'
    return deleteModule(brand, c.req.param('id'))
      ? c.json({ ok: true })
      : c.json({ error: 'Not found' }, 404)
  })

  app.post('/api/training/modules/:id/publish', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? 'default'
    const module = publishModule(brand, c.req.param('id'))
    return module ? c.json({ module }) : c.json({ error: 'Not found' }, 404)
  })

  app.post('/api/training/modules/:id/archive', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? 'default'
    const module = archiveModule(brand, c.req.param('id'))
    return module ? c.json({ module }) : c.json({ error: 'Not found' }, 404)
  })

  // ── Admin: Lessons ──────────────────────────────────────────────────────────

  app.post('/api/training/modules/:id/lessons', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : 'default'
    const module = addLesson(brand, c.req.param('id'), {
      title: typeof b.title === 'string' ? b.title.trim() : 'Untitled Lesson',
      type: (typeof b.type === 'string' ? b.type : 'text') as import('../stores/training-store').LessonType,
      content_html: typeof b.content_html === 'string' ? b.content_html : undefined,
      video_url: typeof b.video_url === 'string' ? b.video_url : undefined,
      audio_url: typeof b.audio_url === 'string' ? b.audio_url : undefined,
      pdf_url: typeof b.pdf_url === 'string' ? b.pdf_url : undefined,
      duration_minutes: typeof b.duration_minutes === 'number' ? b.duration_minutes : undefined,
      quiz_questions: Array.isArray(b.quiz_questions) ? b.quiz_questions as import('../stores/training-store').QuizQuestion[] : undefined,
      is_preview: b.is_preview === true,
    })
    return module ? c.json({ module }, 201) : c.json({ error: 'Module not found' }, 404)
  })

  app.patch('/api/training/modules/:id/lessons/:lessonId', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : 'default'
    const module = updateLesson(brand, c.req.param('id'), c.req.param('lessonId'), {
      title: typeof b.title === 'string' ? b.title.trim() : undefined,
      type: typeof b.type === 'string' ? b.type as import('../stores/training-store').LessonType : undefined,
      content_html: typeof b.content_html === 'string' ? b.content_html : undefined,
      video_url: typeof b.video_url === 'string' ? b.video_url : undefined,
      audio_url: typeof b.audio_url === 'string' ? b.audio_url : undefined,
      pdf_url: typeof b.pdf_url === 'string' ? b.pdf_url : undefined,
      duration_minutes: typeof b.duration_minutes === 'number' ? b.duration_minutes : undefined,
      quiz_questions: Array.isArray(b.quiz_questions) ? b.quiz_questions as import('../stores/training-store').QuizQuestion[] : undefined,
      is_preview: typeof b.is_preview === 'boolean' ? b.is_preview : undefined,
    })
    return module ? c.json({ module }) : c.json({ error: 'Not found' }, 404)
  })

  app.delete('/api/training/modules/:id/lessons/:lessonId', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? 'default'
    const module = removeLesson(brand, c.req.param('id'), c.req.param('lessonId'))
    return module ? c.json({ module }) : c.json({ error: 'Not found' }, 404)
  })

  app.post('/api/training/modules/:id/reorder', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : 'default'
    const orderedIds = Array.isArray(b.ordered_ids)
      ? (b.ordered_ids as unknown[]).filter((x): x is string => typeof x === 'string')
      : []
    const module = reorderLessons(brand, c.req.param('id'), orderedIds)
    return module ? c.json({ module }) : c.json({ error: 'Not found' }, 404)
  })

  // ── Admin: Enrollments ──────────────────────────────────────────────────────

  app.get('/api/training/enrollments', (c) => {
    const u = new URL(c.req.url)
    const brand = u.searchParams.get('brand') ?? process.env.BRAND ?? 'default'
    const module_id = u.searchParams.get('module_id') ?? undefined
    const contact_id = u.searchParams.get('contact_id') ?? undefined
    return c.json({ enrollments: listEnrollments(brand, { module_id, contact_id }) })
  })

  // ── Public: no auth ─────────────────────────────────────────────────────────

  app.get('/api/training/public/:slug', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? 'hfm'
    const module = getModuleBySlug(brand, c.req.param('slug'))
    if (!module || module.status !== 'published') return c.json({ error: 'Not found' }, 404)
    return c.json({ module })
  })

  app.get('/api/training/embed/:token', (c) => {
    const module = getModuleByToken(c.req.param('token'))
    if (!module || module.status !== 'published') return c.json({ error: 'Not found' }, 404)
    return c.json({ module })
  })

  app.post('/api/training/enroll', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : 'hfm'
    if (typeof b.module_id !== 'string' || !b.module_id) return c.json({ error: 'module_id is required' }, 400)
    if (typeof b.contact_name !== 'string' || !b.contact_name.trim()) return c.json({ error: 'contact_name is required' }, 400)

    const module = getModule(brand, b.module_id)
    if (!module || module.status !== 'published') return c.json({ error: 'Module not found or not published' }, 404)

    const enrollment = enroll(brand, b.module_id, {
      contact_name: (b.contact_name as string).trim(),
      contact_email: typeof b.contact_email === 'string' ? b.contact_email.trim() : undefined,
      contact_id: typeof b.contact_id === 'string' ? b.contact_id : undefined,
    })
    return c.json({ enrollment }, 201)
  })

  app.post('/api/training/progress', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof b.brand === 'string' ? b.brand : 'hfm'
    if (typeof b.enrollment_id !== 'string') return c.json({ error: 'enrollment_id is required' }, 400)

    const enrollments = listEnrollments(brand, {})
    const enrollment = enrollments.find(e => e.id === b.enrollment_id)
    if (!enrollment) return c.json({ error: 'Enrollment not found' }, 404)

    const completedIds = enrollment.completed_lessons
    if (typeof b.completed_lesson_id === 'string' && !completedIds.includes(b.completed_lesson_id)) {
      completedIds.push(b.completed_lesson_id)
    }

    const updated = updateProgress(brand, b.enrollment_id, completedIds)
    return updated ? c.json({ enrollment: updated }) : c.json({ error: 'Not found' }, 404)
  })

  // Expose generateShareToken for potential future use
  app.post('/api/training/modules/:id/regenerate-token', (c) => {
    const brand = new URL(c.req.url).searchParams.get('brand') ?? 'default'
    const module = updateModule(brand, c.req.param('id'), { share_token: generateShareToken() })
    return module ? c.json({ module }) : c.json({ error: 'Not found' }, 404)
  })
}
