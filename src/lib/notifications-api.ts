export type AppNotification = {
  id: string
  brand: string
  message: string
  context_summary: string
  read: boolean
  created_at: string
}

export async function fetchNotifications(params?: { brand?: string; unread_only?: boolean }) {
  const qs = new URLSearchParams()
  if (params?.brand) qs.set('brand', params.brand)
  if (params?.unread_only) qs.set('unread_only', 'true')
  const res = await fetch(`/api/notifications?${qs}`)
  if (!res.ok) throw new Error('Failed to load notifications')
  return (await res.json()) as { notifications: AppNotification[]; unread_count: number }
}

export async function markNotificationRead(id: string) {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
}

export async function markAllNotificationsRead(brand?: string) {
  const qs = brand ? `?brand=${brand}` : ''
  await fetch(`/api/notifications/read-all${qs}`, { method: 'POST' })
}
