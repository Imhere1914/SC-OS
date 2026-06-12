import webpush from 'web-push'
import { getOrCreateVapidKeys } from './vapid'
import { listPushSubscriptions, removePushSubscription } from '../stores/push-store'

export interface PushPayload {
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
}

export async function sendPushToAll(brand: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const keys = getOrCreateVapidKeys()
  webpush.setVapidDetails(
    'mailto:push@ai-os.app',
    keys.publicKey,
    keys.privateKey,
  )
  const subs = listPushSubscriptions(brand)
  let sent = 0, failed = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
      )
      sent++
    } catch (e: unknown) {
      failed++
      // If subscription is gone (410), remove it
      if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
        removePushSubscription(brand, sub.endpoint)
      }
    }
  }
  return { sent, failed }
}
