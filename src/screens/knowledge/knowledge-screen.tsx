import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  BookOpen01Icon,
  BubbleChatIcon,
  Delete01Icon,
  JusticeScale01Icon,
  Note01Icon,
  PencilEdit02Icon,
  PinIcon,
  QuillWrite01Icon,
  Rocket01Icon,
  Search01Icon,
  SparklesIcon,
  Tag01Icon,
  Target02Icon,
} from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { toast } from '@/components/toast'
import {
  CATEGORY_LABELS, KNOWLEDGE_CATEGORIES,
  createKnowledgeEntry, deleteKnowledgeEntry, fetchKnowledge, updateKnowledgeEntry,
  type KnowledgeCategory, type KnowledgeEntry, type CreateKnowledgeInput,
} from '@/lib/knowledge-api'

// ── Design tokens (shared vocabulary with Payments / Mission Control) ────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW =
  '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const AI_PURPLE = '#8b5cf6'

const CATEGORY_COLORS: Record<KnowledgeCategory, string> = {
  'brand-voice': '#8b5cf6',
  'icp': '#3b82f6',
  'services': '#10b981',
  'faq': '#0ea5e9',
  'objections': '#f59e0b',
  'snippets': '#f97316',
  'strategy': '#ef4444',
  'other': '#94a3b8',
}

const CATEGORY_ICONS: Record<KnowledgeCategory, typeof Tag01Icon> = {
  'brand-voice': QuillWrite01Icon,
  'icp': Target02Icon,
  'services': Tag01Icon,
  'faq': BubbleChatIcon,
  'objections': JusticeScale01Icon,
  'snippets': SparklesIcon,
  'strategy': Rocket01Icon,
  'other': Note01Icon,
}

// Tinted category chip with icon
function CategoryChip({ category }: { category: KnowledgeCategory }) {
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
      <HugeiconsIcon icon={CATEGORY_ICONS[category]} size={10} />
      {CATEGORY_LABELS[category]}
    </span>
  )
}

// Small AI-purple hint chip — entries feed Hermes as context
function AiContextChip() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${AI_PURPLE} 12%, var(--theme-card))`,
        color: AI_PURPLE,
        border: `1px solid color-mix(in srgb, ${AI_PURPLE} 30%, transparent)`,
      }}
      title="This entry is injected into Hermes as AI context"
    >
      <HugeiconsIcon icon={SparklesIcon} size={9} />
      Used as AI context
    </span>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────

function EntryModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: KnowledgeEntry | null
  onSave: (input: CreateKnowledgeInput) => void
  onClose: () => void
}) {
  const [category, setCategory] = useState<KnowledgeCategory>(initial?.category ?? 'brand-voice')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [pinned, setPinned] = useState(initial?.pinned ?? false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ background: 'var(--theme-card-solid)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(20px)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={BookOpen01Icon} size={16} className="text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-[var(--theme-text)]">
              {initial ? 'Edit entry' : 'Add to Knowledge Vault'}
            </h2>
            <p className="text-[11px] text-[var(--theme-muted)]">
              Brand memory Hermes draws on when drafting
            </p>
          </div>
          <AiContextChip />
        </div>

        <div className="flex flex-col gap-3 p-6">
          {/* Category */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as KnowledgeCategory)}
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
            >
              {KNOWLEDGE_CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Core Brand Voice Guidelines"
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none transition-all"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Content</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write the knowledge here — tone guidelines, pricing, objection scripts, FAQs…"
              rows={6}
              className="w-full resize-none rounded-xl border px-3 py-2 text-[13px] leading-relaxed text-[var(--theme-text)] outline-none transition-all"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. tone, sc, email"
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none transition-all"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            />
          </div>

          {/* Pin */}
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--theme-muted)]">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="accent-[var(--theme-accent)]" />
            Pin to top
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-[13px] text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]" style={{ borderColor: 'var(--theme-border)' }}>Cancel</button>
          <button
            onClick={() => {
              if (!title.trim() || !body.trim()) { toast('Title and content are required', { type: 'error' }); return }
              onSave({ category, title, body, tags: tags.split(',').map(t => t.trim()).filter(Boolean), pinned })
            }}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            {initial ? 'Save changes' : 'Add entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────

export function KnowledgeScreen() {
  const qc = useQueryClient()
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | KnowledgeEntry | null>(null)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['knowledge', activeCategory, search],
    queryFn: () => fetchKnowledge({
      category: activeCategory !== 'all' ? activeCategory : undefined,
      search: search || undefined,
    }),
  })

  const create = useMutation({
    mutationFn: (input: CreateKnowledgeInput) => createKnowledgeEntry(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge'] }); setModal(null); toast('Entry added') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateKnowledgeInput }) => updateKnowledgeEntry(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge'] }); setModal(null); toast('Entry updated') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteKnowledgeEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge'] }),
  })

  return (
    <>
      <ScreenShell
        icon={BookOpen01Icon}
        title="Knowledge Vault"
        count={entries.length}
        subtitle="Brand memory — voice, ICP, services, FAQs, and best-of snippets"
        action={
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Add01Icon} size={15} />
            Add entry
          </button>
        }
      >
        {/* Search + category filter */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <HugeiconsIcon icon={Search01Icon} size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vault…"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-[13px] text-[var(--theme-text)] outline-none transition-all"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...KNOWLEDGE_CATEGORIES] as (KnowledgeCategory | 'all')[]).map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all"
                style={
                  activeCategory === c
                    ? {
                        background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                        border: '1px solid color-mix(in srgb, var(--theme-accent) 35%, transparent)',
                        color: 'var(--theme-accent)',
                      }
                    : { background: 'var(--theme-card)', border: '1px solid var(--theme-border)', color: 'var(--theme-muted)' }
                }
              >
                {c === 'all' ? 'All' : CATEGORY_LABELS[c as KnowledgeCategory]}
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border bg-[var(--theme-card)] opacity-60"
                style={{ borderColor: 'var(--theme-border)' }}
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-16 text-center"
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
              <HugeiconsIcon icon={BookOpen01Icon} size={22} />
            </span>
            <p className="text-[13px] font-semibold text-[var(--theme-text)]">
              {search ? 'No matching entries' : 'Your knowledge vault is empty'}
            </p>
            <p className="text-[11px] text-[var(--theme-muted)]">
              {search ? 'Try a different search or category.' : 'Add your brand guidelines, ICP, and services — Hermes uses them as context.'}
            </p>
            {!search && (
              <button
                onClick={() => setModal('create')}
                className="mt-2 flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md"
                style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
              >
                <HugeiconsIcon icon={Add01Icon} size={13} /> Add first entry
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="group relative rounded-2xl border p-4 transition-all hover:-translate-y-px hover:shadow-md"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(12px)' }}
              >
                {entry.pinned && (
                  <span
                    className="absolute right-3 top-3"
                    style={{ color: 'var(--theme-accent)' }}
                    title="Pinned"
                  >
                    <HugeiconsIcon icon={PinIcon} size={13} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CategoryChip category={entry.category} />
                  </div>
                  <h3 className="mt-1.5 text-[13px] font-semibold text-[var(--theme-text)]">{entry.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--theme-muted)]">{entry.body}</p>
                  {entry.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.tags.map(t => (
                        <span key={t} className="rounded-full border px-2 py-0.5 text-[10px] text-[var(--theme-muted)]" style={{ borderColor: 'var(--theme-border)' }}>#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <AiContextChip />
                  <div className="flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      onClick={() => setModal(entry)}
                      className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                      title="Edit"
                    >
                      <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
                    </button>
                    <button
                      onClick={() => remove.mutate(entry.id)}
                      className="rounded-lg p-1.5 transition-colors"
                      style={{ color: 'var(--theme-danger)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      title="Delete"
                    >
                      <HugeiconsIcon icon={Delete01Icon} size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScreenShell>

      {modal && (
        <EntryModal
          initial={modal === 'create' ? null : modal}
          onSave={input =>
            modal === 'create'
              ? create.mutate(input)
              : update.mutate({ id: (modal as KnowledgeEntry).id, input })
          }
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
