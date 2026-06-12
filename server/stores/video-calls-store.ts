import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Video Calls store — meeting links tied to appointments/contacts.
 * File-backed JSON per brand; atomic writes.
 */

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

export type VideoCallRecord = {
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
  /** ISO datetime */
  scheduled_at: string
  duration_minutes: number
  status: VideoCallStatus
  notes: string
  created_at: string
  updated_at: string
}

type VideoCallsFile = { video_calls: VideoCallRecord[] }

type CreateInput = Partial<VideoCallRecord> & {
  title: string
  join_url: string
  scheduled_at: string
}
type UpdateInput = Partial<Omit<VideoCallRecord, 'id' | 'created_at'>>

const AIOS_HOME =
  process.env.AIOS_DATA_DIR ?? path.join(os.homedir(), '.ai-os')

const PLATFORMS: VideoCallPlatform[] = [
  'zoom',
  'google_meet',
  'teams',
  'whereby',
  'custom',
]
const STATUSES: VideoCallStatus[] = [
  'scheduled',
  'ongoing',
  'completed',
  'cancelled',
]

export function isVideoCallPlatform(v: unknown): v is VideoCallPlatform {
  return typeof v === 'string' && PLATFORMS.includes(v as VideoCallPlatform)
}

export function isVideoCallStatus(v: unknown): v is VideoCallStatus {
  return typeof v === 'string' && STATUSES.includes(v as VideoCallStatus)
}

function filePath(brand: string): string {
  return path.join(AIOS_HOME, `video-calls-${brand}.json`)
}

function ensureFile(brand: string): void {
  fs.mkdirSync(AIOS_HOME, { recursive: true })
  const fp = filePath(brand)
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(
      fp,
      JSON.stringify({ video_calls: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(brand: string): VideoCallsFile {
  ensureFile(brand)
  try {
    const raw = fs.readFileSync(filePath(brand), 'utf-8').trim()
    if (!raw) return { video_calls: [] }
    const parsed = JSON.parse(raw) as Partial<VideoCallsFile>
    return {
      video_calls: Array.isArray(parsed.video_calls) ? parsed.video_calls : [],
    }
  } catch {
    return { video_calls: [] }
  }
}

function writeFile(brand: string, data: VideoCallsFile): void {
  ensureFile(brand)
  const fp = filePath(brand)
  const tmp = `${fp}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, fp)
}

function normalize(
  v: Partial<VideoCallRecord> &
    Pick<VideoCallRecord, 'id' | 'title' | 'join_url' | 'scheduled_at' | 'created_at' | 'updated_at'>,
  brand: string,
): VideoCallRecord {
  return {
    id: v.id,
    brand: typeof v.brand === 'string' ? v.brand : brand,
    appointment_id: v.appointment_id ?? null,
    contact_id: v.contact_id ?? null,
    contact_name: v.contact_name ?? null,
    title: v.title,
    platform: isVideoCallPlatform(v.platform) ? v.platform : 'custom',
    join_url: v.join_url,
    host_url: v.host_url ?? null,
    meeting_id: v.meeting_id ?? null,
    passcode: v.passcode ?? null,
    scheduled_at: v.scheduled_at,
    duration_minutes: typeof v.duration_minutes === 'number' ? v.duration_minutes : 60,
    status: isVideoCallStatus(v.status) ? v.status : 'scheduled',
    notes: typeof v.notes === 'string' ? v.notes : '',
    created_at: v.created_at,
    updated_at: v.updated_at,
  }
}

export function listVideoCalls(
  brand: string,
  opts?: {
    status?: string | null
    contact_id?: string | null
    from?: string | null
    to?: string | null
  },
): VideoCallRecord[] {
  let calls = readFile(brand).video_calls.map((v) => normalize(v as VideoCallRecord, brand))
  if (opts?.status) calls = calls.filter((v) => v.status === opts.status)
  if (opts?.contact_id) calls = calls.filter((v) => v.contact_id === opts.contact_id)
  if (opts?.from) calls = calls.filter((v) => v.scheduled_at >= opts.from!)
  if (opts?.to) calls = calls.filter((v) => v.scheduled_at <= opts.to!)
  return calls.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
}

export function getVideoCall(brand: string, id: string): VideoCallRecord | null {
  return (
    readFile(brand)
      .video_calls.map((v) => normalize(v as VideoCallRecord, brand))
      .find((v) => v.id === id) ?? null
  )
}

export function createVideoCall(brand: string, input: CreateInput): VideoCallRecord {
  const file = readFile(brand)
  const now = new Date().toISOString()
  const record = normalize(
    {
      id: randomUUID(),
      brand,
      appointment_id: input.appointment_id ?? null,
      contact_id: input.contact_id ?? null,
      contact_name: input.contact_name ?? null,
      title: input.title,
      platform: input.platform,
      join_url: input.join_url,
      host_url: input.host_url ?? null,
      meeting_id: input.meeting_id ?? null,
      passcode: input.passcode ?? null,
      scheduled_at: input.scheduled_at,
      duration_minutes: input.duration_minutes,
      status: input.status,
      notes: input.notes,
      created_at: now,
      updated_at: now,
    },
    brand,
  )
  file.video_calls.push(record)
  writeFile(brand, { video_calls: file.video_calls.map((v) => normalize(v as VideoCallRecord, brand)) })
  return record
}

export function updateVideoCall(
  brand: string,
  id: string,
  updates: UpdateInput,
): VideoCallRecord | null {
  const file = readFile(brand)
  const index = file.video_calls.findIndex((v) => v.id === id)
  if (index === -1) return null
  const current = normalize(file.video_calls[index] as VideoCallRecord, brand)
  const next = normalize(
    {
      ...current,
      ...updates,
      id: current.id,
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
      title: typeof updates.title === 'string' ? updates.title : current.title,
      join_url: typeof updates.join_url === 'string' ? updates.join_url : current.join_url,
      scheduled_at:
        typeof updates.scheduled_at === 'string' ? updates.scheduled_at : current.scheduled_at,
    },
    brand,
  )
  file.video_calls[index] = next
  writeFile(brand, { video_calls: file.video_calls.map((v) => normalize(v as VideoCallRecord, brand)) })
  return next
}

export function deleteVideoCall(brand: string, id: string): boolean {
  const file = readFile(brand)
  const next = file.video_calls.filter((v) => v.id !== id)
  if (next.length === file.video_calls.length) return false
  writeFile(brand, { video_calls: next.map((v) => normalize(v as VideoCallRecord, brand)) })
  return true
}

export function getVideoCallByAppointment(
  brand: string,
  appointmentId: string,
): VideoCallRecord | null {
  return (
    readFile(brand)
      .video_calls.map((v) => normalize(v as VideoCallRecord, brand))
      .find((v) => v.appointment_id === appointmentId) ?? null
  )
}
