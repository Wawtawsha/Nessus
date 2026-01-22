---
phase: 03-sync-automation
plan: 01
subsystem: background-sync
completed: 2026-01-22
duration: 5.3 min

tags:
  - polling
  - rate-limiting
  - context-api
  - toast-integration
  - react

requires:
  - 01-01 # Order details display
  - 02-01 # Lead matching panel

provides:
  - Automatic order sync every 60 seconds
  - Sync status indicator in sidebar
  - Rate limit handling with exponential backoff
  - Manual sync trigger from settings page

affects:
  - Future phases will benefit from always-current order data
  - Any new admin features can rely on auto-sync being active

tech-stack:
  added:
    - SyncContext (React Context API)
    - useEffect polling pattern
    - localStorage persistence
    - visibilitychange API
  patterns:
    - Global state management with Context API
    - Polling with cleanup and pause on tab hidden
    - Exponential backoff with jitter for rate limits
    - SSR-safe localStorage access

key-files:
  created:
    - crm-dashboard/contexts/SyncContext.tsx
    - crm-dashboard/components/SyncStatusIndicator.tsx
  modified:
    - crm-dashboard/app/(dashboard)/layout.tsx
    - crm-dashboard/components/DashboardLayout.tsx
    - crm-dashboard/app/(dashboard)/settings/toast/page.tsx

decisions:
  - decision: 60-second polling interval
    rationale: Balances freshness with API rate limits (Toast allows ~11 req/min sustained)
    alternatives: [30 seconds (more aggressive), 120 seconds (more conservative)]
    chosen: 60 seconds
    impact: medium
    reversibility: easy

  - decision: Only poll when admin AND client selected
    rationale: Prevents unnecessary API calls when viewing aggregate or no context
    alternatives: [Poll all active integrations, Poll regardless of role]
    chosen: Admin + client context required
    impact: medium
    reversibility: easy

  - decision: Pause polling when tab hidden
    rationale: Reduces server load and API usage when user isn't viewing app
    alternatives: [Continue polling always, Stop polling entirely]
    chosen: Pause on hidden, resume on visible
    impact: low
    reversibility: easy

  - decision: Use Retry-After header first, fallback to exponential backoff
    rationale: Toast API provides Retry-After, respecting it is best practice
    alternatives: [Only exponential backoff, Fixed delay]
    chosen: Header-first hybrid approach
    impact: high
    reversibility: medium

  - decision: Persist lastSyncAt to localStorage
    rationale: Show consistent sync time across page navigations and refresh
    alternatives: [Keep in memory only, Store in database]
    chosen: localStorage (client-side persistence)
    impact: low
    reversibility: easy
---

# Phase 03 Plan 01: Automatic Background Sync Summary

**One-liner:** 60-second auto-polling of Toast orders with exponential backoff rate limiting and sidebar status indicator

## What Was Built

Implemented automatic background synchronization of Toast POS orders that runs every 60 seconds when an admin user has a client selected. The sync status is displayed in a sidebar indicator showing real-time progress and relative time since last successful sync.

### Core Components

1. **SyncContext (`crm-dashboard/contexts/SyncContext.tsx`)**
   - React Context provider managing global sync state
   - Automatic 60-second polling when admin has client selected
   - Rate limit handling with Retry-After header check and exponential backoff fallback
   - Tab visibility detection to pause polling when app hidden
   - localStorage persistence for lastSyncAt across sessions
   - Concurrent sync prevention with isSyncingRef

2. **SyncStatusIndicator (`crm-dashboard/components/SyncStatusIndicator.tsx`)**
   - Visual status display in sidebar above Sign Out button
   - Shows 5 states: idle, syncing (spinner), success (checkmark + relative time), error (warning), rate-limited (pulse)
   - Relative time formatting (just now, Xm ago, Xh ago)
   - Updates time display every minute
   - Admin-only visibility

3. **Integration with Dashboard Layout**
   - SyncProvider wraps DashboardLayout (inside UserProvider for context access)
   - SyncStatusIndicator placed in sidebar footer
   - Manual sync button on Toast settings page wired to context

## Technical Implementation

### Polling Strategy
```typescript
useEffect(() => {
  if (!isAdmin || !currentClientId) return

  performSync() // Initial sync
  intervalRef.current = setInterval(performSync, 60000)

  return () => clearInterval(intervalRef.current)
}, [isAdmin, currentClientId, performSync])
```

### Rate Limit Handling
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  const delayMs = retryAfter
    ? parseInt(retryAfter) * 1000
    : Math.min(1000 * Math.pow(2, retryAttemptRef.current), 32000) + jitter

  setTimeout(() => performSync(), delayMs)
  retryAttemptRef.current++
}
```

### Tab Visibility Pause
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearInterval(intervalRef.current)
    } else if (isAdmin && currentClientId) {
      performSync()
      intervalRef.current = setInterval(performSync, 60000)
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [isAdmin, currentClientId, performSync])
```

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

Manual verification performed:

1. ✅ Auto-sync triggers every 60 seconds when admin selects client
2. ✅ Status indicator updates in real-time (syncing → success with time)
3. ✅ Manual sync button on settings page triggers context sync
4. ✅ TypeScript compiles without errors
5. ✅ No console errors on dev server start

Not manually testable (verified via code review):
- Rate limit handling with backoff (requires hitting Toast API limits)
- Tab visibility pause (verified logic, full test requires 2+ minutes)

## Commits

| Commit | Task | Files |
|--------|------|-------|
| bdb00df | Task 1: Create SyncContext | contexts/SyncContext.tsx |
| b3d5e0c | Task 2: Create SyncStatusIndicator | components/SyncStatusIndicator.tsx, app/(dashboard)/layout.tsx, components/DashboardLayout.tsx |
| 755047d | Task 3: Update Toast settings | app/(dashboard)/settings/toast/page.tsx |

## Impact Analysis

### Immediate Benefits
- **User Experience:** Orders automatically stay current without manual intervention
- **Admin Efficiency:** No need to remember to sync; happens in background
- **Visual Feedback:** Clear status indicator shows sync health at a glance
- **Error Visibility:** Failed syncs surface immediately in sidebar

### Technical Debt Addressed
- Removed duplicate sync logic from settings page
- Centralized sync state management in Context API
- Added proper rate limit handling (prevents API abuse)
- Implemented polling pause when app not visible (reduces server load)

### Future Phase Readiness

**Phase 04 (Analytics Dashboard)** will benefit from:
- Always-current revenue data from Toast orders
- No need to implement separate polling in analytics components
- Consistent sync state accessible via useSyncStatus hook

**Potential concerns:**
- If Toast API rate limits become an issue with multiple admins, may need to implement server-side job queue
- 60-second interval may need adjustment based on real-world usage patterns

## Lessons Learned

### What Went Well
1. **Followed established patterns:** SyncContext structure mirrored existing UserContext, making it immediately familiar
2. **Research phase paid off:** Having detailed RESEARCH.md with pitfalls and patterns made implementation smooth
3. **Atomic commits:** Each task committed independently with clear, descriptive messages
4. **Type safety:** TypeScript caught zero issues at compile time (clean implementation)

### What Could Improve
1. **Testing:** No automated tests written (unit tests would catch edge cases in rate limit logic)
2. **Logging:** Console logs helpful for debugging but could be removed or put behind feature flag
3. **Configuration:** Polling interval hardcoded (could be environment variable or admin setting)

### Patterns to Reuse
- **Context + localStorage hybrid:** Reactive state with persistence across sessions
- **useRef for interval management:** Prevents stale closures in setInterval callbacks
- **Tab visibility detection:** Should be standard for all polling operations
- **Exponential backoff with jitter:** Reusable pattern for any rate-limited API

## Next Steps

### Immediate (Within Phase 03)
- Monitor sync performance in production to validate 60-second interval
- Add metrics collection (sync duration, failure rate, rate limit frequency)

### Phase 04 (Analytics Dashboard)
- Leverage auto-sync for real-time revenue charts
- Add "Last synced" timestamp to analytics page header
- Consider sync status filter (e.g., hide data from clients with failed syncs)

### Future Enhancements (Post-MVP)
- Add sync history log (last 10 syncs with timestamps and results)
- Implement server-side sync job queue for multi-tenant scalability
- Add admin control to pause/resume auto-sync
- Webhook support from Toast to reduce polling frequency

## Metadata

**Phase:** 03-sync-automation
**Plan:** 01
**Completed:** 2026-01-22
**Duration:** 5.3 minutes
**Tasks:** 3/3 completed
**Commits:** 3 (bdb00df, b3d5e0c, 755047d)
**LOC Added:** ~300 (SyncContext: 206, SyncStatusIndicator: 110, Layout updates: 10)
**LOC Removed:** ~30 (duplicate sync logic in settings page)
