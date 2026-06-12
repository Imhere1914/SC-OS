import { createFileRoute } from '@tanstack/react-router'
import { TeamChatScreen } from '@/screens/team-chat/team-chat-screen'
export const Route = createFileRoute('/team-chat')({ component: TeamChatScreen })
