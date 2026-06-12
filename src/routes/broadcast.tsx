import { createFileRoute } from '@tanstack/react-router'
import { BroadcastScreen } from '@/screens/broadcast/broadcast-screen'

export const Route = createFileRoute('/broadcast')({ component: BroadcastScreen })
