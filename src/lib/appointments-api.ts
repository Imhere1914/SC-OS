/** Appointments API client — /api/appointments routes. */

const API = '/api/appointments'

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type Appointment = {
  id: string
  brand: string
  contact_id: string | null
  contact_name: string | null
  title: string
  starts_at: string
  ends_at: string | null
  status: AppointmentStatus
  location: string
  notes: string
  created_at: string
  updated_at: string
}

export type CreateAppointmentInput = {
  title: string
  starts_at: string
  ends_at?: string | null
  contact_id?: string | null
  contact_name?: string | null
  status?: AppointmentStatus
  location?: string
  notes?: string
  brand?: string
}

export type UpdateAppointmentInput = Partial<Omit<CreateAppointmentInput, 'brand'>>

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'var(--theme-accent)',
  confirmed: 'var(--theme-success)',
  completed: 'var(--theme-muted)',
  cancelled: 'var(--theme-danger)',
  no_show: 'var(--theme-warning)',
}

export async function fetchAppointments(params?: {
  status?: string
  brand?: string
  when?: string
}): Promise<Appointment[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.brand) qs.set('brand', params.brand)
  if (params?.when) qs.set('when', params.when)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load appointments (${res.status})`)
  const data = (await res.json()) as { appointments?: Appointment[] }
  return Array.isArray(data.appointments) ? data.appointments : []
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<Appointment> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create appointment (${res.status})`)
  }
  const data = (await res.json()) as { appointment: Appointment }
  return data.appointment
}

export async function updateAppointment(
  id: string,
  updates: UpdateAppointmentInput,
): Promise<Appointment> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update appointment (${res.status})`)
  }
  const data = (await res.json()) as { appointment: Appointment }
  return data.appointment
}

export async function deleteAppointment(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete appointment (${res.status})`)
}
