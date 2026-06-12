import type { Hono } from 'hono'
import { getPreferences, updatePreferences, getChatModel } from '../stores/preferences-store'

const ALLOWED_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', cost: 'Very low' },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', cost: 'Very low' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', cost: 'Moderate' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', cost: 'Higher' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', cost: 'Higher' },
]

export function registerPreferences(app: Hono): void {
  app.get('/api/preferences', (c) => {
    const prefs = getPreferences()
    return c.json({ preferences: prefs, current_model: getChatModel(), available_models: ALLOWED_MODELS })
  })

  app.patch('/api/preferences', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const patch: Record<string, unknown> = {}

    if (typeof body.chat_model === 'string') {
      const valid = ALLOWED_MODELS.some(m => m.id === body.chat_model)
      if (!valid) return c.json({ error: 'Invalid model. Choose from available_models.' }, 400)
      patch.chat_model = body.chat_model
    }

    const updated = updatePreferences(patch)
    return c.json({ preferences: updated, current_model: getChatModel() })
  })
}
