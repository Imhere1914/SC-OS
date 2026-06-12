
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Copy01Icon,
  Delete01Icon,
  Layout01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import {
  createPage,
  deletePage,
  fetchPages,
  setPagePublished,
  updatePage,
} from '@/lib/pages-api'
import type { CreatePageInput, Page } from '@/lib/pages-api'
import { TEMPLATES, TEMPLATE_LIST } from '@/lib/pages-templates'
import type { PageTemplate } from '@/lib/pages-templates'
import { toast } from '@/components/toast'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'pages'] as const

// ── Design tokens (shared vocabulary with Payments / Mission Control) ────────
const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW =
  '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = {
  background: ACCENT_GRADIENT,
  boxShadow: ACCENT_GLOW,
}

const fieldCls =
  'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

function publicUrl(slug: string): string {
  if (typeof window === 'undefined') return `/p/${slug}`
  return `${window.location.origin}/p/${slug}`
}

// Status as colored dot + soft tinted badge
function PageStatusBadge({ status }: { status: Page['status'] }) {
  const published = status === 'published'
  const color = published ? '#10b981' : '#94a3b8'
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
      {status}
    </span>
  )
}

// Template-type tinted badge
function TemplateTypeBadge({ template }: { template: PageTemplate }) {
  const color = '#8b5cf6'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {TEMPLATES[template].name}
    </span>
  )
}

/** Template picker shown when creating a new page. */
function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (t: PageTemplate) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Layout01Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">
              Choose a template
            </h2>
            <p className="text-[11px] text-[var(--theme-muted)]">
              Start your landing page from a layout
            </p>
          </div>
        </div>
        <div className="space-y-2 p-5">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className="flex w-full items-start gap-3 rounded-xl border border-[var(--theme-border)] p-3 text-left transition-all hover:-translate-y-px hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)] hover:shadow-sm"
            >
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={Layout01Icon} size={14} className="text-white" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--theme-text)]">
                  {t.name}
                </p>
                <p className="text-xs text-[var(--theme-muted)]">
                  {t.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type EditorState = {
  page: Page | null // null = new
  template: PageTemplate
  title: string
  slug: string
  accent_color: string
  fields: Record<string, string>
}

function PageEditor({
  state,
  brandAccent,
  onClose,
  onSave,
  isSaving,
}: {
  state: EditorState
  brandAccent: string
  onClose: () => void
  onSave: (s: EditorState) => void
  isSaving: boolean
}) {
  const def = TEMPLATES[state.template]
  const [title, setTitle] = useState(state.title)
  const [slug, setSlug] = useState(state.slug)
  const [accent, setAccent] = useState(state.accent_color || brandAccent)
  const [fields, setFields] = useState<Record<string, string>>(state.fields)

  const setField = (k: string, v: string) =>
    setFields((prev) => ({ ...prev, [k]: v }))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Layout01Icon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">
              {state.page ? 'Edit page' : 'New page'}
            </h2>
            <p className="text-[11px] text-[var(--theme-muted)]">{def.name} template</p>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Page settings
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Page title (internal)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              URL slug
            </label>
            <div className="flex items-center gap-1 font-mono text-xs text-[var(--theme-muted)]">
              <span>/p/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-page"
                className={fieldCls}
              />
            </div>
          </div>

          {/* Framed public-URL preview */}
          <div
            className="rounded-lg border px-3 py-2"
            style={{
              borderColor: 'var(--theme-border)',
              background: 'color-mix(in srgb, var(--theme-muted) 6%, var(--theme-card))',
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Public URL
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--theme-text)]">
              {publicUrl(slug || 'my-page')}
            </p>
          </div>

          {/* Template fields */}
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Content
          </p>
          {def.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={fields[field.key] ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                />
              ) : (
                <input
                  type={field.type === 'url' ? 'url' : 'text'}
                  value={fields[field.key] ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={fieldCls}
                />
              )}
            </div>
          ))}

          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Appearance
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Accent color
            </label>
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-8 w-16 cursor-pointer rounded border border-[var(--theme-border)] bg-transparent"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onSave({
                  ...state,
                  title,
                  slug,
                  accent_color: accent,
                  fields,
                })
              }
              disabled={!title.trim() || isSaving}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PagesScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const brandAccent = brand.accentColor || '#4A9EA1'

  const [showPicker, setShowPicker] = useState(false)
  const [editor, setEditor] = useState<EditorState | null>(null)

  const pagesQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      fetchPages({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
  })

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreatePageInput) => createPage(input),
    onSuccess: () => {
      invalidate()
      toast('Page created')
      setEditor(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to create', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: {
      id: string
      updates: { title: string; slug: string; accent_color: string; fields: Record<string, string> }
    }) => updatePage(p.id, p.updates),
    onSuccess: () => {
      invalidate()
      toast('Page saved')
      setEditor(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const publishMutation = useMutation({
    mutationFn: (p: { id: string; publish: boolean }) =>
      setPagePublished(p.id, p.publish),
    onSuccess: (_data, vars) => {
      invalidate()
      toast(vars.publish ? 'Page published' : 'Page unpublished')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePage(id),
    onSuccess: () => {
      invalidate()
      toast('Page deleted')
    },
  })

  const pages = pagesQuery.data ?? []

  const pickTemplate = (t: PageTemplate) => {
    setShowPicker(false)
    setEditor({
      page: null,
      template: t,
      title: '',
      slug: '',
      accent_color: brandAccent,
      fields: { ...TEMPLATES[t].defaults },
    })
  }

  const openEdit = (page: Page) => {
    setEditor({
      page,
      template: page.template,
      title: page.title,
      slug: page.slug,
      accent_color: page.accent_color,
      fields: { ...TEMPLATES[page.template].defaults, ...page.fields },
    })
  }

  const handleSave = (s: EditorState) => {
    if (s.page) {
      updateMutation.mutate({
        id: s.page.id,
        updates: {
          title: s.title.trim(),
          slug: s.slug.trim(),
          accent_color: s.accent_color,
          fields: s.fields,
        },
      })
    } else {
      createMutation.mutate({
        title: s.title.trim(),
        slug: s.slug.trim() || undefined,
        template: s.template,
        accent_color: s.accent_color,
        fields: s.fields,
        brand: brand.id !== 'hermes' ? brand.id : undefined,
      })
    }
  }

  const copyLink = (slug: string) => {
    const url = publicUrl(slug)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url)
      toast('Link copied')
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const editorTitle = useMemo(
    () => (editor?.page ? 'Edit' : 'New'),
    [editor],
  )
  void editorTitle

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Layout01Icon} size={18} className="text-white" />
            </span>
            <div>
              <h1 className="text-[22px] font-bold leading-tight text-[var(--theme-text)]">
                Pages
              </h1>
              <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">
                {pagesQuery.data
                  ? `${pages.length} page${pages.length !== 1 ? 's' : ''} · landing pages from templates`
                  : 'Landing pages from templates'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={invalidate}
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
              title="Refresh"
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={16}
                className="text-[var(--theme-muted)]"
              />
            </button>
            <button
              onClick={() => setShowPicker(true)}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              <HugeiconsIcon icon={Add01Icon} size={14} />
              New Page
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {pagesQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border bg-[var(--theme-card)] opacity-60"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
              ))}
            </div>
          ) : pages.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl border py-14 text-center"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={Layout01Icon} size={22} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--theme-text)]">
                No pages yet
              </p>
              <p className="text-[11px] text-[var(--theme-muted)]">
                Create a landing page from a template and publish it.
              </p>
              <button
                onClick={() => setShowPicker(true)}
                className={`${primaryBtnCls} mt-2`}
                style={primaryBtnStyle}
              >
                <HugeiconsIcon icon={Add01Icon} size={13} /> New Page
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {pages.map((page) => (
                <motion.div
                  key={page.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="group rounded-xl border p-4 transition-all hover:-translate-y-px hover:shadow-md"
                  style={{
                    background: 'var(--theme-card)',
                    borderColor: 'var(--theme-border)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <PageStatusBadge status={page.status} />
                        <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">
                          {page.title}
                        </h3>
                        <TemplateTypeBadge template={page.template} />
                      </div>
                      {/* Public URL — mono chip with copy */}
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] text-[var(--theme-muted)]"
                          style={{
                            borderColor: 'var(--theme-border)',
                            background: 'color-mix(in srgb, var(--theme-muted) 6%, var(--theme-card))',
                          }}
                        >
                          <span className="truncate">/p/{page.slug}</span>
                          <button
                            onClick={() => copyLink(page.slug)}
                            className="shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                            title="Copy link"
                          >
                            <HugeiconsIcon icon={Copy01Icon} size={11} />
                          </button>
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      {page.status === 'published' && (
                        <a
                          href={publicUrl(page.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                          title="View live"
                        >
                          <HugeiconsIcon
                            icon={ViewIcon}
                            size={14}
                            className="text-[var(--theme-accent)]"
                          />
                        </a>
                      )}
                      <button
                        onClick={() =>
                          publishMutation.mutate({
                            id: page.id,
                            publish: page.status !== 'published',
                          })
                        }
                        className="rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all hover:-translate-y-px"
                        style={
                          page.status === 'published'
                            ? {
                                color: 'var(--theme-muted)',
                                borderColor: 'var(--theme-border)',
                              }
                            : {
                                color: 'var(--theme-accent)',
                                borderColor:
                                  'color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                                background:
                                  'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
                              }
                        }
                        title={page.status === 'published' ? 'Unpublish' : 'Publish'}
                      >
                        {page.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => openEdit(page)}
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
                          if (confirm(`Delete "${page.title}"?`))
                            deleteMutation.mutate(page.id)
                        }}
                        className="rounded-lg p-1.5 transition-colors"
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
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

      {showPicker && (
        <TemplatePicker onPick={pickTemplate} onClose={() => setShowPicker(false)} />
      )}
      {editor && (
        <PageEditor
          state={editor}
          brandAccent={brandAccent}
          onClose={() => setEditor(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  )
}
