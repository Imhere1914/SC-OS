import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  PlugIcon,
  LinkSquare01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/integrations')({ component: IntegrationsScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

type IntegrationStatus = 'connected' | 'not_configured' | 'error'
type IntegrationCategory = 'email' | 'payments' | 'sms' | 'calendar' | 'ai' | 'storage' | 'crm' | 'analytics'

interface IntegrationInfo {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  status: IntegrationStatus
  detail: string | null
  docs_url: string
}

// ── Category config ───────────────────────────────────────────────────────────

type FilterTab = 'all' | IntegrationCategory

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  email: 'Email',
  payments: 'Payments',
  sms: 'SMS',
  calendar: 'Calendar',
  ai: 'AI',
  storage: 'Storage',
  crm: 'CRM',
  analytics: 'Analytics',
}

const CATEGORY_COLORS: Record<IntegrationCategory, string> = {
  email: '#0ea5e9',
  payments: '#22c55e',
  sms: '#8b5cf6',
  calendar: '#f59e0b',
  ai: '#6366f1',
  storage: '#94a3b8',
  crm: '#f97316',
  analytics: '#ec4899',
}

// ── Design tokens (shared vocabulary with Payments / Payroll) ─────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchIntegrations(brandId: string): Promise<IntegrationInfo[]> {
  const url = new URL('/api/integrations', location.origin)
  if (brandId !== 'default') url.searchParams.set('brand', brandId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load integrations')
  return res.json()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: IntegrationStatus }) {
  if (status === 'connected') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))',
          color: '#10b981',
          border: '1px solid color-mix(in srgb, #10b981 30%, transparent)',
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10b981' }} />
        Connected
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'color-mix(in srgb, #f59e0b 12%, var(--theme-card))',
          color: '#f59e0b',
          border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f59e0b' }} />
        Error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--theme-muted)]" style={{ background: 'var(--theme-hover)' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--theme-muted)' }} />
      Not connected
    </span>
  )
}

function CategoryBadge({ category }: { category: IntegrationCategory }) {
  const color = CATEGORY_COLORS[category]
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`, color }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  )
}

function ConfigurePopover({ integration }: { integration: IntegrationInfo }) {
  const [open, setOpen] = useState(false)
  const color = CATEGORY_COLORS[integration.category]

  // Extract env var hints from the detail text
  const detailText = integration.status === 'not_configured' ? integration.detail : null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-2.5 py-1 text-[11px] font-medium text-[var(--theme-text)] transition-all duration-150 hover:bg-[var(--theme-accent-soft)] hover:text-[var(--theme-accent)]"
      >
        Configure
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-20 mb-2 w-72 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
            {/* Header — modal pattern: gradient icon chip + bold title */}
            <div className="flex items-center gap-2.5 border-b border-[var(--theme-border)] px-4 py-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
                  boxShadow: `0 2px 8px color-mix(in srgb, ${color} 38%, transparent)`,
                }}
              >
                {integration.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <h4 className="text-[12px] font-semibold text-[var(--theme-text)]">Configure {integration.name}</h4>
                <p className="text-[10px] text-[var(--theme-muted)]">{CATEGORY_LABELS[integration.category]}</p>
              </div>
            </div>
            <div className="p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                {integration.status === 'connected' ? 'Status' : 'Setup'}
              </p>
              {integration.status === 'connected' ? (
                <p className="text-[11px] font-medium" style={{ color: '#10b981' }}>
                  {integration.detail ?? 'This integration is active.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {detailText && (
                    <p className="font-mono text-[10px] text-[var(--theme-muted)]">{detailText}</p>
                  )}
                  <p className="text-[11px] text-[var(--theme-muted)]">
                    Add the required environment variables to your <code className="rounded bg-[var(--theme-hover)] px-1 py-0.5 font-mono text-[10px]">.env</code> file and restart the server.
                  </p>
                </div>
              )}
              <a
                href={integration.docs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[var(--theme-accent)] hover:underline"
              >
                <HugeiconsIcon icon={LinkSquare01Icon} size={11} />
                View documentation
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function IntegrationCard({ integration }: { integration: IntegrationInfo }) {
  const isConnected = integration.status === 'connected'
  const color = CATEGORY_COLORS[integration.category]

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md',
        !isConnected && 'opacity-80 hover:opacity-100',
      )}
      style={{ backdropFilter: 'blur(10px)' }}
    >
      {/* Connected accent line */}
      {isConnected && (
        <div
          className="absolute left-0 top-0 h-full w-[3px] rounded-l-2xl"
          style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
        />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {/* Service initial in tinted chip */}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold"
            style={{
              background: `color-mix(in srgb, ${color} 14%, var(--theme-card))`,
              color,
              border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
            }}
          >
            {integration.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-[var(--theme-text)]">{integration.name}</span>
              <CategoryBadge category={integration.category} />
            </div>
            <div className="mt-1">
              <StatusDot status={integration.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] leading-relaxed text-[var(--theme-muted)]">{integration.description}</p>

      {/* Detail text */}
      {integration.detail && integration.status === 'connected' && (
        <p
          className="rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-medium"
          style={{ background: 'color-mix(in srgb, #10b981 10%, var(--theme-card))', color: '#10b981' }}
        >
          {integration.detail}
        </p>
      )}
      {integration.detail && integration.status === 'not_configured' && (
        <p className="rounded-lg bg-[var(--theme-hover)] px-2.5 py-1.5 font-mono text-[10px] text-[var(--theme-muted)]">
          {integration.detail}
        </p>
      )}

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <ConfigurePopover integration={integration} />
        <a
          href={integration.docs_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] px-2.5 py-1 text-[11px] font-medium text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
        >
          <HugeiconsIcon icon={LinkSquare01Icon} size={11} />
          Docs
        </a>
      </div>
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

function IntegrationsScreen() {
  const brand = useBrand()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations', brand.id],
    queryFn: () => fetchIntegrations(brand.id),
    staleTime: 30_000,
  })

  // Build available category tabs (only categories present in data)
  const presentCategories = Array.from(
    new Set(integrations.map(i => i.category)),
  ) as IntegrationCategory[]

  const filtered =
    activeFilter === 'all'
      ? integrations
      : integrations.filter(i => i.category === activeFilter)

  const connectedCount = integrations.filter(i => i.status === 'connected').length
  const totalCount = integrations.length

  const tabs: FilterTab[] = ['all', ...presentCategories]

  return (
    <div className="min-h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={PlugIcon} size={18} />
              </div>
              <div>
                <h1 className="text-[19px] font-bold leading-tight text-[var(--theme-text)]">Integrations</h1>
                <p className="text-[11px] text-[var(--theme-muted)]">Connect your tools and services</p>
              </div>
            </div>

            {/* Stats bar */}
            {!isLoading && totalCount > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: '#10b981' }} />
                <span className="text-[12px] font-medium tabular-nums text-[var(--theme-text)]">
                  {connectedCount} connected
                </span>
                <span className="text-[var(--theme-border)]">·</span>
                <span className="text-[12px] tabular-nums text-[var(--theme-muted)]">
                  {totalCount} available
                </span>
              </div>
            )}
          </div>

          {/* Category filter tabs — segmented control */}
          {!isLoading && (
            <div className="mt-4 inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-0.5">
              {tabs.map(tab => {
                const active = activeFilter === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className="rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-all duration-150"
                    style={
                      active
                        ? { background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }
                        : { color: 'var(--theme-muted)' }
                    }
                  >
                    {tab === 'all' ? 'All' : CATEGORY_LABELS[tab]}
                  </button>
                )
              })}
            </div>
          )}
        </header>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-[var(--theme-card)] opacity-60" />
            ))}
          </div>
        )}

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={PlugIcon} size={22} />
            </div>
            <p className="text-sm font-semibold text-[var(--theme-text)]">
              No integrations in this category
            </p>
            <p className="text-[12px] text-[var(--theme-muted)]">
              Try switching to "All" or a different category.
            </p>
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-1 rounded-lg px-4 py-1.5 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              Show all
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
