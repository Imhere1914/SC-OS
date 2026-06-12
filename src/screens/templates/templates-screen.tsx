
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  Copy01Icon,
  Delete01Icon,
  LibraryIcon,
  Mail01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  Tick02Icon,
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
import {
  PACK_DESCRIPTIONS,
  PACK_LABELS,
  TEMPLATE_PRESETS,
} from '@/lib/template-presets'
import type { TemplatePreset } from '@/lib/template-presets'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'templates'] as const

type TopTab = 'library' | 'gallery'

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

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  email: '#3b82f6',
  sms: '#10b981',
  social: '#8b5cf6',
  reply: '#0ea5e9',
  note: '#f59e0b',
}

// Tinted category badge — colored dot + soft pill
function CategoryBadge({ category }: { category: TemplateCategory }) {
  const color = CATEGORY_COLORS[category]
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
      {CATEGORY_LABELS[category]}
    </span>
  )
}

// Framed muted preview block for template body snippets
function PreviewBlock({ subject, body }: { subject?: string; body: string }) {
  return (
    <div
      className="mt-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: 'var(--theme-border)',
        background: 'color-mix(in srgb, var(--theme-muted) 6%, var(--theme-card))',
      }}
    >
      {subject && (
        <p className="mb-0.5 truncate text-[11px] font-medium text-[var(--theme-text)]">
          {subject}
        </p>
      )}
      <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--theme-muted)]">
        {body}
      </p>
    </div>
  )
}

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

const fieldCls =
  'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--theme-border)] px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={LibraryIcon} size={16} className="text-white" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
            <p className="text-[11px] text-[var(--theme-muted)]">
              Reusable copy for emails, replies, and posts
            </p>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Details
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Template name
            </label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value as TemplateCategory)}
              className={fieldCls}
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
                className={fieldCls}
              />
            </div>
          )}
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
            Content
          </p>
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
              className={fieldCls}
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
              onClick={() => onSubmit(form)}
              disabled={!form.name.trim() || isSubmitting}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Gallery preset card ──────────────────────────────────────────────────────
function PresetCard({
  preset,
  imported,
  importing,
  onImport,
}: {
  preset: TemplatePreset
  imported: boolean
  importing: boolean
  onImport: (p: TemplatePreset) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 transition-all hover:-translate-y-px hover:shadow-md"
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <CategoryBadge category={preset.category} />
            <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">
              {preset.name}
            </h3>
          </div>
          <PreviewBlock subject={preset.subject || undefined} body={preset.body} />
          {preset.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {preset.tags.map((tag) => (
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
        <div className="shrink-0">
          {imported ? (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: 'color-mix(in srgb, #10b981 12%, var(--theme-card))',
                color: '#10b981',
                border: '1px solid color-mix(in srgb, #10b981 30%, transparent)',
              }}
            >
              <HugeiconsIcon icon={Tick02Icon} size={11} />
              Imported
            </span>
          ) : (
            <button
              onClick={() => onImport(preset)}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--theme-text)] transition-all hover:-translate-y-px hover:border-[var(--theme-accent)] hover:bg-[var(--theme-hover)] disabled:opacity-50"
            >
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={12}
                className="text-[var(--theme-accent)]"
              />
              {importing ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────
export function TemplatesScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()
  const navigate = useNavigate()

  const [topTab, setTopTab] = useState<TopTab>('library')
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set())
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

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

  const importMutation = useMutation({
    mutationFn: (input: CreateTemplateInput & { _presetId: string }) => {
      const { _presetId: _, ...body } = input
      return createTemplate(body)
    },
    onSuccess: (_, vars) => {
      const id = vars._presetId
      setImportingIds((prev) => { const s = new Set(prev); s.delete(id); return s })
      setImportedIds((prev) => new Set([...prev, id]))
      invalidate()
      toast('Template imported to your library')
    },
    onError: (e, vars) => {
      setImportingIds((prev) => { const s = new Set(prev); s.delete(vars._presetId); return s })
      toast(e instanceof Error ? e.message : 'Failed to import', { type: 'error' })
    },
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

  // Gallery: filter presets by current brand
  const galleryPresets = useMemo(() => {
    const id = brand.id
    return TEMPLATE_PRESETS.filter((p) => {
      if (p.pack === 'universal') return true
      if (id === 'sc' && p.pack === 'sc-starter') return true
      if (id === 'hfm' && p.pack === 'hfm-starter') return true
      if (id === 'default') return true // show everything in dev
      return false
    })
  }, [brand.id])

  // Group gallery presets by pack
  const galleryByPack = useMemo(() => {
    const map: Record<string, TemplatePreset[]> = {}
    galleryPresets.forEach((p) => {
      if (!map[p.pack]) map[p.pack] = []
      map[p.pack].push(p)
    })
    return map
  }, [galleryPresets])

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

  const useInCampaign = (t: Template) => {
    sessionStorage.setItem('campaign_prefill', JSON.stringify({
      name: `Campaign — ${t.name}`,
      subject: t.subject || t.name,
      body: t.body,
    }))
    void navigate({ to: '/campaigns' })
  }

  const handleImport = (preset: TemplatePreset) => {
    if (importingIds.has(preset.id) || importedIds.has(preset.id)) return
    setImportingIds((prev) => new Set([...prev, preset.id]))
    importMutation.mutate({
      _presetId: preset.id,
      name: preset.name,
      category: preset.category,
      subject: preset.subject,
      body: preset.body,
      tags: preset.tags,
      brand: brand.id !== 'hermes' ? brand.id : undefined,
    })
  }

  const allTemplates = templatesQuery.data ?? []

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
              <HugeiconsIcon icon={LibraryIcon} size={18} className="text-white" />
            </span>
            <div>
              <h1 className="text-[22px] font-bold leading-tight text-[var(--theme-text)]">
                Templates
              </h1>
              <p className="mt-0.5 truncate text-[12px] text-[var(--theme-muted)]">
                {templatesQuery.data
                  ? `${allTemplates.length} template${allTemplates.length !== 1 ? 's' : ''} · reusable copy for every channel`
                  : 'Reusable copy for every channel'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {topTab === 'library' && (
              <>
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
                  className={primaryBtnCls}
                  style={primaryBtnStyle}
                >
                  <HugeiconsIcon icon={Add01Icon} size={14} />
                  New Template
                </button>
              </>
            )}
          </div>
        </div>

        {/* Top tab switcher — segmented control */}
        <div className="flex w-fit gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
          {(['library', 'gallery'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTopTab(tab)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all',
                topTab === tab
                  ? 'shadow-sm'
                  : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
              )}
              style={
                topTab === tab
                  ? {
                      background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                      color: 'var(--theme-accent)',
                    }
                  : undefined
              }
            >
              {tab === 'library' ? 'My Templates' : 'Gallery'}
              <span className="ml-1 opacity-60 tabular-nums">
                {tab === 'library' ? allTemplates.length : galleryPresets.length}
              </span>
            </button>
          ))}
        </div>

        {/* Category filters — library only */}
        {topTab === 'library' && (
          <div className="-mt-2 flex w-fit gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
            {(['all', ...TEMPLATE_CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
                  categoryFilter === c
                    ? 'shadow-sm'
                    : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                )}
                style={
                  categoryFilter === c
                    ? {
                        background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                        color: 'var(--theme-accent)',
                      }
                    : undefined
                }
              >
                {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        )}

        {/* ── Library tab ── */}
        {topTab === 'library' && (
          <div className="flex-1 space-y-2">
            {templatesQuery.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl border bg-[var(--theme-card)] opacity-60"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
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
                  <HugeiconsIcon icon={LibraryIcon} size={22} />
                </span>
                <p className="text-[13px] font-semibold text-[var(--theme-text)]">
                  No templates yet
                </p>
                <p className="text-[11px] text-[var(--theme-muted)]">
                  Create your own or import from the Gallery.
                </p>
                <button
                  onClick={() => setTopTab('gallery')}
                  className={cn(primaryBtnCls, 'mt-2')}
                  style={primaryBtnStyle}
                >
                  Browse Gallery
                </button>
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
                    className="group rounded-xl border p-4 transition-all hover:-translate-y-px hover:shadow-md"
                    style={{
                      background: 'var(--theme-card)',
                      borderColor: 'var(--theme-border)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <CategoryBadge category={t.category} />
                          <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">
                            {t.name}
                          </h3>
                        </div>
                        <PreviewBlock subject={t.subject || undefined} body={t.body} />
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
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          onClick={() => useInCampaign(t)}
                          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all hover:-translate-y-px"
                          style={{
                            color: 'var(--theme-accent)',
                            borderColor: 'color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
                          }}
                          title="Use this template in a new campaign"
                        >
                          <HugeiconsIcon icon={Mail01Icon} size={11} />
                          Use as campaign
                        </button>
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
        )}

        {/* ── Gallery tab ── */}
        {topTab === 'gallery' && (
          <div className="space-y-8">
            {Object.entries(galleryByPack).map(([pack, presets]) => (
              <div key={pack}>
                <div className="mb-3">
                  <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                    {PACK_LABELS[pack] ?? pack}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--theme-muted)]">
                    {PACK_DESCRIPTIONS[pack]}
                  </p>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {presets.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        imported={importedIds.has(preset.id)}
                        importing={importingIds.has(preset.id)}
                        onImport={handleImport}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
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
