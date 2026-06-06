import { createFileRoute } from '@tanstack/react-router'
import { PluginsScreen } from '@/screens/plugins/plugins-screen'

export const Route = createFileRoute('/plugins')({ component: PluginsScreen })
