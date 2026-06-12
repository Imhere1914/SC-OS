import { createFileRoute } from '@tanstack/react-router'
import { WellnessAdminScreen } from '@/screens/wellness/wellness-admin-screen'

export const Route = createFileRoute('/daily-wellness')({ component: WellnessAdminScreen })
