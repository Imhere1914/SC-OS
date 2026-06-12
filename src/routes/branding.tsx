import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  PaintBoardIcon,
  Mail01Icon,
  DocumentValidationIcon,
  Shield01Icon,
  Upload01Icon,
  CheckmarkCircle02Icon,
  Globe02Icon,
  Call02Icon,
  Building01Icon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { ScreenShell } from '@/components/screen-shell'

export const Route = createFileRoute('/branding')({ component: BrandingScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

interface SocialLinks {
  facebook?: string
  twitter?: string
  instagram?: string
  linkedin?: string
  youtube?: string
}

interface BusinessAddress {
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

interface BrandingProfile {
  brand: string
  business_name: string
  tagline: string
  description: string
  logo_url: string
  favicon_url: string
  primary_color: string
  secondary_color: string
  accent_color: string
  email_header_html: string
  email_footer_html: string
  email_from_name: string
  email_reply_to: string
  sms_sender_name: string
  website_url: string
  address: BusinessAddress
  phone: string
  social_links: SocialLinks
  timezone: string
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD'
  date_format: string
  invoice_prefix: string
  invoice_next_number: number
  proposal_prefix: string
  contract_prefix: string
  terms_and_conditions: string
  privacy_policy_url: string
  created_at: string
  updated_at: string
}

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string }
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

// ── Input field helper ────────────────────────────────────────────────────────

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">{label}</label>
      {children}
      {hint && <p className="mt-0.5 text-[10px] text-[var(--theme-muted)]">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

const textareaCls =
  'w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'

// ── Color picker field ────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      className="rounded-xl border p-3 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      style={{
        background: 'var(--theme-card)',
        borderColor: `color-mix(in srgb, ${value} 30%, var(--theme-border))`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <label className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: value }} />
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--theme-border)] bg-transparent p-0.5"
        />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-[13px] font-mono text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        />
      </div>
    </div>
  )
}

// ── Save button ───────────────────────────────────────────────────────────────

function SaveBar({
  isPending,
  onSave,
}: {
  isPending: boolean
  onSave: () => void
}) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        onClick={onSave}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
        style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
      >
        {isPending ? (
          'Saving…'
        ) : (
          <>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
            Save Changes
          </>
        )}
      </button>
    </div>
  )
}

// ── Tab: Business Profile ────────────────────────────────────────────────────

function BusinessProfileTab({
  profile,
  brandId,
}: {
  profile: BrandingProfile
  brandId: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<{
    business_name: string
    tagline: string
    description: string
    website_url: string
    phone: string
    timezone: string
    currency: BrandingProfile['currency']
    address: BusinessAddress
    social_links: SocialLinks
  }>({
    business_name: profile.business_name,
    tagline: profile.tagline,
    description: profile.description,
    website_url: profile.website_url,
    phone: profile.phone,
    timezone: profile.timezone,
    currency: profile.currency,
    address: { ...profile.address },
    social_links: { ...profile.social_links },
  })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const setAddr = (k: keyof BusinessAddress, v: string) =>
    setForm(f => ({ ...f, address: { ...f.address, [k]: v } }))

  const setSocial = (k: keyof SocialLinks, v: string) =>
    setForm(f => ({ ...f, social_links: { ...f.social_links, [k]: v } }))

  const mutation = useMutation({
    mutationFn: (data: Partial<BrandingProfile>) =>
      apiFetch<BrandingProfile>(`/api/branding?brand=${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand: brandId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branding', brandId] })
      toast('Business profile saved')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
    'Australia/Sydney', 'Pacific/Auckland',
  ]

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Basic Info
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Business Name *">
            <input
              value={form.business_name}
              onChange={e => set('business_name', e.target.value)}
              placeholder="Acme Corp"
              className={inputCls}
            />
          </Field>
          <Field label="Tagline">
            <input
              value={form.tagline}
              onChange={e => set('tagline', e.target.value)}
              placeholder="Building better futures"
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Brief description of your business…"
              className={textareaCls}
            />
          </Field>
        </div>
      </section>

      {/* Contact & web */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Contact & Web
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Website URL">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]">
                <HugeiconsIcon icon={Globe02Icon} size={13} />
              </span>
              <input
                value={form.website_url}
                onChange={e => set('website_url', e.target.value)}
                placeholder="https://acmecorp.com"
                className={inputCls + ' pl-8'}
              />
            </div>
          </Field>
          <Field label="Phone">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]">
                <HugeiconsIcon icon={Call02Icon} size={13} />
              </span>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
                className={inputCls + ' pl-8'}
              />
            </div>
          </Field>
        </div>
      </section>

      {/* Address */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon icon={Building01Icon} size={12} />
            Address
          </span>
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Street">
              <input
                value={form.address.street ?? ''}
                onChange={e => setAddr('street', e.target.value)}
                placeholder="123 Main St"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="City">
            <input
              value={form.address.city ?? ''}
              onChange={e => setAddr('city', e.target.value)}
              placeholder="New York"
              className={inputCls}
            />
          </Field>
          <Field label="State / Province">
            <input
              value={form.address.state ?? ''}
              onChange={e => setAddr('state', e.target.value)}
              placeholder="NY"
              className={inputCls}
            />
          </Field>
          <Field label="ZIP / Postal Code">
            <input
              value={form.address.zip ?? ''}
              onChange={e => setAddr('zip', e.target.value)}
              placeholder="10001"
              className={inputCls}
            />
          </Field>
          <Field label="Country">
            <input
              value={form.address.country ?? ''}
              onChange={e => setAddr('country', e.target.value)}
              placeholder="United States"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* Locale */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Locale
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Timezone">
            <select
              value={form.timezone}
              onChange={e => set('timezone', e.target.value)}
              className={inputCls}
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select
              value={form.currency}
              onChange={e => set('currency', e.target.value as BrandingProfile['currency'])}
              className={inputCls}
            >
              {(['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Social links */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Social Links
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(['facebook', 'twitter', 'instagram', 'linkedin', 'youtube'] as const).map(platform => (
            <Field key={platform} label={platform.charAt(0).toUpperCase() + platform.slice(1)}>
              <input
                value={form.social_links[platform] ?? ''}
                onChange={e => setSocial(platform, e.target.value)}
                placeholder={`https://${platform}.com/yourpage`}
                className={inputCls}
              />
            </Field>
          ))}
        </div>
      </section>

      <SaveBar
        isPending={mutation.isPending}
        onSave={() => mutation.mutate(form)}
      />
    </div>
  )
}

// ── Tab: Visual Identity ─────────────────────────────────────────────────────

function VisualIdentityTab({
  profile,
  brandId,
}: {
  profile: BrandingProfile
  brandId: string
}) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState(profile.logo_url)
  const [form, setForm] = useState({
    favicon_url: profile.favicon_url,
    primary_color: profile.primary_color,
    secondary_color: profile.secondary_color,
    accent_color: profile.accent_color,
  })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: (data: Partial<BrandingProfile>) =>
      apiFetch<BrandingProfile>(`/api/branding?brand=${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand: brandId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branding', brandId] })
      toast('Visual identity saved')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const uploadLogo = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch(`/api/branding/upload-logo?brand=${brandId}`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string }
        throw new Error(err.error ?? 'Upload failed')
      }
      const data = await res.json() as { logo_url: string }
      setLogoPreview(data.logo_url + '?t=' + Date.now())
      void qc.invalidateQueries({ queryKey: ['branding', brandId] })
      toast('Logo uploaded')
    } catch (e) {
      toast((e as Error).message, { type: 'error' })
    } finally {
      setUploading(false)
    }
  }, [brandId, qc])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void uploadLogo(file)
  }, [uploadLogo])

  return (
    <div className="space-y-6">
      {/* Logo upload */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Logo
        </h3>
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all duration-150 md:w-64',
              dragOver && 'bg-[var(--theme-accent-soft)]',
              !dragOver && 'hover:bg-[var(--theme-hover)]',
            )}
            style={{
              borderColor: dragOver
                ? 'var(--theme-accent)'
                : 'color-mix(in srgb, var(--theme-accent) 45%, var(--theme-border))',
            }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
              }}
            >
              <HugeiconsIcon icon={Upload01Icon} size={18} />
            </span>
            <p className="text-[12px] text-[var(--theme-muted)]">
              {uploading ? 'Uploading…' : 'Drop logo or click to browse'}
            </p>
            <p className="text-[10px] text-[var(--theme-muted)]">PNG, JPG, SVG, WebP</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void uploadLogo(f) }}
          />

          {/* Preview */}
          {logoPreview && (
            <div
              className="flex h-32 w-64 items-center justify-center rounded-xl border p-4"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}
            >
              <img
                src={logoPreview}
                alt="Logo preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </div>
      </section>

      {/* Favicon */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Favicon
        </h3>
        <Field label="Favicon URL" hint="Link to a .ico, .png, or .svg file">
          <input
            value={form.favicon_url}
            onChange={e => set('favicon_url', e.target.value)}
            placeholder="https://example.com/favicon.ico"
            className={inputCls}
          />
        </Field>
      </section>

      {/* Color pickers */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Brand Colors
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <ColorField
            label="Primary Color"
            value={form.primary_color}
            onChange={v => set('primary_color', v)}
          />
          <ColorField
            label="Secondary Color"
            value={form.secondary_color}
            onChange={v => set('secondary_color', v)}
          />
          <ColorField
            label="Accent Color"
            value={form.accent_color}
            onChange={v => set('accent_color', v)}
          />
        </div>
      </section>

      {/* Live preview */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Live Preview
        </h3>
        <div
          className="overflow-hidden rounded-2xl border shadow-sm"
          style={{
            borderColor: 'color-mix(in srgb, var(--theme-accent) 30%, var(--theme-border))',
            boxShadow: '0 4px 16px color-mix(in srgb, var(--theme-accent) 12%, transparent)',
          }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-2"
            style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
              Sidebar preview
            </span>
            <span className="flex gap-1">
              {[form.primary_color, form.secondary_color, form.accent_color].map((c, i) => (
                <span key={i} className="h-2 w-2 rounded-full" style={{ background: c }} />
              ))}
            </span>
          </div>
          {/* Mock sidebar header */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: form.primary_color + '18', borderBottom: `1px solid ${form.primary_color}30` }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`,
                boxShadow: `0 2px 10px ${form.primary_color}40`,
              }}
            >
              AB
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--theme-text)]">Your Brand</div>
              <div className="text-[10px] text-[var(--theme-muted)]">AI Operating System</div>
            </div>
          </div>
          {/* Mock nav items */}
          <div
            className="px-2.5 py-3 space-y-1"
            style={{ background: form.primary_color + '08' }}
          >
            {['Dashboard', 'Contacts', 'Conversations'].map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                style={
                  i === 0
                    ? { background: form.accent_color + '22', color: form.accent_color }
                    : { color: 'var(--theme-muted)' }
                }
              >
                <span
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-[11px]"
                  style={
                    i === 0
                      ? {
                          background: `linear-gradient(135deg, ${form.accent_color}, ${form.secondary_color})`,
                          color: 'white',
                        }
                      : { background: 'var(--theme-hover)' }
                  }
                >
                  ●
                </span>
                <span className="text-[13px] font-medium">{item}</span>
              </div>
            ))}
            {/* CTA button preview */}
            <div className="pt-2">
              <div
                className="inline-flex rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
                style={{ background: form.accent_color }}
              >
                + New Contact
              </div>
            </div>
          </div>
        </div>
      </section>

      <SaveBar
        isPending={mutation.isPending}
        onSave={() => mutation.mutate(form)}
      />
    </div>
  )
}

// ── Tab: Email & SMS ─────────────────────────────────────────────────────────

function EmailSmsTab({
  profile,
  brandId,
}: {
  profile: BrandingProfile
  brandId: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    email_from_name: profile.email_from_name,
    email_reply_to: profile.email_reply_to,
    sms_sender_name: profile.sms_sender_name,
    email_header_html: profile.email_header_html,
    email_footer_html: profile.email_footer_html,
  })

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: (data: Partial<BrandingProfile>) =>
      apiFetch<BrandingProfile>(`/api/branding?brand=${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand: brandId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branding', brandId] })
      toast('Email & SMS settings saved')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  return (
    <div className="space-y-6">
      {/* Email settings */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Email Settings
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="From Name" hint="Name shown in recipients' inboxes">
            <input
              value={form.email_from_name}
              onChange={e => set('email_from_name', e.target.value)}
              placeholder="Acme Corp"
              className={inputCls}
            />
          </Field>
          <Field label="Reply-To Address">
            <input
              type="email"
              value={form.email_reply_to}
              onChange={e => set('email_reply_to', e.target.value)}
              placeholder="support@acmecorp.com"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* SMS */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          SMS Settings
        </h3>
        <Field label="SMS Sender Name" hint="Alphanumeric sender ID (max 11 chars, carrier-dependent)">
          <input
            value={form.sms_sender_name}
            maxLength={11}
            onChange={e => set('sms_sender_name', e.target.value)}
            placeholder="AcmeCorp"
            className={inputCls}
          />
        </Field>
      </section>

      {/* Email header */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Email Header HTML
        </h3>
        <textarea
          value={form.email_header_html}
          onChange={e => set('email_header_html', e.target.value)}
          rows={6}
          placeholder="<div style='background:#2f6df6;padding:20px;text-align:center'><img src='logo.png' /></div>"
          className={textareaCls + ' font-mono text-[12px]'}
        />
        {form.email_header_html && (
          <div
            className="mt-2 overflow-hidden rounded-xl border p-4"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
              Header Preview
            </p>
            <div dangerouslySetInnerHTML={{ __html: form.email_header_html }} />
          </div>
        )}
      </section>

      {/* Email footer */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Email Footer HTML
        </h3>
        <textarea
          value={form.email_footer_html}
          onChange={e => set('email_footer_html', e.target.value)}
          rows={6}
          placeholder="<div style='text-align:center;color:#888;font-size:12px'>© 2026 Acme Corp · Unsubscribe</div>"
          className={textareaCls + ' font-mono text-[12px]'}
        />
        {form.email_footer_html && (
          <div
            className="mt-2 overflow-hidden rounded-xl border p-4"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
              Footer Preview
            </p>
            <div dangerouslySetInnerHTML={{ __html: form.email_footer_html }} />
          </div>
        )}
      </section>

      <SaveBar
        isPending={mutation.isPending}
        onSave={() => mutation.mutate(form)}
      />
    </div>
  )
}

// ── Tab: Invoicing & Docs ────────────────────────────────────────────────────

function InvoicingTab({
  profile,
  brandId,
}: {
  profile: BrandingProfile
  brandId: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    invoice_prefix: profile.invoice_prefix,
    invoice_next_number: String(profile.invoice_next_number),
    proposal_prefix: profile.proposal_prefix,
    contract_prefix: profile.contract_prefix,
    date_format: profile.date_format,
  })

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: (data: Partial<BrandingProfile>) =>
      apiFetch<BrandingProfile>(`/api/branding?brand=${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand: brandId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branding', brandId] })
      toast('Invoicing settings saved')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MMM D, YYYY']

  const nextNumber = parseInt(form.invoice_next_number) || 1001

  return (
    <div className="space-y-6">
      {/* Invoice */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Invoice Numbering
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Invoice Prefix" hint={`Preview: ${form.invoice_prefix}${nextNumber}`}>
            <input
              value={form.invoice_prefix}
              onChange={e => set('invoice_prefix', e.target.value)}
              placeholder="INV-"
              className={inputCls}
            />
          </Field>
          <Field label="Next Invoice Number">
            <input
              type="number"
              min={1}
              value={form.invoice_next_number}
              onChange={e => set('invoice_next_number', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* Proposals & Contracts */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Proposals & Contracts
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Proposal Prefix" hint={`e.g. ${form.proposal_prefix}001`}>
            <input
              value={form.proposal_prefix}
              onChange={e => set('proposal_prefix', e.target.value)}
              placeholder="PROP-"
              className={inputCls}
            />
          </Field>
          <Field label="Contract Prefix" hint={`e.g. ${form.contract_prefix}001`}>
            <input
              value={form.contract_prefix}
              onChange={e => set('contract_prefix', e.target.value)}
              placeholder="CONTR-"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* Date format */}
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Date Format
        </h3>
        <div className="flex flex-wrap gap-2">
          {DATE_FORMATS.map(fmt => (
            <button
              key={fmt}
              onClick={() => set('date_format', fmt)}
              className={cn(
                'rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors',
                form.date_format === fmt
                  ? 'text-white border-transparent'
                  : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:border-[var(--theme-accent)]',
              )}
              style={form.date_format === fmt ? { background: 'var(--theme-accent)' } : undefined}
            >
              {fmt}
            </button>
          ))}
        </div>
      </section>

      <SaveBar
        isPending={mutation.isPending}
        onSave={() =>
          mutation.mutate({
            ...form,
            invoice_next_number: parseInt(form.invoice_next_number) || 1001,
          })
        }
      />
    </div>
  )
}

// ── Tab: Legal ───────────────────────────────────────────────────────────────

function LegalTab({
  profile,
  brandId,
}: {
  profile: BrandingProfile
  brandId: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    terms_and_conditions: profile.terms_and_conditions,
    privacy_policy_url: profile.privacy_policy_url,
  })

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: (data: Partial<BrandingProfile>) =>
      apiFetch<BrandingProfile>(`/api/branding?brand=${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, brand: brandId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branding', brandId] })
      toast('Legal settings saved')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Terms & Conditions
        </h3>
        <Field label="Terms and Conditions" hint="Appended to contracts, proposals, and invoices">
          <textarea
            value={form.terms_and_conditions}
            onChange={e => set('terms_and_conditions', e.target.value)}
            rows={12}
            placeholder="1. Payment is due within 30 days…"
            className={textareaCls}
          />
        </Field>
      </section>

      <section>
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
          Privacy Policy
        </h3>
        <Field label="Privacy Policy URL" hint="Link shown in emails and client portal">
          <input
            type="url"
            value={form.privacy_policy_url}
            onChange={e => set('privacy_policy_url', e.target.value)}
            placeholder="https://acmecorp.com/privacy"
            className={inputCls}
          />
        </Field>
      </section>

      <SaveBar
        isPending={mutation.isPending}
        onSave={() => mutation.mutate(form)}
      />
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Tab = 'profile' | 'visual' | 'email-sms' | 'invoicing' | 'legal'

const TABS: { id: Tab; label: string; icon: typeof PaintBoardIcon }[] = [
  { id: 'profile', label: 'Business Profile', icon: Building01Icon },
  { id: 'visual', label: 'Visual Identity', icon: PaintBoardIcon },
  { id: 'email-sms', label: 'Email & SMS', icon: Mail01Icon },
  { id: 'invoicing', label: 'Invoicing & Docs', icon: DocumentValidationIcon },
  { id: 'legal', label: 'Legal', icon: Shield01Icon },
]

function BrandingScreen() {
  const brand = useBrand()
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['branding', brand.id],
    queryFn: () => apiFetch<BrandingProfile>(`/api/branding?brand=${brand.id}`),
  })

  return (
    <ScreenShell
      icon={PaintBoardIcon}
      title="Branding"
      subtitle="Configure your white-label business profile and visual identity"
    >
      {/* Tab bar — segmented control */}
      <div
        className="mb-6 flex w-fit max-w-full overflow-x-auto rounded-xl border p-1 gap-1"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-hover)' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-semibold transition-all duration-150',
              activeTab === tab.id
                ? 'shadow-sm'
                : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
            )}
            style={
              activeTab === tab.id
                ? {
                    background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                    color: 'var(--theme-accent)',
                  }
                : undefined
            }
          >
            <HugeiconsIcon icon={tab.icon} size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border opacity-60"
              style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
            />
          ))}
        </div>
      ) : !profile ? (
        <div className="py-16 text-center text-[13px] text-[var(--theme-muted)]">Failed to load branding profile</div>
      ) : (
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
        >
          {activeTab === 'profile' && (
            <BusinessProfileTab profile={profile} brandId={brand.id} />
          )}
          {activeTab === 'visual' && (
            <VisualIdentityTab profile={profile} brandId={brand.id} />
          )}
          {activeTab === 'email-sms' && (
            <EmailSmsTab profile={profile} brandId={brand.id} />
          )}
          {activeTab === 'invoicing' && (
            <InvoicingTab profile={profile} brandId={brand.id} />
          )}
          {activeTab === 'legal' && (
            <LegalTab profile={profile} brandId={brand.id} />
          )}
        </div>
      )}
    </ScreenShell>
  )
}
