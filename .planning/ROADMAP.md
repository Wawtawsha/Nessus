# Roadmap: Nessus CRM

## Milestones

- ✅ **v1.0 Foundation** - Phases 1-4 (shipped 2026-01)
- ✅ **v1.1 Toast Enhancements** - Phases 1-5 (shipped 2026-02-13)
- ✅ **v1.2 Lead Management** - Phases 6-8 (shipped 2026-02-15)
- ✅ **v1.3 Analytics Deep Dive** - Phases 9-13 (shipped 2026-02-15)
- 🔄 **v1.4 Cold Calling Scripts** - Script CRUD, outcome tracking, niche taxonomy, script analytics

## Phases

<details>
<summary>✅ v1.1 Toast Enhancements (Phases 1-5) - SHIPPED 2026-02-13</summary>

- [x] Phase 1: Order Details Modal (1/1 plans)
- [x] Phase 2: Lead Matching Enhancement (1/1 plans)
- [x] Phase 3: Sync Automation (1/1 plans)
- [x] Phase 4: Revenue Charts (1/1 plans)
- [x] Phase 5: Shrike Consolidation (2/2 plans)

</details>

<details>
<summary>✅ v1.2 Lead Management (Phases 6-8) - SHIPPED 2026-02-15</summary>

- [x] Phase 6: Database + Cold Calling Client (1/1 plans)
- [x] Phase 7: Manual Lead Entry UI (1/1 plans)
- [x] Phase 8: Edit Lead UI (1/1 plans)

</details>

<details>
<summary>✅ v1.3 Analytics Deep Dive (Phases 9-13) - SHIPPED 2026-02-15</summary>

- [x] Phase 9: Component Decomposition (1/1 plans)
- [x] Phase 10: Session Journeys + Time on Page (1/1 plans)
- [x] Phase 11: Referrer Analysis + Geo Distribution (1/1 plans)
- [x] Phase 12: Scroll Depth (2/2 plans)
- [x] Phase 13: Database Indexes (1/1 plans)

</details>

### v1.4 Cold Calling Scripts (Phases 14-17)

- [x] Phase 14: Schema + Niche Taxonomy (2/2 plans)
  Plans:
  - [x] 14-01-PLAN.md — Database migration (niches, scripts, outcomes tables) + TypeScript types
  - [x] 14-02-PLAN.md — NicheComboBox component + leads page/detail integration
- [x] Phase 15: Script Library CRUD (1/1 plans)
  Plans:
  - [x] 15-01-PLAN.md — Script CRUD components (ScriptManager, ScriptCard, AddEditScriptDialog) + leads page integration
- [x] Phase 16: Outcome Tracking (2/2 plans)
  Plans:
  - [x] 16-01-PLAN.md — RPC aggregation function + TypeScript types + Zod outcome schema
  - [x] 16-02-PLAN.md — RecordOutcomeDialog + ScriptCard stats + ScriptManager integration
- [ ] Phase 17: Script Analytics (2 plans)
  Plans:
  - [ ] 17-01-PLAN.md — Analytics RPC functions (3 RPCs with date range) + TypeScript types
  - [ ] 17-02-PLAN.md — Analytics UI (OverallPerformance table, NichePerformance chart, ScriptNicheMatrix, leads page integration)

#### Phase 14: Schema + Niche Taxonomy

**Goal:** Users can create, manage, and assign business niches to leads for categorization

**Dependencies:** v1.2 Lead Management (Cold Calling client, Add Lead form, Edit Lead inline mode)

**Requirements:** SCRIPT-03

**Success Criteria:**
1. Database tables exist for scripts, niches, and script_lead_outcomes with RLS policies, indexes, and proper foreign key cascade behavior
2. User can create new niches via a searchable combo selector (type to search, create inline if not found)
3. User can assign a niche to a lead when adding or editing a lead on the Cold Calling page
4. Niche names are normalized (lowercase, trimmed) and enforced unique at the database level -- no duplicate "Restaurant" vs "restaurant"
5. Leads table displays niche column and supports filtering by niche

#### Phase 15: Script Library CRUD

**Goal:** Users can create, edit, and manage call scripts directly from the Cold Calling page

**Dependencies:** Phase 14 (scripts table exists)

**Requirements:** SCRIPT-01

**Success Criteria:**
1. User can create a new script with title and body from the Cold Calling leads page
2. User can edit an existing script (title, body, active/inactive toggle)
3. Script list displays on the Cold Calling leads page with script cards showing title and status
4. User can read a script in a clean, mobile-optimized view suitable for reference during a call
5. Only active scripts show by default; inactive scripts are hidden but not deleted

#### Phase 16: Outcome Tracking

**Goal:** Users can record per-lead call outcomes (success/fail) tied to a specific script

**Dependencies:** Phase 15 (scripts exist to select from)

**Requirements:** SCRIPT-02

**Plans:** 2 plans

**Success Criteria:**
1. User can open a script call dialog, select a lead, and mark the outcome as success or fail with large phone-friendly buttons (48x48px minimum)
2. Each outcome is permanently linked to both a lead and a script -- no orphaned or standalone counters
3. If an outcome already exists for a script+lead pair, the previous result is shown and can be updated (upsert behavior)
4. Script cards on the Cold Calling page display aggregated counters (success count, fail count, win rate percentage) derived from script_lead_outcomes
5. User can add optional notes when recording an outcome to capture context (objections, follow-up timing)

#### Phase 17: Script Analytics

**Goal:** Users can see which scripts perform best overall and within specific business niches

**Dependencies:** Phase 16 (outcomes exist to analyze)

**Requirements:** SCRIPT-04

**Plans:** 2 plans

**Success Criteria:**
1. Cold Calling analytics view shows overall script performance table: total calls, success count, fail count, success rate per script
2. Analytics view shows performance breakdown by niche: which niches have the highest success rates
3. Analytics view shows script-within-niche matrix: which scripts work best for which niches
4. Scripts with zero outcomes display gracefully (show "No data yet" instead of NaN or errors)
5. Date range filter (7d / 30d / 90d / all) allows comparison of recent vs historical performance

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Order Details | v1.1 | 1/1 | Complete | 2026-01 |
| 2. Lead Matching | v1.1 | 1/1 | Complete | 2026-01 |
| 3. Sync Automation | v1.1 | 1/1 | Complete | 2026-02 |
| 4. Revenue Charts | v1.1 | 1/1 | Complete | 2026-02 |
| 5. Shrike Consolidation | v1.1 | 2/2 | Complete | 2026-02-13 |
| 6. Database + Cold Calling | v1.2 | 1/1 | Complete | 2026-02-14 |
| 7. Manual Lead Entry UI | v1.2 | 1/1 | Complete | 2026-02-14 |
| 8. Edit Lead UI | v1.2 | 1/1 | Complete | 2026-02-15 |
| 9. Component Decomposition | v1.3 | 1/1 | Complete | 2026-02-15 |
| 10. Session Journeys + Time | v1.3 | 1/1 | Complete | 2026-02-15 |
| 11. Referrer + Geo | v1.3 | 1/1 | Complete | 2026-02-15 |
| 12. Scroll Depth | v1.3 | 2/2 | Complete | 2026-02-15 |
| 13. Database Indexes | v1.3 | 1/1 | Complete | 2026-02-15 |
| 14. Schema + Niche Taxonomy | v1.4 | 2/2 | Complete | 2026-02-16 |
| 15. Script Library CRUD | v1.4 | 1/1 | Complete | 2026-02-16 |
| 16. Outcome Tracking | v1.4 | 2/2 | Complete | 2026-02-16 |
| 17. Script Analytics | v1.4 | 0/2 | Planned | |

---
*Last updated: 2026-02-16 -- Phase 17 planned (2 plans in 2 waves)*
