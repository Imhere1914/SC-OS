import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Email campaigns store (Phase 4d).
 * File-backed JSON, same conventions as the other platform stores.
 * Swap for Postgres when the platform host is live.
 */

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'

export type CampaignAudience = {
  /** Contact stages to include (empty = all stages) */
  stages: string[]
  /** Contact tags to include (empty = no tag filter) */
  tags: string[]
  /** Whether to include unverified web-chat contacts (default false — safer) */
  include_unverified: boolean
}

export type CampaignStats = {
  recipients: number
  sent: number
  failed: number
}

export type CampaignRecord = {
  id: string
  brand: string
  name: string
  subject: string
  /** Body — markdown or simple HTML */
  body: string
  audience: CampaignAudience
  status: CampaignStatus
  scheduled_at: string | null
  sent_at: string | null
  stats: CampaignStats
  created_by: string
  created_at: string
  updated_at: string
}

type CampaignFile = { campaigns: CampaignRecord[] }

type CreateCampaignInput = Partial<CampaignRecord> & { name: string; subject: string }
type UpdateCampaignInput = Partial<
  Omit<CampaignRecord, 'id' | 'created_at' | 'created_by'>
>

const CLAUDE_HOME =
  process.env.AIOS_DATA_DIR ??
  process.env.AIOS_DATA_DIR ??
  path.join(os.homedir(), '.ai-os')
const CAMPAIGNS_FILE = path.join(CLAUDE_HOME, 'campaigns.json')

const STATUSES: CampaignStatus[] = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'failed',
]

export function isCampaignStatus(v: unknown): v is CampaignStatus {
  return typeof v === 'string' && STATUSES.includes(v as CampaignStatus)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(CAMPAIGNS_FILE)) {
    fs.writeFileSync(
      CAMPAIGNS_FILE,
      JSON.stringify({ campaigns: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): CampaignFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(CAMPAIGNS_FILE, 'utf-8').trim()
    if (!raw) return { campaigns: [] }
    const parsed = JSON.parse(raw) as Partial<CampaignFile>
    return { campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [] }
  } catch {
    return { campaigns: [] }
  }
}

function writeFile(data: CampaignFile): void {
  ensureFile()
  const tmp = `${CAMPAIGNS_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, CAMPAIGNS_FILE)
}

function normalizeAudience(a: Partial<CampaignAudience> | undefined): CampaignAudience {
  return {
    stages: Array.isArray(a?.stages)
      ? a!.stages.filter((s): s is string => typeof s === 'string')
      : [],
    tags: Array.isArray(a?.tags)
      ? a!.tags.filter((t): t is string => typeof t === 'string')
      : [],
    include_unverified: a?.include_unverified === true,
  }
}

function normalize(
  c: Partial<CampaignRecord> &
    Pick<CampaignRecord, 'id' | 'name' | 'subject' | 'created_at' | 'updated_at'>,
): CampaignRecord {
  return {
    id: c.id,
    brand: typeof c.brand === 'string' ? c.brand : process.env.BRAND ?? 'default',
    name: c.name,
    subject: c.subject,
    body: typeof c.body === 'string' ? c.body : '',
    audience: normalizeAudience(c.audience),
    status: isCampaignStatus(c.status) ? c.status : 'draft',
    scheduled_at: c.scheduled_at ?? null,
    sent_at: c.sent_at ?? null,
    stats: {
      recipients: c.stats?.recipients ?? 0,
      sent: c.stats?.sent ?? 0,
      failed: c.stats?.failed ?? 0,
    },
    created_by: typeof c.created_by === 'string' && c.created_by ? c.created_by : 'user',
    created_at: c.created_at,
    updated_at: c.updated_at,
  }
}

export function listCampaigns(filters?: {
  status?: string | null
  brand?: string | null
}): CampaignRecord[] {
  let campaigns = readFile().campaigns.map(normalize)
  if (filters?.status) campaigns = campaigns.filter((c) => c.status === filters.status)
  if (filters?.brand) campaigns = campaigns.filter((c) => c.brand === filters.brand)
  return campaigns.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getCampaign(id: string): CampaignRecord | null {
  return readFile().campaigns.map(normalize).find((c) => c.id === id) ?? null
}

export function createCampaign(input: CreateCampaignInput): CampaignRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const campaign = normalize({
    id: randomUUID(),
    brand: typeof input.brand === 'string' ? input.brand : undefined,
    name: input.name,
    subject: input.subject,
    body: input.body,
    audience: input.audience,
    status: input.scheduled_at ? 'scheduled' : 'draft',
    scheduled_at: input.scheduled_at ?? null,
    sent_at: null,
    stats: { recipients: 0, sent: 0, failed: 0 },
    created_by: input.created_by ?? 'user',
    created_at: now,
    updated_at: now,
  })
  file.campaigns.push(campaign)
  writeFile({ campaigns: file.campaigns.map(normalize) })
  return campaign
}

export function updateCampaign(
  id: string,
  updates: UpdateCampaignInput,
): CampaignRecord | null {
  const file = readFile()
  const index = file.campaigns.findIndex((c) => c.id === id)
  if (index === -1) return null
  const current = normalize(file.campaigns[index] as CampaignRecord)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    created_by: current.created_by,
    updated_at: new Date().toISOString(),
    name: typeof updates.name === 'string' ? updates.name : current.name,
    subject: typeof updates.subject === 'string' ? updates.subject : current.subject,
    audience: updates.audience
      ? normalizeAudience(updates.audience)
      : current.audience,
  })
  file.campaigns[index] = next
  writeFile({ campaigns: file.campaigns.map(normalize) })
  return next
}

export function deleteCampaign(id: string): boolean {
  const file = readFile()
  const next = file.campaigns.filter((c) => c.id !== id)
  if (next.length === file.campaigns.length) return false
  writeFile({ campaigns: next.map((c) => normalize(c as CampaignRecord)) })
  return true
}

export const CAMPAIGN_STATUSES = STATUSES
