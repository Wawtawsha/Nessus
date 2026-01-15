'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
  id: string
  role: 'admin' | 'client'
  client_id: string | null
  display_name: string | null
}

interface Client {
  id: string
  name: string
  slug: string
}

interface UserContextType {
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  currentClientId: string | null
  setCurrentClientId: (id: string | null) => void
  clients: Client[]
  currentClient: Client | null
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentClientId, setCurrentClientId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        // Set initial client context for client users
        if (data.role === 'client' && data.client_id) {
          setCurrentClientId(data.client_id)
        }
      }
    }
    setLoading(false)
  }, [supabase])

  const fetchClients = useCallback(async () => {
    if (!profile || profile.role !== 'admin') return

    const { data } = await supabase
      .from('clients')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name')

    if (data) setClients(data)
  }, [supabase, profile])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchClients()
    }
  }, [profile, fetchClients])

  const currentClient = currentClientId
    ? clients.find(c => c.id === currentClientId) || null
    : null

  return (
    <UserContext.Provider value={{
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      currentClientId,
      setCurrentClientId,
      clients,
      currentClient,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
