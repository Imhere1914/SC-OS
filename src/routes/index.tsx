import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiBrain01Icon,
  AiMagicIcon,
  Briefcase01Icon,
  Calendar01Icon,
  Chat01Icon,
  Copy01Icon,
  FlowSquareIcon,
  ImageAdd01Icon,
  Layout01Icon,
  Mail01Icon,
  Money01Icon,
  PlugSocketIcon,
  Share04Icon,
  StarIcon,
  Target02Icon,
  TaskEdit01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { fetchContacts } from '@/lib/contacts-api'
import { fetchHighlights } from '@/lib/highlights-api'
import { fetchStats } from '@/lib/stats-api'

export const Route = createFileRoute('/')({ component: Dashboard })

const TILES = [
  { to: '/conversations', label: 'Conversations', icon: Chat01Icon,     desc: 'Unified inbox' },
  { to: '/contacts',      label: 'Contacts',      icon: UserGroupIcon,  desc: 'Your CRM' },
  { to: '/appointments',  label: 'Appointments',  icon: Calendar01Icon, desc: 'Bookings' },
  { to: '/scheduling',    label: 'Scheduling',    icon: Calendar01Icon, desc: 'Availability & booking' },
  { to: '/forms',         label: 'Forms',         icon: TaskEdit01Icon, desc: 'Lead capture' },
  { to: '/social',        label: 'Social',        icon: Share04Icon,    desc: 'Plan & publish' },
  { to: '/campaigns',     label: 'Campaigns',     icon: Mail01Icon,     desc: 'Email marketing' },
  { to: '/pages',         label: 'Pages',         icon: Layout01Icon,   desc: 'Landing pages' },
  { to: '/templates',     label: 'Templates',     icon: Copy01Icon,     desc: 'Reusable content' },
  { to: '/projects',      label: 'Projects',      icon: Briefcase01Icon,desc: 'Client work' },
  { to: '/payments',      label: 'Payments',      icon: Money01Icon,    desc: 'Invoices & billing' },
  { to: '/automations',   label: 'Automations',   icon: FlowSquareIcon, desc: 'Rules & workflows' },
  { to: '/strategy',      label: 'Strategy',      icon: Target02Icon,   desc: 'OKRs & decisions' },
  { to: '/media',         label: 'Media Studio',  icon: ImageAdd01Icon, desc: 'Image & video gen' },
  { to: '/knowledge',     label: 'Knowledge Vault',icon: AiBrain01Icon, desc: 'Brand memory' },
  { to: '/avatars',       label: 'Avatars',       icon: UserCircleIcon, desc: 'Voice + chat identity' },
  { to: '/plugins',       label: 'Plugins',       icon: PlugSocketIcon, desc: 'Integrations' },
  { to: '/highlights',    label: 'Highlights',    icon: StarIcon,       desc: 'What\'s going on' },
]

function StatCard({ label, value, sub, to }: { label: string; value: string | number; sub?: string; to?: string }) {
  const inner = (
    <div
      className="flex flex-col rounded-xl border p-3.5 transition-all hover:shadow-sm"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(12px)' }}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--theme-muted)]">{label}</span>
      <span className="mt-1 text-[22px] font-bold leading-none text-[var(--theme-text)]">{value}</span>
      {sub && <span className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{sub}</span>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function Dashboard() {
  const brand = useBrand()
  const contactsQuery = useQuery({ queryKey: ['dash', 'contacts'], queryFn: () => fetchContacts() })
  const highlightsQuery = useQuery({ queryKey: ['dash', 'highlights'], queryFn: () => fetchHighlights(brand.id) })
  const statsQuery = useQuery({ queryKey: ['dash', 'stats', brand.id], queryFn: () => fetchStats(brand.id) })

  const contactCount = contactsQuery.data?.length ?? 0
  const attentionCount = highlightsQuery.data?.attention ?? 0
  const stats = statsQuery.data

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1060px] px-6 py-8">

        {/* ── Hero ────────────────────────────────────────────── */}
        <div
          className="relative mb-6 overflow-hidden rounded-2xl p-7"
          style={{
            background: `
              radial-gradient(ellipse 65% 80% at 0% 50%, color-mix(in srgb, ${brand.accentColor} 28%, transparent) 0%, transparent 70%),
              radial-gradient(ellipse 45% 60% at 100% 0%, color-mix(in srgb, ${brand.accentColor} 18%, #a855f7 60%) 0%, transparent 65%),
              linear-gradient(140deg, color-mix(in srgb, ${brand.accentColor} 88%, #000) 0%, color-mix(in srgb, ${brand.accentColor} 55%, #1e0a30) 100%)
            `,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)`, backgroundSize: '22px 22px' }}
          />
          <div className="relative z-10">
            <p className="text-[13px] font-medium text-white/70">{greeting}</p>
            <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-white">{brand.name}</h1>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/75">
              Your AI-native operating system — contacts, conversations, campaigns, and content, with an AI assistant woven through it all.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/chat"
                className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/28 hover:shadow-lg"
              >
                <HugeiconsIcon icon={AiMagicIcon} size={15} />
                Open Assistant
              </Link>
              {attentionCount > 0 && (
                <Link
                  to="/highlights"
                  className="flex items-center gap-2 rounded-xl bg-white/12 px-4 py-2 text-[13px] font-medium text-white/90 backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white/90" />
                  {attentionCount} need attention
                </Link>
              )}
              <Link
                to="/contacts"
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[13px] font-medium text-white/80 backdrop-blur-sm transition-all hover:bg-white/18"
              >
                {contactCount} contacts
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stats strip ──────────────────────────────────────── */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <StatCard label="Pipeline" value={stats.pipeline.lead + stats.pipeline.contacted + stats.pipeline.qualified} sub="active leads" to="/contacts" />
            <StatCard label="Unread" value={stats.conversations.unread} sub="conversations" to="/conversations" />
            <StatCard label="This week" value={stats.appointments.thisWeek} sub="appointments" to="/appointments" />
            <StatCard label="Scheduled" value={stats.social.scheduled} sub="social posts" to="/social" />
            <StatCard label="Campaigns" value={stats.campaigns.sent} sub={stats.campaigns.deliveryRate != null ? `${stats.campaigns.deliveryRate}% delivered` : 'no sends yet'} to="/campaigns" />
            <StatCard label="Projects" value={stats.projects.active} sub="active" to="/projects" />
            <StatCard label="Revenue" value={`$${(stats.payments?.paid ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} sub={`$${(stats.payments?.outstanding ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} outstanding`} to="/payments" />
            <StatCard label="Forms" value={stats.forms?.active ?? 0} sub={`${stats.forms?.total ?? 0} total`} to="/forms" />
          </div>
        )}

        {/* ── Module tiles ─────────────────────────────────────── */}
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--theme-muted)] opacity-75">
          Workspace
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TILES.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group relative overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
              style={{ background: 'var(--theme-card)', backdropFilter: 'blur(12px)', borderColor: 'var(--theme-border)' }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ background: 'var(--theme-hover)' }} />
              <div className="relative z-10">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105" style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}>
                  <HugeiconsIcon icon={t.icon} size={16} strokeWidth={1.8} />
                </div>
                <div className="text-[13px] font-semibold leading-tight text-[var(--theme-text)]">{t.label}</div>
                <div className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{t.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
