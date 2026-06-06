
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  Mail01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  SentIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import {
  STATUS_COLORS,
  createCampaign,
  deleteCampaign,
  fetchCampaigns,
  sendCampaign,
  updateCampaign,
} from '@/lib/campaigns-api'
import type {
  Campaign,
  CreateCampaignInput,
} from '@/lib/campaigns-api'
import { CONTACT_STAGES, STAGE_LABELS } from '@/lib/contacts-api'
import type { ContactStage } from '@/lib/contacts-api'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'campaigns'] as const

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

type FormState = {
  name: string
  subject: string
  body: string
  stages: ContactStage[]
  tags: string
  include_unverified: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  subject: '',
  body: '',
  stages: [],
  tags: '',
  include_unverified: false,
}

function CampaignDialog({
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

  const toggleStage = (s: ContactStage) =>
    setForm((f) => ({
      ...f,
      stages: f.stages.includes(s)
        ? f.stages.filter((x) => x !== s)
        : [...f.stages, s],
    }))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--theme-text)]">
          {title}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Campaign name (internal)
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Subject line
            </label>
            <input
              value={form.subject}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Body (supports **bold** and paragraphs)
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={7}
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          {/* Audience */}
          <div className="rounded-lg border border-[var(--theme-border)] p-3">
            <p className="mb-2 text-[11px] font-semibold text-[var(--theme-text)]">
              Audience
            </p>
            <p className="mb-1.5 text-[10px] text-[var(--theme-muted)]">
              Stages (none selected = all stages except Lost)
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {CONTACT_STAGES.filter((s) => s !== 'lost').map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStage(s)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    form.stages.includes(s)
                      ? 'border-transparent text-white'
                      : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                  )}
                  style={
                    form.stages.includes(s)
                      ? { background: 'var(--theme-accent)' }
                      : undefined
                  }
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
            <label className="mb-2 block text-[10px] text-[var(--theme-muted)]">
              Tags filter (comma-separated, optional)
            </label>
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="e.g. newsletter, vip"
              className="mb-2 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
            <label className="flex items-center gap-2 text-[11px] text-[var(--theme-muted)]">
              <input
                type="checkbox"
                checked={form.include_unverified}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    include_unverified: e.target.checked,
                  }))
                }
              />
              Include unverified web-chat contacts (use with caution)
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.name.trim() || !form.subject.trim() || isSubmitting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            {isSubmitting ? 'Saving…' : 'Save campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CampaignsScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()

  const [showCompose, setShowCompose] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)

  const campaignsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      fetchCampaigns({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
  })

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateCampaignInput) => createCampaign(input),
    onSuccess: () => {
      invalidate()
      toast('Campaign saved')
      setShowCompose(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateCampaignInput> }) =>
      updateCampaign(p.id, p.updates),
    onSuccess: () => {
      invalidate()
      toast('Campaign updated')
      setEditing(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendCampaign(id),
    onSuccess: ({ campaign, error }) => {
      invalidate()
      if (error) {
        toast(`Send issue: ${error}`, { type: 'error' })
      } else {
        toast(
          `Sent to ${campaign.stats.sent}/${campaign.stats.recipients} recipients`,
        )
      }
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to send', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      invalidate()
      toast('Campaign deleted')
    },
  })

  const campaigns = campaignsQuery.data ?? []

  const toForm = (c: Campaign): FormState => ({
    name: c.name,
    subject: c.subject,
    body: c.body,
    stages: c.audience.stages as ContactStage[],
    tags: c.audience.tags.join(', '),
    include_unverified: c.audience.include_unverified,
  })

  const fromForm = (f: FormState): CreateCampaignInput => ({
    name: f.name.trim(),
    subject: f.subject.trim(),
    body: f.body,
    audience: {
      stages: f.stages,
      tags: f.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      include_unverified: f.include_unverified,
    },
    brand: brand.id !== 'hermes' ? brand.id : undefined,
  })

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Mail01Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Campaigns
              </h1>
              {campaignsQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({campaignsQuery.data.length})
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
                onClick={() => setShowCompose(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Campaign
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-2">
          {campaignsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading campaigns…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon
                icon={Mail01Icon}
                size={32}
                className="mb-3 opacity-40"
              />
              <p className="text-sm font-medium">No campaigns yet</p>
              <p className="mt-1 text-xs">
                Create your first email campaign to your contacts.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {campaigns.map((c) => (
                <motion.div
                  key={c.id}
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
                            color: STATUS_COLORS[c.status],
                          }}
                        >
                          {c.status === 'sent' && (
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={9} />
                          )}
                          {c.status === 'scheduled' && (
                            <HugeiconsIcon icon={Clock01Icon} size={9} />
                          )}
                          {c.status}
                        </span>
                        <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
                          {c.name}
                        </h3>
                      </div>
                      <p className="text-xs text-[var(--theme-muted)]">
                        <span className="text-[var(--theme-text)]">Subject:</span>{' '}
                        {c.subject}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-[var(--theme-muted)]">
                        <span className="flex items-center gap-1">
                          <HugeiconsIcon icon={UserGroupIcon} size={11} />
                          {c.audience.stages.length > 0
                            ? c.audience.stages.join(', ')
                            : 'all stages'}
                          {c.audience.tags.length > 0 &&
                            ` · tags: ${c.audience.tags.join(', ')}`}
                        </span>
                        {c.status === 'sent' && (
                          <span>
                            · {c.stats.sent} sent
                            {c.stats.failed > 0 && `, ${c.stats.failed} failed`}
                            {c.sent_at && ` · ${formatDate(c.sent_at)}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {(c.status === 'draft' ||
                        c.status === 'scheduled' ||
                        c.status === 'failed') && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Send "${c.name}" now? This emails all matching contacts.`,
                              )
                            ) {
                              sendMutation.mutate(c.id)
                            }
                          }}
                          disabled={sendMutation.isPending}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                          title="Send now"
                        >
                          <HugeiconsIcon
                            icon={SentIcon}
                            size={14}
                            className="text-[var(--theme-accent)]"
                          />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(c)}
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
                          if (confirm('Delete this campaign?'))
                            deleteMutation.mutate(c.id)
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

      <CampaignDialog
        open={showCompose}
        initial={EMPTY_FORM}
        title="New Campaign"
        onClose={() => setShowCompose(false)}
        onSubmit={(f) => createMutation.mutate(fromForm(f))}
        isSubmitting={createMutation.isPending}
      />
      <CampaignDialog
        open={editing !== null}
        initial={editing ? toForm(editing) : EMPTY_FORM}
        title="Edit Campaign"
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
