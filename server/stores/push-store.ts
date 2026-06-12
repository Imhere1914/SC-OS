import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string): string {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback
  try { return JSON.parse(readFileSync(file, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, data: unknown): void {
  const tmp = `${file}.${nanoid(8)}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, file)
}

export interface PushSubscription {
  id: string
  brand: string
  endpoint: string
  keys: { auth: string; p256dh: string }
  user_agent?: string
  created_at: string
}

function getFilePath(brand: string): string {
  return dbPath(`push-subscriptions-${brand}.json`)
}

export function savePushSubscription(
  brand: string,
  sub: Omit<PushSubscription, 'id' | 'created_at'>,
): PushSubscription {
  const file = getFilePath(brand)
  const all = readJson<PushSubscription[]>(file, [])
  const existing = all.findIndex(s => s.endpoint === sub.endpoint)
  if (existing !== -1) {
    // Update in place
    all[existing] = { ...all[existing], ...sub }
    writeJson(file, all)
    return all[existing]
  }
  const record: PushSubscription = {
    id: nanoid(),
    brand,
    endpoint: sub.endpoint,
    keys: sub.keys,
    user_agent: sub.user_agent,
    created_at: new Date().toISOString(),
  }
  all.push(record)
  writeJson(file, all)
  return record
}

export function removePushSubscription(brand: string, endpoint: string): void {
  const file = getFilePath(brand)
  const all = readJson<PushSubscription[]>(file, [])
  const filtered = all.filter(s => s.endpoint !== endpoint)
  writeJson(file, filtered)
}

export function listPushSubscriptions(brand: string): PushSubscription[] {
  const file = getFilePath(brand)
  return readJson<PushSubscription[]>(file, [])
}
