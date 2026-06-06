
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  ImageAdd01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  Share04Icon,
  SentIcon,
} from '@hugeicons/core-free-icons'
import {
  PLATFORM_LABELS,
  STATUS_COLORS,
  createPost,
  deletePost,
  fetchPosts,
  publishPost,
  updatePost,
} from '@/lib/social-api'
import type {
  CreatePostInput,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
} from '@/lib/social-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--theme-text)]">
          {title}
        </h2>

        {/* Platform selector */}
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-medium text-[var(--theme-muted)]">
            Platforms
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(defaultPlatforms.length > 0
              ? defaultPlatforms
              : ALL_PLATFORMS
            ).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  form.platforms.includes(p)
                    ? 'border-transparent text-white'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={
                  form.platforms.includes(p)
                    ? { background: 'var(--theme-accent)' }
                    : undefined
                }
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
            Caption / Post text
          </label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={5}
            placeholder="Write your post…"
            className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          <p className="mt-1 text-right text-[10px] text-[var(--theme-muted)]">
            {form.content.length} chars
          </p>
        </div>

        {/* Schedule */}
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
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
          <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
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
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.content.trim() || isSubmitting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            {isSubmitting ? 'Saving…' : 'Save post'}
          </button>
        </div>
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

  const postsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchPosts({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
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
    mutationFn: (id: string) => publishPost(id),
    onSuccess: ({ error }) => {
      invalidate()
      if (error) {
        toast(`Published with warning: ${error}`, { type: 'error' })
      } else {
        toast('Post published!')
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

        {/* Header */}
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Share04Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Social
              </h1>
              {postsQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({postsQuery.data.length})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={invalidate}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                title="Refresh"
              >
                <HugeiconsIcon icon={RefreshIcon} size={16} className="text-[var(--theme-muted)]" />
              </button>
              <button
                onClick={() => setShowCompose(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Post
              </button>
            </div>
          </div>
        </header>

        {/* Tips bar */}
        <div className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <p className="text-xs text-[var(--theme-muted)]">
            <span className="font-medium text-[var(--theme-text)]">Flow:</span>{' '}
            Compose → Save as Draft → add images (via agent <code className="rounded bg-[var(--theme-bg)] px-1 py-0.5 text-[10px]">image_gen</code>) → Publish (sends to platform) or Schedule. Publishing requires a configured social API key (Zernio/Blotato) in the server <code className="rounded bg-[var(--theme-bg)] px-1 py-0.5 text-[10px]">.env</code>.
          </p>
          {/* Status filter pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  statusFilter === s
                    ? 'border-transparent text-white'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={
                  statusFilter === s
                    ? { background: 'var(--theme-accent)' }
                    : undefined
                }
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Post list */}
        <div className="flex-1 space-y-2">
          {postsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading posts…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon icon={Share04Icon} size={32} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No posts yet</p>
              <p className="mt-1 text-xs">
                Click "New Post" to compose your first piece of content.
              </p>
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
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Status + platforms row */}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{
                            background: 'var(--theme-bg)',
                            color: STATUS_COLORS[post.status],
                          }}
                        >
                          {post.status === 'published' && (
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={9} />
                          )}
                          {post.status === 'scheduled' && (
                            <HugeiconsIcon icon={Clock01Icon} size={9} />
                          )}
                          {post.status}
                        </span>
                        {post.platforms.map((p) => (
                          <span
                            key={p}
                            className="rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[9px] text-[var(--theme-muted)]"
                          >
                            {PLATFORM_LABELS[p]}
                          </span>
                        ))}
                        {post.scheduled_at && (
                          <span className="text-[10px] text-[var(--theme-muted)]">
                            · {formatDate(post.scheduled_at)}
                          </span>
                        )}
                        {post.published_at && (
                          <span className="text-[10px] text-[var(--theme-muted)]">
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

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {(post.status === 'draft' || post.status === 'failed') && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Publish to ${post.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')} now?`,
                              )
                            ) {
                              publishMutation.mutate(post.id)
                            }
                          }}
                          disabled={publishMutation.isPending}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
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
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
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
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                        title="Delete"
                      >
                        <HugeiconsIcon
                          icon={Delete01Icon}
                          size={14}
                          style={{ color: 'var(--theme-danger)' }}
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
