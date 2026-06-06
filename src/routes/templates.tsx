import { createFileRoute } from '@tanstack/react-router'
import { TemplatesScreen } from '@/screens/templates/templates-screen'

export const Route = createFileRoute('/templates')({ component: TemplatesScreen })
