import { createFileRoute } from '@tanstack/react-router'
import { WellnessAnalyticsScreen } from '@/screens/wellness/wellness-analytics-screen'

export const Route = createFileRoute('/wellness-analytics')({ component: WellnessAnalyticsScreen })
