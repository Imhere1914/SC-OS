/**
 * /api/dev — Dev Studio: run Claude Code / Codex as headless coding agents.
 * Tasks are spawned server-side; output is captured to log files the UI polls.
 */
import type { Hono } from 'hono'
import { spawnSync } from 'child_process'
import { randomUUID } from 'crypto'
import { getBrandId } from '../lib/brand'
import {
  createDevTask,
  getDevTask,
  listDevTasks,
  type DevAgent,
} from '../stores/dev-tasks-store'
import { cancelDevTask, readTaskLog, resolveWorkspace, runDevTask } from '../lib/dev-agents'

function cliInstalled(name: string): boolean {
  try {
    return spawnSync('which', [name], { stdio: 'ignore' }).status === 0
  } catch {
    return false
  }
}

export function registerDevAgents(app: Hono): void {
  // GET /api/dev/status — CLI install + API key presence (booleans only)
  app.get('/api/dev/status', (c) => {
    return c.json({
      claude_installed: cliInstalled('claude'),
      codex_installed: cliInstalled('codex'),
      anthropic_key_set: !!process.env.ANTHROPIC_API_KEY?.trim(),
      openai_key_set: !!process.env.OPENAI_API_KEY?.trim(),
    })
  })

  // GET /api/dev/tasks — task history (newest first)
  app.get('/api/dev/tasks', (c) => {
    const brand = getBrandId(c)
    const limitRaw = Number(c.req.query('limit'))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined
    return c.json({ tasks: listDevTasks(brand, limit) })
  })

  // POST /api/dev/tasks — create + spawn a task
  app.post('/api/dev/tasks', async (c) => {
    const brand = getBrandId(c)
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const agent = body.agent
    if (agent !== 'claude' && agent !== 'codex')
      return c.json({ error: 'agent must be "claude" or "codex"' }, 400)
    if (typeof body.prompt !== 'string' || !body.prompt.trim())
      return c.json({ error: 'prompt is required' }, 400)

    const id = randomUUID()
    let workspace: string
    try {
      workspace = resolveWorkspace(
        typeof body.workspace === 'string' ? body.workspace : undefined,
        id
      )
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400)
    }

    const task = createDevTask(brand, {
      id,
      agent: agent as DevAgent,
      prompt: body.prompt.trim(),
      workspace,
    })
    runDevTask(brand, task.id) // fire and forget — UI polls for progress
    return c.json({ task }, 201)
  })

  // GET /api/dev/tasks/:id — single task
  app.get('/api/dev/tasks/:id', (c) => {
    const brand = getBrandId(c)
    const task = getDevTask(brand, c.req.param('id'))
    if (!task) return c.json({ error: 'Task not found' }, 404)
    return c.json({ task })
  })

  // GET /api/dev/tasks/:id/log?offset= — incremental log content
  app.get('/api/dev/tasks/:id/log', (c) => {
    const brand = getBrandId(c)
    const task = getDevTask(brand, c.req.param('id'))
    if (!task) return c.json({ error: 'Task not found' }, 404)
    const offsetRaw = Number(c.req.query('offset'))
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0
    return c.json(readTaskLog(task.id, offset))
  })

  // POST /api/dev/tasks/:id/cancel
  app.post('/api/dev/tasks/:id/cancel', (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    const task = getDevTask(brand, id)
    if (!task) return c.json({ error: 'Task not found' }, 404)
    const ok = cancelDevTask(brand, id)
    if (!ok) return c.json({ error: `Task is ${task.status} — nothing to cancel` }, 400)
    return c.json({ task: getDevTask(brand, id) })
  })
}
