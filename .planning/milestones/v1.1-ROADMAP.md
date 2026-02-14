# Roadmap: Nessus CRM v1.1 Toast Enhancements

## Overview

Milestone v1.1 enhances the existing Toast integration with four focused deliverables: detailed order inspection, smart lead matching, automated background sync, and visual revenue analytics. The phases are ordered to deliver quick user-facing value first (order details), then build on that foundation (lead matching), then improve reliability (sync automation), and finally add business insights (charts).

## Phases

- [x] **Phase 1: Order Details** - Click any order to see line items, modifiers, and payments
- [x] **Phase 2: Lead Matching** - Connect unmatched orders to leads with smart suggestions
- [x] **Phase 3: Sync Automation** - Background sync with status indicator and rate limiting
- [x] **Phase 4: Revenue Charts** - Time-series revenue visualization with granularity controls
- [x] **Phase 5: Shrike Website Consolidation** - Merge Press Club & Rosemont into single "Shrike Media Website" client with full data consolidation and per-site visit metrics

## Phase Details

### Phase 1: Order Details
**Goal**: Users can inspect any order's complete details without leaving the orders page
**Depends on**: Nothing (uses existing orders page)
**Requirements**: ORD-01, ORD-02, ORD-03
**Success Criteria** (what must be TRUE):
  1. User can click any order row to open a detail modal
  2. Modal displays all line items with nested modifiers visible
  3. Modal shows payment breakdown including method, card type, and tip amount
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md - Order detail modal with line items and payments

### Phase 2: Lead Matching
**Goal**: Users can manually match unmatched orders to existing leads using smart suggestions
**Depends on**: Phase 1 (matching UI appears in order context)
**Requirements**: MATCH-01, MATCH-02, MATCH-03
**Success Criteria** (what must be TRUE):
  1. Unmatched orders show a visible "Match to Lead" action
  2. Matching UI suggests likely leads ranked by name/phone similarity
  3. User can confirm a match and see the order immediately linked to the lead
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md - Lead matching panel with similarity scoring

### Phase 3: Sync Automation
**Goal**: Orders sync automatically in the background without requiring manual trigger
**Depends on**: Nothing (independent infrastructure)
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. Orders sync on a regular interval without user action
  2. Sync status indicator shows last sync time and in-progress state
  3. Sync gracefully backs off when rate limited (no error spam)
  4. Manual sync button remains available as fallback
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md - SyncContext with auto-polling, status indicator, rate limit handling

### Phase 4: Revenue Charts
**Goal**: Users can visualize revenue trends over time with adjustable granularity
**Depends on**: Nothing (uses existing order data)
**Requirements**: CHART-01, CHART-02, CHART-03
**Success Criteria** (what must be TRUE):
  1. Analytics page shows a time-series revenue chart (line or bar)
  2. User can toggle between daily, weekly, and monthly granularity
  3. User can select a custom date range for the chart
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md - Install shadcn/ui charts, create RPC, build RevenueChart with controls

### Phase 5: Shrike Website Consolidation
**Goal**: Merge "2016 Night at Press Club" and "Rosemont Vineyard" clients into a single "Shrike Media Website" client. Redesign the visits panel to display each webpage's metrics in its own box within a single view.
**Depends on**: Nothing (independent refactoring)
**Requirements**: SHRIKE-01, SHRIKE-02, SHRIKE-03, SHRIKE-04
**Success Criteria** (what must be TRUE):
  1. "Shrike Media Website" client exists in sidebar and both old clients are deactivated
  2. ALL data (visits, leads, orders, items, payments) from both old clients is consolidated under "Shrike Media Website" with per-site visit identity preserved
  3. Visits panel shows each webpage's full metrics (visits, unique IPs, sessions, locations, referrers, pages, time series) in its own distinct box/card
  4. All metrics viewable on one screen without clicking between clients
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md - Database migration: consolidate clients, add website_label, migrate ALL tables (visits, leads, orders, items, payments)
- [x] 05-02-PLAN.md - UI refactoring: per-site WebsiteCard layout on visits page

## Progress

**Execution Order:** 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Order Details | 1/1 | Complete | 2026-01-20 |
| 2. Lead Matching | 1/1 | Complete | 2026-01-22 |
| 3. Sync Automation | 1/1 | Complete | 2026-01-22 |
| 4. Revenue Charts | 1/1 | Complete | 2026-01-22 |
| 5. Shrike Website Consolidation | 2/2 | Complete | 2026-02-13 |

---
*Roadmap created: 2026-01-20*
*Milestone: v1.1 Toast Enhancements*
