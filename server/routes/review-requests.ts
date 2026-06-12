import type { Hono } from 'hono'
import {
  listReviewRequests,
  getReviewRequest,
  createReviewRequest,
  updateReviewRequest,
  deleteReviewRequest,
} from '../stores/review-requests-store'
import { appendActivity } from '../stores/activity-store'
import { isEmailConfigured, sendEmail, renderTransactionalHtml } from '../stores/email-sender'

const BRAND = process.env.BRAND ?? 'default'
const BRAND_NAME =
  BRAND === 'hfm' ? 'Holistic Functional Care'
  : BRAND === 'sc' ? 'Simple Connect'
  : 'AI OS'

export function registerReviewRequests(app: Hono) {
  // List
  app.get('/api/review-requests', (c) => {
    const brand = c.req.query('brand')
    return c.json(listReviewRequests(brand))
  })

  // Get by ID
  app.get('/api/review-requests/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const record = getReviewRequest(id, brand)
    if (!record) return c.json({ error: 'not found' }, 404)
    return c.json(record)
  })

  // Create + send review request email
  app.post('/api/review-requests', async (c) => {
    const body = await c.req.json()

    if (!body.contact_email?.trim()) return c.json({ error: 'contact_email required' }, 400)
    if (!body.contact_name?.trim()) return c.json({ error: 'contact_name required' }, 400)

    if (!isEmailConfigured()) {
      return c.json(
        { error: 'Email not configured. Set RESEND_API_KEY and CAMPAIGN_FROM_EMAIL in .env.' },
        502,
      )
    }

    const record = createReviewRequest({
      brand: body.brand,
      contact_id: body.contact_id,
      contact_name: body.contact_name.trim(),
      contact_email: body.contact_email.trim(),
      message: body.message,
      review_url: body.review_url,
    })

    const defaultMessage = `We hope you enjoyed your experience with ${BRAND_NAME}. We'd love to hear your feedback!`
    const html = renderTransactionalHtml({
      brandName: BRAND_NAME,
      heading: 'How was your experience?',
      lines: [body.message?.trim() || defaultMessage],
      ctaLabel: 'Leave a Review',
      ctaUrl: body.review_url ?? 'https://google.com/maps',
    })

    await sendEmail({
      to: record.contact_email,
      subject: `How was your experience with ${BRAND_NAME}?`,
      html,
    })

    if (record.contact_id) {
      appendActivity({
        contact_id: record.contact_id,
        type: 'custom',
        description: 'Review request sent',
      })
    }

    return c.json(record, 201)
  })

  // Delete
  app.delete('/api/review-requests/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const ok = deleteReviewRequest(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // Mark as clicked (called from tracking pixel / redirect link)
  app.post('/api/review-requests/:id/clicked', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand')
    const record = getReviewRequest(id, brand)
    if (!record) return c.json({ error: 'not found' }, 404)
    // Only advance status forward
    if (record.status === 'sent') {
      const updated = updateReviewRequest(
        id,
        { status: 'clicked', clicked_at: new Date().toISOString() },
        brand,
      )
      return c.json(updated)
    }
    return c.json(record)
  })
}
