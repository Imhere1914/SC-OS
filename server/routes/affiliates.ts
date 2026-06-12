import type { Hono } from 'hono'
import {
  listAffiliates,
  getAffiliate,
  getAffiliateByCode,
  createAffiliate,
  updateAffiliate,
  deleteAffiliate,
  listReferrals,
  createReferral,
  updateReferral,
} from '../stores/affiliates-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerAffiliates(app: Hono) {
  // ── Public tracking endpoint (no auth) ──────────────────────────────────────
  app.get('/api/affiliates/track/:code', (c) => {
    const code = c.req.param('code')
    const affiliate = getAffiliateByCode(code)
    if (!affiliate || affiliate.status !== 'active') {
      return c.json({ error: 'unknown code' }, 404)
    }
    return c.json({
      affiliate_id: affiliate.id,
      affiliate_name: affiliate.name,
      commission_pct: affiliate.commission_pct,
    })
  })

  // ── Affiliates ───────────────────────────────────────────────────────────────

  app.get('/api/affiliates', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const affiliates = listAffiliates(brand)
    return c.json({ affiliates })
  })

  app.post('/api/affiliates', async (c) => {
    const body = await c.req.json()
    if (!body.name?.trim()) return c.json({ error: 'name required' }, 400)
    const affiliate = createAffiliate({ ...body, brand: body.brand ?? BRAND })
    return c.json(affiliate, 201)
  })

  app.patch('/api/affiliates/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand') ?? BRAND
    const affiliate = updateAffiliate(id, body, brand)
    if (!affiliate) return c.json({ error: 'not found' }, 404)
    return c.json(affiliate)
  })

  app.delete('/api/affiliates/:id', (c) => {
    const id = c.req.param('id')
    const brand = c.req.query('brand') ?? BRAND
    const ok = deleteAffiliate(id, brand)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ── Referrals for a specific affiliate ──────────────────────────────────────

  app.get('/api/affiliates/:id/referrals', (c) => {
    const affiliateId = c.req.param('id')
    const brand = c.req.query('brand') ?? BRAND
    const affiliate = getAffiliate(affiliateId, brand)
    if (!affiliate) return c.json({ error: 'not found' }, 404)
    const referrals = listReferrals(brand, affiliateId)
    return c.json({ referrals })
  })

  // ── Referrals ────────────────────────────────────────────────────────────────

  app.get('/api/referrals', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const affiliateId = c.req.query('affiliate_id')
    const referrals = listReferrals(brand, affiliateId ?? undefined)
    return c.json({ referrals })
  })

  app.post('/api/referrals', async (c) => {
    const body = await c.req.json()
    if (!body.affiliate_id) return c.json({ error: 'affiliate_id required' }, 400)
    if (!body.contact_name?.trim()) return c.json({ error: 'contact_name required' }, 400)
    const referral = createReferral({ ...body, brand: body.brand ?? BRAND })
    return c.json(referral, 201)
  })

  app.patch('/api/referrals/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const brand = body.brand ?? c.req.query('brand') ?? BRAND
    const referral = updateReferral(id, body, brand)
    if (!referral) return c.json({ error: 'not found' }, 404)
    return c.json(referral)
  })
}
