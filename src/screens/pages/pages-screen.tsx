
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  CheckmarkCircle01Icon,
  Copy01Icon,
  Delete01Icon,
  Layout01Icon,
  LinkSquare01Icon,
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

function publicUrl(slug: string): string {
  if (typeof window === 'undefined') return `/p/${slug}`
  return `${window.location.origin}/p/${slug}`
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--theme-text)]">
          Choose a template
        </h2>
        <div className="space-y-2">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className="flex w-full items-start gap-3 rounded-xl border border-[var(--theme-border)] p-3 text-left transition-colors hover:bg-[var(--theme-hover)]"
            >
              <HugeiconsIcon
                icon={Layout01Icon}
                size={18}
                className="mt-0.5 text-[var(--theme-accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--theme-text)]">
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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--theme-text)]">
            {state.page ? 'Edit page' : 'New page'} · {def.name}
          </h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Page title (internal)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              URL slug
            </label>
            <div className="flex items-center gap-1 text-xs text-[var(--theme-muted)]">
              <span>/p/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-page"
                className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
          </div>

          {/* Template fields */}
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
                  className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                />
              )}
            </div>
          ))}

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
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
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
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
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
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Layout01Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Pages
              </h1>
              {pagesQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({pagesQuery.data.length})
                </span>
              )}
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
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Page
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-2">
          {pagesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading pages…
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon
                icon={Layout01Icon}
                size={32}
                className="mb-3 opacity-40"
              />
              <p className="text-sm font-medium">No pages yet</p>
              <p className="mt-1 text-xs">
                Create a landing page from a template and publish it.
              </p>
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
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{
                            background: 'var(--theme-bg)',
                            color:
                              page.status === 'published'
                                ? 'var(--theme-success)'
                                : 'var(--theme-muted)',
                          }}
                        >
                          {page.status === 'published' && (
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={9} />
                          )}
                          {page.status}
                        </span>
                        <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
                          {page.title}
                        </h3>
                        <span className="text-[10px] text-[var(--theme-muted)]">
                          {TEMPLATES[page.template].name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[var(--theme-muted)]">
                        <HugeiconsIcon icon={LinkSquare01Icon} size={11} />
                        <span className="truncate">/p/{page.slug}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {page.status === 'published' && (
                        <>
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
                          <button
                            onClick={() => copyLink(page.slug)}
                            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                            title="Copy link"
                          >
                            <HugeiconsIcon
                              icon={Copy01Icon}
                              size={14}
                              className="text-[var(--theme-muted)]"
                            />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() =>
                          publishMutation.mutate({
                            id: page.id,
                            publish: page.status !== 'published',
                          })
                        }
                        className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-[var(--theme-hover)]"
                        style={{
                          color:
                            page.status === 'published'
                              ? 'var(--theme-muted)'
                              : 'var(--theme-accent)',
                        }}
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
