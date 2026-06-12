import type { Hono } from 'hono'
import { appendTrackEvent, getCampaignStats } from '../stores/tracking-store'

// 1×1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

function getBrand(_c: { req: { header: (name: string) => string | undefined } }): string {
  return (process.env.BRAND ?? 'default').toLowerCase()
}

export function registerTracking(app: Hono): void {
  // Open pixel — no auth required (hit by email clients)
  app.get('/track/open/:campaignId/:contactId', (c) => {
    const { campaignId, contactId } = c.req.param()
    const brand = getBrand(c)
    appendTrackEvent(brand, {
      campaign_id: campaignId,
      contact_id: contactId,
      brand,
      type: 'open',
      ip: c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip'),
      user_agent: c.req.header('user-agent'),
    })
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  })

  // Click redirect — no auth required
  app.get('/track/click/:campaignId/:contactId', (c) => {
    const { campaignId, contactId } = c.req.param()
    const url = new URL(c.req.url).searchParams.get('url') ?? ''
    const brand = getBrand(c)

    if (!url.startsWith('http')) {
      return c.text('Invalid redirect URL', 400)
    }

    appendTrackEvent(brand, {
      campaign_id: campaignId,
      contact_id: contactId,
      brand,
      type: 'click',
      url,
      ip: c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip'),
      user_agent: c.req.header('user-agent'),
    })

    return c.redirect(url, 302)
  })

  // Stats — auth not required per spec (called from frontend with campaign ID)
  app.get('/api/campaigns/:id/stats', (c) => {
    const campaignId = c.req.param('id')
    const brand = getBrand(c)
    const stats = getCampaignStats(brand, campaignId)
    return c.json(stats)
  })
}
