import type { Hono } from 'hono'
import { getBrandId } from '../lib/brand'
import { analyzeTrends, getOwnEngagement, searchAdLibrary } from '../lib/social-intel'

export function registerSocialIntel(app: Hono): void {
  // Own published-post engagement analysis.
  app.get('/api/social-intel/engagement', async (c) => {
    const brand = getBrandId(c)
    const platform = c.req.query('platform') || undefined
    const summary = await getOwnEngagement(brand, platform)
    return c.json(summary)
  })

  // Meta Ad Library competitive / trend research.
  app.get('/api/social-intel/ad-library', async (c) => {
    const q = c.req.query('q')?.trim()
    if (!q) return c.json({ ok: false, error: 'q (search query) is required' }, 400)
    const country = c.req.query('country') || undefined
    const result = await searchAdLibrary(q, { country })
    return c.json(result)
  })

  // AI synthesis of own engagement + ad-library into content recommendations.
  app.post('/api/social-intel/analyze', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof body.brand === 'string' && body.brand ? body.brand : getBrandId(c)
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query) return c.json({ ok: false, error: 'query is required' }, 400)
    const result = await analyzeTrends(brand, query)
    return c.json(result)
  })
}
