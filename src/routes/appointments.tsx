import { createFileRoute } from '@tanstack/react-router'
import { AppointmentsScreen } from '@/screens/appointments/appointments-screen'

export const Route = createFileRoute('/appointments')({ component: AppointmentsScreen })
