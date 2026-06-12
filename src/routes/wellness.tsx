import { createFileRoute } from '@tanstack/react-router'
import { WellnessPlayer } from '@/screens/wellness/wellness-player'

export const Route = createFileRoute('/wellness')({ component: WellnessPlayer })
