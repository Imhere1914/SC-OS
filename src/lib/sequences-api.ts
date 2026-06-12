const API = '/api/sequences'

export interface SequenceStep {
  id: string
  subject: string
  body: string
  delay_days: number
}

export interface Sequence {
  id: string
  brand?: string
  name: string
  status: 'draft' | 'active'
  steps: SequenceStep[]
  created_at: string
  updated_at: string
}

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  contact_id?: string
  contact_email: string
  contact_name: string
  brand?: string
  status: 'active' | 'completed' | 'unsubscribed' | 'bounced'
  current_step: number
  next_send_at: string
  enrolled_at: string
  completed_at?: string
}

export async function listSequences(brand?: string): Promise<Sequence[]> {
  const url = brand ? `${API}?brand=${brand}` : API
  const res = await fetch(url)
  const d = await res.json() as { sequences?: Sequence[] }
  return d.sequences ?? []
}

export async function createSequence(data: Partial<Sequence>): Promise<Sequence> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<Sequence>
}

export async function updateSequence(id: string, data: Partial<Sequence>): Promise<Sequence> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<Sequence>
}

export async function deleteSequence(id: string): Promise<void> {
  await fetch(`${API}/${id}`, { method: 'DELETE' })
}

export async function listEnrollments(sequenceId: string): Promise<SequenceEnrollment[]> {
  const res = await fetch(`${API}/${sequenceId}/enrollments`)
  const d = await res.json() as { enrollments?: SequenceEnrollment[] }
  return d.enrollments ?? []
}

export async function enrollContact(
  sequenceId: string,
  data: { contact_id?: string; contact_email: string; contact_name: string; brand?: string },
): Promise<SequenceEnrollment> {
  const res = await fetch(`${API}/${sequenceId}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<SequenceEnrollment>
}

export async function unenroll(enrollmentId: string): Promise<void> {
  await fetch(`/api/enrollments/${enrollmentId}`, { method: 'DELETE' })
}
