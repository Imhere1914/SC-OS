import type { Hono } from 'hono'
import {
  createAvatar, deleteAvatar, getAvatar, isAvatarSurface, listAvatars, updateAvatar,
} from '../stores/avatars-store'

export function registerAvatars(app: Hono): void {
  app.get('/api/avatars', (c) => {
    const u = new URL(c.req.url)
    return c.json({ avatars: listAvatars({ brand: u.searchParams.get('brand') }) })
  })
  app.post('/api/avatars', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.name !== 'string' || !b.name) return c.json({ error: 'name is required' }, 400)
    const avatar = createAvatar({
      name: b.name,
      emoji: typeof b.emoji === 'string' ? b.emoji : undefined,
      image_url: typeof b.image_url === 'string' ? b.image_url : '',
      voice_name: typeof b.voice_name === 'string' ? b.voice_name : '',
      voice_rate: typeof b.voice_rate === 'number' ? b.voice_rate : undefined,
      greeting: typeof b.greeting === 'string' ? b.greeting : undefined,
      accent_color: typeof b.accent_color === 'string' ? b.accent_color : undefined,
      surface: isAvatarSurface(b.surface) ? b.surface : undefined,
      is_default: b.is_default === true,
      brand: typeof b.brand === 'string' ? b.brand : undefined,
    })
    return c.json({ avatar }, 201)
  })
  app.get('/api/avatars/:id', (c) => {
    const a = getAvatar(c.req.param('id'))
    return a ? c.json({ avatar: a }) : c.json({ error: 'Not found' }, 404)
  })
  app.patch('/api/avatars/:id', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const a = updateAvatar(c.req.param('id'), {
      name: typeof b.name === 'string' ? b.name : undefined,
      emoji: typeof b.emoji === 'string' ? b.emoji : undefined,
      image_url: typeof b.image_url === 'string' ? b.image_url : undefined,
      voice_name: typeof b.voice_name === 'string' ? b.voice_name : undefined,
      voice_rate: typeof b.voice_rate === 'number' ? b.voice_rate : undefined,
      greeting: typeof b.greeting === 'string' ? b.greeting : undefined,
      accent_color: typeof b.accent_color === 'string' ? b.accent_color : undefined,
      surface: isAvatarSurface(b.surface) ? b.surface : undefined,
      is_default: typeof b.is_default === 'boolean' ? b.is_default : undefined,
    })
    return a ? c.json({ avatar: a }) : c.json({ error: 'Not found' }, 404)
  })
  app.delete('/api/avatars/:id', (c) =>
    deleteAvatar(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404))
}
