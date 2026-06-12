import { createFileRoute } from '@tanstack/react-router'
import { BillsScreen } from '@/screens/accounting/bills-screen'
export const Route = createFileRoute('/bills')({ component: BillsScreen })
