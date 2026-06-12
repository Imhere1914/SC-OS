import { createFileRoute } from '@tanstack/react-router'
import { FinanceDashboard } from '@/screens/accounting/finance-dashboard'
export const Route = createFileRoute('/finance')({ component: FinanceDashboard })
