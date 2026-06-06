
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle01Icon,
  PlugSocketIcon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { fetchPlugins, setPluginEnabled } from '@/lib/plugins-api'
import type { PluginItem } from '@/lib/plugins-api'
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
} from '@/lib/plugins-catalog'
import type { PluginCategory } from '@/lib/plugins-catalog'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'plugins'] as const

const CATEGORY_ORDER: PluginCategory[] = [
  'ai',
  'messaging',
  'email',
  'social',
  'calendar',
  'voice',
  'payments',
]

function Toggle({
  on,
  disabled,
  onClick,
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40',
      )}
      style={{ background: on ? 'var(--theme-accent)' : 'var(--theme-border)' }}
      aria-pressed={on}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
        style={{ left: 2, transform: on ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}

export function PluginsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const brandParam = brand.id !== 'hermes' ? brand.id : undefined

  const [categoryFilter, setCategoryFilter] = useState<PluginCategory | 'all'>(
    'all',
  )

  const pluginsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchPlugins(brandParam),
    refetchInterval: 60_000,
  })

  const toggleMutation = useMutation({
    mutationFn: (p: { id: string; enabled: boolean }) =>
      setPluginEnabled(p.id, p.enabled, brandParam),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const prev = queryClient.getQueryData<PluginItem[]>(QUERY_KEY)
      queryClient.setQueryData<PluginItem[]>(QUERY_KEY, (old) =>
        (old ?? []).map((p) =>
          p.id === vars.id ? { ...p, enabled: vars.enabled } : p,
        ),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev)
      toast('Failed to update plugin', { type: 'error' })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const plugins = pluginsQuery.data ?? []

  const byCategory = useMemo(() => {
    const filtered =
      categoryFilter === 'all'
        ? plugins
        : plugins.filter((p) => p.category === categoryFilter)
    const groups: Array<{ category: PluginCategory; items: PluginItem[] }> = []
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((p) => p.category === cat)
      if (items.length) groups.push({ category: cat, items })
    }
    return groups
  }, [plugins, categoryFilter])

  const enabledCount = plugins.filter((p) => p.enabled).length

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={PlugSocketIcon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Plugins
              </h1>
              <span className="ml-1 text-xs text-[var(--theme-muted)]">
                ({enabledCount} enabled / {plugins.length})
              </span>
            </div>
            <button
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
              }
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
              title="Refresh"
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={16}
                className="text-[var(--theme-muted)]"
              />
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--theme-muted)]">
            Connect the channels and capabilities your AI OS uses. A plugin needs
            its server keys configured (green check) before it runs.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['all', ...CATEGORY_ORDER] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  categoryFilter === c
                    ? 'border-transparent text-white'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={
                  categoryFilter === c
                    ? { background: 'var(--theme-accent)' }
                    : undefined
                }
              >
                {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </header>

        {pluginsQuery.isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--theme-muted)]">
            Loading…
          </div>
        ) : (
          byCategory.map((group) => (
            <div key={group.category}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
                {CATEGORY_LABELS[group.category]}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((p) => {
                  const locked = p.status === 'coming_soon'
                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-bg)] text-xl">
                        {p.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
                            {p.name}
                          </h3>
                          {p.status !== 'available' && (
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase"
                              style={{
                                background: 'var(--theme-bg)',
                                color:
                                  p.status === 'beta'
                                    ? 'var(--theme-warning)'
                                    : 'var(--theme-muted)',
                              }}
                            >
                              {STATUS_LABELS[p.status]}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--theme-muted)]">
                          {p.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                          {p.configured ? (
                            <span
                              className="flex items-center gap-1"
                              style={{ color: 'var(--theme-success)' }}
                            >
                              <HugeiconsIcon
                                icon={CheckmarkCircle01Icon}
                                size={10}
                              />
                              Configured
                            </span>
                          ) : p.env_vars.length > 0 ? (
                            <span
                              className="text-[var(--theme-muted)]"
                              title={p.env_vars.join(', ')}
                            >
                              Needs: {p.env_vars.length} key
                              {p.env_vars.length !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-[var(--theme-muted)]">
                              No keys required
                            </span>
                          )}
                          <span className="text-[var(--theme-muted)]">
                            · {p.setup}
                          </span>
                        </div>
                      </div>
                      <Toggle
                        on={p.enabled}
                        disabled={locked || toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({ id: p.id, enabled: !p.enabled })
                        }
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
