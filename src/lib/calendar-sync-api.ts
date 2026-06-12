/** Calendar Sync API client — /api/calendar-sync routes. */

const API = '/api/calendar-sync'

export interface CalendarSyncConfig {
  brand: string
  google_connected: boolean
  calendar_id: string | null
  sync_direction: 'push' | 'pull' | 'bidirectional'
  enabled: boolean
  last_synced_at: string | null
  event_prefix: string
}

export type CalendarSyncPatch = Partial<Omit<CalendarSyncConfig, 'brand'>>

export interface ConnectResult {
  ok: boolean
  message: string
}

export interface TestSyncResult {
  synced: number
  message: string
}

async function handleError(res: Response): Promise<never> {
  const err = (await res.json().catch(() => ({}))) as { error?: string }
  throw new Error(err.error ?? `Request failed (${res.status})`)
}

export async function fetchCalendarSync(brand?: string): Promise<CalendarSyncConfig> {
  const qs = brand ? `?brand=${encodeURIComponent(brand)}` : ''
  const res = await fetch(`${API}${qs}`)
  if (!res.ok) await handleError(res)
  return res.json() as Promise<CalendarSyncConfig>
}

export async function updateCalendarSync(
  brand: string,
  patch: CalendarSyncPatch,
): Promise<CalendarSyncConfig> {
  const res = await fetch(API, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand, ...patch }),
  })
  if (!res.ok) await handleError(res)
  return res.json() as Promise<CalendarSyncConfig>
}

export async function connectGoogleCalendar(brand: string): Promise<ConnectResult> {
  const res = await fetch(`${API}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand }),
  })
  if (!res.ok) await handleError(res)
  return res.json() as Promise<ConnectResult>
}

export async function disconnectGoogleCalendar(brand: string): Promise<ConnectResult> {
  const res = await fetch(`${API}/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand }),
  })
  if (!res.ok) await handleError(res)
  return res.json() as Promise<ConnectResult>
}

export async function testCalendarSync(brand: string): Promise<TestSyncResult> {
  const res = await fetch(`${API}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand }),
  })
  if (!res.ok) await handleError(res)
  return res.json() as Promise<TestSyncResult>
}
