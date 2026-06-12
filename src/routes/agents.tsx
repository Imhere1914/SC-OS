import { createFileRoute } from '@tanstack/react-router'
import { AgentsScreen } from '@/screens/agents/agents-screen'

export const Route = createFileRoute('/agents')({ component: AgentsScreen })
