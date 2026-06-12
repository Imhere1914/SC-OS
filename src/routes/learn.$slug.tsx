import { createFileRoute } from '@tanstack/react-router'
import { LearnScreen } from '@/screens/training/learn-screen'

export const Route = createFileRoute('/learn/$slug')({ component: LearnScreen })
