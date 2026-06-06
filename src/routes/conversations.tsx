import { createFileRoute } from '@tanstack/react-router'
import { ConversationsScreen } from '@/screens/conversations/conversations-screen'

export const Route = createFileRoute('/conversations')({ component: ConversationsScreen })
