import { createFileRoute } from '@tanstack/react-router'
import { ChatScreen } from '@/screens/chat/chat-screen'

export const Route = createFileRoute('/chat')({ component: ChatScreen })
