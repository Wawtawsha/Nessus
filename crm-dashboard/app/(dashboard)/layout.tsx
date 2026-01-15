import DashboardLayout from '@/components/DashboardLayout'
import { UserProvider } from '@/contexts/UserContext'

export const dynamic = 'force-dynamic'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </UserProvider>
  )
}
