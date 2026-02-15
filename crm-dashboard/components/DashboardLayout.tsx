'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import ClientAccordion from './ClientAccordion'
import { SyncStatusIndicator } from './SyncStatusIndicator'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [newLeadCount, setNewLeadCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isAdmin, currentClient, currentClientId, setCurrentClientId, profile, loading } = useUser()

  // Note: Real-time notifications disabled (Supabase Realtime not available)
  // The newLeadCount badge won't update automatically until Realtime is enabled

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const clearNewLeadCount = () => setNewLeadCount(0)
  const closeSidebar = () => setSidebarOpen(false)

  // Admin-only navigation items (management pages)
  const adminNavItems = [
    { href: '/clients', label: 'Manage Clients', icon: '⚙️' },
    { href: '/settings/toast', label: 'Toast Integration', icon: '🍞' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-gray-900 text-white px-4 py-3 sticky top-0 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1 -ml-1"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Nessus</h1>
        <div className="w-6" /> {/* Spacer for centering */}
      </div>

      {/* Backdrop overlay (mobile only) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Nessus</h1>
            {!isAdmin && profile && (
              <p className="text-sm text-gray-400 mt-1">Client Portal</p>
            )}
          </div>
          {/* Close button (mobile only) */}
          <button
            onClick={closeSidebar}
            className="md:hidden p-1 text-gray-400 hover:text-white"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          {/* Admin Quick Access - All clients aggregate views */}
          {isAdmin && (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
                All Clients
              </div>
              {[
                { href: '/leads', label: 'All Leads', icon: '👥' },
                { href: '/orders', label: 'All Orders', icon: '🧾' },
                { href: '/pipeline', label: 'All Pipeline', icon: '📋' },
                { href: '/analytics', label: 'All Analytics', icon: '📊' },
                { href: '/visits', label: 'All Visits', icon: '👁️' },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    setCurrentClientId(null)
                    if (item.href === '/leads') clearNewLeadCount()
                    router.push(item.href)
                    closeSidebar()
                  }}
                  className={`w-full flex items-center px-4 py-3 text-sm text-left ${
                    pathname.startsWith(item.href) && !currentClientId
                      ? 'bg-gray-800 border-l-4 border-blue-500'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                  {item.href === '/leads' && newLeadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {newLeadCount}
                    </span>
                  )}
                </button>
              ))}
              <div className="border-t border-gray-700 my-4 mx-4" />
            </>
          )}

          {/* Client Accordion Navigation */}
          <ClientAccordion
            newLeadCount={newLeadCount}
            onLeadsClick={clearNewLeadCount}
            onNavigate={closeSidebar}
          />

          {/* Admin-only management items */}
          {isAdmin && (
            <>
              <div className="border-t border-gray-700 my-4 mx-4" />
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`flex items-center px-4 py-3 text-sm ${
                    pathname.startsWith(item.href)
                      ? 'bg-gray-800 border-l-4 border-blue-500'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {isAdmin && <SyncStatusIndicator />}

        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 bg-gray-100 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
