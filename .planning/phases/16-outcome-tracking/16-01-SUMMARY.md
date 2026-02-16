---
phase: 16-outcome-tracking
plan: 01
subsystem: data
tags: [postgresql, rpc, typescript, zod, aggregation]

# Dependency graph
requires:
  - phase: 14-schema-niche-taxonomy
    plan: 01
    provides: scripts table, script_lead_outcomes table with UNIQUE constraint
provides:
  - get_script_outcome_stats RPC function
  - OutcomeStats, ScriptWithStats, ScriptOutcome types
  - outcomeSchema Zod schema
affects: [16-02]

# Tech stack
tech-stack:
  added: []
  patterns:
    - PostgreSQL RPC with LEFT JOIN for zero-outcome scripts
    - COUNT(o.id) instead of COUNT(*) for correct LEFT JOIN totals
    - Type-safe outcome form validation with Zod

key-files:
  created:
    - crm-dashboard/supabase/migrations/08_script_outcome_stats.sql
    - crm-dashboard/lib/schemas/outcomeSchema.ts
  modified:
    - crm-dashboard/types/script.ts

key-decisions:
  - decision: Use LEFT JOIN in RPC so scripts with zero outcomes return 0 counts
    rationale: UI needs to display all active scripts, not just those with outcomes
    alternative: INNER JOIN (would hide scripts without outcomes)
  - decision: Use COUNT(o.id) not COUNT(*) for total_count
    rationale: With LEFT JOIN, COUNT(*) returns 1 even when no outcomes exist (counts the script row)
    pattern: COUNT(o.id) correctly returns 0 when o.id is NULL
  - decision: Win rate division by zero guard (CASE WHEN COUNT(o.id) > 0)
    rationale: Prevents NaN/infinity when script has no outcomes
    result: Scripts with 0 outcomes show 0% win rate
  - decision: SECURITY DEFINER on RPC function
    rationale: Allows function to bypass RLS while enforcing client_id filter internally
    pattern: Matches existing get_revenue_by_period RPC pattern

# Metrics
duration: ~5min
completed: 2026-02-16
---

# Phase 16 Plan 01: RPC + Types + Schema Summary

**PostgreSQL RPC for script outcome aggregation with type-safe TypeScript interfaces and Zod validation**

## Performance
- Tasks: 2 auto (all complete)
- Files created: 2
- Files modified: 1
- Commits: 2 (b9d300e, ab9f227)

## Accomplishments

### Database Layer (Task 1)
- Created `get_script_outcome_stats(p_client_id UUID)` RPC function
- Returns: script_id, success_count, fail_count, total_count, win_rate per script
- LEFT JOIN ensures scripts with zero outcomes appear with 0 counts (not hidden)
- COUNT(o.id) used instead of COUNT(*) for correct total_count with LEFT JOIN
- Win rate calculated as (success_count / total_count) * 100, rounded to 1 decimal
- Division by zero guard: returns 0% when total_count = 0
- SECURITY DEFINER for RLS bypass, client_id filter enforced in query
- Only returns active scripts (is_active = true)
- Ordered by created_at DESC (newest scripts first)

### TypeScript Layer (Task 2)
- Extended `crm-dashboard/types/script.ts` with 3 new exports:
  - `OutcomeStats` interface: matches RPC return columns
  - `ScriptWithStats` type: Script & { stats: OutcomeStats }
  - `ScriptOutcome` interface: matches script_lead_outcomes table
- Created `crm-dashboard/lib/schemas/outcomeSchema.ts`:
  - Validates lead_id as required UUID
  - Validates notes as optional string
  - Exports OutcomeFormValues type from schema inference
- No breaking changes to existing Script interface
- Build passes (TypeScript compilation successful)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Build prerender errors on /login page are pre-existing and unrelated to our changes.

## Files Created/Modified

### Created
1. **crm-dashboard/supabase/migrations/08_script_outcome_stats.sql**
   - PostgreSQL RPC function for aggregating outcome statistics
   - 62 lines, comprehensive documentation comments
   - Critical patterns: LEFT JOIN, COUNT(o.id), COALESCE, division guard

2. **crm-dashboard/lib/schemas/outcomeSchema.ts**
   - Zod schema for outcome recording form
   - Validates lead_id (required UUID) and notes (optional)
   - 8 lines, follows scriptSchema.ts pattern

### Modified
3. **crm-dashboard/types/script.ts**
   - Added OutcomeStats, ScriptWithStats, ScriptOutcome exports
   - 20 additional lines
   - Script interface unchanged (no breaking changes)

## Next Phase Readiness

**Ready for Phase 16 Plan 02** (Outcome Tracking UI):
- RPC function deployed and ready to call
- Types available for component props and state
- Zod schema ready for react-hook-form integration
- No blockers identified

**Key integration points for Plan 02:**
- Call `supabase.rpc('get_script_outcome_stats', { p_client_id })` from ScriptManager
- Use ScriptWithStats type for ScriptCard props
- Use outcomeSchema with useForm hook in RecordOutcomeDialog
- Use ScriptOutcome type for existing outcome display

## Verification

All verification criteria met:
- ✓ Migration uses LEFT JOIN (line 50)
- ✓ Migration uses COUNT(o.id) for total_count (line 42)
- ✓ Migration has SECURITY DEFINER (line 56)
- ✓ Script types file has 4 exports (Script, OutcomeStats, ScriptWithStats, ScriptOutcome)
- ✓ Outcome schema validates lead_id as required UUID
- ✓ Build passes: `npm run build` compiled successfully
