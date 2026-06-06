import { createFileRoute } from '@tanstack/react-router'
import { MediaScreen } from '@/screens/media/media-screen'

export const Route = createFileRoute('/media')({ component: MediaScreen })
