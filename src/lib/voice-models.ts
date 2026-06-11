export interface VoiceModel {
  id: string
  name: string
  tagline: string
  description: string
  voice: string   // OpenAI voice name
  color: string   // Primary color for avatar orb
  colorAlt: string // Gradient secondary color
  emoji: string
  gender: 'neutral' | 'feminine' | 'masculine'
}

export const VOICE_MODELS: VoiceModel[] = [
  {
    id: 'nova',
    name: 'Nova',
    tagline: 'Warm & Conversational',
    description: 'Bright, friendly, approachable. Nova makes every conversation feel personal.',
    voice: 'nova',
    color: '#f59e0b',
    colorAlt: '#d97706',
    emoji: '🌟',
    gender: 'feminine',
  },
  {
    id: 'marcus',
    name: 'Marcus',
    tagline: 'Deep & Authoritative',
    description: 'Grounded, clear, commanding. Marcus delivers with confidence and precision.',
    voice: 'onyx',
    color: '#6366f1',
    colorAlt: '#4f46e5',
    emoji: '🎙️',
    gender: 'masculine',
  },
  {
    id: 'aria',
    name: 'Aria',
    tagline: 'Clear & Professional',
    description: 'Balanced, articulate, composed. Aria is the voice of steady competence.',
    voice: 'alloy',
    color: '#06b6d4',
    colorAlt: '#0891b2',
    emoji: '💎',
    gender: 'neutral',
  },
  {
    id: 'kai',
    name: 'Kai',
    tagline: 'Energetic & Sharp',
    description: 'Quick, dynamic, engaging. Kai keeps pace with fast-moving conversations.',
    voice: 'echo',
    color: '#3b82f6',
    colorAlt: '#2563eb',
    emoji: '⚡',
    gender: 'neutral',
  },
  {
    id: 'sage',
    name: 'Sage',
    tagline: 'Calm & Thoughtful',
    description: 'Soft, wise, unhurried. Sage brings a sense of ease to every interaction.',
    voice: 'shimmer',
    color: '#84cc16',
    colorAlt: '#65a30d',
    emoji: '🍃',
    gender: 'feminine',
  },
  {
    id: 'fable',
    name: 'Fable',
    tagline: 'Rich & Expressive',
    description: 'Resonant, storytelling, vivid. Fable gives your content color and depth.',
    voice: 'fable',
    color: '#c084fc',
    colorAlt: '#a855f7',
    emoji: '📖',
    gender: 'neutral',
  },
]

export const BRAND_DEFAULT_VOICE: Record<string, string> = {
  sc: 'marcus',
  hfm: 'nova',
}

export function getVoiceModel(id: string): VoiceModel {
  return VOICE_MODELS.find(v => v.id === id) ?? VOICE_MODELS[0]
}
