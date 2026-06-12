import type { Hono } from 'hono'

export function registerTranscribe(app: Hono) {
  app.post('/api/transcribe', async (c) => {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return c.json({ error: 'No API key configured' }, 503)

    try {
      const formData = await c.req.formData()
      const audioFile = formData.get('audio')
      if (!audioFile || typeof audioFile === 'string') {
        return c.json({ error: 'No audio file provided' }, 400)
      }

      // Forward to OpenAI Whisper via direct OpenAI endpoint
      // (OpenRouter doesn't support audio — use OpenAI directly if OPENAI_API_KEY set, else fallback)
      const openaiKey = process.env.OPENAI_API_KEY
      if (!openaiKey) {
        return c.json({ error: 'OPENAI_API_KEY required for Whisper transcription' }, 503)
      }

      const fd = new FormData()
      fd.append('file', audioFile as Blob, 'audio.webm')
      fd.append('model', 'whisper-1')
      fd.append('language', 'en')

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: fd,
      })

      if (!res.ok) {
        const err = await res.text()
        return c.json({ error: `Whisper error: ${err}` }, 502)
      }

      const data = await res.json() as { text: string }
      return c.json({ transcript: data.text })
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500)
    }
  })
}
