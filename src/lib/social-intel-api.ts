/**
 * Social Intelligence API client — /api/social-intel routes.
 */

export type PostEngagement = {
  id: string
  content: string
  platform: string
  published_at: string | null
  likes: number
  comments: number
  shares: number
  total: number
  live: boolean
  has_image: boolean
  length_bucket: 'short' | 'medium' | 'long'
}

export type EngagementBucket = { key: string; posts: number; total: number; avg: number }

export type OwnEngagementSummary = {
  ok: true
  brand: string
  token_configured: boolean
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

export type AnalyzeResult =
  | { ok: true; recommendations: string }
  | { ok: false; error: string }

export async function fetchEngagement(params?: {
  brand?: string
  platform?: string
}): Promise<OwnEngagementSummary> {
  const qs = new URLSearchParams()
  if (params?.brand) qs.set('brand', params.brand)
  if (params?.platform) qs.set('platform', params.platform)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`/api/social-intel/engagement${suffix}`)
  if (!res.ok) throw new Error(`Failed to load engagement (${res.status})`)
  return (await res.json()) as OwnEngagementSummary
}

export async function searchAdLibrary(
  query: string,
  brand?: string,
): Promise<AdLibraryResult> {
  const qs = new URLSearchParams({ q: query })
  if (brand) qs.set('brand', brand)
  const res = await fetch(`/api/social-intel/ad-library?${qs.toString()}`)
  return (await res.json()) as AdLibraryResult
}

export async function analyzeTrends(
  query: string,
  brand?: string,
): Promise<AnalyzeResult> {
  const res = await fetch('/api/social-intel/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, brand }),
  })
  return (await res.json()) as AnalyzeResult
}
