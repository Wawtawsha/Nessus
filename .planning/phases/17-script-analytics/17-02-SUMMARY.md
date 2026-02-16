---
phase: 17-script-analytics
plan: 02
subsystem: ui
tags: [react, recharts, shadcn, analytics, supabase-rpc]

# Dependency graph
requires:
  - phase: 17-01
    provides: Three analytics RPCs (get_script_outcome_stats, get_niche_performance_stats, get_script_niche_matrix) with date filtering + TypeScript types
provides:
  - Script Analytics UI with three views: Overall Performance table, By Niche bar chart, By Script + Niche matrix
  - Date range filter (7d/30d/90d/all) affecting all views
  - Empty state handling and zero-outcome display
  - Collapsible analytics section on Cold Calling leads page
affects: [future script analytics enhancements, cold calling workflow improvements]

# Tech tracking
tech-stack:
  added: [shadcn Table component]
  patterns:
    - "Button group filter pattern from ShrikeAnalytics (bg-gray-100 rounded-lg p-1, active with bg-white shadow-sm)"
    - "Collapsible section pattern (matches Call Scripts section style)"
    - "Three-tiered date filtering in LEFT JOIN (preserves zero-outcome entities)"

key-files:
  created:
    - crm-dashboard/components/ui/table.tsx
    - crm-dashboard/components/ScriptAnalytics.tsx
    - crm-dashboard/components/OverallPerformance.tsx
    - crm-dashboard/components/NichePerformance.tsx
    - crm-dashboard/components/ScriptNicheMatrix.tsx
  modified:
    - crm-dashboard/app/(dashboard)/leads/page.tsx

key-decisions:
  - "Default collapsed for analytics section (scriptsExpanded=true, analyticsExpanded=false) - analytics is secondary to leads workflow"
  - "Simplified Tooltip in NichePerformance (removed formatter prop to avoid TypeScript overload issues with recharts)"
  - "Filter zero-outcome entities client-side after RPC (additional safety beyond HAVING clause in SQL)"
  - "Visual grouping in ScriptNicheMatrix via border-t-2 when script changes (not separate <tbody> elements)"

patterns-established:
  - "dateRangeToFilter helper duplicated in each component (3 lines, not worth extracting to shared file for MVP)"
  - "Empty state messages provide context ('No scripts yet. Create your first script...' not just 'No data')"
  - "Zero-outcome display: 'No data yet' in gray italic, not '0%' or NaN"
  - "Inactive scripts: opacity-50 + '(Inactive)' gray label"

# Metrics
duration: 5min
completed: 2026-02-16
---

# Phase 17 Plan 02: Script Analytics UI Summary

**Script Analytics dashboard with three views (overall table, niche bar chart, script-niche matrix), date filtering (7d/30d/90d/all), and collapsible section on Cold Calling leads page**

## Performance

- **Duration:** 5 min 14 sec
- **Started:** 2026-02-16T18:25:56Z
- **Completed:** 2026-02-16T18:31:10Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Script Analytics UI component with three tabbed views and date range filter
- OverallPerformance table showing per-script success/fail/win-rate stats
- NichePerformance recharts bar chart showing win rates by business niche
- ScriptNicheMatrix grouped table showing script effectiveness within each niche
- Collapsible analytics section wired into Cold Calling leads page (default collapsed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn Table and create analytics components** - `2afe0ab` (feat)
   - Installed shadcn Table component via CLI
   - Created ScriptAnalytics container with date range and view state
   - Created OverallPerformance table calling get_script_outcome_stats RPC
   - Created NichePerformance bar chart calling get_niche_performance_stats RPC
   - Created ScriptNicheMatrix grouped table calling get_script_niche_matrix RPC
   - All components handle empty states, inactive scripts, zero outcomes

2. **Task 2: Wire ScriptAnalytics into leads page** - `cb9ea15` (feat)
   - Added ScriptAnalytics import to leads page
   - Added analyticsExpanded state (default false)
   - Added collapsible Script Analytics section below Call Scripts
   - Follows same button style as Call Scripts section

## Files Created/Modified
- `crm-dashboard/components/ui/table.tsx` - shadcn Table primitive components (Table, TableHeader, TableBody, TableRow, TableHead, TableCell)
- `crm-dashboard/components/ScriptAnalytics.tsx` - Container with date range filter (7d/30d/90d/all) and view tabs (overall/by-niche/matrix)
- `crm-dashboard/components/OverallPerformance.tsx` - Per-script performance table with success/fail/win-rate columns
- `crm-dashboard/components/NichePerformance.tsx` - Recharts bar chart showing win rates by niche
- `crm-dashboard/components/ScriptNicheMatrix.tsx` - Grouped table showing script x niche performance breakdown
- `crm-dashboard/app/(dashboard)/leads/page.tsx` - Added ScriptAnalytics section (collapsible, below Call Scripts)

## Decisions Made

**1. Default analytics section to collapsed**
- Rationale: Analytics is secondary to the leads workflow (calling and recording outcomes). Users expand when they want to analyze performance.
- scriptsExpanded defaults to true (primary tool), analyticsExpanded defaults to false

**2. Simplified Tooltip in NichePerformance**
- Issue: TypeScript overload error with recharts Tooltip formatter prop (value: number | undefined incompatibility)
- Solution: Removed formatter prop, used only custom content prop for tooltip rendering
- Benefit: Simpler implementation, full control over tooltip content

**3. Client-side filtering for zero-outcome entities**
- Pattern: Filter `total_count > 0` client-side after RPC returns data
- Rationale: Additional safety beyond SQL HAVING clause. If RPC changes or returns unexpected data, client gracefully handles it
- Applied in: NichePerformance and ScriptNicheMatrix components

**4. Visual grouping in ScriptNicheMatrix via border styling**
- Pattern: Track previous script_id, add `border-t-2 border-gray-300` when script changes
- Rationale: Cleaner than separate <tbody> elements, works with shadcn Table structure
- Result: Clear visual script grouping without complex DOM manipulation

## Deviations from Plan

None - plan executed exactly as written.

Minor TypeScript fix: Added type annotations to `.filter()` callbacks to avoid implicit `any` type errors. This is standard practice, not a deviation.

## Issues Encountered

**TypeScript: Implicit any type in filter callback**
- Error: `(niche) => niche.total_count > 0` triggered "implicitly has 'any' type" error
- Fix: Added explicit type: `(niche: NichePerformanceData) => niche.total_count > 0`
- Applied to: NichePerformance.tsx and ScriptNicheMatrix.tsx

**TypeScript: Tooltip formatter overload error**
- Error: `formatter={(value: number, name: string) => ...}` incompatible with recharts Formatter type (expects `number | undefined`)
- Fix: Removed formatter prop entirely, used only custom content prop
- Impact: Cleaner implementation, full tooltip control

Both issues resolved quickly without affecting plan scope or timeline.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**v1.4 Cold Calling Scripts milestone: COMPLETE**

Phase 17 (Script Analytics) complete:
- Plan 17-01: Three analytics RPCs with date filtering ✓
- Plan 17-02: Analytics UI components ✓

All v1.4 phases complete:
- Phase 14: Schema + Niche Taxonomy ✓
- Phase 15: Script Library CRUD ✓
- Phase 16: Outcome Tracking ✓
- Phase 17: Script Analytics ✓

**Ready for:**
- User testing of Cold Calling workflow
- Performance monitoring of script analytics queries
- Potential future enhancements: script versioning, A/B testing, advanced filtering

**No blockers.**

**Bundle size impact:** /leads route First Load JS increased from 217 kB to 321 kB (+104 kB) due to analytics components and recharts library. Acceptable for analytics functionality. Future optimization: code-split analytics into separate route if needed.

---
*Phase: 17-script-analytics*
*Completed: 2026-02-16*
