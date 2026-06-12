
import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AiMagicIcon,
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete01Icon,
  EyeIcon,
  LinkSquare01Icon,
  Mail01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  SentIcon,
  TestTube01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import {
  createCampaign,
  deleteCampaign,
  fetchCampaigns,
  sendCampaign,
  sendTestEmail,
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
import { RichEmailEditor } from '@/components/RichEmailEditor'

const QUERY_KEY = ['platform', 'campaigns'] as const

// ── Design tokens (shared vocabulary with Payments / Payroll) ────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls =
  'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const STATUS_HEX: Record<Campaign['status'], string> = {
  draft: '#94a3b8',
  scheduled: '#3b82f6',
  sending: '#f59e0b',
  sent: '#10b981',
  failed: '#ef4444',
}

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const color = STATUS_HEX[status]
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

// Small tinted metric chip (audience / opens / clicks)
function MetricChip({ icon, label, color }: { icon: typeof EyeIcon; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
      style={{
        background: `color-mix(in srgb, ${color} 10%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
      }}
    >
      <HugeiconsIcon icon={icon} size={10} />
      {label}
    </span>
  )
}

interface CampaignStatsData {
  opens: number
  clicks: number
  unique_opens: number
  unique_clicks: number
}

function TrackingStats({ campaignId }: { campaignId: string }) {
  const { data } = useQuery<CampaignStatsData>({
    queryKey: ['campaign-stats', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/stats`)
      if (!res.ok) throw new Error('Failed to load stats')
      return res.json() as Promise<CampaignStatsData>
    },
    staleTime: 30_000,
  })

  if (!data || (data.opens === 0 && data.clicks === 0)) return null

  return (
    <span className="flex items-center gap-1.5">
      <MetricChip icon={EyeIcon} label={`${data.opens} opens`} color="#3b82f6" />
      <MetricChip icon={LinkSquare01Icon} label={`${data.clicks} clicks`} color="#0ea5e9" />
    </span>
  )
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
  const [aiGenerating, setAiGenerating] = useState(false)

  useMemo(() => {
    if (open) setForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const generateBody = async () => {
    if (!form.subject.trim()) return
    setAiGenerating(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Write a professional, friendly marketing email body for a campaign named "${form.name || 'Campaign'}" with subject line: "${form.subject}". The email should be 3-4 short paragraphs. Use {{contact_name}} as a salutation variable. End with a clear call to action. Return only the email body text, no subject line, no markdown headers.`,
          }],
        }),
      })
      if (!res.ok) throw new Error('AI unavailable')
      const data = await res.json() as { content?: string; error?: string }
      const text = data.content?.trim()
      if (text) {
        // Convert plain text (with double-newline paragraphs) to HTML for the rich editor
        const html = text
          .split(/\n\n+/)
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('')
        setForm(f => ({ ...f, body: html }))
      }
    } catch {
      // silent — user still has the text area
    } finally {
      setAiGenerating(false)
    }
  }

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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Mail01Icon} size={16} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[var(--theme-text)]">{title}</h2>
            <p className="text-[11px] text-[var(--theme-muted)]">
              Targeted email to your contacts
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Campaign name (internal)
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
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
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                Body
              </label>
              <button
                type="button"
                onClick={() => void generateBody()}
                disabled={aiGenerating || !form.subject.trim()}
                className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all duration-150 disabled:opacity-40"
                style={{
                  color: '#8b5cf6',
                  background: 'color-mix(in srgb, #8b5cf6 12%, var(--theme-card))',
                  border: '1px solid color-mix(in srgb, #8b5cf6 30%, transparent)',
                }}
                title="Generate body with AI (requires subject line)"
              >
                <HugeiconsIcon icon={AiMagicIcon} size={11} className={aiGenerating ? 'animate-spin' : ''} />
                {aiGenerating ? 'Drafting…' : '✦ Draft with AI'}
              </button>
            </div>
            {aiGenerating && (
              <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-[var(--theme-border)]">
                <div className="h-full animate-pulse rounded-full" style={{ background: '#8b5cf6', width: '60%' }} />
              </div>
            )}
            <RichEmailEditor
              value={form.body}
              onChange={(html) => setForm((f) => ({ ...f, body: html }))}
              placeholder="Write your email body here…"
              minHeight={200}
            />
          </div>

          {/* Audience */}
          <div className="rounded-lg border border-[var(--theme-border)] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
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
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            {isSubmitting ? 'Saving…' : 'Save campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────


function applyVarPreview(text: string): string {
  return text
    .replace(/\{\{contact_name\}\}/g, '<span class="var-chip">Jane Smith</span>')
    .replace(/\{\{contact_email\}\}/g, '<span class="var-chip">jane@example.com</span>')
    .replace(/\{\{contact_company\}\}/g, '<span class="var-chip">Acme Corp</span>')
    .replace(/\{\{unsubscribe_link\}\}/g, '<a class="var-chip" href="#">Unsubscribe</a>')
}

function renderBody(raw: string): string {
  let html = applyVarPreview(raw)
  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // double newline → paragraph
  html = html.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')
  return html
}

// ── Campaign preview modal ─────────────────────────────────────────────────

function CampaignPreviewModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Email client chrome */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-[11px] text-[var(--theme-muted)]">Email preview</span>
          <button onClick={onClose} className="text-[var(--theme-muted)] hover:text-[var(--theme-text)]">
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto bg-white dark:bg-[var(--theme-card)]">
          {/* Email header */}
          <div className="border-b border-[var(--theme-border)] px-6 py-4 text-sm">
            <div className="flex gap-2 text-[var(--theme-muted)]">
              <span className="w-12 shrink-0 font-medium">From:</span>
              <span className="text-[var(--theme-text)]">Your Business &lt;hello@yourbusiness.com&gt;</span>
            </div>
            <div className="mt-1 flex gap-2 text-[var(--theme-muted)]">
              <span className="w-12 shrink-0 font-medium">To:</span>
              <span className="text-[var(--theme-text)]">Jane Smith &lt;jane@example.com&gt;</span>
            </div>
            <div className="mt-1 flex gap-2 text-[var(--theme-muted)]">
              <span className="w-12 shrink-0 font-medium">Subject:</span>
              <span className="font-semibold text-[var(--theme-text)]">{campaign.subject}</span>
            </div>
          </div>

          {/* Email body */}
          <div className="px-6 py-5">
            <style>{`.var-chip { display: inline-block; background: #dbeafe; color: #1d4ed8; border-radius: 4px; padding: 0 4px; font-size: 12px; font-weight: 600; } p { margin: 0 0 12px 0; line-height: 1.6; color: #374151; font-size: 14px; } strong { color: #111827; }`}</style>
            <div
              className="prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderBody(campaign.body) }}
            />

            {/* Footer */}
            <div className="mt-8 border-t border-[var(--theme-border)] pt-4 text-center text-[10px] text-gray-400">
              You received this because you're a contact. &nbsp;
              <a href="#" className="underline">Unsubscribe</a>
            </div>
          </div>
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
  const [previewing, setPreviewing] = useState<Campaign | null>(null)
  const [composeInitial, setComposeInitial] = useState<FormState>(EMPTY_FORM)
  const [testTarget, setTestTarget] = useState<Campaign | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState(false)

  // Read template prefill from sessionStorage (set by Templates screen "Use in Campaign")
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('campaign_prefill')
      if (raw) {
        sessionStorage.removeItem('campaign_prefill')
        const prefill = JSON.parse(raw) as { name?: string; subject?: string; body?: string }
        setComposeInitial({
          ...EMPTY_FORM,
          name: prefill.name ?? '',
          subject: prefill.subject ?? '',
          body: prefill.body ?? '',
        })
        setShowCompose(true)
      }
    } catch { /* ignore */ }
  }, [])

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

  const handleSendTest = async () => {
    if (!testTarget || !testEmail.includes('@')) return
    setTestSending(true)
    try {
      const r = await sendTestEmail(testTarget.id, testEmail)
      if (r.ok) {
        toast(`Test email sent to ${testEmail}`)
        setTestTarget(null)
        setTestEmail('')
      } else {
        toast(r.error ?? 'Send failed', { type: 'error' })
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Send failed', { type: 'error' })
    } finally {
      setTestSending(false)
    }
  }

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
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
              style={{
                background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
                boxShadow: `0 2px 8px color-mix(in srgb, ${brand.accentColor} 38%, transparent)`,
              }}
            >
              <HugeiconsIcon icon={Mail01Icon} size={18} />
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">
                Campaigns
              </h1>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {campaignsQuery.data
                  ? `${campaignsQuery.data.length} campaign${campaignsQuery.data.length === 1 ? '' : 's'} · targeted email to your contacts`
                  : 'Targeted email to your contacts'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={invalidate}
              className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
              title="Refresh"
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={16}
                className="text-[var(--theme-muted)]"
              />
            </button>
            <button
              onClick={() => { setComposeInitial(EMPTY_FORM); setShowCompose(true) }}
              className={primaryBtnCls}
              style={primaryBtnStyle}
            >
              <HugeiconsIcon icon={Add01Icon} size={14} />
              New Campaign
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-2">
          {campaignsQuery.isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-[var(--theme-card)] opacity-60" />
              ))}
            </div>
          ) : campaignsQuery.isError ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] py-16 text-center">
              <HugeiconsIcon icon={AlertCircleIcon} size={36} className="mb-3 text-[var(--theme-muted)]" />
              <p className="font-medium text-[var(--theme-text)]">Couldn't load campaigns</p>
              <p className="mt-1 text-sm text-[var(--theme-muted)] mb-4">
                {campaignsQuery.error instanceof Error ? campaignsQuery.error.message : 'An error occurred'}
              </p>
              <button
                onClick={invalidate}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={RefreshIcon} size={14} />
                Retry
              </button>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 16%, var(--theme-card)), color-mix(in srgb, #000 12%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={Mail01Icon} size={24} />
              </span>
              <p className="font-semibold text-[var(--theme-text)]">No campaigns yet</p>
              <p className="text-sm text-[var(--theme-muted)] mt-1 mb-4">
                Send targeted emails to your contacts in one click.
              </p>
              <button
                onClick={() => { setComposeInitial(EMPTY_FORM); setShowCompose(true) }}
                className={primaryBtnCls}
                style={primaryBtnStyle}
              >
                Create your first campaign
              </button>
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
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                  style={{ backdropFilter: 'blur(10px)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={c.status} />
                        <h3 className="truncate text-sm font-semibold text-[var(--theme-text)]">
                          {c.name}
                        </h3>
                      </div>
                      <p className="text-xs text-[var(--theme-muted)]">
                        <span className="text-[var(--theme-text)]">Subject:</span>{' '}
                        {c.subject}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <MetricChip
                          icon={UserGroupIcon}
                          color="#8b5cf6"
                          label={`${
                            c.audience.stages.length > 0
                              ? c.audience.stages.join(', ')
                              : 'all stages'
                          }${c.audience.tags.length > 0 ? ` · tags: ${c.audience.tags.join(', ')}` : ''}`}
                        />
                        {c.status === 'sent' && (
                          <>
                            <MetricChip
                              icon={CheckmarkCircle01Icon}
                              color="#10b981"
                              label={`${c.stats.sent} sent${c.stats.failed > 0 ? `, ${c.stats.failed} failed` : ''}`}
                            />
                            {c.sent_at && (
                              <MetricChip
                                icon={Clock01Icon}
                                color="#94a3b8"
                                label={formatDate(c.sent_at)}
                              />
                            )}
                          </>
                        )}
                        {c.stats.sent > 0 && <TrackingStats campaignId={c.id} />}
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
                        onClick={() => { setTestTarget(c); setTestEmail('') }}
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                        title="Send test email"
                      >
                        <HugeiconsIcon icon={TestTube01Icon} size={14} className="text-[var(--theme-muted)]" />
                      </button>
                      <button
                        onClick={() => setPreviewing(c)}
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                        title="Preview email"
                      >
                        <HugeiconsIcon icon={EyeIcon} size={14} className="text-[var(--theme-muted)]" />
                      </button>
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

      {previewing && (
        <CampaignPreviewModal campaign={previewing} onClose={() => setPreviewing(null)} />
      )}

      {/* Send test email modal */}
      {testTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setTestTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <HugeiconsIcon icon={TestTube01Icon} size={16} className="text-[var(--theme-accent)]" />
              <h3 className="text-sm font-semibold text-[var(--theme-text)]">Send test email</h3>
            </div>
            <p className="mb-3 text-[11px] text-[var(--theme-muted)]">
              Sends <strong className="text-[var(--theme-text)]">{testTarget.subject}</strong> to a single address with sample variables filled in.
            </p>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSendTest() }}
              placeholder="you@example.com"
              autoFocus
              className="mb-4 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTestTarget(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSendTest()}
                disabled={!testEmail.includes('@') || testSending}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={SentIcon} size={12} />
                {testSending ? 'Sending…' : 'Send test'}
              </button>
            </div>
          </div>
        </div>
      )}
      <CampaignDialog
        open={showCompose}
        initial={composeInitial}
        title="New Campaign"
        onClose={() => { setShowCompose(false); setComposeInitial(EMPTY_FORM) }}
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
