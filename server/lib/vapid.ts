import webpush from 'web-push'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')
const KEYS_FILE = join(DATA_DIR, 'vapid-keys.json')

export interface VapidKeys { publicKey: string; privateKey: string }

export function getOrCreateVapidKeys(): VapidKeys {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(KEYS_FILE)) {
    return JSON.parse(readFileSync(KEYS_FILE, 'utf8')) as VapidKeys
  }
  const keys = webpush.generateVAPIDKeys()
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2))
  return keys
}
