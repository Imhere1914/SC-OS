import { createFileRoute } from '@tanstack/react-router'
import { TrainingScreen } from '@/screens/training/training-screen'

export const Route = createFileRoute('/training')({ component: TrainingScreen })
