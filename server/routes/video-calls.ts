import type { Hono } from 'hono'
import {
  createVideoCall,
  deleteVideoCall,
  getVideoCall,
  getVideoCallByAppointment,
  isVideoCallPlatform,
  isVideoCallStatus,
  listVideoCalls,
  updateVideoCall,
} from '../stores/video-calls-store'
import { getBrandId } from '../lib/brand'

export function registerVideoCalls(app: Hono): void {
  // GET /api/video-calls
  app.get('/api/video-calls', (c) => {
    const brand = getBrandId(c)
    const u = new URL(c.req.url)
    return c.json({
      video_calls: listVideoCalls(brand, {
        status: u.searchParams.get('status'),
        contact_id: u.searchParams.get('contact_id'),
        from: u.searchParams.get('from'),
        to: u.searchParams.get('to'),
      }),
    })
  })

  // GET /api/video-calls/by-appointment/:appointmentId — must be before /:id
  app.get('/api/video-calls/by-appointment/:appointmentId', (c) => {
    const brand = getBrandId(c)
    const record = getVideoCallByAppointment(brand, c.req.param('appointmentId'))
    return record ? c.json({ video_call: record }) : c.json({ error: 'Not found' }, 404)
  })

  // GET /api/video-calls/:id
  app.get('/api/video-calls/:id', (c) => {
    const brand = getBrandId(c)
    const record = getVideoCall(brand, c.req.param('id'))
    return record ? c.json({ video_call: record }) : c.json({ error: 'Not found' }, 404)
  })

  // POST /api/video-calls
  app.post('/api/video-calls', async (c) => {
    const brand = getBrandId(c)
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof b.title !== 'string' || !b.title)
      return c.json({ error: 'title is required' }, 400)
    if (typeof b.join_url !== 'string' || !b.join_url)
      return c.json({ error: 'join_url is required' }, 400)
    if (typeof b.scheduled_at !== 'string' || !b.scheduled_at)
      return c.json({ error: 'scheduled_at is required' }, 400)

    const record = createVideoCall(brand, {
      title: b.title,
      join_url: b.join_url,
      scheduled_at: b.scheduled_at,
      appointment_id: typeof b.appointment_id === 'string' ? b.appointment_id : null,
      contact_id: typeof b.contact_id === 'string' ? b.contact_id : null,
      contact_name: typeof b.contact_name === 'string' ? b.contact_name : null,
      platform: isVideoCallPlatform(b.platform) ? b.platform : 'custom',
      host_url: typeof b.host_url === 'string' ? b.host_url : null,
      meeting_id: typeof b.meeting_id === 'string' ? b.meeting_id : null,
      passcode: typeof b.passcode === 'string' ? b.passcode : null,
      duration_minutes: typeof b.duration_minutes === 'number' ? b.duration_minutes : 60,
      status: isVideoCallStatus(b.status) ? b.status : 'scheduled',
      notes: typeof b.notes === 'string' ? b.notes : '',
    })
    return c.json({ video_call: record }, 201)
  })

  // PATCH /api/video-calls/:id
  app.patch('/api/video-calls/:id', async (c) => {
    const brand = getBrandId(c)
    const id = c.req.param('id')
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const record = updateVideoCall(brand, id, {
      title: typeof b.title === 'string' ? b.title : undefined,
      join_url: typeof b.join_url === 'string' ? b.join_url : undefined,
      scheduled_at: typeof b.scheduled_at === 'string' ? b.scheduled_at : undefined,
      appointment_id:
        b.appointment_id === null || typeof b.appointment_id === 'string'
          ? (b.appointment_id as string | null)
          : undefined,
      contact_id:
        b.contact_id === null || typeof b.contact_id === 'string'
          ? (b.contact_id as string | null)
          : undefined,
      contact_name:
        b.contact_name === null || typeof b.contact_name === 'string'
          ? (b.contact_name as string | null)
          : undefined,
      platform: isVideoCallPlatform(b.platform) ? b.platform : undefined,
      host_url:
        b.host_url === null || typeof b.host_url === 'string'
          ? (b.host_url as string | null)
          : undefined,
      meeting_id:
        b.meeting_id === null || typeof b.meeting_id === 'string'
          ? (b.meeting_id as string | null)
          : undefined,
      passcode:
        b.passcode === null || typeof b.passcode === 'string'
          ? (b.passcode as string | null)
          : undefined,
      duration_minutes:
        typeof b.duration_minutes === 'number' ? b.duration_minutes : undefined,
      status: isVideoCallStatus(b.status) ? b.status : undefined,
      notes: typeof b.notes === 'string' ? b.notes : undefined,
    })
    if (!record) return c.json({ error: 'Not found' }, 404)
    return c.json({ video_call: record })
  })

  // DELETE /api/video-calls/:id
  app.delete('/api/video-calls/:id', (c) =>
    deleteVideoCall(getBrandId(c), c.req.param('id'))
      ? c.json({ ok: true })
      : c.json({ error: 'Not found' }, 404),
  )
}
