import type { Hono } from 'hono'
import {
  createTeamMember,
  getTeamMember,
  isTeamRole,
  listTeamMembers,
  updateTeamMember,
} from '../stores/team-store'

const BRAND = process.env.BRAND ?? 'default'

export function registerTeam(app: Hono): void {
  // GET /api/team — list members (active only by default, ?all=1 for all)
  app.get('/api/team', (c) => {
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? BRAND
    const showAll = url.searchParams.get('all') === '1'
    let members = listTeamMembers(brand)
    if (!showAll) members = members.filter((m) => m.active)
    return c.json({ members })
  })

  // GET /api/team/:id — get one
  app.get('/api/team/:id', (c) => {
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? BRAND
    const member = getTeamMember(c.req.param('id'), brand)
    return member ? c.json({ member }) : c.json({ error: 'Team member not found' }, 404)
  })

  // POST /api/team — create
  app.post('/api/team', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.name || typeof body.name !== 'string')
      return c.json({ error: 'name is required' }, 400)
    try {
      const member = createTeamMember({
        brand: typeof body.brand === 'string' ? body.brand : BRAND,
        name: body.name,
        email: typeof body.email === 'string' ? body.email : undefined,
        role: isTeamRole(body.role) ? body.role : 'member',
        department: typeof body.department === 'string' ? body.department : undefined,
        avatar_color: typeof body.avatar_color === 'string' ? body.avatar_color : undefined,
        phone: typeof body.phone === 'string' ? body.phone : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        active: body.active !== false,
      })
      return c.json({ member }, 201)
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Failed to create team member' }, 400)
    }
  })

  // PATCH /api/team/:id — update
  app.patch('/api/team/:id', async (c) => {
    const id = c.req.param('id')
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? BRAND
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const member = updateTeamMember(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      role: isTeamRole(body.role) ? body.role : undefined,
      department: typeof body.department === 'string' ? body.department : undefined,
      avatar_color: typeof body.avatar_color === 'string' ? body.avatar_color : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      active: typeof body.active === 'boolean' ? body.active : undefined,
      brand: typeof body.brand === 'string' ? body.brand : undefined,
    }, brand)
    if (!member) return c.json({ error: 'Team member not found' }, 404)
    return c.json({ member })
  })

  // DELETE /api/team/:id — deactivate (soft delete)
  app.delete('/api/team/:id', (c) => {
    const id = c.req.param('id')
    const url = new URL(c.req.url)
    const brand = url.searchParams.get('brand') ?? BRAND
    const member = updateTeamMember(id, { active: false }, brand)
    if (!member) return c.json({ error: 'Team member not found' }, 404)
    return c.json({ ok: true, member })
  })
}
