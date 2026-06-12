import { createFileRoute } from '@tanstack/react-router'
import { CinematicHome } from '@/screens/dashboard/cinematic-home'

export const Route = createFileRoute('/')({ component: CinematicHome })
