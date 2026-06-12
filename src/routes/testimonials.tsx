import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Comment01Icon,
  Delete02Icon,
  QuoteUpIcon,
  StarAward01Icon,
  StarIcon,
  Edit02Icon,
  Copy01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

export const Route = createFileRoute('/testimonials')({ component: TestimonialsScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestimonialRecord {
  id: string
  brand: string
  author_name: string
  author_title?: string
  author_company?: string
  author_avatar_url?: string
  body: string
  rating?: number
  source: 'manual' | 'form'
  status: 'pending' | 'approved' | 'rejected'
  featured: boolean
  contact_id?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchTestimonials(brand: string, status?: string): Promise<TestimonialRecord[]> {
  const params = new URLSearchParams({ brand })
  if (status && status !== 'all') params.set('status', status)
  const res = await fetch(`/api/testimonials?${params}`)
  if (!res.ok) throw new Error('Failed to fetch testimonials')
  return res.json() as Promise<TestimonialRecord[]>
}

async function patchTestimonial(
  id: string,
  patch: Partial<TestimonialRecord> & { brand: string; action?: string },
): Promise<TestimonialRecord> {
  const res = await fetch(`/api/testimonials/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update testimonial')
  return res.json() as Promise<TestimonialRecord>
}

async function deleteTestimonial(id: string, brand: string): Promise<void> {
  const res = await fetch(`/api/testimonials/${id}?brand=${brand}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete')
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const GOLD = '#f59e0b'
const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const STATUS_COLORS: Record<TestimonialRecord['status'], string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
}

function StatusBadge({ status }: { status: TestimonialRecord['status'] }) {
  const color = STATUS_COLORS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
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

// Tinted ghost action (approve / reject)
function GhostAction({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 hover:-translate-y-px"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {label}
    </button>
  )
}

// ── Stars display ─────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating?: number; size?: number }) {
  if (!rating) return null
  return (
    <span className="inline-flex gap-px">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ fontSize: size, color: s <= rating ? GOLD : 'var(--theme-border)', lineHeight: 1 }}>
          ★
        </span>
      ))}
    </span>
  )
}

// ── Star rating selector ──────────────────────────────────────────────────────

function StarRatingSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === star ? 0 : star)}
          className="text-xl transition-transform hover:scale-110 focus:outline-none"
        >
          <span style={{ color: star <= (hover || value) ? GOLD : 'var(--theme-border)' }}>★</span>
        </button>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string
  value: string | number
  color: string
  icon: typeof StarIcon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
      />
      <div className="flex items-center gap-3 pl-1.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
          <p className="mt-0.5 text-[20px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{value}</p>
        </div>
      </div>
    </div>
  )
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

function TestimonialModal({
  initial,
  brandId,
  onClose,
  onSave,
}: {
  initial?: TestimonialRecord
  brandId: string
  onClose: () => void
  onSave: (data: Partial<TestimonialRecord>) => void
}) {
  const [authorName, setAuthorName] = useState(initial?.author_name ?? '')
  const [authorTitle, setAuthorTitle] = useState(initial?.author_title ?? '')
  const [authorCompany, setAuthorCompany] = useState(initial?.author_company ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [status, setStatus] = useState<TestimonialRecord['status']>(initial?.status ?? 'approved')
  const [featured, setFeatured] = useState(initial?.featured ?? false)

  const canSave = authorName.trim() && body.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={QuoteUpIcon} size={16} className="text-white" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">
                {initial ? 'Edit testimonial' : 'Add testimonial'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {initial ? initial.author_name : 'Capture words from a happy customer'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--theme-muted)] hover:text-[var(--theme-text)]">
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Rating */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-1.5">Rating</label>
            <StarRatingSelector value={rating} onChange={setRating} />
          </div>

          {/* Body */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-1.5">
              Testimonial <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              placeholder="The testimonial text…"
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] resize-none"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-1.5">
              Author name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Title + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-1.5">Job title</label>
              <input
                type="text"
                value={authorTitle}
                onChange={(e) => setAuthorTitle(e.target.value)}
                placeholder="CEO"
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-1.5">Company</label>
              <input
                type="text"
                value={authorCompany}
                onChange={(e) => setAuthorCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2.5 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
          </div>

          {/* Status + Featured */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TestimonialRecord['status'])}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2.5 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="featured-check"
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--theme-border)] accent-[var(--theme-accent)]"
              />
              <label htmlFor="featured-check" className="text-sm text-[var(--theme-text)]">Featured</label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            disabled={!canSave}
            onClick={() =>
              onSave({
                author_name: authorName.trim(),
                author_title: authorTitle.trim() || undefined,
                author_company: authorCompany.trim() || undefined,
                body: body.trim(),
                rating: rating || undefined,
                status,
                featured,
                brand: brandId,
              })
            }
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {initial ? 'Save changes' : 'Add testimonial'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Embed widget preview ──────────────────────────────────────────────────────

function EmbedPreview({ testimonials }: { testimonials: TestimonialRecord[] }) {
  const items = testimonials.filter((t) => t.status === 'approved').slice(0, 3)
  if (!items.length) return null

  return (
    <div
      className="mt-8 rounded-2xl border p-5"
      style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)', backdropFilter: 'blur(10px)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] mb-4">
        Embed preview — approved testimonials
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((t) => {
          const initials = t.author_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          return (
            <div key={t.id} className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.author_name}</p>
                  {(t.author_title || t.author_company) && (
                    <p className="text-xs text-gray-500 truncate">
                      {[t.author_title, t.author_company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              {t.rating && <Stars rating={t.rating} size={13} />}
              <p className="mt-2 text-xs text-gray-600 line-clamp-4 leading-relaxed">
                "{t.body}"
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

function TestimonialsScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<TestimonialRecord | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: testimonials = [], isLoading } = useQuery({
    queryKey: ['testimonials', brand.id],
    queryFn: () => fetchTestimonials(brand.id),
  })

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['testimonials', brand.id] })

  const createMut = useMutation({
    mutationFn: async (data: Partial<TestimonialRecord>) => {
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: () => { toast('Testimonial added'); invalidate(); setShowAdd(false) },
    onError: () => toast('Failed to add testimonial'),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TestimonialRecord> & { brand: string; action?: string } }) =>
      patchTestimonial(id, patch),
    onSuccess: () => { invalidate() },
    onError: () => toast('Failed to update'),
  })

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TestimonialRecord> }) =>
      patchTestimonial(id, { ...data, brand: brand.id }),
    onSuccess: () => { toast('Saved'); invalidate(); setEditing(null) },
    onError: () => toast('Failed to save'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTestimonial(id, brand.id),
    onSuccess: () => { toast('Deleted'); invalidate() },
    onError: () => toast('Failed to delete'),
  })

  const copyFormLink = () => {
    const url = `${window.location.origin}/testimonial/${brand.id}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast('Form link copied!')
    })
  }

  // Filtered list
  const filtered = filter === 'all' ? testimonials : testimonials.filter((t) => t.status === filter)

  // Stats
  const approved = testimonials.filter((t) => t.status === 'approved')
  const withRating = testimonials.filter((t) => t.rating)
  const avgRating =
    withRating.length > 0
      ? (withRating.reduce((s, t) => s + (t.rating ?? 0), 0) / withRating.length).toFixed(1)
      : '—'
  const featuredCount = testimonials.filter((t) => t.featured).length

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={QuoteUpIcon} size={18} className="text-white" />
            </span>
            <div>
              <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">Testimonials</h1>
              <p className="text-[12px] text-[var(--theme-muted)] mt-0.5">
                {testimonials.length > 0
                  ? `${testimonials.length} testimonial${testimonials.length !== 1 ? 's' : ''} · collect and showcase customer praise`
                  : 'Collect and showcase customer testimonials'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyFormLink}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-text)] hover:bg-[var(--theme-hover)] transition-all duration-150"
            >
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={14} className="text-[var(--theme-muted)]" />
              {copied ? 'Copied!' : 'Copy form link'}
            </button>
            <button onClick={() => setShowAdd(true)} className={primaryBtnCls} style={primaryBtnStyle}>
              <HugeiconsIcon icon={Add01Icon} size={14} />
              Add testimonial
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={testimonials.length} color="#3b82f6" icon={Comment01Icon} />
          <StatCard label="Approved" value={approved.length} color="#10b981" icon={CheckmarkCircle01Icon} />
          <StatCard label="Avg rating" value={avgRating === '—' ? '—' : `${avgRating} ★`} color={GOLD} icon={StarIcon} />
          <StatCard label="Featured" value={featuredCount} color="#8b5cf6" icon={StarAward01Icon} />
        </div>

        {/* Filter tabs — segmented control */}
        <div className="mb-5 flex gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1 w-fit">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? testimonials.length
                : testimonials.filter((t) => t.status === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 ${
                  filter === tab.key ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
                }`}
                style={filter === tab.key ? {
                  background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                  color: 'var(--theme-accent)',
                } : undefined}
              >
                {tab.label}
                <span className="ml-1 opacity-60 tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Testimonial cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border opacity-60"
                style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border py-16 text-center"
            style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                color: 'var(--theme-accent)',
              }}
            >
              <HugeiconsIcon icon={QuoteUpIcon} size={22} />
            </span>
            <p className="text-[13px] font-semibold text-[var(--theme-text)]">No testimonials yet</p>
            <p className="text-[11px] text-[var(--theme-muted)]">
              Add one manually or share the form link to collect them
            </p>
            <button onClick={() => setShowAdd(true)} className={`${primaryBtnCls} mt-2`} style={primaryBtnStyle}>
              <HugeiconsIcon icon={Add01Icon} size={13} /> Add testimonial
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="group rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left: avatar + info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
                    >
                      <span className="text-xs font-bold text-white">
                        {t.author_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--theme-text)]">{t.author_name}</span>
                        {(t.author_title || t.author_company) && (
                          <span className="text-xs text-[var(--theme-muted)]">
                            {[t.author_title, t.author_company].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {t.featured && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--theme-card))',
                              color: 'var(--theme-accent)',
                              border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                            }}
                          >
                            <HugeiconsIcon icon={StarIcon} size={10} />
                            Featured
                          </span>
                        )}
                      </div>
                      {t.rating && <Stars rating={t.rating} size={13} />}
                      <p className="mt-1.5 text-sm text-[var(--theme-text)] line-clamp-3 leading-relaxed">
                        "{t.body}"
                      </p>
                    </div>
                  </div>

                  {/* Right: badges + actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Source badge */}
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize border-[var(--theme-border)] text-[var(--theme-muted)]">
                      {t.source}
                    </span>

                    {/* Status badge */}
                    <StatusBadge status={t.status} />

                    {/* Featured toggle */}
                    <button
                      title={t.featured ? 'Remove from featured' : 'Mark as featured'}
                      onClick={() =>
                        patchMut.mutate({ id: t.id, patch: { featured: !t.featured, brand: brand.id } })
                      }
                      className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                    >
                      <HugeiconsIcon
                        icon={StarIcon}
                        size={15}
                        style={{ color: t.featured ? GOLD : 'var(--theme-muted)' }}
                      />
                    </button>

                    {/* Approve */}
                    {t.status === 'pending' && (
                      <GhostAction
                        label="Approve"
                        color="#10b981"
                        onClick={() =>
                          patchMut.mutate({ id: t.id, patch: { action: 'approve', brand: brand.id } })
                        }
                      />
                    )}

                    {/* Reject */}
                    {t.status === 'pending' && (
                      <GhostAction
                        label="Reject"
                        color="#ef4444"
                        onClick={() =>
                          patchMut.mutate({ id: t.id, patch: { status: 'rejected', brand: brand.id } })
                        }
                      />
                    )}

                    {/* Edit */}
                    <button
                      title="Edit"
                      onClick={() => setEditing(t)}
                      className="rounded-lg p-1.5 text-[var(--theme-muted)] opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--theme-text)] hover:bg-[var(--theme-hover)]"
                    >
                      <HugeiconsIcon icon={Edit02Icon} size={14} />
                    </button>

                    {/* Delete */}
                    <button
                      title="Delete"
                      onClick={() => {
                        if (confirm('Delete this testimonial?')) deleteMut.mutate(t.id)
                      }}
                      className="rounded-lg p-1.5 text-[var(--theme-muted)] opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 hover:bg-[var(--theme-hover)]"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Embed widget preview */}
        <EmbedPreview testimonials={testimonials} />
      </div>

      {/* Add modal */}
      {showAdd && (
        <TestimonialModal
          brandId={brand.id}
          onClose={() => setShowAdd(false)}
          onSave={(data) => createMut.mutate(data)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <TestimonialModal
          initial={editing}
          brandId={brand.id}
          onClose={() => setEditing(null)}
          onSave={(data) => editMut.mutate({ id: editing.id, data })}
        />
      )}
    </div>
  )
}
