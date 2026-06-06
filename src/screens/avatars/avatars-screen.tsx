
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  Mic01Icon,
  PencilEdit02Icon,
  PlayIcon,
  RefreshIcon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import {
  SURFACE_LABELS,
  createAvatar,
  deleteAvatar,
  fetchAvatars,
  getBrowserVoices,
  speakPreview,
  updateAvatar,
} from '@/lib/avatars-api'
import type {
  Avatar,
  AvatarSurface,
  CreateAvatarInput,
} from '@/lib/avatars-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'avatars'] as const
const SURFACES: AvatarSurface[] = ['both', 'chat', 'voice']
const EMOJI_PRESETS = ['🤖', '🧑‍⚕️', '💼', '🌿', '✨', '🧠', '💬', '🎧', '👩‍💻', '🦾']

type FormState = {
  name: string
  emoji: string
  voice_name: string
  voice_rate: number
  greeting: string
  accent_color: string
  surface: AvatarSurface
  is_default: boolean
}

function AvatarDialog({
  open,
  initial,
  title,
  voices,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  initial: FormState
  title: string
  voices: SpeechSynthesisVoice[]
  onClose: () => void
  onSubmit: (form: FormState) => void
  isSubmitting: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  useMemo(() => {
    if (open) setForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  if (!open) return null
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--theme-text)]">
          {title}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Avatar name
            </label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. SC Intelligence"
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Face
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => set('emoji', e)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors',
                    form.emoji === e
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-hover)]'
                      : 'border-[var(--theme-border)] hover:bg-[var(--theme-hover)]',
                  )}
                >
                  {e}
                </button>
              ))}
              <input
                value={form.emoji}
                onChange={(e) => set('emoji', e.target.value.slice(0, 4))}
                className="h-9 w-12 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] text-center text-lg"
                title="custom emoji"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Voice ({voices.length} available in this browser)
            </label>
            <div className="flex gap-2">
              <select
                value={form.voice_name}
                onChange={(e) => set('voice_name', e.target.value)}
                className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
              >
                <option value="">Default voice</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  speakPreview(
                    form.greeting || 'Hello, this is a voice preview.',
                    form.voice_name,
                    form.voice_rate,
                  )
                }
                className="flex items-center gap-1 rounded-lg border border-[var(--theme-border)] px-2.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
                title="Preview voice"
              >
                <HugeiconsIcon icon={PlayIcon} size={13} />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Speaking rate: {form.voice_rate.toFixed(2)}×
            </label>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={form.voice_rate}
              onChange={(e) => set('voice_rate', Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Greeting (spoken / shown)
            </label>
            <textarea
              value={form.greeting}
              onChange={(e) => set('greeting', e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Surface
              </label>
              <select
                value={form.surface}
                onChange={(e) => set('surface', e.target.value as AvatarSurface)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-2 py-1.5 text-xs text-[var(--theme-text)]"
              >
                {SURFACES.map((s) => (
                  <option key={s} value={s}>
                    {SURFACE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Accent
              </label>
              <input
                type="color"
                value={form.accent_color}
                onChange={(e) => set('accent_color', e.target.value)}
                className="h-8 w-full cursor-pointer rounded border border-[var(--theme-border)] bg-transparent"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[var(--theme-muted)]">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => set('is_default', e.target.checked)}
            />
            Set as the default agent avatar for this brand
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.name.trim() || isSubmitting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AvatarsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Avatar | null>(null)

  // Browser voices load async — listen for the voiceschanged event.
  useEffect(() => {
    const load = () => setVoices(getBrowserVoices())
    load()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = load
      return () => {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  const avatarsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      fetchAvatars({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
  })

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateAvatarInput) => createAvatar(input),
    onSuccess: () => {
      invalidate()
      toast('Avatar saved')
      setShowCreate(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateAvatarInput> }) =>
      updateAvatar(p.id, p.updates),
    onSuccess: () => {
      invalidate()
      toast('Avatar updated')
      setEditing(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAvatar(id),
    onSuccess: () => {
      invalidate()
      toast('Avatar deleted')
    },
  })

  const avatars = avatarsQuery.data ?? []

  const emptyForm: FormState = {
    name: '',
    emoji: brand.id === 'hfm' ? '🌿' : '💼',
    voice_name: '',
    voice_rate: 1,
    greeting:
      brand.id === 'hfm'
        ? 'Hi, welcome to Holistic Functional Care. How can we support you today?'
        : 'Hi! Thanks for reaching out to Simple Connect. How can we help?',
    accent_color: brand.accentColor || '#4A9EA1',
    surface: 'both',
    is_default: avatars.length === 0,
  }

  const toForm = (a: Avatar): FormState => ({
    name: a.name,
    emoji: a.emoji,
    voice_name: a.voice_name,
    voice_rate: a.voice_rate,
    greeting: a.greeting,
    accent_color: a.accent_color,
    surface: a.surface,
    is_default: a.is_default,
  })

  const fromForm = (f: FormState): CreateAvatarInput => ({
    name: f.name.trim(),
    emoji: f.emoji,
    voice_name: f.voice_name,
    voice_rate: f.voice_rate,
    greeting: f.greeting,
    accent_color: f.accent_color,
    surface: f.surface,
    is_default: f.is_default,
    brand: brand.id !== 'hermes' ? brand.id : undefined,
  })

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Mic01Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Avatars
              </h1>
              {avatarsQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({avatarsQuery.data.length})
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--theme-accent)' }}
            >
              <HugeiconsIcon icon={Add01Icon} size={14} />
              New Avatar
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--theme-muted)]">
            Voice + chat identities for your AI agent. Voice preview uses your
            browser's speech engine; production voice maps to the server TTS.
          </p>
        </header>

        {avatarsQuery.isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--theme-muted)]">
            Loading…
          </div>
        ) : avatars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
            <HugeiconsIcon icon={Mic01Icon} size={32} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No avatars yet</p>
            <p className="mt-1 text-xs">
              Create a voice + chat identity for your agent.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {avatars.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
                      style={{
                        background: `color-mix(in srgb, ${a.accent_color} 18%, var(--theme-bg))`,
                      }}
                    >
                      {a.image_url ? (
                        <img
                          src={a.image_url}
                          alt={a.name}
                          className="h-full w-full rounded-2xl object-cover"
                        />
                      ) : (
                        a.emoji
                      )}
                    </div>
                    {a.is_default && (
                      <span
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase"
                        style={{ background: 'var(--theme-bg)', color: a.accent_color }}
                      >
                        <HugeiconsIcon icon={StarIcon} size={9} />
                        Default
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-[var(--theme-text)]">
                    {a.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--theme-muted)]">
                    {a.greeting}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--theme-muted)]">
                    <span className="rounded border border-[var(--theme-border)] px-1.5 py-0.5">
                      {SURFACE_LABELS[a.surface]}
                    </span>
                    {a.voice_name && (
                      <span className="truncate">🎙 {a.voice_name}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1 border-t border-[var(--theme-border)] pt-3">
                    <button
                      onClick={() =>
                        speakPreview(a.greeting, a.voice_name, a.voice_rate)
                      }
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium hover:bg-[var(--theme-hover)]"
                      style={{ color: a.accent_color }}
                    >
                      <HugeiconsIcon icon={PlayIcon} size={12} />
                      Hear voice
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => setEditing(a)}
                      className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
                      title="Edit"
                    >
                      <HugeiconsIcon
                        icon={PencilEdit02Icon}
                        size={13}
                        className="text-[var(--theme-muted)]"
                      />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${a.name}"?`)) deleteMutation.mutate(a.id)
                      }}
                      className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
                      title="Delete"
                    >
                      <HugeiconsIcon
                        icon={Delete01Icon}
                        size={13}
                        style={{ color: 'var(--theme-danger)' }}
                      />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <button
          onClick={invalidate}
          className="mx-auto mt-2 flex items-center gap-1 text-[11px] text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
        >
          <HugeiconsIcon icon={RefreshIcon} size={12} /> Refresh
        </button>
      </div>

      <AvatarDialog
        open={showCreate}
        initial={emptyForm}
        title="New Avatar"
        voices={voices}
        onClose={() => setShowCreate(false)}
        onSubmit={(f) => createMutation.mutate(fromForm(f))}
        isSubmitting={createMutation.isPending}
      />
      <AvatarDialog
        open={editing !== null}
        initial={editing ? toForm(editing) : emptyForm}
        title="Edit Avatar"
        voices={voices}
        onClose={() => setEditing(null)}
        onSubmit={(f) => {
          if (editing) updateMutation.mutate({ id: editing.id, updates: fromForm(f) })
        }}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}
