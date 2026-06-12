/**
 * Real media generation backends.
 *
 * Preference order:
 *   Images: OpenAI gpt-image-1 (OPENAI_API_KEY) → OpenRouter image models → error
 *   Video:  OpenAI Sora (OPENAI_API_KEY) → Replicate (REPLICATE_API_TOKEN) → error
 *
 * Generated files are stored under {DATA_DIR}/media-files and served by
 * GET /api/media/file/:name (registered in routes/media.ts).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
const MEDIA_DIR = join(DATA_DIR, 'media-files')

function ensureDir(): string {
  mkdirSync(MEDIA_DIR, { recursive: true })
  return MEDIA_DIR
}

export function mediaFilePath(name: string): string | null {
  // prevent traversal — only allow uuid.ext shaped names
  if (!/^[a-f0-9-]+\.(png|jpg|jpeg|webp|mp4)$/.test(name)) return null
  const p = join(MEDIA_DIR, name)
  return existsSync(p) ? p : null
}

export function readMediaFile(name: string): Buffer | null {
  const p = mediaFilePath(name)
  return p ? readFileSync(p) : null
}

function saveFile(buf: Buffer, ext: string): string {
  const name = `${randomUUID()}.${ext}`
  writeFileSync(join(ensureDir(), name), buf)
  return `/api/media/file/${name}`
}

interface GenResult {
  url: string
  provider: string
}

// ── Images ────────────────────────────────────────────────────────────────────

async function openaiImage(prompt: string, aspect: string): Promise<GenResult | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { error: 'OPENAI_API_KEY not configured' }

  const size = aspect === '16:9' ? '1536x1024' : aspect === '9:16' ? '1024x1536' : '1024x1024'
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size, quality: 'high' }),
    })
    const data = (await res.json()) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } }
    if (!res.ok) return { error: data.error?.message ?? `OpenAI image error (${res.status})` }
    const b64 = data.data?.[0]?.b64_json
    if (!b64) return { error: 'OpenAI returned no image data' }
    return { url: saveFile(Buffer.from(b64, 'base64'), 'png'), provider: 'openai/gpt-image-1' }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

interface OpenRouterImageResponse {
  choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>
  error?: { message?: string }
}

async function openrouterImage(prompt: string, aspect: string): Promise<GenResult | { error: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { error: 'No image backend configured (set OPENAI_API_KEY or OPENROUTER_API_KEY)' }

  const model = process.env.MEDIA_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image'
  const aspectHint =
    aspect === '16:9' ? 'wide 16:9 landscape format' :
    aspect === '9:16' ? 'tall 9:16 vertical/portrait format' :
    'square 1:1 format'

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ai-os.app',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: `Generate an image, ${aspectHint}: ${prompt}` }],
        modalities: ['image', 'text'],
      }),
    })
    const data = (await res.json()) as OpenRouterImageResponse
    if (!res.ok) return { error: data.error?.message ?? `Image API error (${res.status})` }
    const dataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
    if (!dataUrl?.startsWith('data:image/')) return { error: 'Model returned no image' }
    const ext = dataUrl.startsWith('data:image/jpeg') ? 'jpg' : dataUrl.startsWith('data:image/webp') ? 'webp' : 'png'
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    return { url: saveFile(Buffer.from(b64, 'base64'), ext), provider: model }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function generateImage(prompt: string, aspect: string): Promise<GenResult | { error: string }> {
  if (process.env.OPENAI_API_KEY) {
    const r = await openaiImage(prompt, aspect)
    if ('url' in r) return r
    // fall through to OpenRouter on OpenAI failure, but keep the error if both fail
    const fallback = await openrouterImage(prompt, aspect)
    return 'url' in fallback ? fallback : r
  }
  return openrouterImage(prompt, aspect)
}

// ── Video ─────────────────────────────────────────────────────────────────────

interface SoraVideo {
  id?: string
  status?: string
  error?: { message?: string } | null
}

async function openaiVideo(prompt: string, aspect: string): Promise<GenResult | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { error: 'OPENAI_API_KEY not configured' }

  const model = process.env.MEDIA_VIDEO_MODEL ?? 'sora-2'
  const size = aspect === '9:16' ? '720x1280' : '1280x720'

  try {
    const create = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, size, seconds: '8' }),
    })
    const vid = (await create.json()) as SoraVideo
    if (!create.ok) return { error: vid.error?.message ?? `Sora error (${create.status})` }
    if (!vid.id) return { error: 'Sora returned no video id' }

    // Poll until completed (Sora renders take a few minutes)
    const started = Date.now()
    let current = vid
    while (current.status && !['completed', 'failed'].includes(current.status)) {
      if (Date.now() - started > 10 * 60_000) return { error: 'Video render timed out (10 min)' }
      await new Promise((r) => setTimeout(r, 5000))
      const poll = await fetch(`https://api.openai.com/v1/videos/${vid.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      current = (await poll.json()) as SoraVideo
    }
    if (current.status !== 'completed') return { error: current.error?.message ?? 'Video render failed' }

    const content = await fetch(`https://api.openai.com/v1/videos/${vid.id}/content`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!content.ok) return { error: `Could not download video (${content.status})` }
    const buf = Buffer.from(await content.arrayBuffer())
    return { url: saveFile(buf, 'mp4'), provider: `openai/${model}` }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

interface ReplicatePrediction {
  id?: string
  status?: string
  output?: string | string[]
  error?: string | null
}

async function replicateVideo(prompt: string, aspect: string): Promise<GenResult | { error: string }> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) {
    return { error: 'Video generation needs OPENAI_API_KEY (Sora) or REPLICATE_API_TOKEN. Images work today.' }
  }

  const model = process.env.MEDIA_VIDEO_MODEL_REPLICATE ?? 'wan-video/wan-2.2-t2v-fast'
  try {
    const create = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Prefer: 'wait=60' },
      body: JSON.stringify({ input: { prompt, aspect_ratio: aspect === '1:1' ? '16:9' : aspect } }),
    })
    const pred = (await create.json()) as ReplicatePrediction
    if (!create.ok) return { error: pred.error ?? `Replicate error (${create.status})` }

    let current = pred
    const started = Date.now()
    while (current.status && !['succeeded', 'failed', 'canceled'].includes(current.status)) {
      if (Date.now() - started > 5 * 60_000) return { error: 'Video generation timed out (5 min)' }
      await new Promise((r) => setTimeout(r, 4000))
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${current.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      current = (await poll.json()) as ReplicatePrediction
    }
    if (current.status !== 'succeeded') return { error: current.error ?? 'Video generation failed' }
    const outUrl = Array.isArray(current.output) ? current.output[0] : current.output
    if (!outUrl) return { error: 'No video output returned' }

    const vid = await fetch(outUrl)
    const buf = Buffer.from(await vid.arrayBuffer())
    return { url: saveFile(buf, 'mp4'), provider: model }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function generateVideo(prompt: string, aspect: string): Promise<GenResult | { error: string }> {
  if (process.env.OPENAI_API_KEY) {
    const r = await openaiVideo(prompt, aspect)
    if ('url' in r) return r
    const fallback = await replicateVideo(prompt, aspect)
    return 'url' in fallback ? fallback : r
  }
  return replicateVideo(prompt, aspect)
}
