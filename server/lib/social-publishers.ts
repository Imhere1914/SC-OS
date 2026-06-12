/**
 * Direct social publishing layer (per-brand, env-driven).
 *
 * Unlike `stores/social-publisher.ts` (which proxies through an aggregator API
 * like Zernio/Blotato), this module talks to each platform's native API using
 * PER-BRAND credentials read from the environment. A channel is only "configured"
 * if its env vars are present for the active brand — otherwise we degrade
 * gracefully so the UI can prompt the user to connect it in Settings.
 *
 * Env var convention — every var is suffixed with the uppercased brand id, e.g.
 * for brand `sc`:  FB_PAGE_ID_SC, FB_PAGE_TOKEN_SC, …
 *
 *   Facebook Page : FB_PAGE_ID_{BRAND}      + FB_PAGE_TOKEN_{BRAND}
 *   Instagram     : IG_USER_ID_{BRAND}      + FB_PAGE_TOKEN_{BRAND} (reused)
 *   LinkedIn      : LINKEDIN_TOKEN_{BRAND}   + LINKEDIN_ORG_URN_{BRAND}
 *   TikTok        : TIKTOK_TOKEN_{BRAND}
 *
 * `BASE_URL` is used to make relative Media Studio file URLs absolute (required
 * because Instagram/TikTok need a publicly-fetchable media URL).
 */

export type PublishPlatform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok'

export type PublishContent = {
  text: string
  mediaUrls?: string[]
  link?: string
}

export type PlatformResult = {
  platform: PublishPlatform
  ok: boolean
  id?: string
  url?: string
  error?: string
}

const PUBLISHABLE: PublishPlatform[] = ['facebook', 'instagram', 'linkedin', 'tiktok']

export function isPublishPlatform(v: unknown): v is PublishPlatform {
  return typeof v === 'string' && PUBLISHABLE.includes(v as PublishPlatform)
}

/** Read `${base}_${BRAND}` from the environment (brand uppercased). */
export function getEnv(base: string, brand: string): string | undefined {
  const v = process.env[`${base}_${brand.toUpperCase()}`]
  return v && v.trim() ? v.trim() : undefined
}

function baseUrl(): string {
  return (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '')
}

/** Turn a possibly-relative media URL into an absolute, publicly-fetchable one. */
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `${baseUrl()}${url.startsWith('/') ? '' : '/'}${url}`
}

/** Whether a platform has all its required env vars present for this brand. */
export function channelConfigured(platform: PublishPlatform, brand: string): boolean {
  switch (platform) {
    case 'facebook':
      return Boolean(getEnv('FB_PAGE_ID', brand) && getEnv('FB_PAGE_TOKEN', brand))
    case 'instagram':
      return Boolean(getEnv('IG_USER_ID', brand) && getEnv('FB_PAGE_TOKEN', brand))
    case 'linkedin':
      return Boolean(getEnv('LINKEDIN_TOKEN', brand) && getEnv('LINKEDIN_ORG_URN', brand))
    case 'tiktok':
      return Boolean(getEnv('TIKTOK_TOKEN', brand))
  }
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// ── Facebook Page ───────────────────────────────────────────────────────────

async function publishFacebook(brand: string, content: PublishContent): Promise<PlatformResult> {
  const platform: PublishPlatform = 'facebook'
  const pageId = getEnv('FB_PAGE_ID', brand)
  const token = getEnv('FB_PAGE_TOKEN', brand)
  if (!pageId || !token) {
    return { platform, ok: false, error: 'Facebook not connected (set FB_PAGE_ID + FB_PAGE_TOKEN)' }
  }
  const image = content.mediaUrls?.find((u) => !/\.mp4($|\?)/i.test(u))
  try {
    // With an image → /photos (caption); text-only → /feed (message).
    const endpoint = image
      ? `https://graph.facebook.com/v21.0/${pageId}/photos`
      : `https://graph.facebook.com/v21.0/${pageId}/feed`
    const body: Record<string, string> = { access_token: token }
    if (image) {
      body.url = absoluteUrl(image)
      body.caption = content.text
    } else {
      body.message = content.text
      if (content.link) body.link = content.link
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    })
    const data = (await res.json()) as {
      id?: string
      post_id?: string
      error?: { message?: string }
    }
    if (!res.ok) {
      return { platform, ok: false, error: data.error?.message ?? `Facebook error ${res.status}` }
    }
    const id = data.post_id ?? data.id
    return {
      platform,
      ok: true,
      id,
      url: id ? `https://facebook.com/${id}` : undefined,
    }
  } catch (e) {
    return { platform, ok: false, error: errMessage(e) }
  }
}

// ── Instagram (two-step: create container → publish) ─────────────────────────

async function publishInstagram(brand: string, content: PublishContent): Promise<PlatformResult> {
  const platform: PublishPlatform = 'instagram'
  const igUserId = getEnv('IG_USER_ID', brand)
  const token = getEnv('FB_PAGE_TOKEN', brand)
  if (!igUserId || !token) {
    return { platform, ok: false, error: 'Instagram not connected (set IG_USER_ID + FB_PAGE_TOKEN)' }
  }
  // IG feed posts require a public image URL — pass the Media Studio file URL
  // made absolute via BASE_URL so Meta can fetch it.
  const image = content.mediaUrls?.find((u) => !/\.mp4($|\?)/i.test(u))
  if (!image) {
    return { platform, ok: false, error: 'Instagram requires an image (attach or generate one)' }
  }
  try {
    // Step 1 — create media container.
    const createRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        image_url: absoluteUrl(image),
        caption: content.text,
        access_token: token,
      }).toString(),
    })
    const created = (await createRes.json()) as { id?: string; error?: { message?: string } }
    if (!createRes.ok || !created.id) {
      return { platform, ok: false, error: created.error?.message ?? `Instagram container error ${createRes.status}` }
    }
    // Step 2 — publish the container.
    const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: created.id, access_token: token }).toString(),
    })
    const published = (await pubRes.json()) as { id?: string; error?: { message?: string } }
    if (!pubRes.ok || !published.id) {
      return { platform, ok: false, error: published.error?.message ?? `Instagram publish error ${pubRes.status}` }
    }
    return { platform, ok: true, id: published.id }
  } catch (e) {
    return { platform, ok: false, error: errMessage(e) }
  }
}

// ── LinkedIn (ugcPosts — stable text share) ──────────────────────────────────

async function publishLinkedIn(brand: string, content: PublishContent): Promise<PlatformResult> {
  const platform: PublishPlatform = 'linkedin'
  const token = getEnv('LINKEDIN_TOKEN', brand)
  const orgUrn = getEnv('LINKEDIN_ORG_URN', brand)
  if (!token || !orgUrn) {
    return { platform, ok: false, error: 'LinkedIn not connected (set LINKEDIN_TOKEN + LINKEDIN_ORG_URN)' }
  }
  // orgUrn may be provided bare ("123456") or already as a full URN.
  const author = orgUrn.startsWith('urn:li:') ? orgUrn : `urn:li:organization:${orgUrn}`
  const shareText = content.link ? `${content.text}\n\n${content.link}` : content.text
  try {
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: shareText },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) {
      return { platform, ok: false, error: data.message ?? `LinkedIn error ${res.status}` }
    }
    const id = data.id ?? res.headers.get('x-restli-id') ?? undefined
    return {
      platform,
      ok: true,
      id,
      url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined,
    }
  } catch (e) {
    return { platform, ok: false, error: errMessage(e) }
  }
}

// ── TikTok (video-only; Content Posting API init) ────────────────────────────

async function publishTikTok(brand: string, content: PublishContent): Promise<PlatformResult> {
  const platform: PublishPlatform = 'tiktok'
  const token = getEnv('TIKTOK_TOKEN', brand)
  if (!token) {
    return { platform, ok: false, error: 'TikTok not connected (set TIKTOK_TOKEN)' }
  }
  // TikTok is VIDEO-ONLY — needs a pulled (public) video URL.
  const video = content.mediaUrls?.find((u) => /\.mp4($|\?)/i.test(u))
  if (!video) {
    return { platform, ok: false, error: 'TikTok requires a video' }
  }
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: content.text,
          privacy_level: 'SELF_ONLY',
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: absoluteUrl(video),
        },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      data?: { publish_id?: string }
      error?: { code?: string; message?: string }
    }
    if (!res.ok || (data.error && data.error.code && data.error.code !== 'ok')) {
      return { platform, ok: false, error: data.error?.message ?? `TikTok error ${res.status}` }
    }
    return { platform, ok: true, id: data.data?.publish_id }
  } catch (e) {
    return { platform, ok: false, error: errMessage(e) }
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const PUBLISHERS: Record<
  PublishPlatform,
  (brand: string, content: PublishContent) => Promise<PlatformResult>
> = {
  facebook: publishFacebook,
  instagram: publishInstagram,
  linkedin: publishLinkedIn,
  tiktok: publishTikTok,
}

/**
 * Publish `content` to each requested platform using the brand's credentials.
 * Returns one result per platform (never throws — failures are per-platform).
 */
export async function publishToPlatforms(
  brand: string,
  platforms: PublishPlatform[],
  content: PublishContent,
): Promise<PlatformResult[]> {
  return Promise.all(platforms.map((p) => PUBLISHERS[p](brand, content)))
}

/** Configured-state for every publishable platform, for the channels endpoint. */
export function channelStatus(brand: string): Record<PublishPlatform, boolean> {
  return {
    facebook: channelConfigured('facebook', brand),
    instagram: channelConfigured('instagram', brand),
    linkedin: channelConfigured('linkedin', brand),
    tiktok: channelConfigured('tiktok', brand),
  }
}

export const PUBLISHABLE_PLATFORMS = PUBLISHABLE
