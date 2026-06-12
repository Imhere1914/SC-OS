import { createFileRoute } from '@tanstack/react-router'
import { OrchestratorScreen } from '@/screens/orchestrator/orchestrator-screen'

export const Route = createFileRoute('/orchestrator')({ component: OrchestratorScreen })
