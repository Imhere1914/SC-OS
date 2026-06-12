import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listTeamMembers,
  createTeamMember,
  updateTeamMember,
  type TeamMember,
  type TeamMemberRole,
  type CreateTeamMemberInput,
} from '../lib/team-api'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { Add01Icon, Cancel01Icon, Mail01Icon, PencilEdit02Icon, UserAdd01Icon, UserGroupIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/team')({ component: TeamPage })

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT_GRADIENT =
  'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const ROLES: { id: TeamMemberRole; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'member', label: 'Member' },
  { id: 'viewer', label: 'Viewer' },
]

const ROLE_COLORS: Record<TeamMemberRole, string> = {
  owner: '#8b5cf6',
  admin: '#3b82f6',
  member: '#10b981',
  viewer: '#94a3b8',
}

// Avatar color palette — cycles by index when avatar_color not set
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#f43f5e', '#14b8a6',
]

function avatarColor(member: TeamMember, index: number): string {
  if (member.avatar_color) return member.avatar_color
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

// Colored dot + tinted pill badge
function RoleBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

// ── Team member modal ─────────────────────────────────────────────────────────

function TeamMemberModal({
  initial,
  onClose,
  onSave,
  isSaving,
}: {
  initial?: TeamMember
  onClose: () => void
  onSave: (data: CreateTeamMemberInput) => void
  isSaving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [role, setRole] = useState<TeamMemberRole>(initial?.role ?? 'member')
  const [department, setDepartment] = useState(initial?.department ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const canSave = name.trim()

  const fieldCls =
    'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]'
  const sectionLabelCls =
    'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={initial ? PencilEdit02Icon : UserAdd01Icon} size={17} />
            </span>
            <div>
              <h2 className="font-bold text-[var(--theme-text)]">
                {initial ? 'Edit team member' : 'Add team member'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">
                {initial ? 'Update profile and role' : 'Invite someone to your workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-all duration-150 hover:bg-[var(--theme-hover)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--theme-muted)]" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className={sectionLabelCls}>Profile</label>
            <div className="space-y-3">
              <input
                placeholder="Full name *"
                value={name}
                onChange={e => setName(e.target.value)}
                className={fieldCls}
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>
          <div>
            <label className={sectionLabelCls}>Role &amp; department</label>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={role}
                onChange={e => setRole(e.target.value as TeamMemberRole)}
                className={fieldCls}
              >
                {ROLES.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Department"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>
          <div>
            <label className={sectionLabelCls}>Contact</label>
            <input
              type="tel"
              placeholder="Phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label className={sectionLabelCls}>Notes</label>
            <textarea
              rows={2}
              placeholder="Notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className={`${fieldCls} resize-y`}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]"
          >
            Cancel
          </button>
          <button
            disabled={!canSave || isSaving}
            onClick={() =>
              onSave({
                name: name.trim(),
                email: email.trim() || undefined,
                role,
                department: department.trim() || undefined,
                phone: phone.trim() || undefined,
                notes: notes.trim() || undefined,
              })
            }
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  member,
  index,
  onEdit,
  onToggleActive,
}: {
  member: TeamMember
  index: number
  onEdit: () => void
  onToggleActive: () => void
}) {
  const color = avatarColor(member, index)
  const roleLabel = ROLES.find(r => r.id === member.role)?.label ?? member.role

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-2xl border bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md ${
        !member.active ? 'opacity-50' : ''
      }`}
      style={{ borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      {/* Edit button — revealed on hover */}
      <button
        onClick={onEdit}
        title="Edit"
        className="absolute right-3 top-3 rounded-lg p-1.5 opacity-0 transition-all duration-150 hover:bg-[var(--theme-hover)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <HugeiconsIcon icon={PencilEdit02Icon} size={14} className="text-[var(--theme-muted)]" />
      </button>

      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 38%, transparent)`,
          }}
        >
          {initials(member.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--theme-text)]">{member.name}</p>
          {member.department && (
            <p className="truncate text-xs text-[var(--theme-muted)]">{member.department}</p>
          )}
        </div>
      </div>

      {/* Role badge */}
      <div className="flex items-center gap-2">
        <RoleBadge color={ROLE_COLORS[member.role]} label={roleLabel} />
        {!member.active && <RoleBadge color="#94a3b8" label="Inactive" />}
      </div>

      {/* Email */}
      {member.email && (
        <p className="flex items-center gap-1.5 truncate text-xs text-[var(--theme-muted)]">
          <HugeiconsIcon icon={Mail01Icon} size={12} className="shrink-0" />
          <span className="truncate">{member.email}</span>
        </p>
      )}

      {/* Deactivate / Reactivate */}
      <button
        onClick={onToggleActive}
        className="mt-auto w-full rounded-lg border py-1.5 text-xs font-semibold transition-all duration-150"
        style={
          member.active
            ? {
                borderColor: 'color-mix(in srgb, #ef4444 30%, transparent)',
                color: '#ef4444',
                background: 'color-mix(in srgb, #ef4444 6%, var(--theme-card))',
              }
            : {
                borderColor: 'color-mix(in srgb, #10b981 30%, transparent)',
                color: '#10b981',
                background: 'color-mix(in srgb, #10b981 6%, var(--theme-card))',
              }
        }
      >
        {member.active ? 'Deactivate' : 'Reactivate'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function TeamPage() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<TeamMember | null | undefined>(undefined)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team', brand.id],
    queryFn: () => listTeamMembers(brand.id !== 'default' ? brand.id : undefined),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTeamMemberInput) => createTeamMember(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team', brand.id] })
      setEditing(undefined)
      toast('Team member added')
    },
    onError: (err: Error) => toast(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTeamMember>[1] }) =>
      updateTeamMember(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['team', brand.id] })
      setEditing(undefined)
      toast('Team member updated')
    },
    onError: (err: Error) => toast(err.message),
  })

  function handleSave(data: CreateTeamMemberInput) {
    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate({
        ...data,
        brand: brand.id !== 'default' ? brand.id : undefined,
      })
    }
  }

  function handleToggleActive(member: TeamMember) {
    updateMutation.mutate({ id: member.id, data: { active: !member.active } })
    toast(member.active ? `${member.name} deactivated` : `${member.name} reactivated`)
  }

  const activeCount = members.filter(m => m.active).length

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={UserGroupIcon} size={19} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[var(--theme-text)]">Team</h1>
            <p className="mt-0.5 text-sm text-[var(--theme-muted)]">
              {members.length > 0
                ? `${activeCount} active member${activeCount !== 1 ? 's' : ''}`
                : 'Manage your team members and their roles'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} />
          Add member
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl"
              style={{ background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }}
            />
          ))}
        </div>
      ) : members.length === 0 ? (
        // Empty state
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, var(--theme-accent) 6%, var(--theme-card)))',
            }}
          >
            <HugeiconsIcon icon={UserGroupIcon} size={28} className="text-[var(--theme-accent)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--theme-text)]">No team members yet</p>
          <p className="max-w-xs text-xs text-[var(--theme-muted)]">
            Add your first team member to start collaborating and assigning roles.
          </p>
          <button
            onClick={() => setEditing(null)}
            className="mt-1 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Add01Icon} size={15} />
            Add member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {members.map((member, i) => (
            <MemberCard
              key={member.id}
              member={member}
              index={i}
              onEdit={() => setEditing(member)}
              onToggleActive={() => handleToggleActive(member)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {editing !== undefined && (
        <TeamMemberModal
          initial={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}
