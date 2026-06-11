import type { Hono } from 'hono'
import { getPreferences } from '../stores/preferences-store'

// Maps avatar model IDs to OpenAI TTS voice names
const VOICE_MAP: Record<string, string> = {
  nova: 'nova',
  marcus: 'onyx',
  aria: 'alloy',
  kai: 'echo',
  sage: 'shimmer',
  fable: 'fable',
}
const BRAND_DEFAULT: Record<string, string> = { sc: 'marcus', hfm: 'nova' }

export function registerTts(app: Hono) {
  app.post('/api/tts', async (c) => {
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) return c.json({ error: 'OPENAI_API_KEY required for TTS' }, 503)

    const body = await c.req.json<{ text?: string; voice?: string; voice_model_id?: string }>()
    const text = body.text?.trim()
    if (!text) return c.json({ error: 'No text provided' }, 400)

    const cleaned = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[*_~]{1,3}/g, '')
      .replace(/\/api\/media\/file\/[\w.-]+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (!cleaned) return c.json({ error: 'Nothing to speak after cleanup' }, 400)

    const truncated = cleaned.length > 4096 ? cleaned.slice(0, 4096) + '...' : cleaned

    const brand = process.env.BRAND ?? 'sc'

    // Resolve voice: explicit voice name > voice_model_id > stored pref > brand default
    let voice: string
    if (body.voice && Object.values(VOICE_MAP).includes(body.voice)) {
      voice = body.voice
    } else {
      const modelId = body.voice_model_id
        ?? getPreferences().voice_model_id
        ?? BRAND_DEFAULT[brand]
        ?? 'marcus'
      voice = VOICE_MAP[modelId] ?? 'onyx'
    }

    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: truncated,
          voice,
          response_format: 'mp3',
          speed: 1.05,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return c.json({ error: `TTS error: ${err}` }, 502)
      }

      c.header('Content-Type', 'audio/mpeg')
      c.header('Cache-Control', 'no-store')
      return c.body(res.body as ReadableStream)
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500)
    }
  })
}
