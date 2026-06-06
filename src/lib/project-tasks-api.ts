/** Project tasks API client */

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'var(--theme-muted)',
  in_progress: 'var(--theme-accent)',
  review: 'var(--theme-warning)',
  done: 'var(--theme-success)',
}

export type Subtask = { id: string; title: string; done: boolean }

export type ProjectTask = {
  id: string
  project_id: string
  brand: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string | null
  due_date: string | null
  subtasks: Subtask[]
  created_at: string
  updated_at: string
}

export async function fetchTasksForProject(projectId: string): Promise<ProjectTask[]> {
  const res = await fetch(`/api/projects/${projectId}/tasks`)
  if (!res.ok) throw new Error('Failed to load tasks')
  return (await res.json()).tasks
}

export async function createTask(projectId: string, input: { title: string; description?: string; priority?: TaskPriority; assignee?: string | null; due_date?: string | null }): Promise<ProjectTask> {
  const res = await fetch(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Create failed')
  return (await res.json()).task
}

export async function updateTask(projectId: string, taskId: string, patch: Partial<{ title: string; description: string; status: TaskStatus; priority: TaskPriority; assignee: string | null; due_date: string | null }>): Promise<ProjectTask> {
  const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Update failed')
  return (await res.json()).task
}

export async function addSubtask(projectId: string, taskId: string, title: string): Promise<ProjectTask> {
  const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}?action=add-subtask`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('Failed')
  return (await res.json()).task
}

export async function toggleSubtask(projectId: string, taskId: string, subtaskId: string): Promise<ProjectTask> {
  const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}?action=toggle-subtask`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtask_id: subtaskId }),
  })
  if (!res.ok) throw new Error('Failed')
  return (await res.json()).task
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}
