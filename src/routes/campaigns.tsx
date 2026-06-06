import { createFileRoute } from '@tanstack/react-router'
import { CampaignsScreen } from '@/screens/campaigns/campaigns-screen'

export const Route = createFileRoute('/campaigns')({ component: CampaignsScreen })
