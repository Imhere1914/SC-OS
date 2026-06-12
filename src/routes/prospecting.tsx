import { createFileRoute } from '@tanstack/react-router'
import { ProspectingScreen } from '@/screens/prospecting/prospecting-screen'

export const Route = createFileRoute('/prospecting')({
  component: ProspectingScreen,
})
