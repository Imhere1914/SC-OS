import { createFileRoute } from '@tanstack/react-router'
import { BankingScreen } from '@/screens/accounting/banking-screen'
export const Route = createFileRoute('/banking')({ component: BankingScreen })
