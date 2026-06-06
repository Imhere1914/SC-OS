import { createFileRoute } from '@tanstack/react-router'
import { HighlightsScreen } from '@/screens/highlights/highlights-screen'

export const Route = createFileRoute('/highlights')({ component: HighlightsScreen })
