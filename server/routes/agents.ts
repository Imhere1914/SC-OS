import type { Hono } from 'hono'
import {
  listAgents, getAgent, createAgent, updateAgent,
  listTasks, getTask, createTask, updateTask, deleteTask, getTaskStats,
  type AgentRole, type TaskStatus,
} from '../stores/agents-store'

const VALID_ROLES: AgentRole[] = ['scheduler', 'outreach', 'bookkeeper', 'content', 'researcher', 'dispatcher', 'intake', 'custom']
const VALID_STATUSES: TaskStatus[] = ['queued', 'running', 'review', 'done', 'failed']
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

export function registerAgents(app: Hono) {
  // ── Agents CRUD ─────────────────────────────────────────────────
  app.get('/api/agents', (c) => {
    return c.json(listAgents())
  })

  app.get('/api/agents/:id', (c) => {
    const agent = getAgent(c.req.param('id'))
    if (!agent) return c.json({ error: 'Agent not found' }, 404)
    return c.json(agent)
  })

  app.post('/api/agents', async (c) => {
    const body = await c.req.json()
    if (!body.name || !body.role) return c.json({ error: 'name and role required' }, 400)
    if (!VALID_ROLES.includes(body.role)) return c.json({ error: 'Invalid role' }, 400)
    const agent = createAgent({
      role: body.role,
      name: body.name,
      description: body.description ?? '',
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
      avatar_emoji: body.avatar_emoji ?? '🤖',
      active: body.active !== false,
    })
    return c.json(agent, 201)
  })

  app.patch('/api/agents/:id', async (c) => {
    const body = await c.req.json()
    const agent = updateAgent(c.req.param('id'), body)
    if (!agent) return c.json({ error: 'Agent not found' }, 404)
    return c.json(agent)
  })

  // ── Tasks CRUD ──────────────────────────────────────────────────
  app.get('/api/agents/tasks', (c) => {
    const agent_id = c.req.query('agent_id')
    const status = c.req.query('status') as TaskStatus | undefined
    const parent = c.req.query('parent_task_id')
    return c.json(listTasks({
      agent_id: agent_id || undefined,
      status: status && VALID_STATUSES.includes(status) ? status : undefined,
      parent_task_id: parent || undefined,
    }))
  })

  app.get('/api/agents/tasks/stats', (c) => {
    return c.json(getTaskStats())
  })

  app.get('/api/agents/tasks/:id', (c) => {
    const task = getTask(c.req.param('id'))
    if (!task) return c.json({ error: 'Task not found' }, 404)
    return c.json(task)
  })

  app.post('/api/agents/tasks', async (c) => {
    const body = await c.req.json()
    if (!body.agent_id || !body.title) return c.json({ error: 'agent_id and title required' }, 400)
    if (!getAgent(body.agent_id)) return c.json({ error: 'Agent not found' }, 404)
    const task = createTask({
      agent_id: body.agent_id,
      title: body.title,
      description: body.description ?? '',
      status: 'queued',
      priority: VALID_PRIORITIES.includes(body.priority) ? body.priority : 'normal',
      parent_task_id: body.parent_task_id,
      metadata: body.metadata,
    })
    return c.json(task, 201)
  })

  app.patch('/api/agents/tasks/:id', async (c) => {
    const body = await c.req.json()
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }
    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { ...body }
    if (body.status === 'running' && !body.started_at) patch.started_at = now
    if ((body.status === 'done' || body.status === 'failed') && !body.completed_at) patch.completed_at = now
    const task = updateTask(c.req.param('id'), patch)
    if (!task) return c.json({ error: 'Task not found' }, 404)
    return c.json(task)
  })

  app.delete('/api/agents/tasks/:id', (c) => {
    if (!deleteTask(c.req.param('id'))) return c.json({ error: 'Task not found' }, 404)
    return c.json({ ok: true })
  })

  // ── Orchestrate — Hermes decomposes a goal into agent tasks ─────
  app.post('/api/agents/orchestrate', async (c) => {
    const body = await c.req.json<{ goal: string; context?: string }>()
    if (!body.goal?.trim()) return c.json({ error: 'goal required' }, 400)

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return c.json({ error: 'No API key configured' }, 503)

    const agents = listAgents().filter(a => a.active)
    const agentList = agents.map(a => `- ${a.name} (${a.role}): ${a.description}`).join('\n')

    const prompt = `You are Hermes, an AI operations manager. A business owner has a goal. Decompose it into specific, actionable tasks and assign each to the most appropriate agent.

Available agents:
${agentList}

Goal: "${body.goal}"
${body.context ? `Context: ${body.context}` : ''}

Respond with a JSON array of tasks. Each task: {"agent_role": "...", "title": "short action title", "description": "what specifically to do", "priority": "low|normal|high|urgent"}

Only output the JSON array, nothing else.`

    try {
      const { getChatModel } = await import('../stores/preferences-store')
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: getChatModel(),
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return c.json({ error: `LLM error: ${err}` }, 502)
      }

      const data = await res.json() as { choices: { message: { content: string } }[] }
      const raw = data.choices[0]?.message?.content ?? '[]'

      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return c.json({ error: 'Could not parse task plan' }, 502)

      const planned = JSON.parse(jsonMatch[0]) as {
        agent_role: string; title: string; description: string; priority: string
      }[]

      const parentTask = createTask({
        agent_id: agents[0]?.id ?? '',
        title: body.goal,
        description: `Orchestrated goal: ${body.goal}`,
        status: 'running',
        priority: 'high',
        started_at: new Date().toISOString(),
      })

      const created = planned.map(p => {
        const agent = agents.find(a => a.role === p.agent_role) ?? agents[0]
        if (!agent) return null
        return createTask({
          agent_id: agent.id,
          title: p.title,
          description: p.description,
          status: 'queued',
          priority: (['low', 'normal', 'high', 'urgent'].includes(p.priority) ? p.priority : 'normal') as 'low' | 'normal' | 'high' | 'urgent',
          parent_task_id: parentTask.id,
        })
      }).filter(Boolean)

      return c.json({ parent: parentTask, tasks: created, plan: planned })
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500)
    }
  })
}
