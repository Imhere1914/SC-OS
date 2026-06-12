import { createFileRoute } from '@tanstack/react-router'
import { PayrollScreen } from '@/screens/accounting/payroll-screen'
export const Route = createFileRoute('/payroll')({ component: PayrollScreen })
