/** Video Calls API client — /api/video-calls routes. */

const API = '/api/video-calls'

export type VideoCallPlatform =
  | 'zoom'
  | 'google_meet'
  | 'teams'
  | 'whereby'
  | 'custom'

export type VideoCallStatus =
  | 'scheduled'
  | 'ongoing'
  | 'completed'
  | 'cancelled'

export type VideoCall = {
  id: string
  brand: string
  appointment_id: string | null
  contact_id: string | null
  contact_name: string | null
  title: string
  platform: VideoCallPlatform
  join_url: string
  host_url: string | null
  meeting_id: string | null
  passcode: string | null
  scheduled_at: string
  duration_minutes: number
  status: VideoCallStatus
  notes: string
  created_at: string
  updated_at: string
}

export type CreateVideoCallInput = {
  title: string
  join_url: string
  scheduled_at: string
  appointment_id?: string | null
  contact_id?: string | null
  contact_name?: string | null
  platform?: VideoCallPlatform
  host_url?: string | null
  meeting_id?: string | null
  passcode?: string | null
  duration_minutes?: number
  status?: VideoCallStatus
  notes?: string
  brand?: string
}

export type UpdateVideoCallInput = Partial<Omit<CreateVideoCallInput, 'brand'>>

export const PLATFORM_LABELS: Record<VideoCallPlatform, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  teams: 'Teams',
  whereby: 'Whereby',
  custom: 'Custom',
}

export const PLATFORM_COLORS: Record<VideoCallPlatform, string> = {
  zoom: '#2D8CFF',
  google_meet: '#34A853',
  teams: '#6264A7',
  whereby: '#E8594A',
  custom: '#888888',
}

export const PLATFORM_EMOJIS: Record<VideoCallPlatform, string> = {
  zoom: '🔵',
  google_meet: '🟢',
  teams: '🟣',
  whereby: '🔴',
  custom: '🎥',
}

export const STATUS_LABELS: Record<VideoCallStatus, string> = {
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export async function fetchVideoCalls(params?: {
  status?: string
  contact_id?: string
  from?: string
  to?: string
}): Promise<VideoCall[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.contact_id) qs.set('contact_id', params.contact_id)
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load video calls (${res.status})`)
  const data = (await res.json()) as { video_calls?: VideoCall[] }
  return Array.isArray(data.video_calls) ? data.video_calls : []
}

export async function createVideoCall(input: CreateVideoCallInput): Promise<VideoCall> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create video call (${res.status})`)
  }
  const data = (await res.json()) as { video_call: VideoCall }
  return data.video_call
}

export async function updateVideoCall(
  id: string,
  updates: UpdateVideoCallInput,
): Promise<VideoCall> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update video call (${res.status})`)
  }
  const data = (await res.json()) as { video_call: VideoCall }
  return data.video_call
}

export async function deleteVideoCall(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete video call (${res.status})`)
}
