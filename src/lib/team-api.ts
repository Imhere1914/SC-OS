const API = '/api/team'

export type TeamMemberRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface TeamMember {
  id: string
  brand?: string
  name: string
  email?: string
  role: TeamMemberRole
  department?: string
  avatar_color?: string
  phone?: string
  notes?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface CreateTeamMemberInput {
  brand?: string
  name: string
  email?: string
  role: TeamMemberRole
  department?: string
  phone?: string
  notes?: string
}

export interface UpdateTeamMemberInput extends Partial<CreateTeamMemberInput> {
  active?: boolean
}

export async function listTeamMembers(brand?: string): Promise<TeamMember[]> {
  const url = brand ? `${API}?brand=${brand}` : API
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load team members (${res.status})`)
  const d = (await res.json()) as { team_members?: TeamMember[] }
  return d.team_members ?? []
}

export async function createTeamMember(input: CreateTeamMemberInput): Promise<TeamMember> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(e.error || `Failed to create team member (${res.status})`)
  }
  const d = (await res.json()) as { team_member?: TeamMember } & TeamMember
  return d.team_member ?? (d as TeamMember)
}

export async function updateTeamMember(id: string, updates: UpdateTeamMemberInput): Promise<TeamMember> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(e.error || `Failed to update team member (${res.status})`)
  }
  const d = (await res.json()) as { team_member?: TeamMember } & TeamMember
  return d.team_member ?? (d as TeamMember)
}

export async function deleteTeamMember(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete team member (${res.status})`)
}
