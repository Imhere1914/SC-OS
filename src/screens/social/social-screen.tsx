
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  Facebook01Icon,
  ImageAdd01Icon,
  InstagramIcon,
  Linkedin01Icon,
  NewTwitterIcon,
  PencilEdit02Icon,
  RefreshIcon,
  Share04Icon,
  SentIcon,
  TiktokIcon,
} from '@hugeicons/core-free-icons'
import {
  PLATFORM_LABELS,
  PUBLISH_PLATFORMS,
  createPost,
  deletePost,
  fetchChannels,
  fetchPosts,
  publishToChannels,
  updatePost,
} from '@/lib/social-api'
import type {
  ChannelStatus,
  CreatePostInput,
  PublishPlatform,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
} from '@/lib/social-api'
import { toast } from '@/components/toast'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'social'] as const

const ALL_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'x',
]

/** Which platforms each brand focuses on */
const BRAND_PLATFORMS: Record<string, SocialPlatform[]> = {
  hfm: ['instagram', 'facebook', 'tiktok'],
  sc: ['linkedin', 'x', 'facebook'],
}

// ── Design vocabulary (shared with Payroll / Payments / Mission Control) ─────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW =
  '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

/** Brand color + icon per platform */
const PLATFORM_META: Record<
  SocialPlatform,
  { color: string; icon: typeof InstagramIcon }
> = {
  instagram: { color: '#E1306C', icon: InstagramIcon },
  facebook: { color: '#1877F2', icon: Facebook01Icon },
  tiktok: { color: '#00BFC6', icon: TiktokIcon },
  linkedin: { color: '#0A66C2', icon: Linkedin01Icon },
  x: { color: '#64748b', icon: NewTwitterIcon },
}

const STATUS_HEX: Record<SocialPostStatus, string> = {
  draft: '#94a3b8',
  scheduled: '#3b82f6',
  published: '#10b981',
  failed: '#ef4444',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

// Status as colored dot + soft tinted badge
function StatusBadge({ status }: { status: SocialPostStatus }) {
  const color = STATUS_HEX[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status === 'published' && (
        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={9} />
      )}
      {status === 'scheduled' && <HugeiconsIcon icon={Clock01Icon} size={9} />}
      {status}
    </span>
  )
}

// Tiny tinted platform badge with brand-colored icon
function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  const meta = PLATFORM_META[platform]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${meta.color} 12%, var(--theme-card))`,
        color: meta.color,
        border: `1px solid color-mix(in srgb, ${meta.color} 25%, transparent)`,
      }}
    >
      <HugeiconsIcon icon={meta.icon} size={10} />
      {PLATFORM_LABELS[platform]}
    </span>
  )
}

type ComposeFormState = {
  content: string
  platforms: SocialPlatform[]
  scheduled_at: string
  notes: string
}

function ComposeDialog({
  open,
  initial,
  title,
  defaultPlatforms,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  initial: ComposeFormState
  title: string
  defaultPlatforms: SocialPlatform[]
  onClose: () => void
  onSubmit: (form: ComposeFormState) => void
  isSubmitting: boolean
}) {
  const [form, setForm] = useState<ComposeFormState>(initial)

  useMemo(() => {
    if (open) setForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const togglePlatform = (p: SocialPlatform) =>
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter((x) => x !== p)
        : [...f.platforms, p],
    }))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        style={{ backdropFilter: 'blur(12px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header: gradient chip + bold title + muted subtitle */}
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Share04Icon} size={16} />
          </span>
          <div>
            <h2 className="text-[14px] font-bold leading-tight text-[var(--theme-text)]">
              {title}
            </h2>
            <p className="text-[11px] text-[var(--theme-muted)]">
              Compose once, publish everywhere
            </p>
          </div>
        </div>

        {/* Platform selector — tinted icon chips */}
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Platforms
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(defaultPlatforms.length > 0
              ? defaultPlatforms
              : ALL_PLATFORMS
            ).map((p) => {
              const meta = PLATFORM_META[p]
              const active = form.platforms.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150"
                  style={
                    active
                      ? {
                          background: `color-mix(in srgb, ${meta.color} 14%, var(--theme-card))`,
                          borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)`,
                          color: meta.color,
                        }
                      : {
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-muted)',
                        }
                  }
                >
                  <HugeiconsIcon icon={meta.icon} size={12} />
                  {PLATFORM_LABELS[p]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Caption */}
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Caption / Post text
          </label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={5}
            placeholder="Write your post…"
            className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          <p className="mt-1 text-right text-[10px] tabular-nums text-[var(--theme-muted)]">
            {form.content.length} chars
          </p>
        </div>

        {/* Schedule */}
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Schedule (optional — leave blank to save as draft)
          </label>
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) =>
              setForm((f) => ({ ...f, scheduled_at: e.target.value }))
            }
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Internal notes
          </label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            placeholder="e.g. waiting for image from ComfyUI"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.content.trim() || isSubmitting}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            {isSubmitting ? 'Saving…' : 'Save post'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Channels status row — green dot + platform when connected, else muted "Connect"
function ChannelsBar({
  status,
  isLoading,
}: {
  status: ChannelStatus | undefined
  isLoading: boolean
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'var(--theme-border)',
        background: 'var(--theme-card)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
        Channels
      </p>
      <div className="flex flex-wrap gap-2">
        {isLoading
          ? [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-7 w-28 animate-pulse rounded-full"
                style={{ background: 'var(--theme-hover)', opacity: 0.6 }}
              />
            ))
          : (PUBLISH_PLATFORMS as PublishPlatform[]).map((p) => {
              const meta = PLATFORM_META[p]
              const connected = status?.[p] ?? false
              return (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={
                    connected
                      ? {
                          background: `color-mix(in srgb, ${meta.color} 12%, var(--theme-card))`,
                          borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)`,
                          color: meta.color,
                        }
                      : {
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-muted)',
                        }
                  }
                  title={
                    connected
                      ? `${PLATFORM_LABELS[p]} connected`
                      : `Connect ${PLATFORM_LABELS[p]} in Settings`
                  }
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: connected ? '#10b981' : 'var(--theme-muted)' }}
                  />
                  <HugeiconsIcon icon={meta.icon} size={11} />
                  {connected
                    ? PLATFORM_LABELS[p]
                    : `Connect ${PLATFORM_LABELS[p]} in Settings`}
                </span>
              )
            })}
      </div>
    </div>
  )
}

const STATUS_FILTERS: Array<SocialPostStatus | 'all'> = [
  'all',
  'draft',
  'scheduled',
  'published',
  'failed',
]

const STATUS_LABELS: Record<SocialPostStatus | 'all', string> = {
  all: 'All',
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
}

export function SocialScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const defaultPlatforms = BRAND_PLATFORMS[brand.id] ?? ALL_PLATFORMS

  const [statusFilter, setStatusFilter] = useState<SocialPostStatus | 'all'>('all')
  const [showCompose, setShowCompose] = useState(false)
  const [editing, setEditing] = useState<SocialPost | null>(null)

  const EMPTY_FORM: ComposeFormState = {
    content: '',
    platforms: defaultPlatforms,
    scheduled_at: '',
    notes: '',
  }

  const brandParam = brand.id !== 'hermes' ? brand.id : undefined

  const postsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchPosts({ brand: brandParam }),
    refetchInterval: 60_000,
  })

  const channelsQuery = useQuery({
    queryKey: ['platform', 'social', 'channels', brand.id],
    queryFn: () => fetchChannels(brandParam),
    staleTime: 30_000,
  })

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreatePostInput) => createPost(input),
    onSuccess: () => {
      invalidate()
      toast('Post saved')
      setShowCompose(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreatePostInput> }) =>
      updatePost(p.id, p.updates),
    onSuccess: () => {
      invalidate()
      toast('Post updated')
      setEditing(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const publishMutation = useMutation({
    mutationFn: (post: SocialPost) => {
      // Only the natively-publishable platforms can go out via /publish.
      const targets = post.platforms.filter((p): p is PublishPlatform =>
        (PUBLISH_PLATFORMS as SocialPlatform[]).includes(p),
      )
      if (targets.length === 0) {
        return Promise.reject(
          new Error('No publishable channel selected (Facebook, Instagram, LinkedIn, TikTok).'),
        )
      }
      return publishToChannels({
        brand: brandParam,
        platforms: targets,
        text: post.content,
        media_urls: post.media_urls,
        post_id: post.id,
      })
    },
    onSuccess: ({ results }) => {
      invalidate()
      // Per-platform result toasts.
      for (const r of results) {
        if (r.ok) {
          toast(`Posted to ${PLATFORM_LABELS[r.platform]} ✓`)
        } else {
          toast(`${PLATFORM_LABELS[r.platform]}: ${r.error ?? 'failed'}`, { type: 'error' })
        }
      }
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to publish', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => { invalidate(); toast('Post deleted') },
  })

  const filtered = useMemo(() => {
    const posts = postsQuery.data ?? []
    if (statusFilter === 'all') return posts
    return posts.filter((p) => p.status === statusFilter)
  }, [postsQuery.data, statusFilter])

  const statusCounts = useMemo(() => {
    const posts = postsQuery.data ?? []
    const counts: Record<string, number> = { all: posts.length }
    for (const p of posts) counts[p.status] = (counts[p.status] ?? 0) + 1
    return counts
  }, [postsQuery.data])

  const toForm = (p: SocialPost): ComposeFormState => ({
    content: p.content,
    platforms: p.platforms,
    scheduled_at: p.scheduled_at
      ? new Date(p.scheduled_at).toISOString().slice(0, 16)
      : '',
    notes: p.notes,
  })

  const fromForm = (f: ComposeFormState): CreatePostInput => ({
    content: f.content.trim(),
    platforms: f.platforms,
    scheduled_at: f.scheduled_at
      ? new Date(f.scheduled_at).toISOString()
      : null,
    notes: f.notes,
    brand: brand.id !== 'hermes' ? brand.id : undefined,
  })

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">

        {/* Header — gradient icon chip + bold title */}
        <header
          className="rounded-2xl border p-4"
          style={{
            borderColor: 'var(--theme-border)',
            background: 'var(--theme-card)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={Share04Icon} size={17} />
              </span>
              <div>
                <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">
                  Social
                </h1>
                <p className="text-[11px] text-[var(--theme-muted)]">
                  {postsQuery.data ? (
                    <>
                      <span className="tabular-nums">{postsQuery.data.length}</span> posts across your channels
                    </>
                  ) : (
                    'Posts across your channels'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={invalidate}
                className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
                title="Refresh"
              >
                <HugeiconsIcon icon={RefreshIcon} size={16} className="text-[var(--theme-muted)]" />
              </button>
              <button
                onClick={() => setShowCompose(true)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Post
              </button>
            </div>
          </div>
        </header>

        {/* Channels connect-state */}
        <ChannelsBar status={channelsQuery.data} isLoading={channelsQuery.isLoading} />

        {/* Tips bar + status filter */}
        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: 'var(--theme-border)',
            background: 'var(--theme-card)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <p className="text-xs text-[var(--theme-muted)]">
            <span className="font-medium text-[var(--theme-text)]">Flow:</span>{' '}
            Compose → Save as Draft → add images (via agent <code className="rounded bg-[var(--theme-bg)] px-1 py-0.5 text-[10px]">image_gen</code>) → Publish (sends to platform) or Schedule. Publishing requires a configured social API key (Zernio/Blotato) in the server <code className="rounded bg-[var(--theme-bg)] px-1 py-0.5 text-[10px]">.env</code>.
          </p>
          {/* Status segmented control */}
          <div
            className="mt-3 inline-flex items-center gap-0.5 rounded-lg border p-0.5"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            {STATUS_FILTERS.map((s) => {
              const active = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150"
                  style={
                    active
                      ? {
                          background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                          color: 'var(--theme-accent)',
                        }
                      : { color: 'var(--theme-muted)' }
                  }
                >
                  {STATUS_LABELS[s]}
                  <span className="tabular-nums text-[10px] text-[var(--theme-muted)]">
                    {statusCounts[s] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Post list */}
        <div className="flex-1 space-y-2">
          {postsQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[88px] animate-pulse rounded-xl"
                  style={{ background: 'var(--theme-card)', opacity: 0.6 }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <span
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={Share04Icon} size={24} />
              </span>
              <p className="text-sm font-semibold text-[var(--theme-text)]">No posts yet</p>
              <p className="mt-1 text-xs text-[var(--theme-muted)]">
                Compose your first piece of content to get started.
              </p>
              <button
                onClick={() => setShowCompose(true)}
                className="mt-4 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Post
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((post) => (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="group rounded-xl border p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                  style={{
                    borderColor: 'var(--theme-border)',
                    background: 'var(--theme-card)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Status + platforms row */}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={post.status} />
                        {post.platforms.map((p) => (
                          <PlatformBadge key={p} platform={p} />
                        ))}
                        {post.scheduled_at && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
                            style={{
                              background: 'color-mix(in srgb, #3b82f6 10%, var(--theme-card))',
                              color: '#3b82f6',
                            }}
                          >
                            <HugeiconsIcon icon={Clock01Icon} size={10} />
                            {formatDate(post.scheduled_at)}
                          </span>
                        )}
                        {post.published_at && (
                          <span className="text-[10px] tabular-nums text-[var(--theme-muted)]">
                            · published {formatDate(post.published_at)}
                          </span>
                        )}
                      </div>

                      {/* Caption preview */}
                      <p className="line-clamp-3 text-sm text-[var(--theme-text)]">
                        {post.content}
                      </p>

                      {/* Media indicator */}
                      {post.media_urls.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--theme-muted)]">
                          <HugeiconsIcon icon={ImageAdd01Icon} size={11} />
                          {post.media_urls.length} media file
                          {post.media_urls.length !== 1 ? 's' : ''} attached
                        </div>
                      )}

                      {/* Notes */}
                      {post.notes && (
                        <p className="mt-1 text-[10px] italic text-[var(--theme-muted)]">
                          {post.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions — ghost buttons revealed on hover */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                      {(post.status === 'draft' || post.status === 'failed') && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Publish to ${post.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')} now?`,
                              )
                            ) {
                              publishMutation.mutate(post)
                            }
                          }}
                          disabled={publishMutation.isPending}
                          className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
                          title="Publish now"
                        >
                          <HugeiconsIcon
                            icon={SentIcon}
                            size={14}
                            className="text-[var(--theme-accent)]"
                          />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(post)}
                        className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
                        title="Edit"
                      >
                        <HugeiconsIcon
                          icon={PencilEdit02Icon}
                          size={14}
                          className="text-[var(--theme-muted)]"
                        />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this post?')) deleteMutation.mutate(post.id)
                        }}
                        className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
                        title="Delete"
                      >
                        <HugeiconsIcon
                          icon={Delete01Icon}
                          size={14}
                          style={{ color: '#ef4444' }}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Compose dialog */}
      <ComposeDialog
        open={showCompose}
        initial={EMPTY_FORM}
        title="New Post"
        defaultPlatforms={defaultPlatforms}
        onClose={() => setShowCompose(false)}
        onSubmit={(f) => createMutation.mutate(fromForm(f))}
        isSubmitting={createMutation.isPending}
      />

      {/* Edit dialog */}
      <ComposeDialog
        open={editing !== null}
        initial={editing ? toForm(editing) : EMPTY_FORM}
        title="Edit Post"
        defaultPlatforms={defaultPlatforms}
        onClose={() => setEditing(null)}
        onSubmit={(f) => {
          if (editing)
            updateMutation.mutate({ id: editing.id, updates: fromForm(f) })
        }}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}
