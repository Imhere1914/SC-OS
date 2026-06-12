import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBrand } from '@/contexts/BrandContext'
import { HugeiconsIcon } from '@hugeicons/react'
import { AiMagicIcon } from '@hugeicons/core-free-icons'

interface BriefingData {
  generated: boolean
  briefing: string | null
  brand: string
}

export function MorningBriefing() {
  const brand = useBrand()
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery<BriefingData>({
    queryKey: ['briefing', brand.id],
    queryFn: () => fetch(`/api/briefing?brand=${brand.id}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border p-4" style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
        <div className="h-4 w-48 rounded bg-[var(--theme-muted)] opacity-30 mb-2" />
        <div className="h-3 w-full rounded bg-[var(--theme-muted)] opacity-20 mb-1" />
        <div className="h-3 w-4/5 rounded bg-[var(--theme-muted)] opacity-20" />
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${brand.accentColor} 8%, var(--theme-card)), var(--theme-card))`,
        borderColor: `color-mix(in srgb, ${brand.accentColor} 30%, var(--theme-border))`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AiMagicIcon} size={16} style={{ color: brand.accentColor }} />
          <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: brand.accentColor }}>
            Morning Briefing
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="text-[11px] text-[var(--theme-muted)] hover:text-[var(--theme-text)] transition-colors"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {data?.briefing ? (
        <div className="mt-2.5">
          <p className="text-[13px] leading-relaxed text-[var(--theme-text)]">
            {expanded ? data.briefing : data.briefing.slice(0, 280) + (data.briefing.length > 280 ? '…' : '')}
          </p>
          {data.briefing.length > 280 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-1 text-[12px] font-medium transition-colors"
              style={{ color: brand.accentColor }}
            >
              {expanded ? 'Show less' : 'Read full briefing'}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-[var(--theme-muted)]">
          Set OPENROUTER_API_KEY to enable AI briefings. Your business data is ready.
        </p>
      )}
    </div>
  )
}
