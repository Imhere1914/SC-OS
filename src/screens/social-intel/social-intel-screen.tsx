import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiMagicIcon,
  AnalyticsUpIcon,
  Calendar03Icon,
  ChartLineData01Icon,
  Comment01Icon,
  FavouriteIcon,
  InboxIcon,
  Search01Icon,
  SentIcon,
  SparklesIcon,
  ThumbsUpIcon,
} from '@hugeicons/core-free-icons'
import {
  analyzeTrends,
  fetchEngagement,
  searchAdLibrary,
  type AdLibraryEntry,
  type EngagementBucket,
  type OwnEngagementSummary,
  type PostEngagement,
} from '@/lib/social-intel-api'
import { toast } from '@/components/toast'
import { useBrand } from '@/contexts/BrandContext'

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW =
  '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const PLATFORM_COLOR: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#00BFC6',
  linkedin: '#0A66C2',
  x: '#64748b',
  unknown: '#94a3b8',
}

function platformLabel(p: string): string {
  if (p === 'x') return 'X'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

// ── Shared primitives ───────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof AnalyticsUpIcon
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--theme-accent)_45%,var(--theme-border))]"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl"
        style={{ background: color }}
      />
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={14} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-[var(--theme-text)]">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{sub}</div>}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: typeof InboxIcon
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--theme-border)] px-6 py-14 text-center">
      <div
        className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--theme-accent) 25%, transparent), transparent)',
          color: 'var(--theme-accent)',
        }}
      >
        <HugeiconsIcon icon={icon} size={24} />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--theme-text)]">{title}</h3>
      <p className="mt-1 max-w-md text-[12px] leading-relaxed text-[var(--theme-muted)]">
        {subtitle}
      </p>
    </div>
  )
}

// ── Tab 1: Your Performance ─────────────────────────────────────────────────

function EngagementBar({ bucket, max }: { bucket: EngagementBucket; max: number }) {
  const color = PLATFORM_COLOR[bucket.key] ?? 'var(--theme-accent)'
  const pct = max > 0 ? Math.max(4, Math.round((bucket.avg / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-right text-[11px] font-medium text-[var(--theme-muted)]">
        {platformLabel(bucket.key)}
      </div>
      <div className="h-6 flex-1 overflow-hidden rounded-md bg-[var(--theme-hover)]">
        <div
          className="flex h-full items-center justify-end rounded-md px-2 text-[10px] font-semibold text-white transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 70%, transparent), ${color})`,
          }}
        >
          {bucket.avg}
        </div>
      </div>
      <div className="w-12 shrink-0 text-[10px] tabular-nums text-[var(--theme-muted)]">
        {bucket.posts} post{bucket.posts === 1 ? '' : 's'}
      </div>
    </div>
  )
}

function MetricChip({
  icon,
  value,
  color,
}: {
  icon: typeof ThumbsUpIcon
  value: number
  color: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <HugeiconsIcon icon={icon} size={10} />
      {value}
    </span>
  )
}

function TopPostRow({ post, rank }: { post: PostEngagement; rank: number }) {
  const color = PLATFORM_COLOR[post.platform] ?? 'var(--theme-accent)'
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 transition-all duration-150 hover:border-[color-mix(in_srgb,var(--theme-accent)_40%,var(--theme-border))]">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ background: ACCENT_GRADIENT }}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12px] leading-snug text-[var(--theme-text)]">
          {post.content || '(no caption)'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
            style={{
              background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
              color,
            }}
          >
            {platformLabel(post.platform)}
          </span>
          <MetricChip icon={ThumbsUpIcon} value={post.likes} color="#3b82f6" />
          <MetricChip icon={Comment01Icon} value={post.comments} color="#8b5cf6" />
          <MetricChip icon={SentIcon} value={post.shares} color="#10b981" />
          {post.published_at && (
            <span className="text-[10px] text-[var(--theme-muted)]">
              {formatDate(post.published_at)}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-base font-bold tabular-nums text-[var(--theme-text)]">
          {post.total}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-[var(--theme-muted)]">
          total
        </div>
      </div>
    </div>
  )
}

function PerformanceTab({ data }: { data: OwnEngagementSummary }) {
  const maxAvg = useMemo(
    () => Math.max(1, ...data.by_platform.map((b) => b.avg)),
    [data.by_platform],
  )

  if (data.analyzed_posts === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="No published posts to analyze yet"
        subtitle="Once you publish posts from the Social screen, their likes, comments and shares show up here. For live platform metrics, set FB_PAGE_TOKEN_{BRAND} so Hermes can read engagement directly from Facebook and Instagram."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={FavouriteIcon}
          label="Total engagement"
          value={String(data.totals.engagement)}
          sub={`${data.analyzed_posts} posts · ${data.avg_engagement_per_post} avg`}
          color="#ec4899"
        />
        <StatCard
          icon={AnalyticsUpIcon}
          label="Best platform"
          value={data.best_platform ? platformLabel(data.best_platform.platform) : '—'}
          sub={data.best_platform ? `${data.best_platform.avg} avg engagement` : 'No data'}
          color={
            data.best_platform
              ? PLATFORM_COLOR[data.best_platform.platform] ?? '#3b82f6'
              : '#3b82f6'
          }
        />
        <StatCard
          icon={Calendar03Icon}
          label="Best day"
          value={data.best_day ? data.best_day.day.slice(0, 3) : '—'}
          sub={data.best_day ? `${data.best_day.avg} avg engagement` : 'Needs timestamps'}
          color="#f59e0b"
        />
        <StatCard
          icon={SparklesIcon}
          label="Best time to post"
          value={data.best_hour ? data.best_hour.label : '—'}
          sub={data.best_hour ? `${data.best_hour.avg} avg engagement` : 'Needs timestamps'}
          color="#8b5cf6"
        />
      </div>

      {/* Status note */}
      <div
        className="rounded-lg border px-3 py-2 text-[11px]"
        style={{
          background: data.live_metrics
            ? 'color-mix(in srgb, #10b981 8%, var(--theme-card))'
            : 'color-mix(in srgb, #f59e0b 8%, var(--theme-card))',
          borderColor: data.live_metrics
            ? 'color-mix(in srgb, #10b981 30%, transparent)'
            : 'color-mix(in srgb, #f59e0b 30%, transparent)',
          color: 'var(--theme-muted)',
        }}
      >
        {data.note}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Top posts */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Top-performing posts
          </p>
          <div className="flex flex-col gap-2">
            {data.top_posts.map((post, i) => (
              <TopPostRow key={post.id} post={post} rank={i + 1} />
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Avg engagement by platform
            </p>
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
              {data.by_platform.length ? (
                data.by_platform.map((b) => (
                  <EngagementBar key={b.key} bucket={b} max={maxAvg} />
                ))
              ) : (
                <p className="text-[11px] text-[var(--theme-muted)]">No data</p>
              )}
            </div>
          </div>

          {data.by_image.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                Image vs text
              </p>
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
                {data.by_image.map((b) => (
                  <div
                    key={b.key}
                    className="flex items-center justify-between text-[12px]"
                  >
                    <span className="capitalize text-[var(--theme-text)]">{b.key}</span>
                    <span className="font-semibold tabular-nums text-[var(--theme-text)]">
                      {b.avg}{' '}
                      <span className="text-[10px] font-normal text-[var(--theme-muted)]">
                        avg
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab 2: Trend Research ───────────────────────────────────────────────────

function AdCard({ entry }: { entry: AdLibraryEntry }) {
  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 transition-all duration-150 hover:border-[color-mix(in_srgb,var(--theme-accent)_40%,var(--theme-border))]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-semibold text-[var(--theme-text)]">
          {entry.page_name}
        </span>
        {entry.started && (
          <span className="shrink-0 text-[10px] text-[var(--theme-muted)]">
            {formatDate(entry.started)}
          </span>
        )}
      </div>
      {entry.headline && (
        <p className="text-[12px] font-medium text-[var(--theme-accent)]">
          {entry.headline}
        </p>
      )}
      {entry.body && (
        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[var(--theme-muted)]">
          {entry.body}
        </p>
      )}
    </div>
  )
}

function ResearchTab({ brandId }: { brandId: string }) {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')

  const searchMutation = useMutation({
    mutationFn: (q: string) => searchAdLibrary(q, brandId),
    onSuccess: (res) => {
      if (!res.ok) toast(res.error, { type: 'error' })
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Search failed', { type: 'error' }),
  })

  const analyzeMutation = useMutation({
    mutationFn: (q: string) => analyzeTrends(q, brandId),
    onSuccess: (res) => {
      if (!res.ok) toast(res.error, { type: 'error' })
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Analysis failed', { type: 'error' }),
  })

  const runSearch = () => {
    const q = query.trim()
    if (!q) return
    setSubmitted(q)
    analyzeMutation.reset()
    searchMutation.mutate(q)
  }

  const searchResult = searchMutation.data
  const analysis = analyzeMutation.data

  return (
    <div className="flex flex-col gap-5">
      {/* Search box */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]">
            <HugeiconsIcon icon={Search01Icon} size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Research ads for a topic or competitor…"
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] py-2 pl-9 pr-3 text-[13px] text-[var(--theme-text)] outline-none transition-all duration-150 placeholder:text-[var(--theme-muted)] focus:border-[var(--theme-accent)]"
          />
        </div>
        <button
          onClick={runSearch}
          disabled={!query.trim() || searchMutation.isPending}
          className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 disabled:opacity-50"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={Search01Icon} size={15} />
          {searchMutation.isPending ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Initial / empty state */}
      {!searchMutation.isPending && !searchResult && (
        <EmptyState
          icon={ChartLineData01Icon}
          title="Research what competitors are running"
          subtitle="Search the Meta Ad Library for any topic or brand to see live and archived ad creatives. Set META_ADLIB_TOKEN to enable this — it's a free Meta app token."
        />
      )}

      {/* Token-not-configured / error */}
      {searchResult && !searchResult.ok && (
        <div
          className="rounded-xl border px-4 py-6 text-center"
          style={{
            background: 'color-mix(in srgb, #f59e0b 8%, var(--theme-card))',
            borderColor: 'color-mix(in srgb, #f59e0b 30%, transparent)',
          }}
        >
          <p className="text-[13px] font-semibold text-[var(--theme-text)]">
            {searchResult.error}
          </p>
          <p className="mt-1 text-[11px] text-[var(--theme-muted)]">
            Add META_ADLIB_TOKEN to your workspace .env to enable trend research.
          </p>
        </div>
      )}

      {/* Results */}
      {searchResult && searchResult.ok && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[var(--theme-muted)]">{searchResult.note}</p>
            {searchResult.count > 0 && (
              <button
                onClick={() => analyzeMutation.mutate(submitted)}
                disabled={analyzeMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--theme-accent)_40%,var(--theme-border))] px-3 py-1.5 text-[12px] font-semibold text-[var(--theme-accent)] transition-all duration-150 hover:bg-[color-mix(in_srgb,var(--theme-accent)_10%,transparent)] disabled:opacity-50"
              >
                <HugeiconsIcon icon={AiMagicIcon} size={14} />
                {analyzeMutation.isPending ? 'Analyzing…' : 'Ask Hermes to analyze'}
              </button>
            )}
          </div>

          {/* AI recommendations */}
          {analysis && analysis.ok && (
            <div
              className="rounded-xl border p-4"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card)), var(--theme-card))',
                borderColor: 'color-mix(in srgb, var(--theme-accent) 35%, var(--theme-border))',
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                  style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
                >
                  <HugeiconsIcon icon={AiMagicIcon} size={14} />
                </span>
                <span className="text-[12px] font-bold text-[var(--theme-text)]">
                  Hermes recommendations
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--theme-text)]">
                {analysis.recommendations}
              </p>
            </div>
          )}

          {searchResult.count > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {searchResult.results.map((entry, i) => (
                <AdCard key={i} entry={entry} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Search01Icon}
              title="No ads found"
              subtitle={`No active or archived ads matched "${searchResult.query}". Try a broader topic or a known brand name.`}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Screen shell ────────────────────────────────────────────────────────────

export function SocialIntelScreen() {
  const brand = useBrand()
  const brandId = brand.id !== 'default' ? brand.id : undefined
  const [tab, setTab] = useState<'performance' | 'research'>('performance')

  const engagementQuery = useQuery({
    queryKey: ['platform', 'social-intel', brandId ?? 'default'],
    queryFn: () => fetchEngagement({ brand: brandId }),
    refetchInterval: 120_000,
  })

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        {/* Page header */}
        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: 'var(--theme-border)',
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)), var(--theme-card))',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={ChartLineData01Icon} size={18} />
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">
                Social Intelligence
              </h1>
              <p className="text-[11px] text-[var(--theme-muted)]">
                See what's working for you, and what competitors are running
              </p>
            </div>
          </div>
        </div>

        {/* Segmented control */}
        <div className="inline-flex w-fit rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-0.5">
          {(
            [
              { id: 'performance', label: 'Your Performance' },
              { id: 'research', label: 'Trend Research' },
            ] as const
          ).map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="rounded-[7px] px-3 py-1.5 text-[12px] font-semibold transition-all duration-150"
                style={{
                  background: active
                    ? 'color-mix(in srgb, var(--theme-accent) 14%, transparent)'
                    : 'transparent',
                  color: active ? 'var(--theme-accent)' : 'var(--theme-muted)',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {tab === 'performance' ? (
          engagementQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[92px] animate-pulse rounded-xl bg-[var(--theme-card)] opacity-60"
                />
              ))}
            </div>
          ) : engagementQuery.data ? (
            <PerformanceTab data={engagementQuery.data} />
          ) : (
            <EmptyState
              icon={InboxIcon}
              title="Couldn't load engagement"
              subtitle="Try refreshing. Engagement is computed from your published posts in the Social store."
            />
          )
        ) : (
          <ResearchTab brandId={brandId ?? ''} />
        )}
      </div>
    </div>
  )
}
