/**
 * Onboarding wizard — /onboarding
 * Full-screen standalone page (no app shell). 6-step guided setup.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Mail01Icon,
  Settings02Icon,
  UserGroupIcon,
  UserAdd01Icon,
  CheckListIcon,
  Cancel01Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'

export const Route = createFileRoute('/onboarding')({ component: OnboardingWizard })

// ── Types ─────────────────────────────────────────────────────────────────────

type StepId = 'welcome' | 'brand-profile' | 'first-contact' | 'email-setup' | 'invite-team' | 'done'

interface Step {
  id: StepId
  title: string
  subtitle: string
  optional?: boolean
}

const STEPS: Step[] = [
  { id: 'welcome',        title: 'Welcome',          subtitle: "Let's get your platform set up" },
  { id: 'brand-profile',  title: 'Brand Profile',    subtitle: 'Tell us about your business' },
  { id: 'first-contact',  title: 'Add First Contact', subtitle: 'Start building your CRM', optional: true },
  { id: 'email-setup',    title: 'Email Setup',       subtitle: 'Connect your email sender' },
  { id: 'invite-team',    title: 'Invite Team',       subtitle: 'Bring your team on board', optional: true },
  { id: 'done',           title: 'All Done!',         subtitle: "You're ready to go" },
]

const ACCENT_COLORS = [
  { label: 'Green',   value: '#22c55e' },
  { label: 'Purple',  value: '#7c3aed' },
  { label: 'Rose',    value: '#e11d48' },
  { label: 'Teal',    value: '#0d9488' },
  { label: 'Amber',   value: '#d97706' },
  { label: 'Slate',   value: '#475569' },
]

// ── API helpers ───────────────────────────────────────────────────────────────

async function markStep(stepId: string): Promise<void> {
  await fetch('/api/onboarding/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step_id: stepId }),
  })
}

async function completeOnboarding(): Promise<void> {
  await fetch('/api/onboarding/complete', { method: 'POST' })
}

// ── Step components ───────────────────────────────────────────────────────────

function WelcomeStep({ brand, onNext }: { brand: { name: string; accentColor: string }; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
          boxShadow: `0 8px 32px color-mix(in srgb, ${brand.accentColor} 35%, transparent)`,
        }}
      >
        {brand.name.slice(0, 2).toUpperCase()}
      </div>
      <h2 className="text-2xl font-bold text-[var(--theme-text)]">Welcome to {brand.name}</h2>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[var(--theme-muted)]">
        Your AI-powered operating system is ready. This quick setup takes about 3 minutes and helps you get the most out of the platform.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        {[
          { label: 'Smart CRM', desc: 'Manage contacts & conversations' },
          { label: 'Campaigns', desc: 'Email & SMS marketing' },
          { label: 'Automation', desc: 'Workflows that work while you sleep' },
        ].map(f => (
          <div
            key={f.label}
            className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-3"
          >
            <p className="text-[12px] font-semibold text-[var(--theme-text)]">{f.label}</p>
            <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{f.desc}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        className="mt-8 flex items-center gap-2 rounded-xl px-8 py-3 text-[15px] font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #000))` }}
      >
        Let's get started
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
      </button>
    </div>
  )
}

interface BrandProfileData {
  name: string
  description: string
  accent_color: string
}

function BrandProfileStep({
  brand,
  onComplete,
}: {
  brand: { name: string; accentColor: string }
  onComplete: () => void
}) {
  const [form, setForm] = useState<BrandProfileData>({
    name: brand.name,
    description: '',
    accent_color: brand.accentColor,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    // Mock save — PATCH /api/brand-profile doesn't exist yet; log locally
    await new Promise(r => setTimeout(r, 400))
    console.info('[onboarding] brand profile (mock save):', form)
    await markStep('brand-profile')
    setSaving(false)
    onComplete()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--theme-text)]">
          Business name
        </label>
        <input
          required
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Acme Inc."
          className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3 text-[14px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--theme-text)]">
          Tagline / description
        </label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="We help small businesses grow with AI-powered tools"
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3 text-[14px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>
      <div>
        <label className="mb-2 block text-[13px] font-medium text-[var(--theme-text)]">
          Accent color
        </label>
        <div className="flex gap-3">
          {ACCENT_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, accent_color: c.value }))}
              title={c.label}
              className="relative h-9 w-9 rounded-xl transition-transform hover:scale-110 active:scale-95"
              style={{ background: c.value }}
            >
              {form.accent_color === c.value && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} className="text-white drop-shadow" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
        style={{ background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #000))` }}
      >
        {saving ? 'Saving…' : 'Save & continue'}
        {!saving && <HugeiconsIcon icon={ArrowRight01Icon} size={18} />}
      </button>
    </form>
  )
}

function FirstContactStep({
  brand,
  onComplete,
  onSkip,
}: {
  brand: { accentColor: string }
  onComplete: () => void
  onSkip: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          source: 'manual',
          stage: 'lead',
        }),
      })
      if (!res.ok) throw new Error('Failed to create contact')
      await markStep('first-contact')
      toast('Contact added!')
      onComplete()
    } catch {
      toast('Failed to save contact', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--theme-text)]">
          Full name <span className="text-[var(--theme-accent)]">*</span>
        </label>
        <input
          required
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Jane Smith"
          className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3 text-[14px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--theme-text)]">
          Email address
        </label>
        <input
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="jane@example.com"
          className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3 text-[14px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--theme-text)]">
          Phone number
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="+1 (555) 000-0000"
          className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3 text-[14px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-xl border border-[var(--theme-border)] py-3 text-[14px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
        >
          Skip for now
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #000))` }}
        >
          {saving ? 'Adding…' : 'Add contact'}
          {!saving && <HugeiconsIcon icon={ArrowRight01Icon} size={16} />}
        </button>
      </div>
    </form>
  )
}

function EmailSetupStep({
  brand,
  onComplete,
}: {
  brand: { accentColor: string }
  onComplete: () => void
}) {
  const queryClient = useQueryClient()
  const { data: status, isFetching } = useQuery({
    queryKey: ['email-status'],
    queryFn: async () => {
      const res = await fetch('/api/email-status')
      return res.json() as Promise<{ configured: boolean; from: string | null; note: string }>
    },
    staleTime: 0,
  })

  const handleCheckAgain = () => {
    void queryClient.invalidateQueries({ queryKey: ['email-status'] })
  }

  const handleContinue = async () => {
    await markStep('email-setup')
    onComplete()
  }

  return (
    <div className="space-y-5">
      <div
        className={`rounded-2xl border p-5 transition-all ${
          status?.configured
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
            : 'border-[var(--theme-border)] bg-[var(--theme-hover)]'
        }`}
      >
        {isFetching && !status ? (
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--theme-border)] border-t-[var(--theme-accent)]" />
            <span className="text-[13px] text-[var(--theme-muted)]">Checking email status…</span>
          </div>
        ) : status?.configured ? (
          <div className="flex items-start gap-3">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={22} className="mt-0.5 shrink-0 text-green-500" />
            <div>
              <p className="text-[14px] font-semibold text-green-700 dark:text-green-400">Email is configured!</p>
              {status.from && (
                <p className="mt-0.5 text-[12px] text-green-600 dark:text-green-500">Sending from: {status.from}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <HugeiconsIcon icon={Mail01Icon} size={22} className="mt-0.5 shrink-0 text-[var(--theme-muted)]" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--theme-text)]">Email not yet configured</p>
              <p className="mt-0.5 text-[12px] text-[var(--theme-muted)]">{status?.note ?? 'Loading…'}</p>
            </div>
          </div>
        )}
      </div>

      {!status?.configured && (
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">Setup instructions</p>
          <ol className="space-y-2 text-[13px] text-[var(--theme-text)]">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: brand.accentColor }}>1</span>
              Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: brand.accentColor }}>resend.com</a> (free tier available)
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: brand.accentColor }}>2</span>
              Create an API key in your Resend dashboard
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: brand.accentColor }}>3</span>
              Add to your <code className="rounded bg-[var(--theme-card)] px-1.5 py-0.5 font-mono text-[11px]">.env</code> file:
            </li>
          </ol>
          <pre className="mt-3 rounded-lg bg-[var(--theme-card)] p-3 font-mono text-[11px] text-[var(--theme-text)]">
{`RESEND_API_KEY=re_xxxxxxxxxxxxx
CAMPAIGN_FROM_EMAIL=hello@yourdomain.com`}
          </pre>
        </div>
      )}

      <div className="flex gap-3">
        {!status?.configured && (
          <button
            type="button"
            onClick={handleCheckAgain}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-xl border border-[var(--theme-border)] px-4 py-3 text-[13px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-50"
          >
            <HugeiconsIcon icon={RefreshIcon} size={15} className={isFetching ? 'animate-spin' : ''} />
            Check again
          </button>
        )}
        <button
          type="button"
          onClick={handleContinue}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #000))` }}
        >
          {status?.configured ? 'Continue' : 'Skip for now'}
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
        </button>
      </div>
    </div>
  )
}

const TEAM_ROLES = ['Admin', 'Manager', 'Member', 'Viewer']

function InviteTeamStep({
  brand,
  onComplete,
  onSkip,
}: {
  brand: { accentColor: string }
  onComplete: () => void
  onSkip: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', role: 'Member' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role.toLowerCase(),
        }),
      })
      if (!res.ok) throw new Error('Failed to invite team member')
      await markStep('invite-team')
      toast(`Invited ${form.name}!`)
      onComplete()
    } catch {
      toast('Failed to invite team member', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--theme-text)]">
          Full name <span className="text-[var(--theme-accent)]">*</span>
        </label>
        <input
          required
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Alex Johnson"
          className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3 text-[14px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--theme-text)]">
          Email address <span className="text-[var(--theme-accent)]">*</span>
        </label>
        <input
          required
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="alex@yourcompany.com"
          className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3 text-[14px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--theme-text)]">
          Role
        </label>
        <select
          value={form.role}
          onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] px-4 py-3 text-[14px] text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
        >
          {TEAM_ROLES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-xl border border-[var(--theme-border)] py-3 text-[14px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]"
        >
          Skip for now
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim() || !form.email.trim()}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #000))` }}
        >
          {saving ? 'Inviting…' : 'Send invite'}
          {!saving && <HugeiconsIcon icon={ArrowRight01Icon} size={16} />}
        </button>
      </div>
    </form>
  )
}

function DoneStep({
  brand,
  onFinish,
}: {
  brand: { name: string; accentColor: string }
  onFinish: () => void
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 65%, #000))`,
          boxShadow: `0 8px 32px color-mix(in srgb, ${brand.accentColor} 35%, transparent)`,
        }}
      >
        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={40} className="text-white" />
      </div>
      <h2 className="text-2xl font-bold text-[var(--theme-text)]">You're all set!</h2>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[var(--theme-muted)]">
        {brand.name} is ready to go. Head to your dashboard to start managing contacts, launching campaigns, and growing your business.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3 text-left">
        {[
          { emoji: '📬', title: 'Start a conversation', desc: 'Reach out to your first contact' },
          { emoji: '📣', title: 'Create a campaign', desc: 'Send your first email blast' },
          { emoji: '⚡', title: 'Build an automation', desc: 'Set up a welcome sequence' },
          { emoji: '📊', title: 'View your dashboard', desc: 'Track what matters most' },
        ].map(f => (
          <div
            key={f.title}
            className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-hover)] p-3"
          >
            <div className="text-lg">{f.emoji}</div>
            <p className="mt-1 text-[12px] font-semibold text-[var(--theme-text)]">{f.title}</p>
            <p className="text-[11px] text-[var(--theme-muted)]">{f.desc}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onFinish}
        className="mt-8 flex items-center gap-2 rounded-xl px-8 py-3 text-[15px] font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #000))` }}
      >
        Go to Dashboard
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
      </button>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

function OnboardingWizard() {
  const brand = useBrand()
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)

  const totalSteps = STEPS.length
  const currentStep = STEPS[stepIndex]
  const progress = Math.round((stepIndex / (totalSteps - 1)) * 100)

  const goNext = () => setStepIndex(i => Math.min(i + 1, totalSteps - 1))
  const goPrev = () => setStepIndex(i => Math.max(i - 1, 0))

  const handleStepComplete = () => goNext()
  const handleSkip = async () => {
    // Mark optional step as skipped (just advance)
    goNext()
  }

  const handleFinish = async () => {
    await completeOnboarding()
    void navigate({ to: '/' })
  }

  const STEP_ICONS = [
    CheckListIcon,
    Settings02Icon,
    UserGroupIcon,
    Mail01Icon,
    UserAdd01Icon,
    CheckmarkCircle01Icon,
  ]

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, ${brand.accentColor} 12%, transparent) 0%, transparent 70%),
          var(--theme-bg-grad, #f9fafb)
        `,
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Card */}
      <div
        className="w-full max-w-lg rounded-3xl border shadow-2xl"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
      >
        {/* Progress bar */}
        <div className="overflow-hidden rounded-t-3xl">
          <div
            className="h-1 transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #000))`,
            }}
          />
        </div>

        <div className="p-8">
          {/* Step indicator + nav */}
          <div className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Step number badge */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${brand.accentColor}, color-mix(in srgb, ${brand.accentColor} 70%, #000))`,
                  boxShadow: `0 2px 10px color-mix(in srgb, ${brand.accentColor} 35%, transparent)`,
                }}
              >
                <HugeiconsIcon icon={STEP_ICONS[stepIndex]} size={18} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
                  Step {stepIndex + 1} of {totalSteps}
                  {currentStep.optional && (
                    <span className="ml-2 rounded-full bg-[var(--theme-hover)] px-2 py-0.5 normal-case tracking-normal">
                      optional
                    </span>
                  )}
                </p>
                <p className="text-[15px] font-bold text-[var(--theme-text)]">{currentStep.title}</p>
              </div>
            </div>

            {/* Dot stepper */}
            <div className="flex gap-1.5">
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: i === stepIndex ? '20px' : '8px',
                    background: i <= stepIndex ? brand.accentColor : 'var(--theme-border)',
                    opacity: i === stepIndex ? 1 : i < stepIndex ? 0.6 : 0.35,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Subtitle */}
          <p className="mb-6 text-[13px] text-[var(--theme-muted)]">{currentStep.subtitle}</p>

          {/* Step content */}
          <div>
            {currentStep.id === 'welcome' && (
              <WelcomeStep brand={brand} onNext={goNext} />
            )}
            {currentStep.id === 'brand-profile' && (
              <BrandProfileStep brand={brand} onComplete={handleStepComplete} />
            )}
            {currentStep.id === 'first-contact' && (
              <FirstContactStep brand={brand} onComplete={handleStepComplete} onSkip={handleSkip} />
            )}
            {currentStep.id === 'email-setup' && (
              <EmailSetupStep brand={brand} onComplete={handleStepComplete} />
            )}
            {currentStep.id === 'invite-team' && (
              <InviteTeamStep brand={brand} onComplete={handleStepComplete} onSkip={handleSkip} />
            )}
            {currentStep.id === 'done' && (
              <DoneStep brand={brand} onFinish={handleFinish} />
            )}
          </div>

          {/* Bottom nav (shown for middle steps that don't have inline Next) */}
          {currentStep.id !== 'welcome' && currentStep.id !== 'done' &&
           currentStep.id !== 'brand-profile' && currentStep.id !== 'first-contact' &&
           currentStep.id !== 'email-setup' && currentStep.id !== 'invite-team' && (
            <div className="mt-6 flex items-center justify-between border-t border-[var(--theme-border)] pt-5">
              {stepIndex > 0 ? (
                <button
                  onClick={goPrev}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={15} />
                  Back
                </button>
              ) : <span />}
              <button
                onClick={goNext}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: brand.accentColor }}
              >
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} size={15} />
              </button>
            </div>
          )}

          {/* Back button for steps that have their own next/submit */}
          {(currentStep.id === 'brand-profile' || currentStep.id === 'first-contact' ||
            currentStep.id === 'email-setup' || currentStep.id === 'invite-team') && stepIndex > 0 && (
            <button
              onClick={goPrev}
              className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={13} />
              Back
            </button>
          )}
        </div>
      </div>

      {/* Skip entire wizard */}
      {currentStep.id !== 'done' && (
        <button
          onClick={handleFinish}
          className="mt-5 flex items-center gap-1.5 text-[12px] text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} />
          Skip setup, go to dashboard
        </button>
      )}
    </div>
  )
}
