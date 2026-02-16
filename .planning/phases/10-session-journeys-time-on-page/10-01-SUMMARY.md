---
phase: 10-session-journeys-time-on-page
plan: 01
subsystem: ui
tags: [react, nextjs, typescript, useMemo, analytics, session-tracking, date-fns]

# Dependency graph
requires:
  - phase: 09-component-decomposition
    provides: Section component pattern, Visit interface, shared components, Deep Dive tab placeholder
provides:
  - SessionJourneys component showing chronological event timelines grouped by session
  - TimeOnPage component showing average page durations from timestamp deltas
  - Deep Dive tab with real session analytics (replacing "Coming Soon")
affects: [11-referrer-geo, 12-scroll-depth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Session grouping via Map with chronological sorting within sessions
    - Time-on-page calculation using consecutive event timestamp deltas
    - Last-page exclusion pattern (no next timestamp available)
    - 30-minute duration cap to exclude abandoned tabs

key-files:
  created:
    - crm-dashboard/app/(dashboard)/analytics/components/sections/SessionJourneys.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/TimeOnPage.tsx
  modified:
    - crm-dashboard/app/(dashboard)/analytics/components/ShrikeAnalytics.tsx

key-decisions:
  - "Time deltas calculated within sessions only (never across session boundaries)"
  - "Last page in each session excluded from time-on-page metrics (no exit timestamp)"
  - "30-minute cap on page durations to exclude abandoned tabs"
  - "SessionJourneys shows 10 most recent sessions by default with Show More button"

patterns-established:
  - "Session grouping pattern: Map<session_id, Visit[]> → sort chronologically → process"
  - "Duration formatting helper: formatDuration(seconds) → 'Xm Ys' or 'Xs'"
  - "Consecutive pair iteration: for (i = 0; i < arr.length - 1; i++) to skip last element"

# Metrics
duration: 6min
completed: 2026-02-16
---

# Phase 10 Plan 01: Session Journeys + Time on Page Summary

**Deep Dive tab now shows session-level visitor insights: chronological event timelines grouped by session and average time-on-page computed from timestamp deltas with last-page exclusion**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-15T23:58:13Z
- **Completed:** 2026-02-16T00:04:12Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- SessionJourneys component groups visits by session_id and displays chronological event timelines with start time, duration, and event count
- TimeOnPage component calculates average page durations from consecutive event timestamp deltas within sessions
- Deep Dive tab functional with real analytics (no more "Coming Soon" placeholder)
- Site filter applies to both Deep Dive sections via shared visits state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SessionJourneys section component** - `79f238f` (feat)
2. **Task 2: Create TimeOnPage section component** - `34657ac` (feat)
3. **Task 3: Wire Deep Dive sections into ShrikeAnalytics** - `c45293e` (feat)

## Files Created/Modified

### Created
- `components/sections/SessionJourneys.tsx` - Groups visits by session, displays chronological event timelines with summary stats (total sessions, avg events/session, avg duration). Shows 10 most recent sessions by default with expandable "Show more" button. Each session card shows start time, duration, event count badge, and timeline with colored event dots.
- `components/sections/TimeOnPage.tsx` - Computes average time on page from consecutive event timestamp deltas within sessions. Excludes last page in each session (no next timestamp) and caps durations at 30 minutes (abandoned tabs). Shows overall stats and per-page breakdown with visual bars.

### Modified
- `components/ShrikeAnalytics.tsx` - Added SessionJourneys and TimeOnPage imports, replaced "Coming Soon" placeholder with new section components in Deep Dive tab

## Decisions Made

1. **Time deltas calculated within sessions only** - Grouped visits by session_id BEFORE calculating durations to prevent cross-session time calculations (would create impossible durations like hours between consecutive events).

2. **Last page exclusion from time-on-page** - The last page in every session has no duration (no subsequent timestamp to calculate delta). Documented limitation in UI: "Last page in each session excluded (no exit timestamp)."

3. **30-minute duration cap** - Skip durations > 1800 seconds to exclude abandoned tabs from time-on-page averages (user left tab open but wasn't actively viewing).

4. **Show 10 sessions by default** - SessionJourneys displays 10 most recent sessions with "Show more" button to prevent overwhelming UI while still providing access to full data.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both section components followed established Phase 9 pattern. Build passed on first try for all tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for phases 11-12:**
- Deep Dive tab has two working analytics sections (SessionJourneys, TimeOnPage)
- Section component pattern proven for session-based analytics
- Phase 11 can add Referrer Analysis and Geographic Distribution sections
- Phase 12 can add Scroll Depth section

**Implementation notes for future phases:**
- SessionJourneys pattern (Map grouping + chronological sort) applies to any session-based visualization
- TimeOnPage pattern (consecutive pair iteration with last-element exclusion) applies to any delta-based metric
- Both sections use same formatDuration helper - consider extracting to shared/utils.ts if more sections need it

---
*Phase: 10-session-journeys-time-on-page*
*Completed: 2026-02-16*
