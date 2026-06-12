import { createFileRoute } from '@tanstack/react-router'
import { AdminScreen } from '@/screens/admin/admin-screen'

export const Route = createFileRoute('/admin')({ component: AdminScreen })
