'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [newLeadCount, setNewLeadCount] = useState(0)

  // Subscribe to new leads for real-time notifications
  useEffect(() => {
    const channel = supabase
      .channel('new-leads-notification')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          setNewLeadCount((prev) => prev + 1)
          // Show browser notification if permitted
          if (Notification.permission === 'granted') {
            new Notification('New Lead!', {
              body: `${payload.new.first_name} ${payload.new.last_name} just submitted`,
            })
          }
        }
      )
      .subscribe()

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const clearNewLeadCount = () => setNewLeadCount(0)

  const navItems = [
    { href: '/leads', label: 'Leads', icon: '👥' },
    { href: '/analytics', label: 'Analytics', icon: '📊' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-4">
          <h1 className="text-xl font-bold">Nessus</h1>
        </div>
        <nav className="mt-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.href === '/leads' ? clearNewLeadCount : undefined}
              className={`flex items-center px-4 py-3 text-sm ${
                pathname.startsWith(item.href)
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
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-64 p-4">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}
