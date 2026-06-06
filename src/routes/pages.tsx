import { createFileRoute } from '@tanstack/react-router'
import { PagesScreen } from '@/screens/pages/pages-screen'

export const Route = createFileRoute('/pages')({ component: PagesScreen })
