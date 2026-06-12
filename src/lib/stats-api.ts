/** Stats API client */
export type Stats = {
  pipeline: { lead: number; contacted: number; qualified: number; customer: number; lost: number }
  contacts: { total: number; newThisWeek: number }
  conversations: { open: number; unread: number }
  appointments: { thisWeek: number }
  campaigns: { sent: number; totalRecipients: number; totalSent: number; deliveryRate: number | null }
  social: { scheduled: number; published: number; publishedThisMonth: number }
  projects: { active: number }
  tasks?: { dueToday: number; overdue: number }
  automations?: { runsThisWeek: number }
  forms?: { total: number; active: number }
  payments?: { paid: number; outstanding: number; draft: number; total: number }
}

export async function fetchStats(brand?: string): Promise<Stats> {
  const q = brand ? `?brand=${brand}` : ''
  const res = await fetch(`/api/stats${q}`)
  if (!res.ok) throw new Error('Failed to load stats')
  return res.json()
}

// ── Activity feed ──────────────────────────────────────────────────────────
export type ActivityItem = {
  id: string
  type: 'contact' | 'conversation' | 'appointment' | 'automation' | string
  title: string
  sub: string
  link: string
  at: string
}

export async function fetchActivity(brand?: string): Promise<ActivityItem[]> {
  const q = brand ? `?brand=${brand}` : ''
  const res = await fetch(`/api/activity${q}`)
  if (!res.ok) throw new Error('Failed to load activity')
  const data = await res.json() as { items: ActivityItem[] }
  return data.items
}
