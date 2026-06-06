/**
 * Social publishing adapter (Phase 4c).
 *
 * Dispatches queued posts through a unified social API (Zernio preferred;
 * falls back gracefully if not configured so drafts still save locally).
 *
 * Zernio docs: https://zernio.com  — one REST endpoint, 15 platforms.
 * Alternative: set BLOTATO_API_KEY to use Blotato instead.
 *
 * Env vars:
 *   ZERNIO_API_KEY   — primary (recommended)
 *   BLOTATO_API_KEY  — alternative
 *
 * If neither is set the publish call returns ok:false with a clear message —
 * posts are saved as 'failed' with a note so nothing is silently lost.
 */

import type { SocialPlatform } from './social-store'

export type PublishResult =
  | { ok: true; external_ids: Record<string, string> }
  | { ok: false; error: string }

// ── Platform → Zernio slug map ────────────────────────────────────────────────
const ZERNIO_PLATFORM: Record<SocialPlatform, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
  x: 'x',
}

// ── Platform → Blotato slug map ────────────────────────────────────────────────
const BLOTATO_PLATFORM: Record<SocialPlatform, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
  x: 'twitter',
}

async function publishViaZernio(
  platforms: SocialPlatform[],
  content: string,
  mediaUrls: string[],
  scheduledAt: string | null,
): Promise<PublishResult> {
  const apiKey = process.env.ZERNIO_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: 'ZERNIO_API_KEY not configured' }
  }

  const payload: Record<string, unknown> = {
    platforms: platforms.map((p) => ZERNIO_PLATFORM[p]),
    text: content,
  }
  if (mediaUrls.length > 0) payload.media_urls = mediaUrls
  if (scheduledAt) payload.scheduled_at = scheduledAt

  try {
    const res = await fetch('https://api.zernio.com/v1/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as {
      id?: string
      post_ids?: Record<string, string>
      error?: string
      message?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? data.message ?? `Zernio error ${res.status}`,
      }
    }
    const externalIds: Record<string, string> = data.post_ids ?? {}
    if (data.id && Object.keys(externalIds).length === 0) {
      externalIds['zernio'] = data.id
    }
    return { ok: true, external_ids: externalIds }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function publishViaBlotato(
  platforms: SocialPlatform[],
  content: string,
  mediaUrls: string[],
  scheduledAt: string | null,
): Promise<PublishResult> {
  const apiKey = process.env.BLOTATO_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: 'BLOTATO_API_KEY not configured' }
  }

  const payload: Record<string, unknown> = {
    platforms: platforms.map((p) => BLOTATO_PLATFORM[p]),
    content,
  }
  if (mediaUrls.length > 0) payload.media = mediaUrls
  if (scheduledAt) payload.publish_at = scheduledAt

  try {
    const res = await fetch('https://api.blotato.com/v1/post', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as {
      id?: string
      ids?: Record<string, string>
      error?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `Blotato error ${res.status}`,
      }
    }
    const externalIds: Record<string, string> = data.ids ?? {}
    if (data.id) externalIds['blotato'] = data.id
    return { ok: true, external_ids: externalIds }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Publish a social post through whichever API is configured.
 * Prefers Zernio; falls back to Blotato; returns ok:false if neither is set.
 */
export async function publishPost(opts: {
  platforms: SocialPlatform[]
  content: string
  mediaUrls: string[]
  scheduledAt: string | null
}): Promise<PublishResult> {
  if (process.env.ZERNIO_API_KEY?.trim()) {
    return publishViaZernio(
      opts.platforms,
      opts.content,
      opts.mediaUrls,
      opts.scheduledAt,
    )
  }
  if (process.env.BLOTATO_API_KEY?.trim()) {
    return publishViaBlotato(
      opts.platforms,
      opts.content,
      opts.mediaUrls,
      opts.scheduledAt,
    )
  }
  return {
    ok: false,
    error:
      'No social publishing API configured. Set ZERNIO_API_KEY (recommended) or BLOTATO_API_KEY in your workspace .env.',
  }
}
