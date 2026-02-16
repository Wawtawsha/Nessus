---
phase: 16-outcome-tracking
plan: 02
subsystem: ui
tags: [react, supabase, dialog, upsert, mobile, outcome-tracking, stats]

# Dependency graph
requires:
  - phase: 16-outcome-tracking
    plan: 01
    provides: get_script_outcome_stats RPC, OutcomeStats, ScriptWithStats, outcomeSchema
provides:
  - RecordOutcomeDialog component with relative-positioned dropdown
  - ScriptCard with stats row display
  - ScriptManager with record-outcome dialog mode and RPC integration
affects: [17-script-analytics]

key-files:
  created:
    - crm-dashboard/components/RecordOutcomeDialog.tsx
  modified:
    - crm-dashboard/components/ScriptCard.tsx
    - crm-dashboard/components/ScriptManager.tsx

key-decisions:
  - decision: Use relative-positioned dropdown instead of Radix Popover for lead selector
    rationale: Phase 14 lesson learned - Radix Popover renders behind Dialog (z-index bug)
    impact: Avoids portal-behind-dialog rendering issues
  - decision: Place outcome buttons ABOVE notes textarea
    rationale: Mobile keyboard won't obscure buttons when notes field is focused
    impact: Better mobile UX - users can see and tap success/fail without scrolling
  - decision: Show existing outcome as status badge, not pre-selected button state
    rationale: Clearer visual feedback - user sees "Current: Success" badge vs implicit button state
    impact: Less ambiguous - user knows they're updating, not creating
  - decision: Fetch stats via RPC on mount and after every outcome save
    rationale: Ensures counters are always current after any outcome change
    impact: Slightly more RPC calls but guarantees UI consistency

# Metrics
duration: ~66min
completed: 2026-02-16
---

# Phase 16 Plan 02: Outcome Tracking UI Summary

**Mobile-first outcome recording with aggregated stats display on script cards**

## Performance
- Tasks: 2 auto
- Files created: 1
- Files modified: 2
- Commits: 2344025, eda8b38

## Accomplishments

**RecordOutcomeDialog component (Task 1):**
- Lead selector with relative-positioned dropdown (NOT Radix Popover - avoids z-index issues)
- React Hook Form Controller wrapper for validation
- Existing outcome loading when lead selected - shows "Current: Success/Failed" badge
- Pre-fills notes from existing outcome
- 48x48px success/fail buttons above notes textarea (mobile keyboard won't cover them)
- Supabase upsert with `onConflict: 'script_id,lead_id'` for outcome updates
- Optional notes textarea (Zod schema allows empty string)

**ScriptCard enhancements (Task 2):**
- Changed props to accept `ScriptWithStats` instead of `Script`
- Stats row displays: `{success_count} won`, `{fail_count} lost`, `{win_rate}%`
- Stats row only shown when `total_count > 0` (no clutter for unused scripts)
- "Record Call" button added as first action (leftmost, most accessible)
- Phone icon for visual clarity

**ScriptManager integration (Task 2):**
- Extended `DialogMode` type to include `'record-outcome'`
- Changed state from `Script[]` to `ScriptWithStats[]`
- Replaced `fetchScripts` with `fetchScriptsAndStats`:
  - Fetches scripts from Supabase
  - Fetches stats via `get_script_outcome_stats` RPC
  - Joins with LEFT JOIN semantics (default stats for zero-outcome scripts)
- Added `handleRecordOutcome` to open dialog
- Added `handleOutcomeSaved` to refetch stats and close dialog
- RecordOutcomeDialog wired into dialog state machine
- All existing dialog modes preserved (add/edit/view still work)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Initial type error in RecordOutcomeDialog:**
- Selected only `id, first_name, last_name, email` from leads table
- TypeScript error: incomplete Lead type (missing 16 required fields)
- Fix: Changed to `select('*')` to fetch complete Lead records
- Impact: Minor - caught at build time, fixed in 30 seconds

## Files Created/Modified

**Created:**
- `crm-dashboard/components/RecordOutcomeDialog.tsx` (330 lines)
  - Lead selector with search and filtering
  - Existing outcome detection and pre-fill
  - 48x48px outcome buttons (mobile-friendly)
  - Optional notes with placeholder text
  - Upsert logic with conflict resolution

**Modified:**
- `crm-dashboard/components/ScriptCard.tsx` (+11 lines)
  - ScriptWithStats props interface
  - Stats row conditional render
  - "Record Call" button with Phone icon

- `crm-dashboard/components/ScriptManager.tsx` (+62 lines, -20 lines)
  - ScriptWithStats state type
  - fetchScriptsAndStats with RPC integration
  - record-outcome dialog mode
  - RecordOutcomeDialog render block

## Testing Notes

**Build verification:**
- `npm run build` passes with no type errors
- All existing functionality preserved (add/edit/view/toggle still work)
- RecordOutcomeDialog integrates cleanly into dialog state machine

**Manual verification required (not performed in this execution):**
1. Open Cold Calling page for a client with leads
2. Click "Record Call" on a script card
3. Verify lead dropdown opens with relative positioning (no z-index issues)
4. Select a lead - verify no existing outcome message appears
5. Click "Success" - verify outcome saves and dialog closes
6. Verify script card stats row appears with "1 won, 0 lost, 100%"
7. Click "Record Call" again on same script, select same lead
8. Verify "Current: Success" badge appears
9. Verify notes textarea pre-filled if notes were saved
10. Click "Failed" - verify outcome updates and stats change to "0 won, 1 lost, 0%"

## Next Steps

Phase 16 Plan 02 complete. Ready for:
- Phase 16 Plan 03 (if exists - analytics/reporting on outcomes)
- OR Phase 17 (next phase in milestone)
- Manual testing of full outcome tracking flow
- Consider adding outcome history view (list of all outcomes for a script)
- Consider adding bulk outcome import (CSV of call results)
