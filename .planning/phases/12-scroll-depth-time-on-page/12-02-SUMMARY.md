---
phase: 12-scroll-depth-time-on-page
plan: 02
subsystem: analytics
tags: [react, useMemo, scroll-tracking, analytics-dashboard]

# Dependency graph
requires:
  - phase: 09-session-journeys
    provides: Section component pattern with Visit prop and useMemo
  - phase: 11-referrer-analysis-geo-distribution
    provides: StatCard component and section layout patterns
provides:
  - ScrollDepth analytics section showing per-page scroll milestone achievement rates
  - Empty state handling for missing scroll_depth events
  - Summary stats: pages tracked, average max scroll depth, most-read page
affects: [13-scroll-depth-ui, v1.3-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Milestone achievement calculation: unique sessions reaching milestone / total page view sessions"
    - "Session max scroll computation: track max milestone per session, then average across all sessions"

key-files:
  created:
    - crm-dashboard/app/(dashboard)/analytics/components/sections/ScrollDepth.tsx
  modified:
    - crm-dashboard/app/(dashboard)/analytics/components/ShrikeAnalytics.tsx

key-decisions:
  - "Achievement rates use page view sessions as denominator (not scroll event count)"
  - "Fallback to unique scroll sessions when no page view data exists for a page"
  - "Average max scroll calculated per session (finds max milestone each session reached, then averages)"
  - "Most-read page uses 100% achievement rate, falls back to average milestone rate if no 100% data"
  - "Top 10 pages by session count shown (no pagination/show-more)"
  - "Page paths truncated to last 2 segments if > 30 characters"

patterns-established:
  - "Milestone colors: 25%=green, 50%=blue, 75%=yellow, 90%=orange, 100%=red for visual gradient"
  - "Empty state messaging explains what data is missing and when it will appear"

# Metrics
duration: 2.4min
completed: 2026-02-17
---

# Phase 12 Plan 02: Scroll Depth Analytics Summary

**ScrollDepth section shows per-page milestone achievement rates with summary stats for pages tracked, average max scroll depth, and most-read page**

## Performance

- **Duration:** 2.4 min
- **Started:** 2026-02-17T03:25:57Z
- **Completed:** 2026-02-17T03:28:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ScrollDepth section component filters scroll_depth events and calculates milestone achievement rates per page
- Summary stats display pages tracked, avg max scroll percentage, and most-read page
- Per-page breakdown shows horizontal milestone bars for 25/50/75/90/100% milestones
- Empty state with informative message when no scroll data exists
- Component wired into Deep Dive tab as 5th section after GeoDistribution

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ScrollDepth section component** - `6a20ca5` (feat)
2. **Task 2: Wire ScrollDepth into ShrikeAnalytics Deep Dive tab** - `b7d1da2` (feat)

## Files Created/Modified
- `crm-dashboard/app/(dashboard)/analytics/components/sections/ScrollDepth.tsx` - ScrollDepth section component with useMemo computation, milestone achievement calculation, and per-page visualization
- `crm-dashboard/app/(dashboard)/analytics/components/ShrikeAnalytics.tsx` - Added ScrollDepth import and rendering in Deep Dive tab

## Decisions Made

**Achievement rate calculation:**
- Uses page view sessions as denominator (visits with event_name === null)
- Fallback to unique scroll event sessions when no page view data exists for a page
- Prevents inflated rates from multi-event sessions

**Average max scroll computation:**
- For each session, find max milestone reached (highest percent_scrolled value)
- Average those max values across all sessions with scroll data
- Example: session A reached 75%, session B reached 50% → avgMaxScroll = 62.5%

**Most-read page determination:**
- Primary: page with highest 100% achievement rate
- Fallback: page with highest average milestone rate if no 100% data
- Ensures metric always returns meaningful result

**UI constraints:**
- Top 10 pages by session count (no pagination to keep UI simple)
- Page path truncation to last 2 segments if > 30 chars
- Milestone color gradient provides visual progression cue

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

ScrollDepth section complete and functional. Ready for Phase 13 (scroll depth tracking implementation in Shrike website).

**Current state:**
- Deep Dive tab now has 5 sections: SessionJourneys, TimeOnPage, ReferrerAnalysis, GeoDistribution, ScrollDepth
- ScrollDepth shows empty state (no scroll_depth events exist yet in database)
- Once Phase 13 adds scroll tracking to Shrike website, this section will populate with real data

**Blockers:** None

**Next steps:** Phase 13 will implement scroll depth tracking in the Shrike website (useNessusTracking hook enhancement)

---
*Phase: 12-scroll-depth-time-on-page*
*Completed: 2026-02-17*
