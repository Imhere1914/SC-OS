import type { Hono } from 'hono'
import {
  getOnboarding,
  markStepComplete,
  markOnboardingComplete,
  resetOnboarding,
} from '../stores/onboarding-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerOnboarding(app: Hono): void {
  // GET /api/onboarding — get current state
  app.get('/api/onboarding', (c) => {
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? BRAND
    return c.json(getOnboarding(brand))
  })

  // POST /api/onboarding/step — mark a step complete
  // body: { step_id: string }
  app.post('/api/onboarding/step', async (c) => {
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? BRAND
    const body = (await c.req.json()) as { step_id?: string }
    if (!body.step_id) {
      return c.json({ error: 'step_id is required' }, 400)
    }
    const state = markStepComplete(brand, body.step_id)
    return c.json(state)
  })

  // POST /api/onboarding/complete — mark wizard fully complete
  app.post('/api/onboarding/complete', (c) => {
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? BRAND
    const state = markOnboardingComplete(brand)
    return c.json(state)
  })

  // POST /api/onboarding/reset — reset for testing
  app.post('/api/onboarding/reset', (c) => {
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? BRAND
    const state = resetOnboarding(brand)
    return c.json(state)
  })
}
