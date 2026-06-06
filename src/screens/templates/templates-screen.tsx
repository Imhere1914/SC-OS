
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Copy01Icon,
  Delete01Icon,
  PencilEdit02Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import {
  CATEGORY_LABELS,
  TEMPLATE_CATEGORIES,
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  updateTemplate,
} from '@/lib/templates-api'
import type {
  CreateTemplateInput,
  Template,
  TemplateCategory,
} from '@/lib/templates-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'templates'] as const

type FormState = {
  name: string
  category: TemplateCategory
  subject: string
  body: string
  tags: string
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'reply',
  subject: '',
  body: '',
  tags: '',
}

function TemplateDialog({
  open,
  initial,
  title,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  initial: FormState
  title: string
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

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

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
              Template name
            </label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value as TemplateCategory)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          {form.category === 'email' && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Subject
              </label>
              <input
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Body (use {'{{name}}'} for placeholders)
            </label>
            <textarea
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              rows={6}
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Tags (comma-separated)
            </label>
            <input
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
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

export function TemplatesScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()

  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>(
    'all',
  )
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)

  const templatesQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      fetchTemplates({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
  })

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateTemplateInput) => createTemplate(input),
    onSuccess: () => {
      invalidate()
      toast('Template saved')
      setShowCreate(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateTemplateInput> }) =>
      updateTemplate(p.id, p.updates),
    onSuccess: () => {
      invalidate()
      toast('Template updated')
      setEditing(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      invalidate()
      toast('Template deleted')
    },
  })

  const filtered = useMemo(() => {
    const templates = templatesQuery.data ?? []
    if (categoryFilter === 'all') return templates
    return templates.filter((t) => t.category === categoryFilter)
  }, [templatesQuery.data, categoryFilter])

  const toForm = (t: Template): FormState => ({
    name: t.name,
    category: t.category,
    subject: t.subject,
    body: t.body,
    tags: t.tags.join(', '),
  })

  const fromForm = (f: FormState): CreateTemplateInput => ({
    name: f.name.trim(),
    category: f.category,
    subject: f.subject,
    body: f.body,
    tags: f.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    brand: brand.id !== 'hermes' ? brand.id : undefined,
  })

  const copyBody = (body: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(body)
      toast('Copied to clipboard')
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Copy01Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Templates
              </h1>
              {templatesQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({templatesQuery.data.length})
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
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Template
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['all', ...TEMPLATE_CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  categoryFilter === c
                    ? 'border-transparent text-white'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={
                  categoryFilter === c
                    ? { background: 'var(--theme-accent)' }
                    : undefined
                }
              >
                {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 space-y-2">
          {templatesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading templates…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon icon={Copy01Icon} size={32} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No templates yet</p>
              <p className="mt-1 text-xs">
                Create reusable message, email, and content templates.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((t) => (
                <motion.div
                  key={t.id}
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
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{
                            background: 'var(--theme-bg)',
                            color: 'var(--theme-accent)',
                          }}
                        >
                          {CATEGORY_LABELS[t.category]}
                        </span>
                        <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
                          {t.name}
                        </h3>
                      </div>
                      {t.subject && (
                        <p className="text-[11px] text-[var(--theme-muted)]">
                          Subject: {t.subject}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--theme-muted)]">
                        {t.body}
                      </p>
                      {t.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[9px] text-[var(--theme-muted)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => copyBody(t.body)}
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                        title="Copy body"
                      >
                        <HugeiconsIcon
                          icon={Copy01Icon}
                          size={14}
                          className="text-[var(--theme-accent)]"
                        />
                      </button>
                      <button
                        onClick={() => setEditing(t)}
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
                          if (confirm(`Delete "${t.name}"?`))
                            deleteMutation.mutate(t.id)
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

      <TemplateDialog
        open={showCreate}
        initial={EMPTY_FORM}
        title="New Template"
        onClose={() => setShowCreate(false)}
        onSubmit={(f) => createMutation.mutate(fromForm(f))}
        isSubmitting={createMutation.isPending}
      />
      <TemplateDialog
        open={editing !== null}
        initial={editing ? toForm(editing) : EMPTY_FORM}
        title="Edit Template"
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
