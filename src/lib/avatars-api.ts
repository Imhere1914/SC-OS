/** Avatars API client — /api/avatars routes. */

const API = '/api/avatars'

export type AvatarSurface = 'chat' | 'voice' | 'both'

export type Avatar = {
  id: string
  brand: string
  name: string
  emoji: string
  image_url: string
  voice_name: string
  voice_rate: number
  greeting: string
  accent_color: string
  surface: AvatarSurface
  is_default: boolean
  created_at: string
  updated_at: string
}

export type CreateAvatarInput = {
  name: string
  emoji?: string
  image_url?: string
  voice_name?: string
  voice_rate?: number
  greeting?: string
  accent_color?: string
  surface?: AvatarSurface
  is_default?: boolean
  brand?: string
}

export type UpdateAvatarInput = Partial<Omit<CreateAvatarInput, 'brand'>>

export const SURFACE_LABELS: Record<AvatarSurface, string> = {
  chat: 'Chat',
  voice: 'Voice',
  both: 'Chat + Voice',
}

export async function fetchAvatars(params?: { brand?: string }): Promise<Avatar[]> {
  const qs = new URLSearchParams()
  if (params?.brand) qs.set('brand', params.brand)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load avatars (${res.status})`)
  const data = (await res.json()) as { avatars?: Avatar[] }
  return Array.isArray(data.avatars) ? data.avatars : []
}

export async function createAvatar(input: CreateAvatarInput): Promise<Avatar> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create avatar (${res.status})`)
  }
  const data = (await res.json()) as { avatar: Avatar }
  return data.avatar
}

export async function updateAvatar(
  id: string,
  updates: UpdateAvatarInput,
): Promise<Avatar> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update avatar (${res.status})`)
  }
  const data = (await res.json()) as { avatar: Avatar }
  return data.avatar
}

export async function deleteAvatar(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete avatar (${res.status})`)
}

// ── Browser voice helpers (Web Speech API) ─────────────────────────────────

export function getBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices()
}

/** Speak text with the named voice (in-browser preview; no backend). */
export function speakPreview(
  text: string,
  voiceName: string,
  rate = 1,
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const voices = window.speechSynthesis.getVoices()
  const match = voices.find((v) => v.name === voiceName)
  if (match) u.voice = match
  u.rate = Math.max(0.5, Math.min(1.5, rate))
  window.speechSynthesis.speak(u)
}
