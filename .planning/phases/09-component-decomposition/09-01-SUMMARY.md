---
phase: 09-component-decomposition
plan: 01
subsystem: ui
tags: [react, nextjs, typescript, useMemo, component-architecture, recharts, supabase]

# Dependency graph
requires:
  - phase: 05-shrike-website-consolidation
    provides: ShrikeAnalytics component with 11 state variables
provides:
  - Thin tab container pattern (130 lines vs 606 lines)
  - 8 autonomous section components computing from raw visits
  - Shared StatCard and BreakdownCard components
  - Overview/Deep Dive tab layout for future analytics
affects: [10-session-journeys, 11-referrer-geo, 12-scroll-depth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Section component pattern: receives raw data, computes via useMemo, self-renders
    - Tab container pattern: data fetch + tab routing only, delegates rendering
    - Shared component library under components/shared/

key-files:
  created:
    - crm-dashboard/app/(dashboard)/analytics/components/shared/StatCard.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/shared/BreakdownCard.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/shared/types.ts
    - crm-dashboard/app/(dashboard)/analytics/components/shared/constants.ts
    - crm-dashboard/app/(dashboard)/analytics/components/sections/EngagementOverview.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/DownloadMetrics.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/TopPhotos.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/FeatureUsage.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/EngagementFunnel.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/ActivityTimeline.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/PageDistribution.tsx
    - crm-dashboard/app/(dashboard)/analytics/components/sections/DeviceBrowserOS.tsx
  modified:
    - crm-dashboard/app/(dashboard)/analytics/components/ShrikeAnalytics.tsx
    - crm-dashboard/app/(dashboard)/analytics/page.tsx

key-decisions:
  - "Section components compute from raw visits (not pre-computed state) to avoid prop drilling"
  - "useMemo for all computations to prevent recalculation on tab switching"
  - "Shared constants (EVENT_CATEGORIES, parseUA) exported from shared/constants.ts"
  - "Visit type exported from shared/types.ts as interface contract"
  - "Tab bar uses same pill-style toggle as site filter for visual consistency"

patterns-established:
  - "Section component signature: function SectionName({ visits }: { visits: Visit[] })"
  - "Section components are self-contained: import shared components, compute via useMemo, render JSX"
  - "Tab container owns: data fetching, site filtering, tab routing"
  - "Shared components live in components/shared/, sections in components/sections/"

# Metrics
duration: 307min
completed: 2026-02-15
---

# Phase 09 Plan 01: Component Decomposition Summary

**ShrikeAnalytics refactored from 606-line monolith to 130-line tab container + 8 autonomous section components + shared component library, enabling phases 10-12 to add Deep Dive analytics without touching Overview tab**

## Performance

- **Duration:** 5h 7min
- **Started:** 2026-02-15T23:17:41Z
- **Completed:** 2026-02-16T04:24:42Z
- **Tasks:** 4
- **Files modified:** 14 (12 created, 2 modified)

## Accomplishments
- Reduced ShrikeAnalytics.tsx from 606 lines with 11 state vars to 130 lines with 4 state vars
- Created 8 section components, each owning its own computation from raw visits
- Unified StatCard component shared across DefaultAnalytics and ShrikeAnalytics
- Added Overview/Deep Dive tab layout, with Deep Dive ready for phases 10-12
- Zero visual regression - all 8 sections render identically to pre-refactor

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared components** - `b6628c2` (feat)
2. **Task 2: Extract section components** - `83d5020` (feat)
3. **Task 3: Rewrite ShrikeAnalytics as tab container** - `d23fa8b` (refactor)
4. **Task 4: Update analytics/page.tsx to use shared StatCard** - `9b50e18` (refactor)

## Files Created/Modified

### Created
- `components/shared/StatCard.tsx` - Unified stat card with 7 color variants
- `components/shared/BreakdownCard.tsx` - Bar chart breakdown with % display
- `components/shared/types.ts` - Visit interface for type safety
- `components/shared/constants.ts` - EVENT_CATEGORIES, formatEventName, getEventColor, parseUA
- `components/sections/EngagementOverview.tsx` - Page views, sessions, interactions, avg per session
- `components/sections/DownloadMetrics.tsx` - Instant downloads, unique photos, queue, email
- `components/sections/TopPhotos.tsx` - Top 10 downloaded photos with filenames
- `components/sections/FeatureUsage.tsx` - Event breakdown with color-coded bars
- `components/sections/EngagementFunnel.tsx` - 4-step funnel (sessions → promo → form → submit)
- `components/sections/ActivityTimeline.tsx` - 30-day bar chart using Recharts
- `components/sections/PageDistribution.tsx` - Page view counts by page_path
- `components/sections/DeviceBrowserOS.tsx` - Device/browser/OS breakdowns

### Modified
- `components/ShrikeAnalytics.tsx` - Reduced to thin tab container (606 → 130 lines)
- `analytics/page.tsx` - Replaced local StatCard with shared import

## Decisions Made

1. **Section components compute from raw visits** - Rather than pre-computing all metrics in ShrikeAnalytics and passing down, each section receives the raw visits array and computes via useMemo. This prevents prop drilling and keeps sections autonomous.

2. **useMemo for all computations** - All section components wrap computations in useMemo to prevent recalculation when user switches between Overview/Deep Dive tabs.

3. **Shared constants exported from shared/constants.ts** - EVENT_CATEGORIES, getEventColor, formatEventName, and parseUA are used by multiple sections, so exported from shared location rather than duplicated.

4. **Visit interface as type contract** - Exported Visit interface from shared/types.ts ensures all sections expect same data shape from Supabase query.

5. **Pill-style tab toggle** - Tab bar uses same visual pattern as site filter (gray background with white active pill) for UI consistency.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - refactoring was straightforward. All sections extracted cleanly, build passed on first try for all tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for phases 10-12:**
- Deep Dive tab exists as placeholder
- Section component pattern established
- New analytics features can be added as new section components in Deep Dive tab
- Overview tab is frozen - no more changes to existing 8 sections

**No blockers** - architecture supports:
- Phase 10: Session journey visualization (new section in Deep Dive)
- Phase 11: Referrer analysis + geo distribution (new sections in Deep Dive)
- Phase 12: Scroll depth tracking (new section in Deep Dive)

---
*Phase: 09-component-decomposition*
*Completed: 2026-02-15*
