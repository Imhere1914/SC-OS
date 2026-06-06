import { createFileRoute } from '@tanstack/react-router'
import { AvatarsScreen } from '@/screens/avatars/avatars-screen'

export const Route = createFileRoute('/avatars')({ component: AvatarsScreen })
