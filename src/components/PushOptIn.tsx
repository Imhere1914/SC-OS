import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'


async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const res = await fetch('/api/push/vapid-public-key')
  if (!res.ok) return
  const { publicKey } = (await res.json()) as { publicKey: string }

  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey,
  })

  const sub = subscription.toJSON()
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: sub.keys,
      user_agent: navigator.userAgent,
    }),
  })
}

export function PushOptIn() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    // Check if Push API is supported
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return

    // Check dismissed state
    if (localStorage.getItem('push-dismissed') === '1') {
      setDismissed(true)
      return
    }

    setPermission(Notification.permission)

    // If already granted, auto-subscribe in background
    if (Notification.permission === 'granted') {
      subscribeToPush().catch(() => {/* silent */})
    }
  }, [])

  const handleEnable = async () => {
    setSubscribing(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        await subscribeToPush()
      }
    } catch {
      /* silent */
    } finally {
      setSubscribing(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('push-dismissed', '1')
    setDismissed(true)
  }

  // Don't render if:
  // - Push not supported
  // - Already dismissed
  // - Permission is denied (user declined)
  // - Permission already granted (already subscribed)
  if (
    dismissed ||
    permission === null ||
    permission === 'denied' ||
    permission === 'granted'
  ) {
    return null
  }

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl md:left-auto md:right-6 md:max-w-sm md:bottom-8"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: 'linear-gradient(135deg, var(--theme-accent), #000)' }}
      >
        <HugeiconsIcon icon={Notification01Icon} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[var(--theme-text)]">Enable push notifications</p>
        <p className="text-[10px] text-[var(--theme-muted)]">Get notified about new leads, tickets, and automations</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          onClick={handleEnable}
          disabled={subscribing}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--theme-accent)' }}
        >
          {subscribing ? 'Enabling…' : 'Enable'}
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1 text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          title="Dismiss"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} />
        </button>
      </div>
    </div>
  )
}

// Export subscribe function for use in Settings
export { subscribeToPush }
