import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { ImageAdd01Icon, AiMagicIcon, Delete01Icon, PlayIcon } from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { toast } from '@/components/toast'
import { ASPECTS, deleteMedia, fetchMedia, generateMedia, type MediaKind, type MediaRecord } from '@/lib/media-api'

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
      <div className="mb-6 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image or video you want to create…"
          rows={3}
          className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] p-3 text-sm text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[var(--theme-border)]">
            {(['image', 'video'] as MediaKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 text-sm capitalize ${kind === k ? 'bg-[var(--theme-accent)] text-white' : 'text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]'}`}
              >
                {k}
              </button>
            ))}
          </div>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-sm text-[var(--theme-text)] outline-none"
          >
            {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={() => prompt.trim() && gen.mutate()}
            disabled={!prompt.trim() || gen.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-[var(--theme-accent)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <HugeiconsIcon icon={AiMagicIcon} size={16} />
            {gen.isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-[var(--theme-muted)]">Loading…</p>
      ) : media.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] py-16 text-center">
          <p className="text-sm text-[var(--theme-muted)]">No media yet. Describe something above to generate your first asset.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((m: MediaRecord) => (
            <div key={m.id} className="group relative overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
              {m.url ? (
                <img src={m.url} alt={m.prompt} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-[var(--theme-muted)]">…</div>
              )}
              {m.kind === 'video' && (
                <span className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white">
                  <HugeiconsIcon icon={PlayIcon} size={14} />
                </span>
              )}
              <button
                onClick={() => del.mutate(m.id)}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Delete"
              >
                <HugeiconsIcon icon={Delete01Icon} size={14} />
              </button>
              <p className="truncate p-2 text-xs text-[var(--theme-muted)]" title={m.prompt}>{m.prompt}</p>
            </div>
          ))}
        </div>
      )}
    </ScreenShell>
  )
}
