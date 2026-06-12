import type { Hono } from 'hono'
import {
  createProject, deleteProject, getProject, isProjectPriority, isProjectStatus,
  listProjects, updateProject,
} from '../stores/projects-store'
import { listTasksForProject } from '../stores/project-tasks-store'

export function registerProjects(app: Hono): void {
  app.get('/api/projects', (c) => {
    const u = new URL(c.req.url)
    const projects = listProjects({
      status: u.searchParams.get('status'), brand: u.searchParams.get('brand'),
      contact_id: u.searchParams.get('contact_id'),
    })
    // Enrich each project with live task counts
    const enriched = projects.map(p => {
      const tasks = listTasksForProject(p.id)
      const task_count = tasks.length
      const tasks_done = tasks.filter(t => t.status === 'done').length
      const task_progress = task_count > 0 ? Math.round((tasks_done / task_count) * 100) : null
      return { ...p, task_count, tasks_done, task_progress }
    })
    return c.json({ projects: enriched })
  })
  app.post('/api/projects', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.name !== 'string' || !b.name) return c.json({ error: 'name is required' }, 400)
    const project = createProject({
      name: b.name,
      description: typeof b.description === 'string' ? b.description : '',
      contact_id: typeof b.contact_id === 'string' ? b.contact_id : null,
      contact_name: typeof b.contact_name === 'string' ? b.contact_name : null,
      status: isProjectStatus(b.status) ? b.status : undefined,
      priority: isProjectPriority(b.priority) ? b.priority : undefined,
      progress: typeof b.progress === 'number' ? b.progress : 0,
      due_date: typeof b.due_date === 'string' ? b.due_date : null,
      notes: typeof b.notes === 'string' ? b.notes : '',
      brand: typeof b.brand === 'string' ? b.brand : undefined,
    })
    return c.json({ project }, 201)
  })
  app.get('/api/projects/:id', (c) => {
    const p = getProject(c.req.param('id'))
    return p ? c.json({ project: p }) : c.json({ error: 'Not found' }, 404)
  })
  app.patch('/api/projects/:id', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const p = updateProject(c.req.param('id'), {
      name: typeof b.name === 'string' ? b.name : undefined,
      description: typeof b.description === 'string' ? b.description : undefined,
      contact_id: b.contact_id === null || typeof b.contact_id === 'string' ? (b.contact_id as string | null) : undefined,
      contact_name: b.contact_name === null || typeof b.contact_name === 'string' ? (b.contact_name as string | null) : undefined,
      status: isProjectStatus(b.status) ? b.status : undefined,
      priority: isProjectPriority(b.priority) ? b.priority : undefined,
      progress: typeof b.progress === 'number' ? b.progress : undefined,
      due_date: b.due_date === null || typeof b.due_date === 'string' ? (b.due_date as string | null) : undefined,
      notes: typeof b.notes === 'string' ? b.notes : undefined,
    })
    return p ? c.json({ project: p }) : c.json({ error: 'Not found' }, 404)
  })
  app.delete('/api/projects/:id', (c) =>
    deleteProject(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
