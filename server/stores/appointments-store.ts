import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Appointments store — bookings/sessions tied to CRM contacts.
 * For SC: jobs/meetings. For HFM: patient appointments.
 * File-backed JSON; Postgres-swappable. Atomic writes.
 */

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type AppointmentRecord = {
  id: string
  brand: string
  contact_id: string | null
  contact_name: string | null
  title: string
  /** ISO datetime */
  starts_at: string
  /** ISO datetime */
  ends_at: string | null
  status: AppointmentStatus
  location: string
  notes: string
  created_at: string
  updated_at: string
}

type AppointmentFile = { appointments: AppointmentRecord[] }

type CreateInput = Partial<AppointmentRecord> & { title: string; starts_at: string }
type UpdateInput = Partial<Omit<AppointmentRecord, 'id' | 'created_at'>>

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const APPTS_FILE = path.join(CLAUDE_HOME, 'appointments.json')

const STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]

export function isAppointmentStatus(v: unknown): v is AppointmentStatus {
  return typeof v === 'string' && STATUSES.includes(v as AppointmentStatus)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(APPTS_FILE)) {
    fs.writeFileSync(
      APPTS_FILE,
      JSON.stringify({ appointments: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): AppointmentFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(APPTS_FILE, 'utf-8').trim()
    if (!raw) return { appointments: [] }
    const parsed = JSON.parse(raw) as Partial<AppointmentFile>
    return {
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
    }
  } catch {
    return { appointments: [] }
  }
}

function writeFile(data: AppointmentFile): void {
  ensureFile()
  const tmp = `${APPTS_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, APPTS_FILE)
}

function normalize(
  a: Partial<AppointmentRecord> &
    Pick<AppointmentRecord, 'id' | 'title' | 'starts_at' | 'created_at' | 'updated_at'>,
): AppointmentRecord {
  return {
    id: a.id,
    brand: typeof a.brand === 'string' ? a.brand : process.env.BRAND ?? 'default',
    contact_id: a.contact_id ?? null,
    contact_name: a.contact_name ?? null,
    title: a.title,
    starts_at: a.starts_at,
    ends_at: a.ends_at ?? null,
    status: isAppointmentStatus(a.status) ? a.status : 'scheduled',
    location: typeof a.location === 'string' ? a.location : '',
    notes: typeof a.notes === 'string' ? a.notes : '',
    created_at: a.created_at,
    updated_at: a.updated_at,
  }
}

export function listAppointments(filters?: {
  status?: string | null
  brand?: string | null
  contact_id?: string | null
  /** 'upcoming' | 'past' | undefined(all) */
  when?: string | null
}): AppointmentRecord[] {
  let appts = readFile().appointments.map(normalize)
  if (filters?.status) appts = appts.filter((a) => a.status === filters.status)
  if (filters?.brand) appts = appts.filter((a) => a.brand === filters.brand)
  if (filters?.contact_id)
    appts = appts.filter((a) => a.contact_id === filters.contact_id)
  if (filters?.when === 'upcoming') {
    const now = new Date().toISOString()
    appts = appts.filter((a) => a.starts_at >= now)
  } else if (filters?.when === 'past') {
    const now = new Date().toISOString()
    appts = appts.filter((a) => a.starts_at < now)
  }
  // Soonest first
  return appts.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}

export function getAppointment(id: string): AppointmentRecord | null {
  return readFile().appointments.map(normalize).find((a) => a.id === id) ?? null
}

export function createAppointment(input: CreateInput): AppointmentRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const appt = normalize({
    id: randomUUID(),
    brand: typeof input.brand === 'string' ? input.brand : undefined,
    contact_id: input.contact_id,
    contact_name: input.contact_name,
    title: input.title,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    status: input.status,
    location: input.location,
    notes: input.notes,
    created_at: now,
    updated_at: now,
  })
  file.appointments.push(appt)
  writeFile({ appointments: file.appointments.map(normalize) })
  return appt
}

export function updateAppointment(
  id: string,
  updates: UpdateInput,
): AppointmentRecord | null {
  const file = readFile()
  const index = file.appointments.findIndex((a) => a.id === id)
  if (index === -1) return null
  const current = normalize(file.appointments[index] as AppointmentRecord)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    title: typeof updates.title === 'string' ? updates.title : current.title,
    starts_at:
      typeof updates.starts_at === 'string' ? updates.starts_at : current.starts_at,
  })
  file.appointments[index] = next
  writeFile({ appointments: file.appointments.map(normalize) })
  return next
}

export function deleteAppointment(id: string): boolean {
  const file = readFile()
  const next = file.appointments.filter((a) => a.id !== id)
  if (next.length === file.appointments.length) return false
  writeFile({ appointments: next.map((a) => normalize(a as AppointmentRecord)) })
  return true
}

export const APPOINTMENT_STATUSES = STATUSES
