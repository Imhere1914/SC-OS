import { createFileRoute } from '@tanstack/react-router'
import { FinancialsScreen } from '@/screens/accounting/financials-screen'
export const Route = createFileRoute('/financials')({ component: FinancialsScreen })
