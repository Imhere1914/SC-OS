/** Stats API client */
export type Stats = {
  pipeline: { lead: number; contacted: number; qualified: number; customer: number; lost: number }
  contacts: { total: number; newThisWeek: number }
  conversations: { open: number; unread: number }
  appointments: { thisWeek: number }
  campaigns: { sent: number; totalRecipients: number; totalSent: number; deliveryRate: number | null }
  social: { scheduled: number; published: number; publishedThisMonth: number }
  projects: { active: number }
}

export async function fetchStats(brand?: string): Promise<Stats> {
  const q = brand ? `?brand=${brand}` : ''
  const res = await fetch(`/api/stats${q}`)
  if (!res.ok) throw new Error('Failed to load stats')
  return res.json()
}
