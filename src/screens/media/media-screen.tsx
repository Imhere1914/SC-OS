import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { AiImageIcon, AiMagicIcon, AiVideoIcon, Delete01Icon, ImageAdd01Icon, PlayIcon } from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { toast } from '@/components/toast'
import { ASPECTS, deleteMedia, fetchMedia, generateMedia, type MediaKind, type MediaRecord } from '@/lib/media-api'

// ── Design vocabulary ─────────────────────────────────────────────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW =
  '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10b981',
  gemini: '#3b82f6',
  placeholder: '#94a3b8',
}

// Tiny tinted provider chip
function ProviderChip({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? '#94a3b8'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 14%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: color }} />
      {provider}
    </span>
  )
}

// Mini wireframe rectangle illustrating an aspect ratio
function RatioGlyph({ aspect, active }: { aspect: string; active: boolean }) {
  const [w, h] = aspect.split(':').map(Number)
  const scale = 14 / Math.max(w, h)
  return (
    <span
      className="rounded-[3px] border"
      style={{
        width: Math.max(6, Math.round(w * scale)),
        height: Math.max(6, Math.round(h * scale)),
        borderColor: 'currentColor',
        background: active ? 'color-mix(in srgb, currentColor 25%, transparent)' : 'transparent',
      }}
    />
  )
}

// Shimmering skeleton tile with a breathing glow — shown while generating
function GeneratingTile() {
  return (
    <div
      className="relative mb-3 overflow-hidden rounded-xl border break-inside-avoid"
      style={{
        borderColor: 'color-mix(in srgb, var(--theme-accent) 35%, var(--theme-border))',
        background: 'var(--theme-card)',
        boxShadow: '0 0 18px color-mix(in srgb, var(--theme-accent) 25%, transparent)',
        animation: 'breathe 3.2s ease-in-out infinite',
      }}
    >
      <div className="aspect-square w-full animate-pulse" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-white"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={AiMagicIcon} size={18} />
        </span>
        <p className="text-[11px] font-medium text-[var(--theme-muted)]">Generating…</p>
      </div>
    </div>
  )
}

export function MediaScreen() {
  const qc = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState<MediaKind>('image')
  const [aspect, setAspect] = useState<string>('1:1')

  const { data: media = [], isLoading } = useQuery({ queryKey: ['media'], queryFn: () => fetchMedia() })

  const gen = useMutation({
    mutationFn: () => generateMedia({ prompt: prompt.trim(), kind, aspect }),
    onSuccess: (rec) => {
      setPrompt('')
      qc.invalidateQueries({ queryKey: ['media'] })
      toast(rec.provider === 'placeholder' ? 'Generated (preview — connect Hermes for live output)' : 'Generated', { type: 'info' })
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteMedia(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  })

  return (
    <ScreenShell icon={ImageAdd01Icon} title="Media Studio" count={media.length} subtitle="Generate images & video from a prompt">
      {/* Hero prompt composer — glass card */}
      <div
        className="mb-6 rounded-2xl border p-4"
        style={{
          borderColor: 'color-mix(in srgb, var(--theme-accent) 25%, var(--theme-border))',
          background: 'var(--theme-card)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px color-mix(in srgb, var(--theme-accent) 10%, transparent)',
        }}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={AiMagicIcon} size={15} />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Describe your asset
          </p>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image or video you want to create…"
          rows={3}
          className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] p-3 text-sm text-[var(--theme-text)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Kind — segmented control */}
          <div
            className="flex items-center gap-0.5 rounded-lg border p-0.5"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            {(['image', 'video'] as MediaKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-all duration-150"
                style={
                  kind === k
                    ? {
                        background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                        color: 'var(--theme-accent)',
                      }
                    : { color: 'var(--theme-muted)' }
                }
              >
                <HugeiconsIcon icon={k === 'image' ? AiImageIcon : AiVideoIcon} size={13} />
                {k}
              </button>
            ))}
          </div>

          {/* Aspect — small ratio tiles */}
          <div className="flex items-center gap-1.5">
            {ASPECTS.map((a) => {
              const active = aspect === a
              return (
                <button
                  key={a}
                  onClick={() => setAspect(a)}
                  className="flex flex-col items-center gap-1 rounded-lg border px-2.5 py-1.5 transition-all duration-150 hover:-translate-y-px"
                  style={
                    active
                      ? {
                          borderColor: 'var(--theme-accent)',
                          background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
                          color: 'var(--theme-accent)',
                        }
                      : { borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }
                  }
                  title={`Aspect ${a}`}
                >
                  <RatioGlyph aspect={a} active={active} />
                  <span className="text-[9px] font-semibold tabular-nums">{a}</span>
                </button>
              )
            })}
          </div>

          {/* Generate — gradient button */}
          <button
            onClick={() => prompt.trim() && gen.mutate()}
            disabled={!prompt.trim() || gen.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={AiMagicIcon} size={16} />
            {gen.isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="columns-2 gap-3 sm:columns-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="mb-3 aspect-square animate-pulse rounded-xl break-inside-avoid"
              style={{ background: 'var(--theme-card)', opacity: 0.6 }}
            />
          ))}
        </div>
      ) : media.length === 0 && !gen.isPending ? (
        <div
          className="flex flex-col items-center rounded-2xl border border-dashed py-16 text-center"
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={ImageAdd01Icon} size={24} />
          </span>
          <p className="mt-3 text-sm font-semibold text-[var(--theme-text)]">No media yet</p>
          <p className="mt-1 text-sm text-[var(--theme-muted)]">Describe something above to generate your first asset.</p>
        </div>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3">
          {gen.isPending && <GeneratingTile />}
          {media.map((m: MediaRecord) =>
            m.status === 'pending' ? (
              <GeneratingTile key={m.id} />
            ) : (
              <div
                key={m.id}
                className="group relative mb-3 overflow-hidden rounded-xl border break-inside-avoid transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)', backdropFilter: 'blur(10px)' }}
              >
                {m.url ? (
                  <img src={m.url} alt={m.prompt} className="w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-[var(--theme-muted)]">
                    <HugeiconsIcon icon={m.kind === 'video' ? AiVideoIcon : AiImageIcon} size={24} className="opacity-40" />
                  </div>
                )}
                {m.kind === 'video' && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white">
                    <HugeiconsIcon icon={PlayIcon} size={14} />
                  </span>
                )}

                {/* Hover overlay — prompt excerpt + provider + delete */}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/25 to-transparent p-2.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                  <p className="line-clamp-2 text-[11px] leading-snug text-white" title={m.prompt}>
                    {m.prompt}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <ProviderChip provider={m.provider} />
                    <button
                      onClick={() => del.mutate(m.id)}
                      className="rounded-full bg-black/50 p-1.5 text-white transition-all duration-150 hover:bg-black/70"
                      title="Delete"
                    >
                      <HugeiconsIcon icon={Delete01Icon} size={14} />
                    </button>
                  </div>
                </div>

                {/* Generation error — red-tinted inline note */}
                {m.status === 'failed' && m.error && (
                  <p
                    className="m-2 rounded-lg px-2 py-1.5 text-[10px] leading-snug"
                    style={{
                      background: 'color-mix(in srgb, #ef4444 12%, var(--theme-card))',
                      color: '#ef4444',
                      border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                    }}
                  >
                    {m.error}
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </ScreenShell>
  )
}
