import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import type { Chat01Icon } from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cinema } from '@/lib/brand-cinema'

/** Standard page header + scroll container shared by module screens. */
export function ScreenShell({
  icon,
  title,
  count,
  subtitle,
  onRefresh,
  action,
  children,
}: {
  icon: typeof Chat01Icon
  title: string
  count?: number
  subtitle?: string
  onRefresh?: () => void
  action?: ReactNode
  children: ReactNode
}) {
  const brand = useBrand()
  const c = cinema(brand.id)
  return (
    <div className="h-full overflow-y-auto">

      <div
        className="cine-chrome-wash mx-auto flex w-full max-w-[1060px] flex-col px-6 py-7"
        style={{ '--cine-accent': c.accent, '--cine-glow': c.glow } as React.CSSProperties}
      >

        {/* Page header */}
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}
            >
              <HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-tight text-[var(--theme-text)]">
                {title}
                {typeof count === 'number' && (
                  <span className="ml-2 text-[13px] font-normal text-[var(--theme-muted)]">
                    {count}
                  </span>
                )}
              </h1>
              {subtitle && (
                <p className="text-[12px] text-[var(--theme-muted)]">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                title="Refresh"
              >
                <HugeiconsIcon icon={RefreshIcon} size={15} />
              </button>
            )}
            {action}
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
