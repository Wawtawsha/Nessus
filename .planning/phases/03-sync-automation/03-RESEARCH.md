# Phase 3: Sync Automation - Research

**Researched:** 2026-01-22
**Domain:** Background polling and rate limiting in Next.js 14 App Router
**Confidence:** HIGH

## Summary

This phase implements automatic background syncing of Toast POS orders in a Next.js 14 App Router application. The research confirms that **client-side polling with setInterval** is the appropriate pattern for this use case, as the app lacks a backend job scheduler and requires immediate user feedback.

The existing codebase already uses this pattern successfully (visits page polls every 30 seconds). Toast API has well-documented rate limits (20 req/sec, 10k req/15min) with proper HTTP 429 responses including `Retry-After` headers, making rate limit handling straightforward.

**Primary recommendation:** Use client-side polling with a 30-60 second interval, implement exponential backoff with jitter for 429 responses, and store sync state in React Context persisted to localStorage for cross-page consistency.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React hooks (useEffect) | React 18 | Polling orchestration | Native React, zero dependencies, proven pattern |
| Next.js App Router | 14 | Server action invocation | Built-in, no API routes needed |
| React Context API | React 18 | Global sync state | Lightweight, built-in, survives navigation |
| localStorage | Native | Persist last sync time | Browser API, survives refresh |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| exponential-backoff | Latest | Retry logic | If custom implementation too complex |
| date-fns | Latest | Time formatting | "Last synced X mins ago" display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client polling | Vercel Cron Jobs | Requires Pro plan, no immediate feedback, harder debugging |
| Client polling | React Query | Overkill for single endpoint, adds 13KB, polling is built-in but configured per-component |
| Context + localStorage | Zustand | Adds dependency for minimal benefit, though some devs prefer its ergonomics |

**Installation:**
```bash
npm install exponential-backoff date-fns
# OR use custom implementation (recommended for learning/control)
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── contexts/
│   └── SyncContext.tsx           # Global sync state
├── hooks/
│   └── useSyncStatus.ts          # Hook for components to access sync state
├── lib/
│   └── sync/
│       ├── poller.ts             # Polling logic
│       └── rateLimiter.ts        # Backoff algorithm
└── api/
    └── toast/
        └── sync/
            └── route.ts          # Existing sync endpoint
```

### Pattern 1: Polling with useEffect Cleanup
**What:** Use setInterval in useEffect with cleanup function to prevent memory leaks
**When to use:** All client-side polling scenarios
**Example:**
```typescript
// Source: https://medium.com/@sfcofc/implementing-polling-in-react-a-guide-for-efficient-real-time-data-fetching-47f0887c54a7
useEffect(() => {
  const interval = setInterval(() => {
    performSync()
  }, 30000) // 30 seconds

  return () => clearInterval(interval) // CRITICAL: Cleanup on unmount
}, [performSync])
```

### Pattern 2: Context Provider in Root Layout
**What:** Place sync context provider in root layout to survive page navigations
**When to use:** State that must persist across page changes
**Example:**
```typescript
// Source: https://reactician.com/articles/sharing-state-between-nextjs-page-navigations-using-react-contexts
// app/layout.tsx
'use client'

export default function RootLayout({ children }) {
  return (
    <SyncProvider>
      {children}
    </SyncProvider>
  )
}
```

### Pattern 3: Exponential Backoff with Retry-After
**What:** Check Retry-After header first, fallback to exponential backoff with jitter
**When to use:** All API rate limit handling
**Example:**
```typescript
// Source: Toast API docs + https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/
async function handleRateLimit(response: Response, attempt: number) {
  // 1. Check Retry-After header (Toast provides this)
  const retryAfter = response.headers.get('Retry-After')
  if (retryAfter) {
    return parseInt(retryAfter) * 1000 // Convert seconds to ms
  }

  // 2. Fallback to exponential backoff with jitter
  const baseDelay = Math.min(1000 * Math.pow(2, attempt), 32000) // Cap at 32s
  const jitter = Math.random() * baseDelay * 0.1 // 10% jitter
  return baseDelay + jitter
}
```

### Pattern 4: Hybrid State (Context + localStorage)
**What:** Keep React state as source of truth, sync to localStorage for persistence
**When to use:** State that needs both reactivity (re-renders) and persistence (survives refresh)
**Example:**
```typescript
// Source: https://www.darrenlester.com/blog/syncing-react-state-and-session-storage
const [lastSync, setLastSync] = useState<string | null>(() => {
  // Initialize from localStorage
  return localStorage.getItem('lastSyncTime')
})

useEffect(() => {
  // Sync to localStorage whenever state changes
  if (lastSync) {
    localStorage.setItem('lastSyncTime', lastSync)
  }
}, [lastSync])
```

### Pattern 5: Stop Polling When Window Unfocused
**What:** Pause polling when user switches tabs/windows to reduce server load
**When to use:** Non-critical polling (not real-time monitoring)
**Example:**
```typescript
// Source: https://www.dhiwise.com/post/a-guide-to-real-time-applications-with-react-polling
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Clear interval when tab hidden
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    } else {
      // Restart polling when tab visible
      startPolling()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])
```

### Anti-Patterns to Avoid
- **No cleanup function:** Always return cleanup from useEffect with intervals/timers
- **Polling too fast:** Sub-second intervals for non-real-time data wastes resources
- **Using localStorage alone:** Won't trigger re-renders, must sync with React state
- **Ignoring Retry-After header:** Toast provides it, use it (servers know their limits better)
- **Polling during full-page refreshes:** User won't see progress anyway, wastes API calls

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exponential backoff algorithm | Custom retry loop | `exponential-backoff` npm package OR simple formula: `Math.min(1000 * 2^attempt, maxDelay)` | Edge cases: max delay cap, jitter, overflow protection |
| "X minutes ago" formatting | Date math strings | `date-fns/formatDistanceToNow` OR Intl.RelativeTimeFormat | Handles pluralization, i18n, units automatically |
| HTTP 429 detection | Status code checking | Toast response headers: `X-Toast-RateLimit-Remaining`, `X-Toast-RateLimit-Reset` | Proactive prevention vs reactive handling |

**Key insight:** The Toast API provides excellent rate limit headers (`X-Toast-RateLimit-Remaining`, `Retry-After`) that make custom rate limiting mostly unnecessary. Use their data.

## Common Pitfalls

### Pitfall 1: Memory Leaks from Uncleaned Intervals
**What goes wrong:** setInterval continues running after component unmounts, causing ghost requests and memory leaks
**Why it happens:** Forgetting to return cleanup function from useEffect
**How to avoid:** ALWAYS return `() => clearInterval(interval)` from useEffect
**Warning signs:** Increasing network requests over time, console errors about unmounted component updates

### Pitfall 2: Infinite Re-render from useEffect Dependencies
**What goes wrong:** useEffect with interval depends on unstable function reference, causes interval to restart constantly
**Why it happens:** Not wrapping callback in useCallback or stabilizing dependencies
**How to avoid:** Use useCallback for functions passed to useEffect, or use empty dependency array `[]`
**Warning signs:** Interval fires rapidly, console shows excessive re-renders

### Pitfall 3: Racing Conditions from Concurrent Syncs
**What goes wrong:** Multiple sync requests overlap, causing duplicate inserts or incorrect status updates
**Why it happens:** New interval fires before previous sync completes
**How to avoid:** Track `isSyncing` state, skip interval tick if already syncing
**Warning signs:** Duplicate orders in database, "in_progress" status stuck

### Pitfall 4: Stale Closure in setInterval
**What goes wrong:** Interval callback captures old state values, never sees updates
**Why it happens:** JavaScript closures capture variables at creation time
**How to avoid:** Use useRef for mutable values accessed in intervals, or recreate interval when deps change
**Warning signs:** Sync state appears frozen, logs show old values

### Pitfall 5: Aggressive Polling Overwhelms Toast API
**What goes wrong:** Polling interval too fast, hits rate limit (20 req/sec, 10k req/15min)
**Why it happens:** Not calculating sustained request rate: 10k/15min = ~11 requests/minute max
**How to avoid:** Use 30-60 second intervals, implement exponential backoff, monitor `X-Toast-RateLimit-Remaining`
**Warning signs:** Frequent 429 errors, sync repeatedly fails then succeeds

### Pitfall 6: localStorage Not Available (SSR/Private Browsing)
**What goes wrong:** App crashes trying to access localStorage during SSR or when storage disabled
**Why it happens:** Next.js renders on server where localStorage doesn't exist
**How to avoid:** Check `typeof window !== 'undefined'` before localStorage access, wrap in try-catch
**Warning signs:** "localStorage is not defined" error, app breaks in private browsing mode

## Code Examples

Verified patterns from official sources:

### Complete Polling Implementation
```typescript
// Source: Existing codebase pattern (visits/page.tsx) + best practices compilation
'use client'

import { useEffect, useCallback, useRef } from 'react'

export function useAutoSync(clientId: string, enabled: boolean) {
  const isSyncingRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const performSync = useCallback(async () => {
    // Prevent concurrent syncs
    if (isSyncingRef.current) {
      console.log('Sync already in progress, skipping')
      return
    }

    isSyncingRef.current = true

    try {
      const response = await fetch('/api/toast/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })

      if (response.status === 429) {
        // Handle rate limit
        const retryAfter = response.headers.get('Retry-After')
        const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000
        console.warn(`Rate limited, retrying in ${delayMs}ms`)
        setTimeout(performSync, delayMs)
        return
      }

      const data = await response.json()
      if (data.success) {
        console.log('Sync completed', data.stats)
      }
    } catch (error) {
      console.error('Sync failed', error)
    } finally {
      isSyncingRef.current = false
    }
  }, [clientId])

  useEffect(() => {
    if (!enabled) return

    // Initial sync
    performSync()

    // Poll every 30 seconds
    intervalRef.current = setInterval(performSync, 30000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, performSync])
}
```

### Sync Status Context Provider
```typescript
// Source: https://reactician.com/articles/sharing-state-between-nextjs-page-navigations-using-react-contexts
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SyncStatus {
  lastSyncAt: string | null
  status: 'idle' | 'syncing' | 'success' | 'error'
  error: string | null
}

const SyncContext = createContext<SyncStatus & { refresh: () => void }>(null!)

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>(() => {
    // Initialize from localStorage (safe client-side check)
    if (typeof window === 'undefined') {
      return { lastSyncAt: null, status: 'idle', error: null }
    }

    try {
      const stored = localStorage.getItem('syncStatus')
      return stored ? JSON.parse(stored) : { lastSyncAt: null, status: 'idle', error: null }
    } catch {
      return { lastSyncAt: null, status: 'idle', error: null }
    }
  })

  // Sync to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('syncStatus', JSON.stringify(status))
    }
  }, [status])

  const refresh = async () => {
    // Fetch latest sync status from DB
    // Update state
  }

  return (
    <SyncContext.Provider value={{ ...status, refresh }}>
      {children}
    </SyncContext.Provider>
  )
}

export const useSyncStatus = () => useContext(SyncContext)
```

### Rate Limit Handler with Exponential Backoff
```typescript
// Source: Toast API docs + https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: RetryConfig = { maxRetries: 3, baseDelay: 1000, maxDelay: 32000 }
): Promise<Response> {
  let attempt = 0

  while (attempt <= config.maxRetries) {
    const response = await fetch(url, options)

    if (response.ok) {
      return response
    }

    if (response.status === 429) {
      // Check Retry-After header first (Toast API provides this)
      const retryAfter = response.headers.get('Retry-After')
      const remainingRequests = response.headers.get('X-Toast-RateLimit-Remaining')
      const resetTime = response.headers.get('X-Toast-RateLimit-Reset')

      console.warn('Rate limited', { retryAfter, remainingRequests, resetTime })

      let delayMs: number
      if (retryAfter) {
        // Use server-provided delay
        delayMs = parseInt(retryAfter) * 1000
      } else {
        // Fallback to exponential backoff with jitter
        const exponentialDelay = Math.min(
          config.baseDelay * Math.pow(2, attempt),
          config.maxDelay
        )
        const jitter = Math.random() * exponentialDelay * 0.1
        delayMs = exponentialDelay + jitter
      }

      console.log(`Retrying after ${delayMs}ms (attempt ${attempt + 1}/${config.maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
      attempt++
      continue
    }

    // Non-retriable error
    return response
  }

  throw new Error('Max retries exceeded')
}
```

### Sync Status Indicator Component
```typescript
// Source: https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback
'use client'

import { useSyncStatus } from '@/contexts/SyncContext'
import { formatDistanceToNow } from 'date-fns'

export function SyncIndicator() {
  const { status, lastSyncAt, error } = useSyncStatus()

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {status === 'syncing' && (
        <>
          <Spinner className="w-4 h-4" />
          <span>Syncing orders...</span>
        </>
      )}

      {status === 'success' && lastSyncAt && (
        <>
          <CheckIcon className="w-4 h-4 text-green-600" />
          <span>
            Last synced {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
          </span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertIcon className="w-4 h-4 text-red-600" />
          <span>Sync failed: {error}</span>
        </>
      )}

      {status === 'idle' && (
        <span>Waiting to sync...</span>
      )}
    </div>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API Route Handlers for data fetching | Server Actions called from client | Next.js 13 (2023) | Less boilerplate, direct function calls, automatic POST endpoints |
| Redux for all global state | Context API for simple cases, React Query for server state | 2020-2023 | Reduced bundle size, simpler code for common cases |
| setInterval directly | Custom hooks (useInterval, usePolling) | 2019+ | Cleaner code, reusable logic, better cleanup |
| Manual polling logic | React Query's polling features | 2020+ | Built-in, optimized, but adds 13KB dependency |

**Deprecated/outdated:**
- pages/ directory API routes (use app/ directory Server Actions instead - less code)
- Redux for simple global state (Context API sufficient, unless complex async logic)
- Polling without window focus detection (wastes resources, all modern apps should pause when hidden)

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal polling interval for user experience**
   - What we know: Toast rate limits allow ~11 requests/minute sustained. 30-60 seconds is safe.
   - What's unclear: Does this client need near-real-time (30s) or periodic (60s) updates? Depends on business workflow.
   - Recommendation: Start with 60 seconds, make configurable, monitor user feedback. Can always decrease if needed.

2. **Whether to stop polling when no active integration**
   - What we know: Polling will fail with 404 if no integration configured
   - What's unclear: Should we check integration status before starting poller, or let it fail gracefully?
   - Recommendation: Check `toast_integrations.is_active` before starting poller to avoid unnecessary API calls.

3. **Multi-client polling strategy for admin users**
   - What we know: Admin users can view multiple clients, but polling one client at a time is safest
   - What's unclear: Should we poll all active integrations simultaneously or sequentially?
   - Recommendation: Poll only the currently selected client to stay within rate limits and provide immediate feedback.

4. **Sync conflict resolution**
   - What we know: Existing sync uses upsert with `client_id,toast_order_guid` conflict resolution
   - What's unclear: What happens if user triggers manual sync while auto-sync is running?
   - Recommendation: Use `isSyncing` flag to prevent concurrent syncs, queue manual triggers if auto-sync in progress.

## Sources

### Primary (HIGH confidence)
- Toast API Rate Limiting: https://doc.toasttab.com/doc/devguide/apiRateLimiting.html
- Next.js Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- React Context for Next.js: https://reactician.com/articles/sharing-state-between-nextjs-page-navigations-using-react-contexts
- React useEffect docs: https://react.dev/reference/react/useEffect

### Secondary (MEDIUM confidence)
- Polling in React best practices: https://www.dhiwise.com/post/a-guide-to-real-time-applications-with-react-polling
- Exponential backoff implementation: https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/
- HTTP 429 handling guide: https://blog.postman.com/http-error-429/
- State persistence with localStorage: https://www.darrenlester.com/blog/syncing-react-state-and-session-storage
- Loading UX patterns: https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback

### Tertiary (LOW confidence)
- React polling libraries comparison (GitHub repos, Medium articles) - useful for patterns but not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Next.js 14 App Router patterns are well-established, codebase already uses polling successfully
- Architecture: HIGH - Multiple production examples exist, Toast API docs are comprehensive
- Pitfalls: HIGH - Common React pitfalls are well-documented, Toast rate limits are clearly specified
- Rate limiting: HIGH - Toast API provides explicit headers and documentation
- UI patterns: MEDIUM - Best practices exist but vary by design system

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (30 days - stable ecosystem, unlikely major changes)

**Key findings:**
1. Toast API has excellent rate limit documentation with helpful response headers
2. Client-side polling is appropriate for this use case (no backend job scheduler needed)
3. Existing codebase already demonstrates successful polling pattern
4. React Context + localStorage hybrid provides both reactivity and persistence
5. 30-60 second interval is optimal balance between UX and API limits
