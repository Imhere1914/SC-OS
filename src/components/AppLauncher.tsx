/**
 * OS App Launcher — full-screen glass overlay with a spatial grid of glowing
 * module tiles. visionOS / console-dashboard energy. Always-dark cinematic
 * palette. Separate from the ⌘K CommandPalette (that's quick search/actions;
 * this is the spatial app grid).
 *
 * Opened via a sidebar button or Cmd/Ctrl+/ (wired through useAppLauncher).
 * Esc / backdrop click closes. Auto-focused search filters tiles live.
 * Arrow keys move between tiles, Enter opens, click opens. Closes on navigate.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { cinema } from '@/lib/brand-cinema'
import { cn } from '@/lib/utils'
import { allNavItems } from '@/routes/__root'

/** Cmd/Ctrl+/ toggle hook for the launcher. */
export function useAppLauncher() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  return {
    open,
    openLauncher: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen((o) => !o),
  }
}

const GRID_COLS = 5

export function AppLauncher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const brand = useBrand()
  const c = cinema(brand.id)
  const accent = c.accent
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allTiles = useMemo(
    () => allNavItems(brand.id),
    [brand.id],
  )

  const tiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allTiles
    return allTiles.filter((t) => t.label.toLowerCase().includes(q))
  }, [allTiles, query])

  // Reset + focus on open.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      const id = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(id)
    }
  }, [open])

  // Keep the active index in range as the filtered list shrinks.
  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(0, tiles.length - 1)))
  }, [tiles.length])

  if (!open) return null

  const openTile = (to: string) => {
    void navigate({ to: to as '/' })
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (tiles.length === 0) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, tiles.length - 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + GRID_COLS, tiles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - GRID_COLS, 0))
    } else if (e.key === 'Enter' && tiles[activeIdx]) {
      e.preventDefault()
      openTile(tiles[activeIdx].to)
    }
  }

  return (
    <div
      className="cine-launcher-in fixed inset-0 z-[400] flex flex-col"
      style={{
        background: `radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, ${accent} 14%, ${c.baseBg}) 0%, ${c.baseBg} 70%), color-mix(in srgb, ${c.baseBg} 88%, transparent)`,
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
      }}
      onClick={onClose}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="App launcher"
    >
      {/* Inner — stop backdrop close when clicking content */}
      <div
        className="mx-auto flex h-full w-full max-w-5xl flex-col px-6 pb-10 pt-[10vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + search */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{
              background: c.gradient,
              boxShadow: `0 4px 18px color-mix(in srgb, ${accent} 45%, transparent)`,
            }}
          >
            <HugeiconsIcon icon={Search01Icon} size={20} />
          </div>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIdx(0)
              }}
              placeholder="Search apps & actions…"
              className="w-full rounded-2xl border bg-white/[0.04] px-5 py-3.5 text-[16px] text-white placeholder:text-white/40 focus:outline-none"
              style={{
                borderColor: `color-mix(in srgb, ${accent} 30%, rgba(255,255,255,0.12))`,
              }}
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Close launcher"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>

        {/* Tile grid */}
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto pb-4">
          {tiles.length === 0 ? (
            <p className="mt-16 text-center text-sm text-white/40">
              No apps match “{query}”
            </p>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
            >
              {tiles.map((tile, i) => {
                const isActive = i === activeIdx
                return (
                  <button
                    key={tile.to}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => openTile(tile.to)}
                    className={cn(
                      'cine-tile group flex flex-col items-center gap-3 rounded-2xl border px-3 py-6 text-center',
                      isActive && 'cine-tile-active',
                    )}
                    style={{
                      borderColor: isActive
                        ? `color-mix(in srgb, ${accent} 55%, transparent)`
                        : 'rgba(255,255,255,0.08)',
                      background: isActive
                        ? `linear-gradient(160deg, color-mix(in srgb, ${accent} 18%, transparent), rgba(255,255,255,0.02))`
                        : 'rgba(255,255,255,0.03)',
                      boxShadow: isActive
                        ? `0 10px 32px -8px color-mix(in srgb, ${accent} 55%, transparent), inset 0 0 0 1px color-mix(in srgb, ${accent} 20%, transparent)`
                        : 'none',
                    }}
                  >
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                      style={{
                        background: c.gradient,
                        boxShadow: `0 4px 16px color-mix(in srgb, ${accent} ${isActive ? 55 : 32}%, transparent)`,
                      }}
                    >
                      <HugeiconsIcon icon={tile.icon} size={24} strokeWidth={1.8} />
                    </span>
                    <span className="line-clamp-2 text-[13px] font-medium leading-tight text-white/85">
                      {tile.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="mt-2 flex items-center justify-center gap-5 text-[10px] text-white/40">
          <span>
            <kbd className="rounded border border-white/15 px-1.5 py-0.5">↑↓←→</kbd> navigate
          </span>
          <span>
            <kbd className="rounded border border-white/15 px-1.5 py-0.5">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded border border-white/15 px-1.5 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
