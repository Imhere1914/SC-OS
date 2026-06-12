import { createFileRoute } from '@tanstack/react-router'
import { VideoCallsScreen } from '@/screens/video-calls/video-calls-screen'

export const Route = createFileRoute('/video-calls')({ component: VideoCallsScreen })
