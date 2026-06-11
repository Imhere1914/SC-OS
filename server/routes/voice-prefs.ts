import type { Hono } from 'hono'
import { getPreferences, updatePreferences } from '../stores/preferences-store'

const BRAND_DEFAULT: Record<string, string> = { sc: 'marcus', hfm: 'nova' }
const VALID_VOICES = ['nova', 'marcus', 'aria', 'kai', 'sage', 'fable']

export function registerVoicePrefs(app: Hono) {
  app.get('/api/voice/preference', (c) => {
    const brand = process.env.BRAND ?? 'sc'
    const prefs = getPreferences()
    const voice_model_id = prefs.voice_model_id ?? BRAND_DEFAULT[brand] ?? 'marcus'
    return c.json({ voice_model_id })
  })

  app.patch('/api/voice/preference', async (c) => {
    const body = await c.req.json<{ voice_model_id?: string }>()
    if (!body.voice_model_id || !VALID_VOICES.includes(body.voice_model_id)) {
      return c.json({ error: 'Invalid voice_model_id' }, 400)
    }
    const updated = updatePreferences({ voice_model_id: body.voice_model_id })
    return c.json({ voice_model_id: updated.voice_model_id })
  })
}
