# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Connect marketing leads to actual revenue
**Current focus:** Milestone v1.1 — Toast Enhancements — COMPLETE

## Current Position

Phase: 5 of 5 (Shrike Website Consolidation)
Plan: 2 of 2 in current phase
Status: Complete
Last activity: 2026-02-13 — Phase 5 executed (2 plans, both verified)

Progress: [##########] 100% (5 of 5 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 13.7 min
- Total execution time: ~1.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-order-details | 1 | 20 min | 20 min |
| 02-lead-matching | 1 | 25 min | 25 min |
| 03-sync-automation | 1 | 5.3 min | 5.3 min |
| 04-revenue-charts | 1 | 12 min | 12 min |
| 05-shrike-consolidation | 2 | ~18 min | ~9 min |

**Recent Trend:**
- Last 5 plans: 02-01 (25min), 03-01 (5.3min), 04-01 (12min), 05-01 (~10min), 05-02 (~8min)
- Trend: Stable velocity with efficient execution

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Aggressive polling for sync (as fast as API allows)
- Smart suggestions for manual lead matching (not just search/dropdown)
- Revenue chart needs daily/weekly/monthly toggle

**Phase 01-01 decisions:**
- Build nested modifier structure client-side from flat parent_item_id relationships
- Support Escape key and overlay click for modal dismissal
- Show card type and last four for credit card payments

**Phase 02-01 decisions:**
- Similarity scoring weights: email (100) > phone (80/40) > name (60/30)
- Show top 5 suggestions, with search fallback for others
- Auto-close modal after 1.5s on successful match

**Phase 03-01 decisions:**
- 60-second polling interval balances freshness with rate limits
- Only poll when admin AND client selected (prevents unnecessary API calls)
- Pause polling when tab hidden (reduces server load)
- Use Retry-After header first, fallback to exponential backoff
- Persist lastSyncAt to localStorage for cross-session consistency

**Phase 04-01 decisions:**
- Manual shadcn/ui setup vs CLI for better control in automation
- react-day-picker v9 API with Chevron component
- Custom tooltip for type safety over generic wrapper
- RPC aggregation for charts (better perf than client-side)

**Phase 05 decisions:**
- website_label TEXT column intentionally nullable (external tracker not yet updated)
- Client IDs looked up dynamically by name (no hardcoded UUIDs)
- Old clients deactivated, not deleted (enables rollback)
- Per-site WebsiteCard components with independent data fetching and polling
- addSiteFilters helper scopes queries by client_id + website_label

### Pending Todos

- Fix visit tracking script to pass `website_label` parameter for new visits under "Shrike Media Website" client

### Roadmap Evolution

- Phase 5 added: Shrike Media Website Consolidation — merge Press Club & Rosemont into single "Shrike Media Website" client with full data consolidation (all tables) and per-site visit metrics
- Name corrected from "Shrike Website" to "Shrike Media Website" per user
- Scope expanded from visits-only to full consolidation (visits, leads, orders, items, payments)

### Blockers/Concerns

None currently.

### Quick Tasks Completed

| # | Description | Date | Directory |
|---|-------------|------|-----------|
| 001 | Full Resync with optimized batch inserts (30,424 orders synced) | 2026-01-23 | [001-run-full-resync](./quick/001-run-full-resync-with-optimized-batch-ins/) |

## Session Continuity

Last session: 2026-02-13
Stopped at: Milestone v1.1 complete — all 5 phases done
Resume file: None

---
*Last updated: 2026-02-13*
