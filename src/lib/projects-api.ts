/**
 * Projects API client — /api/projects routes.
 */

const API = '/api/projects'

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'
export type ProjectPriority = 'high' | 'medium' | 'low'

export type Project = {
  id: string
  brand: string
  name: string
  description: string
  contact_id: string | null
  contact_name: string | null
  status: ProjectStatus
  priority: ProjectPriority
  progress: number
  due_date: string | null
  owner: string | null
  notes: string
  created_at: string
  updated_at: string
  // Enriched at query time from project tasks
  task_count?: number
  tasks_done?: number
  task_progress?: number | null
}

export type CreateProjectInput = {
  name: string
  description?: string
  contact_id?: string | null
  contact_name?: string | null
  status?: ProjectStatus
  priority?: ProjectPriority
  progress?: number
  due_date?: string | null
  notes?: string
  brand?: string
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, 'brand'>>

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'var(--theme-accent)',
  on_hold: 'var(--theme-warning)',
  completed: 'var(--theme-success)',
  cancelled: 'var(--theme-muted)',
}

export const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  high: 'var(--theme-danger)',
  medium: 'var(--theme-warning)',
  low: 'var(--theme-muted)',
}

export async function fetchProjects(params?: {
  status?: string
  brand?: string
  contact_id?: string
}): Promise<Project[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.brand) qs.set('brand', params.brand)
  if (params?.contact_id) qs.set('contact_id', params.contact_id)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load projects (${res.status})`)
  const data = (await res.json()) as { projects?: Project[] }
  return Array.isArray(data.projects) ? data.projects : []
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create project (${res.status})`)
  }
  const data = (await res.json()) as { project: Project }
  return data.project
}

export async function updateProject(
  id: string,
  updates: UpdateProjectInput,
): Promise<Project> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update project (${res.status})`)
  }
  const data = (await res.json()) as { project: Project }
  return data.project
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete project (${res.status})`)
}
