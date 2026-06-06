/** Highlights API client — computed "what's going on" feed. */

export type Highlight = {
  id: string
  kind: 'lead' | 'conversation' | 'appointment' | 'social' | 'campaign' | 'page'
  priority: 'attention' | 'info'
  emoji: string
  title: string
  detail: string
  link: string
  at: string | null
}

export async function fetchHighlights(brand?: string): Promise<{ highlights: Highlight[]; attention: number }> {
  const q = brand ? `?brand=${encodeURIComponent(brand)}` : ''
  const res = await fetch(`/api/highlights${q}`)
  if (!res.ok) throw new Error('Failed to load highlights')
  return res.json()
}
