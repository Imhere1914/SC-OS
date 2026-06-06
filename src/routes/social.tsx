import { createFileRoute } from '@tanstack/react-router'
import { SocialScreen } from '@/screens/social/social-screen'

export const Route = createFileRoute('/social')({ component: SocialScreen })
