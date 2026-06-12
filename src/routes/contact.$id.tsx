import { createFileRoute } from '@tanstack/react-router'
import { Contact360Screen } from '@/screens/contacts/contact-360-screen'

export const Route = createFileRoute('/contact/$id')({ component: Contact360Screen })
