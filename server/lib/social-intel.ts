/**
 * Social Intelligence (Phase 5).
 *
 * Two capabilities:
 *  (a) getOwnEngagement(brand) — analyse the business's OWN published posts.
 *      Reads the social store; for posts with a Facebook/Instagram external id
 *      and a configured page token, fetches live engagement from the Graph API.
 *      Degrades gracefully: with no token it falls back to whatever counts are
 *      stored on the post, and still computes the structural insights it can.
 *  (b) searchAdLibrary(query) — competitive / trend research via the public
 *      Meta Ad Library API. Needs META_ADLIB_TOKEN.
 *  (c) analyzeTrends(brand, query) — optional OpenRouter synthesis combining the
 *      two into concrete content recommendations.
 *
 * Env vars:
 *   FB_PAGE_TOKEN_{BRAND}  — page token for live FB/IG engagement (uppercased brand)
 *   META_ADLIB_TOKEN       — Meta app token for the Ad Library API
 *   OPENROUTER_API_KEY     — enables analyzeTrends synthesis
 *   MODEL                  — OpenRouter model (default minimax/minimax-m3)
 *
 * Nothing here throws on a missing token — callers always get a structured
 * object describing what was (and wasn't) available.
 */

import { listPosts, type SocialPost } from '../stores/social-store'

const GRAPH = 'https://graph.facebook.com/v21.0'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PostEngagement = {
  id: string
  content: string
  platform: string
  published_at: string | null
  likes: number
  comments: number
  shares: number
  total: number
  /** true when likes/comments/shares came from a live Graph API fetch */
  live: boolean
  has_image: boolean
  length_bucket: 'short' | 'medium' | 'long'
}

export type EngagementBucket = { key: string; posts: number; total: number; avg: number }

export type OwnEngagementSummary = {
  ok: true
  brand: string
  token_configured: boolean
  /** true if at least one post pulled live metrics from the platform */
  live_metrics: boolean
  analyzed_posts: number
  totals: { likes: number; comments: number; shares: number; engagement: number }
  avg_engagement_per_post: number
  best_platform: { platform: string; avg: number } | null
  best_day: { day: string; avg: number } | null
  best_hour: { hour: number; label: string; avg: number } | null
  top_posts: PostEngagement[]
  by_platform: EngagementBucket[]
  by_length: EngagementBucket[]
  by_image: EngagementBucket[]
  note: string
}

export type AdLibraryEntry = {
  page_name: string
  headline: string
  body: string
  started: string | null
}

export type AdLibraryResult =
  | { ok: true; query: string; count: number; results: AdLibraryEntry[]; note: string }
  | { ok: false; error: string }

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function pageToken(brand: string): string | undefined {
  const key = `FB_PAGE_TOKEN_${brand.toUpperCase()}`
  const raw = process.env[key]?.trim()
  return raw ? raw : undefined
}

function lengthBucket(content: string): 'short' | 'medium' | 'long' {
  const n = content.trim().length
  if (n < 100) return 'short'
  if (n < 280) return 'medium'
  return 'long'
}

function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}${hour < 12 ? 'am' : 'pm'}`
}

/** Stored fallback counts — best-effort read of optional metrics on the post. */
function storedCounts(post: SocialPost): { likes: number; comments: number; shares: number } {
  const raw = post as unknown as Record<string, unknown>
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const metrics =
    raw['metrics'] && typeof raw['metrics'] === 'object'
      ? (raw['metrics'] as Record<string, unknown>)
      : raw
  return {
    likes: num(metrics['likes']),
    comments: num(metrics['comments']),
    shares: num(metrics['shares']),
  }
}

/** Fetch live FB engagement for a single post id. Returns null on any failure. */
async function fetchFacebook(
  postId: string,
  token: string,
): Promise<{ likes: number; comments: number; shares: number } | null> {
  try {
    const url =
      `${GRAPH}/${encodeURIComponent(postId)}` +
      `?fields=likes.summary(true),comments.summary(true),shares` +
      `&access_token=${encodeURIComponent(token)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      likes?: { summary?: { total_count?: number } }
      comments?: { summary?: { total_count?: number } }
      shares?: { count?: number }
    }
    return {
      likes: data.likes?.summary?.total_count ?? 0,
      comments: data.comments?.summary?.total_count ?? 0,
      shares: data.shares?.count ?? 0,
    }
  } catch {
    return null
  }
}

/** Fetch live IG engagement (like_count + comments_count) for a media id. */
async function fetchInstagram(
  mediaId: string,
  token: string,
): Promise<{ likes: number; comments: number; shares: number } | null> {
  try {
    const url =
      `${GRAPH}/${encodeURIComponent(mediaId)}` +
      `?fields=like_count,comments_count` +
      `&access_token=${encodeURIComponent(token)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { like_count?: number; comments_count?: number }
    return { likes: data.like_count ?? 0, comments: data.comments_count ?? 0, shares: 0 }
  } catch {
    return null
  }
}

function bucketize(
  posts: PostEngagement[],
  keyOf: (p: PostEngagement) => string | null,
): EngagementBucket[] {
  const map = new Map<string, { posts: number; total: number }>()
  for (const p of posts) {
    const key = keyOf(p)
    if (key === null) continue
    const cur = map.get(key) ?? { posts: 0, total: 0 }
    cur.posts += 1
    cur.total += p.total
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, posts: v.posts, total: v.total, avg: Math.round(v.total / v.posts) }))
    .sort((a, b) => b.avg - a.avg)
}

// ── (a) Own engagement ─────────────────────────────────────────────────────

export async function getOwnEngagement(
  brand: string,
  platformFilter?: string,
): Promise<OwnEngagementSummary> {
  const published = listPosts({ brand, status: 'published' }).filter(
    (p) => !platformFilter || p.platforms.includes(platformFilter as SocialPost['platforms'][number]),
  )

  const token = pageToken(brand)
  let live = false

  const engagements: PostEngagement[] = []
  for (const post of published) {
    // A post can target multiple platforms; attribute engagement to the
    // platform we actually have an external id + fetcher for.
    const platform = post.platforms[0] ?? 'unknown'
    let counts = storedCounts(post)
    let postLive = false

    if (token) {
      const fbId = post.external_ids['facebook']
      const igId = post.external_ids['instagram']
      if (fbId && post.platforms.includes('facebook')) {
        const fetched = await fetchFacebook(fbId, token)
        if (fetched) {
          counts = fetched
          postLive = true
          live = true
        }
      } else if (igId && post.platforms.includes('instagram')) {
        const fetched = await fetchInstagram(igId, token)
        if (fetched) {
          counts = fetched
          postLive = true
          live = true
        }
      }
    }

    engagements.push({
      id: post.id,
      content: post.content,
      platform,
      published_at: post.published_at,
      likes: counts.likes,
      comments: counts.comments,
      shares: counts.shares,
      total: counts.likes + counts.comments + counts.shares,
      live: postLive,
      has_image: post.media_urls.length > 0,
      length_bucket: lengthBucket(post.content),
    })
  }

  const totalsLikes = engagements.reduce((s, e) => s + e.likes, 0)
  const totalsComments = engagements.reduce((s, e) => s + e.comments, 0)
  const totalsShares = engagements.reduce((s, e) => s + e.shares, 0)
  const totalEngagement = totalsLikes + totalsComments + totalsShares

  const byPlatform = bucketize(engagements, (p) => p.platform)
  const byLength = bucketize(engagements, (p) => p.length_bucket)
  const byImage = bucketize(engagements, (p) => (p.has_image ? 'with image' : 'no image'))

  // Best day / hour from published timestamps (only posts with a timestamp).
  const dayBuckets = bucketize(engagements, (p) =>
    p.published_at ? DAYS[new Date(p.published_at).getDay()] ?? null : null,
  )
  const hourBuckets = bucketize(engagements, (p) =>
    p.published_at ? String(new Date(p.published_at).getHours()) : null,
  )

  const bestPlatform = byPlatform[0] ? { platform: byPlatform[0].key, avg: byPlatform[0].avg } : null
  const bestDay = dayBuckets[0] ? { day: dayBuckets[0].key, avg: dayBuckets[0].avg } : null
  const bestHour = hourBuckets[0]
    ? { hour: Number(hourBuckets[0].key), label: hourLabel(Number(hourBuckets[0].key)), avg: hourBuckets[0].avg }
    : null

  const topPosts = [...engagements].sort((a, b) => b.total - a.total).slice(0, 5)

  const note = !published.length
    ? 'No published posts yet — publish from the Social screen to start collecting engagement.'
    : token
      ? live
        ? 'Live engagement pulled from the platform.'
        : 'No live metrics available (posts may lack a platform post-id). Showing stored counts.'
      : `No platform token configured (set FB_PAGE_TOKEN_${brand.toUpperCase()}). Showing stored counts and structural insights.`

  return {
    ok: true,
    brand,
    token_configured: Boolean(token),
    live_metrics: live,
    analyzed_posts: engagements.length,
    totals: {
      likes: totalsLikes,
      comments: totalsComments,
      shares: totalsShares,
      engagement: totalEngagement,
    },
    avg_engagement_per_post: engagements.length
      ? Math.round(totalEngagement / engagements.length)
      : 0,
    best_platform: bestPlatform,
    best_day: bestDay,
    best_hour: bestHour,
    top_posts: topPosts,
    by_platform: byPlatform,
    by_length: byLength,
    by_image: byImage,
    note,
  }
}

// ── (b) Meta Ad Library ─────────────────────────────────────────────────────

export async function searchAdLibrary(
  query: string,
  opts: { country?: string; limit?: number } = {},
): Promise<AdLibraryResult> {
  const token = process.env.META_ADLIB_TOKEN?.trim()
  if (!token) {
    return { ok: false, error: 'Meta Ad Library token not configured (set META_ADLIB_TOKEN)' }
  }
  const q = query.trim()
  if (!q) return { ok: false, error: 'A search query is required' }

  const country = opts.country?.trim() || 'US'
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 50)

  try {
    const url =
      `${GRAPH}/ads_archive` +
      `?search_terms=${encodeURIComponent(q)}` +
      `&ad_reach_country=${encodeURIComponent(country)}` +
      `&ad_type=ALL` +
      `&fields=ad_creative_bodies,ad_creative_link_titles,page_name,ad_delivery_start_time` +
      `&access_token=${encodeURIComponent(token)}` +
      `&limit=${limit}`
    const res = await fetch(url)
    const data = (await res.json()) as {
      data?: Array<{
        page_name?: string
        ad_creative_bodies?: string[]
        ad_creative_link_titles?: string[]
        ad_delivery_start_time?: string
      }>
      error?: { message?: string }
    }
    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message ?? `Ad Library error ${res.status}` }
    }
    const results: AdLibraryEntry[] = (data.data ?? []).map((ad) => ({
      page_name: ad.page_name ?? 'Unknown advertiser',
      headline: ad.ad_creative_link_titles?.[0] ?? '',
      body: ad.ad_creative_bodies?.[0] ?? '',
      started: ad.ad_delivery_start_time ?? null,
    }))
    return {
      ok: true,
      query: q,
      count: results.length,
      results,
      note: results.length
        ? `Found ${results.length} active/archived ads for "${q}".`
        : `No ads found for "${q}".`,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── (c) Trend synthesis (optional) ──────────────────────────────────────────

export async function analyzeTrends(
  brand: string,
  query: string,
): Promise<{ ok: true; recommendations: string } | { ok: false; error: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: 'AI analysis unavailable (set OPENROUTER_API_KEY)' }
  }
  const model = process.env.MODEL ?? 'minimax/minimax-m3'

  const [own, ads] = await Promise.all([getOwnEngagement(brand), searchAdLibrary(query)])

  const ownLines = own.top_posts.length
    ? own.top_posts
        .map(
          (p, i) =>
            `${i + 1}. [${p.platform}] ${p.total} engagement — "${p.content.slice(0, 120)}"`,
        )
        .join('\n')
    : 'No own-post engagement data yet.'

  const adLines = ads.ok && ads.results.length
    ? ads.results
        .slice(0, 12)
        .map((a) => `- ${a.page_name}: ${a.headline || a.body.slice(0, 100)}`)
        .join('\n')
    : 'No competitor ad data available.'

  const hfmRule =
    brand === 'hfm'
      ? ' Never make medical claims or diagnose conditions in any suggested content.'
      : ''

  const systemPrompt =
    `You are Hermes, a social media strategist. Using the business's own top-performing posts and ` +
    `competitor ads from the Meta Ad Library, give 3-5 concrete, specific content recommendations ` +
    `the business should try next. Be actionable (topic, format, hook, posting cadence).${hfmRule} ` +
    `Keep it tight — short numbered list, no preamble.`

  const userPrompt =
    `Topic / competitor researched: "${query}"\n\n` +
    `Best platform so far: ${own.best_platform?.platform ?? 'unknown'}\n` +
    `Best posting time: ${own.best_day?.day ?? '?'} around ${own.best_hour?.label ?? '?'}\n` +
    `Posts with images vs without: ${own.by_image.map((b) => `${b.key} avg ${b.avg}`).join(', ') || 'n/a'}\n\n` +
    `Our top posts:\n${ownLines}\n\nCompetitor ads:\n${adLines}`

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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 700,
        temperature: 0.6,
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      return { ok: false, error: `AI error ${res.status}: ${err.slice(0, 160)}` }
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return { ok: false, error: 'AI returned no recommendations' }
    return { ok: true, recommendations: content }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
