import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { StarIcon } from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { fetchHighlights, type Highlight } from '@/lib/highlights-api'
import { useBrand } from '@/contexts/BrandContext'

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
  return (
    <Link
      to={h.link}
      className="flex items-start gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-colors hover:bg-[var(--theme-hover)]"
    >
      <span className="text-2xl leading-none">{h.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-[var(--theme-text)]">{h.title}</p>
          {attention && (
            <span className="rounded-full bg-[var(--theme-accent)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-accent)]">
              Action
            </span>
          )}
        </div>
        <p className="truncate text-sm text-[var(--theme-muted)]">{h.detail}</p>
      </div>
      <span className="shrink-0 text-xs text-[var(--theme-muted)]">{timeAgo(h.at)}</span>
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
        <p className="py-12 text-center text-sm text-[var(--theme-muted)]">Loading…</p>
      ) : highlights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] py-16 text-center">
          <p className="text-sm text-[var(--theme-muted)]">All caught up — nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {attention.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Needs attention</h2>
              {attention.map((h) => <HighlightCard key={h.id} h={h} />)}
            </section>
          )}
          {info.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)]">Activity</h2>
              {info.map((h) => <HighlightCard key={h.id} h={h} />)}
            </section>
          )}
        </div>
      )}
    </ScreenShell>
  )
}
