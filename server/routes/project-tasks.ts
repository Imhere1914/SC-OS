import type { Hono } from 'hono'
import { getProject } from '../stores/projects-store'
import {
  addSubtask, createTask, deleteTask, getTask, isTaskStatus,
  listTasksForProject, toggleSubtask, updateTask,
} from '../stores/project-tasks-store'

export function registerProjectTasks(app: Hono): void {
  // List tasks for a project
  app.get('/api/projects/:projectId/tasks', (c) => {
    const project = getProject(c.req.param('projectId'))
    if (!project) return c.json({ error: 'Project not found' }, 404)
    return c.json({ tasks: listTasksForProject(project.id) })
  })

  // Create task
  app.post('/api/projects/:projectId/tasks', async (c) => {
    const project = getProject(c.req.param('projectId'))
    if (!project) return c.json({ error: 'Project not found' }, 404)
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.title !== 'string' || !b.title.trim()) return c.json({ error: 'title is required' }, 400)
    const task = createTask({
      project_id: project.id,
      brand: project.brand,
      title: b.title.trim(),
      description: typeof b.description === 'string' ? b.description : undefined,
      priority: (['high', 'medium', 'low'] as const).includes(b.priority as 'high') ? b.priority as 'high' | 'medium' | 'low' : undefined,
      assignee: typeof b.assignee === 'string' ? b.assignee : null,
      due_date: typeof b.due_date === 'string' ? b.due_date : null,
    })
    return c.json({ task }, 201)
  })

  // Update task
  app.patch('/api/projects/:projectId/tasks/:taskId', async (c) => {
    const task = getTask(c.req.param('taskId'))
    if (!task || task.project_id !== c.req.param('projectId')) return c.json({ error: 'Not found' }, 404)
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const action = new URL(c.req.url).searchParams.get('action')

    if (action === 'add-subtask') {
      if (typeof b.title !== 'string' || !b.title.trim()) return c.json({ error: 'title is required' }, 400)
      const updated = addSubtask(task.id, b.title.trim())
      return updated ? c.json({ task: updated }) : c.json({ error: 'Failed' }, 500)
    }
    if (action === 'toggle-subtask') {
      if (typeof b.subtask_id !== 'string') return c.json({ error: 'subtask_id is required' }, 400)
      const updated = toggleSubtask(task.id, b.subtask_id)
      return updated ? c.json({ task: updated }) : c.json({ error: 'Not found' }, 404)
    }

    const updated = updateTask(task.id, {
      title: typeof b.title === 'string' ? b.title.trim() : undefined,
      description: typeof b.description === 'string' ? b.description : undefined,
      status: isTaskStatus(b.status) ? b.status : undefined,
      priority: (['high', 'medium', 'low'] as const).includes(b.priority as 'high') ? b.priority as 'high' | 'medium' | 'low' : undefined,
      assignee: b.assignee === null || typeof b.assignee === 'string' ? (b.assignee as string | null) : undefined,
      due_date: b.due_date === null || typeof b.due_date === 'string' ? (b.due_date as string | null) : undefined,
    })
    return updated ? c.json({ task: updated }) : c.json({ error: 'Not found' }, 404)
  })

  // Delete task
  app.delete('/api/projects/:projectId/tasks/:taskId', (c) =>
    deleteTask(c.req.param('taskId')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
