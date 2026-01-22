'use client'

import { useSyncStatus } from '@/contexts/SyncContext'
import { useEffect, useState } from 'react'

export function SyncStatusIndicator() {
  const { status, lastSyncAt, error } = useSyncStatus()
  const [relativeTime, setRelativeTime] = useState<string>('')

  // Update relative time every minute
  useEffect(() => {
    const updateRelativeTime = () => {
      if (!lastSyncAt) {
        setRelativeTime('')
        return
      }

      const seconds = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000)
      if (seconds < 60) {
        setRelativeTime('just now')
      } else {
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) {
          setRelativeTime(`${minutes}m ago`)
        } else {
          const hours = Math.floor(minutes / 60)
          setRelativeTime(`${hours}h ago`)
        }
      }
    }

    updateRelativeTime()
    const interval = setInterval(updateRelativeTime, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [lastSyncAt])

  // Don't show anything if idle with no last sync
  if (status === 'idle' && !lastSyncAt) {
    return null
  }

  return (
    <div className="px-4 py-3 text-xs border-t border-gray-700">
      {status === 'syncing' && (
        <div className="flex items-center gap-2 text-gray-400">
          <Spinner className="w-4 h-4" />
          <span>Syncing orders...</span>
        </div>
      )}

      {status === 'success' && lastSyncAt && (
        <div className="flex items-center gap-2 text-gray-400">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Synced {relativeTime}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 text-red-400">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="flex-1">
            Sync failed
            {error && <span className="block mt-1 text-xs opacity-75">{error}</span>}
          </span>
        </div>
      )}

      {status === 'rate-limited' && (
        <div className="flex items-center gap-2 text-yellow-400">
          <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Rate limited, retrying...</span>
        </div>
      )}

      {status === 'idle' && lastSyncAt && (
        <div className="flex items-center gap-2 text-gray-500">
          <span>Auto-sync active</span>
        </div>
      )}
    </div>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
