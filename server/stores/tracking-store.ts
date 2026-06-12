import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { nanoid } from 'nanoid'

export interface TrackEvent {
  id: string
  campaign_id: string
  contact_id: string
  brand: string
  type: 'open' | 'click'
  url?: string
  tracked_at: string
  ip?: string
  user_agent?: string
}

const MAX_ENTRIES = 50_000

const DATA_DIR =
  process.env.AIOS_DATA_DIR ?? path.join(os.homedir(), '.ai-os')

function trackingFile(brand: string): string {
  return path.join(DATA_DIR, `tracking-${brand}.json`)
}

function ensureFile(brand: string): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const file = trackingFile(brand)
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([]) + '\n', 'utf-8')
  }
}

function readEvents(brand: string): TrackEvent[] {
  ensureFile(brand)
  try {
    const raw = fs.readFileSync(trackingFile(brand), 'utf-8').trim()
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as TrackEvent[]) : []
  } catch {
    return []
  }
}

function writeEvents(brand: string, events: TrackEvent[]): void {
  ensureFile(brand)
  fs.writeFileSync(trackingFile(brand), JSON.stringify(events, null, 2) + '\n', 'utf-8')
}

export function appendTrackEvent(
  brand: string,
  event: Omit<TrackEvent, 'id' | 'tracked_at'>,
): TrackEvent {
  const events = readEvents(brand)
  const newEvent: TrackEvent = {
    ...event,
    id: nanoid(),
    tracked_at: new Date().toISOString(),
  }
  events.push(newEvent)
  // Trim oldest if over max
  const trimmed = events.length > MAX_ENTRIES ? events.slice(events.length - MAX_ENTRIES) : events
  writeEvents(brand, trimmed)
  return newEvent
}

export function listTrackEvents(brand: string, campaignId?: string): TrackEvent[] {
  const events = readEvents(brand)
  if (!campaignId) return events
  return events.filter((e) => e.campaign_id === campaignId)
}

export function getCampaignStats(
  brand: string,
  campaignId: string,
): { opens: number; clicks: number; unique_opens: number; unique_clicks: number } {
  const events = listTrackEvents(brand, campaignId)
  const opens = events.filter((e) => e.type === 'open')
  const clicks = events.filter((e) => e.type === 'click')
  const uniqueOpenContacts = new Set(opens.map((e) => e.contact_id))
  const uniqueClickContacts = new Set(clicks.map((e) => e.contact_id))
  return {
    opens: opens.length,
    clicks: clicks.length,
    unique_opens: uniqueOpenContacts.size,
    unique_clicks: uniqueClickContacts.size,
  }
}
