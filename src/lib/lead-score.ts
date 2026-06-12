/**
 * Client-side lead score (0–100) computed from contact data.
 * No backend call — purely derived from the contact record.
 */
import type { Contact } from './contacts-api'

export type ScoreTier = 'hot' | 'warm' | 'cool' | 'cold'

export interface LeadScore {
  score: number
  tier: ScoreTier
  color: string
  breakdown: { label: string; points: number }[]
}

const STAGE_POINTS: Record<string, number> = {
  lead: 5,
  contacted: 15,
  qualified: 35,
  customer: 60,
  lost: 0,
}

export function computeLeadScore(contact: Contact): LeadScore {
  const breakdown: { label: string; points: number }[] = []

  const add = (label: string, points: number) => {
    if (points > 0) breakdown.push({ label, points })
  }

  // Stage (biggest signal)
  const stagePoints = STAGE_POINTS[contact.stage] ?? 0
  add(`Stage: ${contact.stage}`, stagePoints)

  // Profile completeness
  if (contact.email) add('Has email', 8)
  if (contact.phone) add('Has phone', 6)
  if (contact.company) add('Has company', 4)

  // Engagement signals
  const tagPoints = Math.min(contact.tags.length * 4, 16)
  if (tagPoints > 0) add(`${contact.tags.length} tag${contact.tags.length > 1 ? 's' : ''}`, tagPoints)

  const notesLen = (contact.notes ?? '').trim().length
  if (notesLen > 200) add('Rich notes', 6)
  else if (notesLen > 50) add('Has notes', 3)

  const total = Math.min(breakdown.reduce((s, b) => s + b.points, 0), 100)

  let tier: ScoreTier
  let color: string
  if (total >= 70) { tier = 'hot'; color = '#ef4444' }
  else if (total >= 45) { tier = 'warm'; color = '#f97316' }
  else if (total >= 20) { tier = 'cool'; color = '#3b82f6' }
  else { tier = 'cold'; color = '#94a3b8' }

  return { score: total, tier, color, breakdown }
}
