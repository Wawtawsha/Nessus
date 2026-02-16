# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Connect marketing leads to actual revenue
**Current focus:** v1.4 Cold Calling Scripts

## Current Position

Milestone: v1.4 Cold Calling Scripts
Phase: 16 - Outcome Tracking (in progress)
Plan: 16-01 (complete)
Status: Phase 16 Plan 01 complete - RPC + types + schema ready
Last activity: 2026-02-16 -- Completed 16-01-PLAN.md (get_script_outcome_stats RPC, OutcomeStats types, outcomeSchema)

Progress v1.4: ████░░ (2/4 phases complete, 16-01 done)

## v1.4 Phases

| Phase | Name | Status |
|-------|------|--------|
| 14 | Schema + Niche Taxonomy | ✓ Complete |
| 15 | Script Library CRUD | ✓ Complete |
| 16 | Outcome Tracking | In Progress (16-01 complete) |
| 17 | Script Analytics | Pending |

## Completed Milestones

| Version | Name | Phases | Plans | Duration |
|---------|------|--------|-------|----------|
| v1.0 | Foundation | -- | -- | 2026-01 |
| v1.1 | Toast Enhancements | 5 | 6 | 2026-01-15 to 2026-02-13 |
| v1.2 | Lead Management | 3 | 3 | 2026-02-14 to 2026-02-15 |
| v1.3 | Analytics Deep Dive | 5 | 6 | 2026-02-15 |

See `.planning/milestones/` for archived details.

## Accumulated Context

### Key Decisions (v1.4 scope)

| Decision | Phase | Rationale |
|----------|-------|-----------|
| All 3 tables (scripts, niches, script_lead_outcomes) created in single migration | 14-01 | Single foundation, avoids fragmented migrations |
| Niche names normalized to lowercase with UNIQUE constraint | 14-01 | Prevents "Restaurant" vs "restaurant" duplicates, enforced via CHECK constraint |
| Soft delete for scripts (is_active flag) | 14-01 | Preserves outcome history when scripts retired |
| niche_id on leads uses ON DELETE SET NULL (not CASCADE) | 14-01 | Preserves leads when niche removed (deleting niche shouldn't delete leads) |
| UNIQUE(script_id, lead_id) on script_lead_outcomes | 14-01 | Enables upsert pattern for updating outcomes |
| RLS policies scope scripts through user_clients join | 14-01 | Multi-tenant security enforced at database level |
| Script outcome is binary success/fail for MVP | 16 (planned) | Keep simple, expand categories based on user feedback (Pitfall 16) |
| mode:'onSubmit' for RHF inside shadcn Dialog | 15-01 | Prevents Dialog X button from triggering validation errors |
| Dialog state machine (closed/add/edit/view) | 15-01 | Single state var instead of multiple booleans, cleaner transitions |
| No is_active in script form (separate toggle button) | 15-01 | Form focused on content; active/inactive is operational, not editorial |
| LEFT JOIN in get_script_outcome_stats RPC | 16-01 | Ensures scripts with zero outcomes appear with 0 counts (not hidden) |
| COUNT(o.id) not COUNT(*) for total_count | 16-01 | With LEFT JOIN, COUNT(*) returns 1 even when no outcomes; COUNT(o.id) returns 0 correctly |
| Win rate division by zero guard | 16-01 | Returns 0% when total_count = 0, prevents NaN/infinity in analytics |

### Research Artifacts

| File | Content | Key Findings |
|------|---------|--------------|
| research/FEATURES_V1.4_CALL_SCRIPTS.md | Feature research | 4-phase MVP, table stakes vs differentiators, anti-features |
| research/ARCHITECTURE.md | Schema + component design | 3 new tables, RLS policies, component structure, data flows |
| research/PITFALLS.md | 18 domain pitfalls | Critical: orphaned outcomes, missing RLS SELECT, niche duplicates, NaN analytics, missing indexes |
| research/STACK-v1.4.md | Stack decisions | react-hook-form + zod, shadcn Command/Dialog/Textarea, Supabase RPC for analytics |

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Directory |
|---|-------------|------|-----------|
| 001 | Full Resync with optimized batch inserts (30,424 orders synced) | 2026-01-23 | [001-run-full-resync](./quick/001-run-full-resync-with-optimized-batch-ins/) |

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 16-01-PLAN.md (RPC + types + schema)
Resume file: None
Next: Phase 16 Plan 02 (Outcome Tracking UI) — ready to execute

### Roadmap Evolution

- v1.3 Analytics Deep Dive: shipped 2026-02-15 (5 phases, 6 plans)
- v1.4 Cold Calling Scripts roadmap defined: schema + niche taxonomy, script CRUD, outcome tracking, script analytics
- Phase 14 complete: NicheComboBox, leads integration, photo download → lead pipeline
- Phase 15 complete: ScriptManager, ScriptCard, AddEditScriptDialog with RHF+Zod validation
- Phase 16 Plan 01 complete: get_script_outcome_stats RPC, OutcomeStats/ScriptWithStats types, outcomeSchema

---
*Last updated: 2026-02-16*
