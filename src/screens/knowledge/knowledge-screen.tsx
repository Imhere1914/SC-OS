import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Delete01Icon, PencilEdit02Icon, Search01Icon, StarIcon } from '@hugeicons/core-free-icons'
import { ScreenShell } from '@/components/screen-shell'
import { toast } from '@/components/toast'
import {
  CATEGORY_EMOJIS, CATEGORY_LABELS, KNOWLEDGE_CATEGORIES,
  createKnowledgeEntry, deleteKnowledgeEntry, fetchKnowledge, updateKnowledgeEntry,
  type KnowledgeCategory, type KnowledgeEntry, type CreateKnowledgeInput,
} from '@/lib/knowledge-api'

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
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-xl rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--theme-card-solid)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(20px)' }}
      >
        <h2 className="mb-4 text-[15px] font-semibold text-[var(--theme-text)]">
          {initial ? 'Edit entry' : 'Add to Knowledge Vault'}
        </h2>

        <div className="flex flex-col gap-3">
          {/* Category */}
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as KnowledgeCategory)}
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
            >
              {KNOWLEDGE_CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Core Brand Voice Guidelines"
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">Content</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write the knowledge here — tone guidelines, pricing, objection scripts, FAQs…"
              rows={6}
              className="w-full resize-none rounded-xl border px-3 py-2 text-[13px] leading-relaxed text-[var(--theme-text)] outline-none"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-input)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--theme-border)' }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. tone, sc, email"
              className="w-full rounded-xl border px-3 py-2 text-[13px] text-[var(--theme-text)] outline-none"
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

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-[13px] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]" style={{ borderColor: 'var(--theme-border)' }}>Cancel</button>
          <button
            onClick={() => {
              if (!title.trim() || !body.trim()) { toast('Title and content are required', { type: 'error' }); return }
              onSave({ category, title, body, tags: tags.split(',').map(t => t.trim()).filter(Boolean), pinned })
            }}
            className="btn-primary rounded-xl px-4 py-2 text-[13px] font-medium"
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

  const BookOpenIcon = StarIcon // placeholder icon — use StarIcon for now
  return (
    <>
      <ScreenShell
        icon={BookOpenIcon}
        title="Knowledge Vault"
        count={entries.length}
        subtitle="Brand memory — voice, ICP, services, FAQs, and best-of snippets"
        action={
          <button
            onClick={() => setModal('create')}
            className="btn-primary flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-white"
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
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-[13px] text-[var(--theme-text)] outline-none"
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
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-all"
                style={
                  activeCategory === c
                    ? { background: 'var(--theme-accent)', color: 'white' }
                    : { background: 'var(--theme-card)', border: '1px solid var(--theme-border)', color: 'var(--theme-muted)' }
                }
              >
                {c === 'all' ? 'All' : `${CATEGORY_EMOJIS[c as KnowledgeCategory]} ${CATEGORY_LABELS[c as KnowledgeCategory]}`}
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        {isLoading ? (
          <p className="py-12 text-center text-sm text-[var(--theme-muted)]">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center" style={{ borderColor: 'var(--theme-border)' }}>
            <p className="text-[32px]">🧠</p>
            <p className="mt-2 text-[13px] text-[var(--theme-muted)]">
              {search ? 'No matching entries' : 'Your knowledge vault is empty — add your brand guidelines, ICP, and services.'}
            </p>
            {!search && (
              <button onClick={() => setModal('create')} className="mt-3 text-[13px] font-medium" style={{ color: 'var(--theme-accent)' }}>
                Add first entry →
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="group relative rounded-2xl border p-4 transition-all hover:shadow-sm"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(12px)' }}
              >
                {entry.pinned && (
                  <span className="absolute right-3 top-3 text-[12px]" title="Pinned">📌</span>
                )}
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-[20px] leading-none">{CATEGORY_EMOJIS[entry.category]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}>
                        {CATEGORY_LABELS[entry.category]}
                      </span>
                    </div>
                    <h3 className="mt-1 text-[13px] font-semibold text-[var(--theme-text)]">{entry.title}</h3>
                    <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-[var(--theme-muted)]">{entry.body}</p>
                    {entry.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.tags.map(t => (
                          <span key={t} className="rounded-full border px-2 py-0.5 text-[10px] text-[var(--theme-muted)]" style={{ borderColor: 'var(--theme-border)' }}>#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setModal(entry)}
                    className="rounded-lg p-1.5 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
                  </button>
                  <button
                    onClick={() => remove.mutate(entry.id)}
                    className="rounded-lg p-1.5 hover:bg-[var(--theme-hover)]"
                    style={{ color: 'var(--theme-danger)' }}
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={14} />
                  </button>
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
