/** Media generation API client — /api/media routes. */

export type MediaKind = 'image' | 'video'
export type MediaStatus = 'pending' | 'ready' | 'failed'

export type MediaRecord = {
  id: string
  brand: string
  kind: MediaKind
  prompt: string
  status: MediaStatus
  url: string | null
  aspect: string
  provider: string
  error: string | null
  created_at: string
  updated_at: string
}

export const ASPECTS = ['1:1', '16:9', '9:16'] as const

export async function fetchMedia(kind?: MediaKind): Promise<MediaRecord[]> {
  const q = kind ? `?kind=${kind}` : ''
  const res = await fetch(`/api/media${q}`)
  if (!res.ok) throw new Error('Failed to load media')
  return (await res.json()).media
}

export async function generateMedia(input: { prompt: string; kind: MediaKind; aspect: string }): Promise<MediaRecord> {
  const res = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Generation failed')
  return (await res.json()).media
}

export async function deleteMedia(id: string): Promise<void> {
  const res = await fetch(`/api/media/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}
