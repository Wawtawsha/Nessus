# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Connect marketing leads to actual revenue
**Current focus:** v1.4 Cold Calling Scripts (v1.3 running in parallel window)

## Current Position

Milestone: v1.4 Cold Calling Scripts
Phase: 14 - Schema + Niche Taxonomy (1 of 1 plans complete)
Plan: 14-01 complete
Status: Phase 14 complete, ready for Phase 15
Last activity: 2026-02-16 -- Completed 14-01-PLAN.md (Database schema for scripts, niches, outcomes)

Note: v1.3 Analytics Deep Dive -- Phase 11 Plan 01 complete (ReferrerAnalysis + GeoDistribution)

Progress: █░░░ (1/4 phases = 25%)

## v1.4 Phases

| Phase | Name | Status |
|-------|------|--------|
| 14 | Schema + Niche Taxonomy | ✓ Complete |
| 15 | Script Library CRUD | Pending |
| 16 | Outcome Tracking | Pending |
| 17 | Script Analytics | Pending |

## Completed Milestones

| Version | Name | Phases | Plans | Duration |
|---------|------|--------|-------|----------|
| v1.0 | Foundation | -- | -- | 2026-01 |
| v1.1 | Toast Enhancements | 5 | 6 | 2026-01-15 to 2026-02-13 |
| v1.2 | Lead Management | 3 | 3 | 2026-02-14 to 2026-02-15 |

See `.planning/milestones/` for archived details.

## Accumulated Context

### Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Section components compute from raw visits (not pre-computed state) | 09-01 | Prevents prop drilling, keeps sections autonomous |
| useMemo for all section computations | 09-01 | Prevents recalculation on tab switching |
| Visit interface as type contract | 09-01 | Type safety across all section components |
| Time deltas calculated within sessions only (never across boundaries) | 10-01 | Prevents impossible cross-session durations |
| Last page in each session excluded from time-on-page metrics | 10-01 | No exit timestamp available for final page |
| 30-minute cap on page durations | 10-01 | Excludes abandoned tabs from averages |
| fbclid tracking param checked FIRST in referrer categorization | 11-01 | Handles shrike.vercel.app?fbclid=... as Facebook traffic, not self-referral |
| Engagement quality defined as avg events/session per referrer source | 11-01 | Identifies high-quality traffic sources producing most engaged visitors |
| US state names mapped to 2-letter abbreviations for city display | 11-01 | Compact "Farmville, VA" format improves geo breakdown readability |
| All 3 tables (scripts, niches, script_lead_outcomes) created in single migration | 14-01 | Single foundation, avoids fragmented migrations |
| Niche names normalized to lowercase with UNIQUE constraint | 14-01 | Prevents "Restaurant" vs "restaurant" duplicates, enforced via CHECK constraint |
| Soft delete for scripts (is_active flag) | 14-01 | Preserves outcome history when scripts retired |
| niche_id on leads uses ON DELETE SET NULL (not CASCADE) | 14-01 | Preserves leads when niche removed (deleting niche shouldn't delete leads) |
| UNIQUE(script_id, lead_id) on script_lead_outcomes | 14-01 | Enables upsert pattern for updating outcomes |
| RLS policies scope scripts through user_clients join | 14-01 | Multi-tenant security enforced at database level |
| Script outcome is binary success/fail for MVP | 16 (planned) | Keep simple, expand categories based on user feedback (Pitfall 16) |

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
Stopped at: Completed 11-01-PLAN.md (ReferrerAnalysis + GeoDistribution sections)
Resume file: None
Next: v1.4 Phase 15 (Script Library CRUD) - or v1.3 continues with Phase 12 (Scroll Depth)

### Roadmap Evolution

- v1.3 Analytics Deep Dive started: session journeys, geo heatmap, referrer analysis, scroll depth
- v1.4 Cold Calling Scripts roadmap defined: schema + niche taxonomy, script CRUD, outcome tracking, script analytics

---
*Last updated: 2026-02-16*
