import { createFileRoute } from '@tanstack/react-router'
import { SiteStudioScreen } from '@/screens/site-studio/site-studio-screen'
export const Route = createFileRoute('/site-studio')({ component: SiteStudioScreen })
