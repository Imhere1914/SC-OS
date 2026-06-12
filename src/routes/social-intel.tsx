import { createFileRoute } from '@tanstack/react-router'
import { SocialIntelScreen } from '@/screens/social-intel/social-intel-screen'

export const Route = createFileRoute('/social-intel')({
  component: SocialIntelScreen,
})
