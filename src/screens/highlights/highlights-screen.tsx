import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUpRight01Icon, StarIcon } from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { fetchHighlights, type Highlight } from '@/lib/highlights-api'
import { useBrand } from '@/contexts/BrandContext'

// Type color per highlight kind; attention severity overrides to amber
const KIND_COLORS: Record<Highlight['kind'], string> = {
  lead: '#10b981',
  conversation: '#3b82f6',
  appointment: '#8b5cf6',
  social: '#f97316',
  campaign: '#0ea5e9',
  page: '#94a3b8',
}

function timeAgo(at: string | null): string {
  if (!at) return ''
  const diff = Date.now() - Date.parse(at)
  if (Number.isNaN(diff)) return ''
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function HighlightCard({ h }: { h: Highlight }) {
  const attention = h.priority === 'attention'
  const color = attention ? '#f59e0b' : KIND_COLORS[h.kind] ?? '#94a3b8'
  return (
    <Link
      to={h.link}
      className="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:bg-[var(--theme-hover)] hover:shadow-md"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
      />
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[17px] leading-none"
        style={{
          background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
          border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        }}
      >
        {h.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-[var(--theme-text)]">{h.title}</p>
          {attention && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))',
                color: '#f59e0b',
                border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f59e0b' }} />
              Action
            </span>
          )}
        </div>
        <p className="truncate text-sm text-[var(--theme-muted)]">{h.detail}</p>
      </div>
      <span className="shrink-0 text-xs text-[var(--theme-muted)]">{timeAgo(h.at)}</span>
      <span
        className="shrink-0 self-center text-[var(--theme-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ color: 'var(--theme-accent)' }}
      >
        <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} />
      </span>
    </Link>
  )
}

export function HighlightsScreen() {
  const brand = useBrand()
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['highlights', brand.id],
    queryFn: () => fetchHighlights(brand.id),
    refetchInterval: 60_000,
  })
  const highlights = data?.highlights ?? []
  const attention = highlights.filter((h) => h.priority === 'attention')
  const info = highlights.filter((h) => h.priority === 'info')

  return (
    <ScreenShell icon={StarIcon} title="Highlights" count={highlights.length} subtitle="What's happening across your business" onRefresh={() => refetch()}>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-xl border border-[var(--theme-border)]"
              style={{ background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }}
            />
          ))}
        </div>
      ) : highlights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] py-16 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={StarIcon} size={24} />
          </div>
          <p className="text-sm font-semibold text-[var(--theme-text)]">All caught up</p>
          <p className="mt-1 text-sm text-[var(--theme-muted)]">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {attention.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Needs attention</h2>
              {attention.map((h) => <HighlightCard key={h.id} h={h} />)}
            </section>
          )}
          {info.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Activity</h2>
              {info.map((h) => <HighlightCard key={h.id} h={h} />)}
            </section>
          )}
        </div>
      )}
    </ScreenShell>
  )
}
