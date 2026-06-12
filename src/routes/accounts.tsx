import { createFileRoute } from '@tanstack/react-router'
import { AccountsScreen } from '@/screens/accounting/accounts-screen'
export const Route = createFileRoute('/accounts')({ component: AccountsScreen })
