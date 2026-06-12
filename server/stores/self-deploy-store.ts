import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Self-deploy store — records of gated staging→live deploy runs triggered from
 * Dev Studio. File-backed JSON with atomic tmp+rename writes (same pattern as
 * dev-tasks-store). Deploys are global to the box (not per-brand): a deploy
 * rebuilds and restarts BOTH instances, so one shared file.
 * Records:   self-deploys.json
 * Log files: {DATA_DIR}/self-deploys/{id}.log
 */

export type SelfDeployStatus = 'running' | 'deployed' | 'rolled_back' | 'failed'

export interface SelfDeployRecord {
  id: string
  brand: string              // brand whose UI triggered the deploy
  status: SelfDeployStatus
  exit_code?: number
  log_file: string           // absolute path to the captured pipeline output
  started_at: string
  finished_at?: string
}

const MAX_STORED_DEPLOYS = 50

function dataDir(): string {
  return process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
}

export function selfDeployLogsDir(): string {
  const dir = join(dataDir(), 'self-deploys')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function dbPath(): string {
  return join(dataDir(), 'self-deploys.json')
}

type DeploysFile = { deploys: SelfDeployRecord[] }

function readDeploys(): SelfDeployRecord[] {
  const filePath = dbPath()
  if (!existsSync(filePath)) return []
  try {
    const raw = readFileSync(filePath, 'utf-8').trim()
    if (!raw) return []
    const file = JSON.parse(raw) as DeploysFile
    return Array.isArray(file.deploys) ? file.deploys : []
  } catch {
    return []
  }
}

function writeDeploys(deploys: SelfDeployRecord[]): void {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = dbPath()
  const tmp = `${filePath}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify({ deploys }, null, 2) + '\n', 'utf-8')
  renameSync(tmp, filePath)
}

// ── API ───────────────────────────────────────────────────────────────────────

export function listSelfDeploys(limit?: number): SelfDeployRecord[] {
  const deploys = readDeploys().sort((a, b) => b.started_at.localeCompare(a.started_at))
  return typeof limit === 'number' && limit > 0 ? deploys.slice(0, limit) : deploys
}

export function getSelfDeploy(id: string): SelfDeployRecord | null {
  return readDeploys().find((d) => d.id === id) ?? null
}

export function createSelfDeploy(brand: string): SelfDeployRecord {
  const id = randomUUID()
  const record: SelfDeployRecord = {
    id,
    brand,
    status: 'running',
    log_file: join(selfDeployLogsDir(), `${id}.log`),
    started_at: new Date().toISOString(),
  }
  let deploys = readDeploys()
  deploys.push(record)
  if (deploys.length > MAX_STORED_DEPLOYS) {
    deploys = deploys
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, MAX_STORED_DEPLOYS)
  }
  writeDeploys(deploys)
  return record
}

export function updateSelfDeploy(id: string, patch: Partial<SelfDeployRecord>): SelfDeployRecord | null {
  const deploys = readDeploys()
  const i = deploys.findIndex((d) => d.id === id)
  if (i === -1) return null
  deploys[i] = { ...deploys[i], ...patch, id: deploys[i].id }
  writeDeploys(deploys)
  return deploys[i]
}
