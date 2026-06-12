import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listReviewRequests,
  createReviewRequest,
  deleteReviewRequest,
  type ReviewRequest,
  type ReviewRequestStatus,
} from '../lib/review-requests-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  CursorPointer01Icon,
  Delete02Icon,
  StarIcon,
  Mail01Icon,
  SentIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/review-requests')({ component: ReviewRequestsPage })

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_LABELS: Record<ReviewRequestStatus, string> = {
  sent: 'Sent',
  clicked: 'Clicked',
  reviewed: 'Reviewed',
}

const STATUS_COLORS: Record<ReviewRequestStatus, string> = {
  sent: '#3b82f6',
  clicked: '#f59e0b',
  reviewed: '#10b981',
}

const STATUS_ICONS: Record<ReviewRequestStatus, typeof SentIcon> = {
  sent: SentIcon,
  clicked: CursorPointer01Icon,
  reviewed: CheckmarkCircle01Icon,
}

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

function StatusBadge({ status }: { status: ReviewRequestStatus }) {
  const color = STATUS_COLORS[status]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Send modal ────────────────────────────────────────────────────────────────

function SendReviewRequestModal({
  onClose,
  onSend,
  isSending,
}: {
  onClose: () => void
  onSend: (data: { contact_name: string; contact_email: string; message?: string; review_url?: string }) => void
  isSending: boolean
}) {
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [message, setMessage] = useState('')
  const [reviewUrl, setReviewUrl] = useState('')

  const canSend = contactName.trim() && contactEmail.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={StarIcon} size={16} className="text-white" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">Send review request</h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Email a customer asking for a review</p>
            </div>
          </div>
          <button onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <input
            placeholder="Contact name *"
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          <input
            type="email"
            placeholder="Email address *"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          <textarea
            rows={3}
            placeholder="Custom message (optional)"
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full resize-y rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
          <input
            type="url"
            placeholder="https://g.page/your-business-name/review"
            value={reviewUrl}
            onChange={e => setReviewUrl(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
          >
            Cancel
          </button>
          <button
            disabled={!canSend || isSending}
            onClick={() =>
              onSend({
                contact_name: contactName.trim(),
                contact_email: contactEmail.trim(),
                message: message.trim() || undefined,
                review_url: reviewUrl.trim() || undefined,
              })
            }
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            <HugeiconsIcon icon={Mail01Icon} size={14} />
            {isSending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ReviewRequestRow({
  req,
  onDelete,
}: {
  req: ReviewRequest
  onDelete: () => void
}) {
  return (
    <div
      className="group flex items-center gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      {/* Avatar initials */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
      >
        {req.contact_name
          .split(' ')
          .slice(0, 2)
          .map(p => p[0]?.toUpperCase() ?? '')
          .join('')}
      </div>

      {/* Name + email */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--theme-text)]">{req.contact_name}</p>
        <p className="truncate text-xs text-[var(--theme-muted)]">{req.contact_email}</p>
      </div>

      {/* Channel chip */}
      <span className="hidden shrink-0 items-center gap-1 rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--theme-muted)] sm:inline-flex">
        <HugeiconsIcon icon={Mail01Icon} size={10} />
        Email
      </span>

      {/* Sent date */}
      <p className="hidden shrink-0 text-xs tabular-nums text-[var(--theme-muted)] sm:block">{fmtDate(req.sent_at)}</p>

      {/* Status badge */}
      <StatusBadge status={req.status} />

      {/* Delete */}
      <button
        onClick={onDelete}
        title="Delete"
        className="shrink-0 rounded-lg p-1.5 opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--theme-hover)]"
      >
        <HugeiconsIcon icon={Delete02Icon} size={15} className="text-red-400" />
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ReviewRequestsPage() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['review-requests', brand.id],
    queryFn: () => listReviewRequests(brand.id !== 'default' ? brand.id : undefined),
  })

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createReviewRequest>[0]) => createReviewRequest(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['review-requests', brand.id] })
      setShowModal(false)
      toast('Review request sent')
    },
    onError: (err: Error) => toast(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReviewRequest(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['review-requests', brand.id] })
      toast('Request deleted')
    },
    onError: (err: Error) => toast(err.message),
  })

  // Stats
  const sentCount = requests.filter(r => r.status === 'sent').length
  const clickedCount = requests.filter(r => r.status === 'clicked').length
  const reviewedCount = requests.filter(r => r.status === 'reviewed').length

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={StarIcon} size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-[var(--theme-text)]">Review Requests</h1>
            <p className="mt-0.5 text-[12px] text-[var(--theme-muted)]">
              {requests.length > 0
                ? `${requests.length} request${requests.length !== 1 ? 's' : ''} · track and send review requests`
                : 'Track and send review requests to your customers'}
            </p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className={`${primaryBtnCls} shrink-0`} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          Send review request
        </button>
      </div>

      {/* Stats strip */}
      {requests.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([
            { label: 'Sent', count: sentCount, status: 'sent' as const },
            { label: 'Clicked', count: clickedCount, status: 'clicked' as const },
            { label: 'Reviewed', count: reviewedCount, status: 'reviewed' as const },
          ]).map(s => {
            const color = STATUS_COLORS[s.status]
            return (
              <div
                key={s.label}
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
                    <HugeiconsIcon icon={STATUS_ICONS[s.status]} size={15} className="text-white" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{s.label}</p>
                    <p className="mt-0.5 text-[20px] font-bold leading-none tabular-nums text-[var(--theme-text)]">{s.count}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border opacity-60"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            />
          ))}
        </div>
      ) : requests.length === 0 ? (
        // Empty state
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
              color: 'var(--theme-accent)',
            }}
          >
            <HugeiconsIcon icon={StarIcon} size={26} />
          </div>
          <p className="text-sm font-semibold text-[var(--theme-text)]">No review requests yet</p>
          <p className="max-w-xs text-xs text-[var(--theme-muted)]">
            Send your first review request and start collecting 5-star reviews from happy customers.
          </p>
          <button onClick={() => setShowModal(true)} className={`${primaryBtnCls} mt-1`} style={primaryBtnStyle}>
            <HugeiconsIcon icon={Add01Icon} size={15} />
            Send review request
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map(req => (
            <ReviewRequestRow
              key={req.id}
              req={req}
              onDelete={() => {
                if (confirm(`Delete review request for ${req.contact_name}?`)) {
                  deleteMutation.mutate(req.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <SendReviewRequestModal
          onClose={() => setShowModal(false)}
          isSending={createMutation.isPending}
          onSend={data =>
            createMutation.mutate({
              ...data,
              brand: brand.id !== 'default' ? brand.id : undefined,
            })
          }
        />
      )}
    </div>
  )
}
