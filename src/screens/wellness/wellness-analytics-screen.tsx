import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Activity01Icon,
  Award01Icon,
  BookOpen01Icon,
  Calendar01Icon,
  ChartLineData01Icon,
  CheckmarkCircle01Icon,
  Fire03Icon,
  RepeatIcon,
  SparklesIcon,
  StarIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'

// ── Types (mirror server EngagementStats) ───────────────────────────────────────

interface EngagementStats {
  patients: { total_started: number; active_7d: number; active_today: number }
  engagement: {
    plans_completed: number
    avg_current_streak: number
    longest_streak_overall: number
    total_points: number
    total_lessons_completed: number
  }
  retention: {
    streak_buckets: { bucket: string; count: number }[]
    returning_rate: number
  }
  distribution: {
    by_focus_area: { key: string; label: string; emoji: string; count: number }[]
    by_level: { level: number; label: string; count: number }[]
  }
  content: { session_id: string; title: string; count: number }[]
  trend: { date: string; count: number }[]
}

// ── Design tokens ───────────────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const BUCKET_COLORS: Record<string, string> = {
  '0': '#94a3b8',
  '1-2': '#0ea5e9',
  '3-6': '#3b82f6',
  '7-13': '#8b5cf6',
  '14+': '#10b981',
}

const BUCKET_LABELS: Record<string, string> = {
  '0': 'Not started',
  '1-2': '1–2 days',
  '3-6': '3–6 days',
  '7-13': '7–13 days',
  '14+': '14+ days',
}

const LEVEL_COLORS: Record<number, string> = { 1: '#0ea5e9', 2: '#8b5cf6', 3: '#10b981' }

// ── API ─────────────────────────────────────────────────────────────────────────

async function fetchEngagement(brand: string): Promise<EngagementStats> {
  const res = await fetch(`/api/wellness/admin/engagement?brand=${brand}`)
  if (!res.ok) throw new Error('Failed to load engagement')
  const d = (await res.json()) as { engagement: EngagementStats }
  return d.engagement
}

// ── Stat card ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: typeof StarIcon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
      />
      <div className="pl-1.5">
        <span
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// ── Section card shell ──────────────────────────────────────────────────────────

function Panel({ title, icon, children, right }: {
  title: string; icon: typeof StarIcon; children: React.ReactNode; right?: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      <div className="mb-3.5 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={icon} size={12} className="text-white" />
        </span>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[110px] animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[220px] animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
        ))}
      </div>
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: 'radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--theme-accent) 30%, transparent), transparent 70%)' }}
      >
        <HugeiconsIcon icon={Activity01Icon} size={30} className="text-[var(--theme-accent)]" />
      </span>
      <h3 className="text-[15px] font-semibold text-[var(--theme-text)]">No patient activity yet</h3>
      <p className="mt-1 max-w-xs text-[13px] text-[var(--theme-muted)]">
        Engagement appears here as patients use the daily plans.
      </p>
    </div>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────────────

export function WellnessAnalyticsScreen() {
  const brand = useBrand()
  const query = useQuery({
    queryKey: ['wellness', 'admin', 'engagement', brand.id],
    queryFn: () => fetchEngagement(brand.id),
    refetchInterval: 60_000,
  })

  const data = query.data

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}>
          <HugeiconsIcon icon={ChartLineData01Icon} size={22} className="text-white" />
        </span>
        <div>
          <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">Wellness Engagement</h1>
          <p className="text-[13px] text-[var(--theme-muted)]">Who's engaging, retention, and what's resonating</p>
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton />
      ) : !data || data.patients.total_started === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Active Patients (7d)"
              value={String(data.patients.active_7d)}
              sub={`${data.patients.active_today} active today`}
              color="#10b981"
              icon={UserGroupIcon}
            />
            <StatCard
              label="Plans Completed"
              value={String(data.engagement.plans_completed)}
              sub={`${data.engagement.total_lessons_completed} lessons done`}
              color="#3b82f6"
              icon={CheckmarkCircle01Icon}
            />
            <StatCard
              label="Avg Streak"
              value={data.engagement.avg_current_streak > 0 ? `${data.engagement.avg_current_streak}` : '—'}
              sub="days, active streakers"
              color="#f59e0b"
              icon={Fire03Icon}
            />
            <StatCard
              label="Returning Rate"
              value={`${data.retention.returning_rate}%`}
              sub={`${data.engagement.total_points.toLocaleString()} pts awarded`}
              color="#8b5cf6"
              icon={RepeatIcon}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Retention — streak buckets */}
            <Panel
              title="Retention by Streak"
              icon={Fire03Icon}
              right={
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                  style={{ background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))', color: '#10b981' }}
                >
                  <HugeiconsIcon icon={Award01Icon} size={11} />
                  {data.engagement.longest_streak_overall} day best
                </span>
              }
            >
              <RetentionBars buckets={data.retention.streak_buckets} />
            </Panel>

            {/* 14-day activity trend */}
            <Panel title="14-Day Activity" icon={Calendar01Icon}>
              <TrendChart trend={data.trend} accent={brand.accentColor} />
            </Panel>

            {/* Focus distribution */}
            <Panel title="Focus Tracks" icon={SparklesIcon}>
              <FocusDistribution rows={data.distribution.by_focus_area} total={data.patients.total_started} accent={brand.accentColor} />
            </Panel>

            {/* Level distribution */}
            <Panel title="Level Distribution" icon={StarIcon}>
              <LevelDistribution rows={data.distribution.by_level} total={data.patients.total_started} />
            </Panel>
          </div>

          {/* Top content */}
          <Panel title="Top Lessons" icon={BookOpen01Icon}>
            <TopContent content={data.content} accent={brand.accentColor} />
          </Panel>
        </div>
      )}
    </div>
  )
}

// ── Retention bars ──────────────────────────────────────────────────────────────

function RetentionBars({ buckets }: { buckets: { bucket: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map(b => b.count))
  return (
    <div className="space-y-2.5">
      {buckets.map(b => {
        const color = BUCKET_COLORS[b.bucket] ?? 'var(--theme-accent)'
        const pct = Math.round((b.count / max) * 100)
        return (
          <div key={b.bucket} className="flex items-center gap-3">
            <span className="w-[72px] shrink-0 text-[11px] font-medium text-[var(--theme-muted)]">{BUCKET_LABELS[b.bucket]}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 55%, transparent))`, minWidth: b.count > 0 ? 6 : 0 }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--theme-text)]">{b.count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Trend chart ─────────────────────────────────────────────────────────────────

function TrendChart({ trend, accent }: { trend: { date: string; count: number }[]; accent: string }) {
  const max = Math.max(1, ...trend.map(t => t.count))
  return (
    <div>
      <div className="flex h-[140px] items-end gap-1">
        {trend.map(t => {
          const pct = Math.round((t.count / max) * 100)
          const day = new Date(t.date + 'T00:00:00').getDate()
          return (
            <div key={t.date} className="group flex flex-1 flex-col items-center gap-1" title={`${t.date}: ${t.count}`}>
              <span className="text-[9px] font-semibold tabular-nums text-[var(--theme-muted)] opacity-0 transition-opacity group-hover:opacity-100">{t.count}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${Math.max(pct, t.count > 0 ? 4 : 0)}%`,
                    background: t.count > 0
                      ? `linear-gradient(180deg, ${accent}, color-mix(in srgb, ${accent} 45%, transparent))`
                      : 'var(--theme-hover)',
                    minHeight: t.count > 0 ? 3 : 2,
                  }}
                />
              </div>
              <span className="text-[8px] tabular-nums text-[var(--theme-muted)]">{day}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] text-[var(--theme-muted)]">Plans completed per day</p>
    </div>
  )
}

// ── Focus distribution ──────────────────────────────────────────────────────────

function FocusDistribution({ rows, total, accent }: {
  rows: { key: string; label: string; emoji: string; count: number }[]; total: number; accent: string
}) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div className="space-y-2.5">
      {rows.map(r => {
        const pct = Math.round((r.count / max) * 100)
        const share = total > 0 ? Math.round((r.count / total) * 100) : 0
        return (
          <div key={r.key} className="flex items-center gap-2.5">
            <span className="text-[15px]">{r.emoji}</span>
            <span className="w-[120px] shrink-0 truncate text-[12px] font-medium text-[var(--theme-text)]">{r.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 50%, transparent))`, minWidth: r.count > 0 ? 4 : 0 }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--theme-muted)]">
              <span className="font-semibold text-[var(--theme-text)]">{r.count}</span> · {share}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Level distribution ──────────────────────────────────────────────────────────

function LevelDistribution({ rows, total }: { rows: { level: number; label: string; count: number }[]; total: number }) {
  return (
    <div className="space-y-2.5">
      {rows.map(r => {
        const color = LEVEL_COLORS[r.level] ?? 'var(--theme-accent)'
        const share = total > 0 ? Math.round((r.count / total) * 100) : 0
        return (
          <div key={r.level} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums text-white"
              style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #000))` }}
            >
              {r.level}
            </span>
            <span className="flex-1 text-[12px] font-medium text-[var(--theme-text)]">{r.label}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: 'var(--theme-hover)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share}%`, background: color, minWidth: r.count > 0 ? 4 : 0 }} />
            </div>
            <span className="w-7 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--theme-text)]">{r.count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Top content ─────────────────────────────────────────────────────────────────

function TopContent({ content, accent }: { content: { session_id: string; title: string; count: number }[]; accent: string }) {
  if (content.length === 0) {
    return <p className="py-4 text-center text-[12px] text-[var(--theme-muted)]">No lessons completed yet.</p>
  }
  const max = Math.max(1, ...content.map(c => c.count))
  return (
    <div className="space-y-1.5">
      {content.map((c, i) => {
        const pct = Math.round((c.count / max) * 100)
        return (
          <div key={c.session_id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
            <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-[var(--theme-muted)]">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--theme-text)]">{c.title}</span>
            <div className="hidden h-1.5 w-28 overflow-hidden rounded-full sm:block" style={{ background: 'var(--theme-hover)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 50%, transparent))` }} />
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
              style={{ background: `color-mix(in srgb, ${accent} 12%, var(--theme-card))`, color: accent, border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)` }}
            >
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={10} />
              {c.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}
