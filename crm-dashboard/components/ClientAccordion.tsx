'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'

interface Client {
  id: string
  name: string
  slug: string
  client_type: string  // 'full' | 'leads_only'
}

interface ClientAccordionProps {
  newLeadCount: number
  onLeadsClick: () => void
  onNavigate?: () => void
}

export default function ClientAccordion({ newLeadCount, onLeadsClick, onNavigate }: ClientAccordionProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { isAdmin, currentClientId, setCurrentClientId, profile } = useUser()

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, slug, client_type')
        .eq('is_active', true)
        .order('name')

      if (data) {
        setClients(data)
        // Auto-expand the current client if one is selected
        if (currentClientId) {
          setExpandedClientId(currentClientId)
        } else if (data.length > 0 && !isAdmin) {
          // For client users, expand their client
          setExpandedClientId(data[0].id)
        }
      }
    }

    fetchClients()
  }, [supabase, currentClientId, isAdmin])

  const handleClientClick = (clientId: string) => {
    if (expandedClientId === clientId) {
      // Clicking same client collapses it
      setExpandedClientId(null)
    } else {
      // Expand new client (auto-collapses previous)
      setExpandedClientId(clientId)
    }
  }

  const handleNavClick = (clientId: string, path: string) => {
    setCurrentClientId(clientId)
    if (path === '/leads') {
      onLeadsClick()
    }
    router.push(path)
    onNavigate?.()
  }

  const getNavItems = (clientType: string) => {
    const allItems = [
      { path: '/leads', label: 'Leads', icon: '👥' },
      { path: '/orders', label: 'Orders', icon: '🧾' },
      { path: '/pipeline', label: 'Pipeline', icon: '📋' },
      { path: '/analytics', label: 'Analytics', icon: '📊' },
      { path: '/visits', label: 'Visits', icon: '👁️' },
    ]
    if (clientType === 'leads_only') {
      return allItems.filter(item => item.path === '/leads')
    }
    return allItems
  }

  // For client users with only one client, show simplified view
  if (!isAdmin && clients.length === 1) {
    const client = clients[0]
    return (
      <div className="mt-2">
        <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
          {client.name}
        </div>
        {getNavItems(client.client_type).map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavClick(client.id, item.path)}
            className={`w-full flex items-center px-4 py-3 text-sm text-left ${
              pathname.startsWith(item.path) && currentClientId === client.id
                ? 'bg-gray-800 border-l-4 border-blue-500'
                : 'hover:bg-gray-800'
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            {item.label}
            {item.path === '/leads' && newLeadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {newLeadCount}
              </span>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-2">
      <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
        Clients
      </div>
      {clients.map((client) => {
        const isExpanded = expandedClientId === client.id
        const isSelected = currentClientId === client.id

        return (
          <div key={client.id}>
            {/* Client Header */}
            <button
              onClick={() => handleClientClick(client.id)}
              className={`w-full flex items-center px-4 py-3 text-sm text-left transition-colors ${
                isSelected
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span
                className={`mr-2 transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              >
                ▶
              </span>
              <span className="flex-1">{client.name}</span>
              {isSelected && (
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>

            {/* Sub-navigation (expanded state) */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isExpanded ? 'max-h-64' : 'max-h-0'
              }`}
            >
              {getNavItems(client.client_type).map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(client.id, item.path)}
                  className={`w-full flex items-center pl-10 pr-4 py-2 text-sm text-left ${
                    pathname.startsWith(item.path) && currentClientId === client.id
                      ? 'bg-gray-700 text-white border-l-4 border-blue-500'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-xs">{item.icon}</span>
                  {item.label}
                  {item.path === '/leads' && currentClientId === client.id && newLeadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {newLeadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
