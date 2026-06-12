export type AgentRole = 'scheduler' | 'outreach' | 'bookkeeper' | 'content' | 'researcher' | 'dispatcher' | 'intake' | 'custom'
export type TaskStatus = 'queued' | 'running' | 'review' | 'done' | 'failed'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface AgentDef {
  id: string
  role: AgentRole
  name: string
  description: string
  capabilities: string[]
  avatar_emoji: string
  active: boolean
  created_at: string
}

export interface AgentTask {
  id: string
  agent_id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  result?: string
  error?: string
  parent_task_id?: string
  created_at: string
  started_at?: string
  completed_at?: string
  metadata?: Record<string, unknown>
}

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export const fetchAgents = () => api<AgentDef[]>('/api/agents')
export const fetchAgent = (id: string) => api<AgentDef>(`/api/agents/${id}`)
export const createAgent = (data: Partial<AgentDef>) => api<AgentDef>('/api/agents', { method: 'POST', body: JSON.stringify(data) })
export const updateAgent = (id: string, data: Partial<AgentDef>) => api<AgentDef>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const fetchTasks = (params?: { agent_id?: string; status?: TaskStatus; parent_task_id?: string }) => {
  const q = new URLSearchParams()
  if (params?.agent_id) q.set('agent_id', params.agent_id)
  if (params?.status) q.set('status', params.status)
  if (params?.parent_task_id) q.set('parent_task_id', params.parent_task_id)
  return api<AgentTask[]>(`/api/agents/tasks?${q}`)
}

export const fetchTaskStats = () => api<Record<TaskStatus, number>>('/api/agents/tasks/stats')
export const createTask = (data: Partial<AgentTask>) => api<AgentTask>('/api/agents/tasks', { method: 'POST', body: JSON.stringify(data) })
export const updateTask = (id: string, data: Partial<AgentTask>) => api<AgentTask>(`/api/agents/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteTask = (id: string) => api<{ ok: boolean }>(`/api/agents/tasks/${id}`, { method: 'DELETE' })

export const orchestrate = (goal: string, context?: string) =>
  api<{ parent: AgentTask; tasks: AgentTask[]; plan: unknown[] }>('/api/agents/orchestrate', {
    method: 'POST',
    body: JSON.stringify({ goal, context }),
  })
