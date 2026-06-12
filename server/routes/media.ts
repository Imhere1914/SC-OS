import type { Hono } from 'hono'
import { createMedia, deleteMedia, isMediaKind, listMedia, updateMedia } from '../stores/media-store'
import { generateImage, generateVideo, readMediaFile } from '../lib/media-generator'

const BRAND_COLOR: Record<string, string> = { sc: '#22c55e', hfm: '#a3843b', default: '#22c55e' }

function esc(s: string): string {
  return s.replace(/[<>&]/g, (ch) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'))
}

// Placeholder renderer — branded SVG data URL embedding the prompt.
// Real generation plugs in via the Hermes agent (image_gen / video_gen) later.
function placeholderDataUrl(prompt: string, kind: string, aspect: string, brand: string): string {
  const color = BRAND_COLOR[brand] ?? BRAND_COLOR.default
  const [w, h] = aspect === '16:9' ? [1280, 720] : aspect === '9:16' ? [720, 1280] : [1024, 1024]
  const words = esc(prompt).split(/\s+/).slice(0, 14).join(' ')
  const badge = kind === 'video' ? '▶ VIDEO' : '🖼 IMAGE'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#111827"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="50%" y="42%" fill="#ffffff" opacity="0.85" font-family="system-ui,sans-serif" font-size="${Math.round(w / 26)}" text-anchor="middle">${badge}</text>
  <foreignObject x="8%" y="48%" width="84%" height="40%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-family:system-ui,sans-serif;font-size:${Math.round(w / 30)}px;text-align:center;line-height:1.3;opacity:0.95">${words}</div>
  </foreignObject>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

async function tryHermesGenerate(prompt: string, kind: string, aspect: string): Promise<{ url: string; provider: string } | null> {
  const base = process.env.HERMES_API_URL
  if (!base) return null
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/media/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.HERMES_API_TOKEN ? { Authorization: `Bearer ${process.env.HERMES_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ prompt, kind, aspect, brand: process.env.BRAND ?? 'default' }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    return data.url ? { url: data.url, provider: 'hermes-agent' } : null
  } catch {
    return null
  }
}

export function registerMedia(app: Hono): void {
  app.get('/api/media', (c) => {
    const u = new URL(c.req.url)
    return c.json({ media: listMedia({ brand: u.searchParams.get('brand'), kind: u.searchParams.get('kind') }) })
  })

  app.post('/api/media', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.prompt !== 'string' || !b.prompt.trim()) return c.json({ error: 'prompt is required' }, 400)
    const kind = isMediaKind(b.kind) ? b.kind : 'image'
    const aspect = typeof b.aspect === 'string' ? b.aspect : '1:1'
    const rec = createMedia({ kind, prompt: b.prompt.trim(), aspect, brand: typeof b.brand === 'string' ? b.brand : undefined })

    // Generation order: real backends first (OpenRouter images / Replicate video),
    // then the legacy Hermes hook, then the branded placeholder as a last resort.
    const real = kind === 'video'
      ? await generateVideo(rec.prompt, aspect)
      : await generateImage(rec.prompt, aspect)

    if ('url' in real) {
      const updated = updateMedia(rec.id, { status: 'ready', url: real.url, provider: real.provider })
      return c.json({ media: updated }, 201)
    }

    const live = await tryHermesGenerate(rec.prompt, kind, aspect)
    if (live) {
      const updated = updateMedia(rec.id, { status: 'ready', url: live.url, provider: live.provider })
      return c.json({ media: updated }, 201)
    }

    const updated = updateMedia(rec.id, {
      status: 'ready',
      url: placeholderDataUrl(rec.prompt, kind, aspect, rec.brand),
      provider: 'placeholder',
    })
    return c.json({ media: updated, generation_error: real.error }, 201)
  })

  // Serve generated files from the data dir
  app.get('/api/media/file/:name', (c) => {
    const name = c.req.param('name')
    const data = readMediaFile(name)
    if (!data) return c.json({ error: 'Not found' }, 404)
    const type = name.endsWith('.mp4') ? 'video/mp4'
      : name.endsWith('.jpg') || name.endsWith('.jpeg') ? 'image/jpeg'
      : name.endsWith('.webp') ? 'image/webp'
      : 'image/png'
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  })

  app.delete('/api/media/:id', (c) =>
    deleteMedia(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
