import { createFileRoute } from '@tanstack/react-router'
import { DevStudioScreen } from '@/screens/dev-studio/dev-studio-screen'
export const Route = createFileRoute('/dev-studio')({ component: DevStudioScreen })
