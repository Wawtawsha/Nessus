'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from './UserContext'

interface SyncContextType {
  status: 'idle' | 'syncing' | 'success' | 'error' | 'rate-limited'
  lastSyncAt: string | null
  error: string | null
  syncNow: () => Promise<void>
}

const SyncContext = createContext<SyncContextType | null>(null)

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, currentClientId } = useUser()
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'rate-limited'>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => {
    // Initialize from localStorage (SSR-safe)
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem('lastSyncAt')
    } catch {
      return null
    }
  })
  const [error, setError] = useState<string | null>(null)

  // Refs for state management in intervals
  const isSyncingRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryAttemptRef = useRef(0)

  // Persist lastSyncAt to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && lastSyncAt) {
      try {
        localStorage.setItem('lastSyncAt', lastSyncAt)
      } catch {
        // Silently fail if localStorage unavailable
      }
    }
  }, [lastSyncAt])

  const performSync = useCallback(async () => {
    // Prevent concurrent syncs
    if (isSyncingRef.current) {
      console.log('[SyncContext] Sync already in progress, skipping')
      return
    }

    // Only sync if admin AND client selected
    if (!isAdmin || !currentClientId) {
      return
    }

    isSyncingRef.current = true
    setStatus('syncing')
    setError(null)

    try {
      const response = await fetch('/api/toast/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: currentClientId }),
      })

      if (response.status === 429) {
        // Handle rate limit with exponential backoff
        setStatus('rate-limited')

        // Check Retry-After header first (Toast provides it)
        const retryAfter = response.headers.get('Retry-After')
        let delayMs: number

        if (retryAfter) {
          // Use server-provided delay (in seconds)
          delayMs = parseInt(retryAfter) * 1000
          console.warn(`[SyncContext] Rate limited, server says retry after ${retryAfter}s`)
        } else {
          // Fallback: exponential backoff with jitter
          const exponentialDelay = Math.min(
            1000 * Math.pow(2, retryAttemptRef.current),
            32000 // Cap at 32 seconds
          )
          const jitter = Math.random() * exponentialDelay * 0.1 // 10% jitter
          delayMs = exponentialDelay + jitter
          console.warn(`[SyncContext] Rate limited, retrying after ${Math.round(delayMs)}ms (attempt ${retryAttemptRef.current})`)
        }

        retryAttemptRef.current++

        // Schedule retry
        setTimeout(() => {
          isSyncingRef.current = false
          performSync()
        }, delayMs)

        return
      }

      const data = await response.json()

      if (data.success) {
        setStatus('success')
        setLastSyncAt(new Date().toISOString())
        setError(null)
        retryAttemptRef.current = 0 // Reset attempt counter on success
        console.log('[SyncContext] Sync completed:', data.stats)
      } else {
        setStatus('error')
        setError(data.error || 'Sync failed')
        console.error('[SyncContext] Sync failed:', data.error)
      }
    } catch (err) {
      setStatus('error')
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
      console.error('[SyncContext] Sync error:', err)
    } finally {
      isSyncingRef.current = false
    }
  }, [isAdmin, currentClientId])

  // Public method for manual sync trigger
  const syncNow = useCallback(async () => {
    await performSync()
  }, [performSync])

  // Auto-polling effect
  useEffect(() => {
    // Only poll if admin AND client selected
    if (!isAdmin || !currentClientId) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setStatus('idle')
      return
    }

    // Initial sync
    performSync()

    // Poll every 60 seconds
    intervalRef.current = setInterval(() => {
      performSync()
    }, 60000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isAdmin, currentClientId, performSync])

  // Pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause polling when tab hidden
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          console.log('[SyncContext] Tab hidden, pausing polling')
        }
      } else {
        // Resume polling when tab visible
        if (isAdmin && currentClientId && !intervalRef.current) {
          console.log('[SyncContext] Tab visible, resuming polling')
          performSync()
          intervalRef.current = setInterval(() => {
            performSync()
          }, 60000)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAdmin, currentClientId, performSync])

  return (
    <SyncContext.Provider
      value={{
        status,
        lastSyncAt,
        error,
        syncNow,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export const useSyncStatus = () => {
  const context = useContext(SyncContext)
  if (!context) throw new Error('useSyncStatus must be used within SyncProvider')
  return context
}
