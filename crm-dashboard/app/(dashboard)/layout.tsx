import DashboardLayout from '@/components/DashboardLayout'
import { UserProvider } from '@/contexts/UserContext'
import { SyncProvider } from '@/contexts/SyncContext'

export const dynamic = 'force-dynamic'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <SyncProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </SyncProvider>
    </UserProvider>
  )
}
