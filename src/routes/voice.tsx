import { createFileRoute } from '@tanstack/react-router'
import { VoiceScreen } from '@/screens/voice/voice-screen'

export const Route = createFileRoute('/voice')({ component: VoiceScreen })
