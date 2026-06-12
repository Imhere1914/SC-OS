import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Team store — team member management. File-backed JSON, atomic writes.
 * Data dir: AIOS_DATA_DIR or ~/.ai-os. Postgres-swappable later.
 */

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface TeamMember {
  id: string
  brand?: string
  name: string
  email?: string
  role: TeamRole
  department?: string
  avatar_color?: string  // hex color for initials avatar
  phone?: string
  notes?: string
  active: boolean
  created_at: string
  updated_at: string
}

export type CreateTeamMemberInput = Partial<TeamMember> & { name: string }
type UpdateTeamMemberInput = Partial<Omit<TeamMember, 'id' | 'created_at'>>

type TeamFile = { members: TeamMember[] }

const DATA_DIR =
  process.env.AIOS_DATA_DIR ?? path.join(os.homedir(), '.ai-os')
const BRAND = process.env.BRAND ?? 'default'
const MAX_MEMBERS = 50

const ROLES: TeamRole[] = ['owner', 'admin', 'member', 'viewer']

export function isTeamRole(v: unknown): v is TeamRole {
  return typeof v === 'string' && ROLES.includes(v as TeamRole)
}

function dbPath(brand?: string): string {
  const b = brand ?? BRAND
  const fileName = b === 'default' ? 'team.json' : `team-${b}.json`
  return path.join(DATA_DIR, fileName)
}

function readJson(filePath: string): TeamFile {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(filePath))
    fs.writeFileSync(filePath, JSON.stringify({ members: [] }, null, 2) + '\n', 'utf-8')
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').trim()
    if (!raw) return { members: [] }
    const p = JSON.parse(raw) as Partial<TeamFile>
    return { members: Array.isArray(p.members) ? p.members : [] }
  } catch {
    return { members: [] }
  }
}

function writeJson(filePath: string, data: TeamFile): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, filePath)
}

function normalize(m: Partial<TeamMember> & Pick<TeamMember, 'id' | 'name' | 'created_at' | 'updated_at'>): TeamMember {
  return {
    id: m.id,
    brand: typeof m.brand === 'string' ? m.brand : BRAND,
    name: m.name,
    email: typeof m.email === 'string' ? m.email : undefined,
    role: isTeamRole(m.role) ? m.role : 'member',
    department: typeof m.department === 'string' ? m.department : undefined,
    avatar_color: typeof m.avatar_color === 'string' ? m.avatar_color : undefined,
    phone: typeof m.phone === 'string' ? m.phone : undefined,
    notes: typeof m.notes === 'string' ? m.notes : undefined,
    active: m.active !== false,
    created_at: m.created_at,
    updated_at: m.updated_at,
  }
}

export function listTeamMembers(brand?: string): TeamMember[] {
  const file = readJson(dbPath(brand))
  return file.members
    .map((m) => normalize(m as TeamMember))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getTeamMember(id: string, brand?: string): TeamMember | null {
  return readJson(dbPath(brand)).members
    .map((m) => normalize(m as TeamMember))
    .find((m) => m.id === id) ?? null
}

export function createTeamMember(data: CreateTeamMemberInput): TeamMember {
  const filePath = dbPath(data.brand)
  const file = readJson(filePath)
  if (file.members.length >= MAX_MEMBERS) {
    throw new Error(`Team member limit of ${MAX_MEMBERS} reached`)
  }
  const now = new Date().toISOString()
  const member = normalize({
    id: randomUUID(),
    brand: data.brand ?? BRAND,
    name: data.name,
    email: data.email,
    role: data.role,
    department: data.department,
    avatar_color: data.avatar_color,
    phone: data.phone,
    notes: data.notes,
    active: data.active !== false,
    created_at: now,
    updated_at: now,
  })
  file.members.push(member)
  writeJson(filePath, { members: file.members.map((m) => normalize(m as TeamMember)) })
  return member
}

export function updateTeamMember(id: string, updates: UpdateTeamMemberInput, brand?: string): TeamMember | null {
  const filePath = dbPath(brand)
  const file = readJson(filePath)
  const i = file.members.findIndex((m) => m.id === id)
  if (i === -1) return null
  const current = normalize(file.members[i] as TeamMember)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    name: typeof updates.name === 'string' ? updates.name : current.name,
  })
  file.members[i] = next
  writeJson(filePath, { members: file.members.map((m) => normalize(m as TeamMember)) })
  return next
}

export function deleteTeamMember(id: string, brand?: string): boolean {
  const filePath = dbPath(brand)
  const file = readJson(filePath)
  const next = file.members.filter((m) => m.id !== id)
  if (next.length === file.members.length) return false
  writeJson(filePath, { members: next.map((m) => normalize(m as TeamMember)) })
  return true
}

export const TEAM_ROLES = ROLES
