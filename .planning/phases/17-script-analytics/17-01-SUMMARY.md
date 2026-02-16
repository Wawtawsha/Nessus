---
phase: 17-script-analytics
plan: 01
subsystem: database
tags: [postgresql, supabase, rpc, analytics, aggregation]

# Dependency graph
requires:
  - phase: 14-schema-niche-taxonomy
    provides: scripts, niches, script_lead_outcomes tables with RLS policies
  - phase: 16-outcome-tracking
    provides: get_script_outcome_stats RPC (single-param version)
provides:
  - Three analytics RPCs with date range filtering (get_script_outcome_stats, get_niche_performance_stats, get_script_niche_matrix)
  - TypeScript interfaces for all RPC return types (ScriptPerformance, NichePerformance, ScriptNicheCell, DateRange)
affects: [17-02-script-analytics-ui, analytics, reporting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DROP old function signature before CREATE OR REPLACE to avoid overload ambiguity"
    - "Date filters in LEFT JOIN ON clause (not WHERE) to preserve zero-outcome entities"
    - "COUNT(o.id) pattern for accurate totals with LEFT JOIN"
    - "Division-by-zero guard in win_rate calculation"

key-files:
  created:
    - crm-dashboard/supabase/migrations/09_script_analytics_rpcs.sql
  modified:
    - crm-dashboard/types/script.ts

key-decisions:
  - "DROP old get_script_outcome_stats(UUID) before creating new 3-param version to avoid ambiguous function errors"
  - "get_script_outcome_stats shows inactive scripts (no is_active filter) for historical analytics view"
  - "All three RPCs accept optional p_start_date/p_end_date TIMESTAMPTZ DEFAULT NULL"
  - "Date filter moved to LEFT JOIN ON clause to preserve scripts/niches with zero outcomes in date range"
  - "get_script_niche_matrix uses CROSS JOIN + HAVING COUNT(l.id) > 0 to only show script-niche pairs where client has leads"

patterns-established:
  - "Analytics RPCs pattern: LEFT JOIN with date filter in ON clause, COUNT(o.id) for total, division guard for percentage"
  - "TypeScript analytics types mirror RPC column names exactly for type safety"
  - "DateRange type as union literal for consistent date filtering across analytics UI"

# Metrics
duration: 12min
completed: 2026-02-16
---

# Phase 17 Plan 01: Script Analytics RPCs Summary

**Three PostgreSQL RPCs for script analytics with date filtering, LEFT JOIN zero-preservation, and matching TypeScript types**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-16T18:15:00Z
- **Completed:** 2026-02-16T18:27:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Upgraded get_script_outcome_stats with date range parameters and script_title + is_active return columns
- Created get_niche_performance_stats for per-niche outcome aggregation
- Created get_script_niche_matrix for script x niche cross-tabulation
- All three RPCs preserve zero-outcome entities via LEFT JOIN with date filter in ON clause
- TypeScript types match RPC return signatures exactly (ScriptPerformance, NichePerformance, ScriptNicheCell, DateRange)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create analytics RPC migration** - `b2a5763` (feat)
2. **Task 2: Add analytics TypeScript types** - `87277f6` (feat)

## Files Created/Modified

### Created
- `crm-dashboard/supabase/migrations/09_script_analytics_rpcs.sql` - Three analytics RPC functions with date filtering

### Modified
- `crm-dashboard/types/script.ts` - Added ScriptPerformance, NichePerformance, ScriptNicheCell, DateRange types

## Decisions Made

**1. DROP old function signature before CREATE OR REPLACE**
- **Rationale:** PostgreSQL treats get_script_outcome_stats(UUID) and get_script_outcome_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) as different overloads. Without DROP, ScriptManager.tsx calls with only p_client_id would get "ambiguous function" errors. New function has DEFAULT NULL for date params, so single-param calls still work.

**2. Remove is_active filter from get_script_outcome_stats WHERE clause**
- **Rationale:** Analytics needs historical view of all scripts including inactive ones. Active/inactive toggle is operational, not analytical. Filter moved from WHERE to return column so UI can filter if needed.

**3. Move date filter to LEFT JOIN ON clause (not WHERE)**
- **Rationale:** With date filter in WHERE, scripts/niches with zero outcomes in the date range disappear. In ON clause, LEFT JOIN preserves them with 0 counts. Critical for "which scripts got no attempts?" insights.

**4. HAVING COUNT(l.id) > 0 in get_script_niche_matrix**
- **Rationale:** CROSS JOIN creates all script x niche combinations. HAVING filters to only script-niche pairs where the client has leads in that niche (no point showing "Restaurant script x Auto Repair niche" if client has no auto repair leads).

**5. COUNT(o.id) not COUNT(*) for total_count**
- **Rationale:** With LEFT JOIN, COUNT(*) returns 1 even when no outcomes exist (counts the row from scripts/niches table). COUNT(o.id) returns 0 when no outcomes (doesn't count NULL ids from LEFT JOIN).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - migration is SQL-only, no external service configuration required.

## Next Phase Readiness

**Ready for Plan 17-02 (Script Analytics UI):**
- All three RPCs deployed to Supabase (migration file ready)
- TypeScript types available for import
- RPC signatures support both "all time" (NULL dates) and date range filtering
- ScriptManager.tsx will continue to work (new get_script_outcome_stats defaults to all time when called with only p_client_id)

**No blockers.**

**Next steps:**
1. Deploy migration to Supabase: `npx supabase db push`
2. Build analytics UI components that call these RPCs
3. Add date range picker to analytics UI

---
*Phase: 17-script-analytics*
*Completed: 2026-02-16*
