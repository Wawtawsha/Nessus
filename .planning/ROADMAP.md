# Roadmap: Nessus CRM

## Milestones

- ✅ **v1.0 Foundation** - Phases 1-4 (shipped 2026-01)
- ✅ **v1.1 Toast Enhancements** - Phases 1-5 (shipped 2026-02-13)
- 🚧 **v1.2 Lead Management** - Phases 6-7 (in progress)

## Overview

Milestone v1.2 expands lead capture beyond website forms with manual entry capability and a dedicated cold-calling client. Phase 6 extends the database schema with new lead fields (has_website, social_media_presence) and creates a Cold Calling client that shows leads-only view. Phase 7 builds the manual "Add Lead" form UI across all clients' leads pages.

## Phases

- [ ] **Phase 6: Database + Cold Calling Client** - Extend schema and create leads-only client
- [ ] **Phase 7: Manual Lead Entry UI** - Build Add Lead form for all clients

<details>
<summary>✅ v1.1 Toast Enhancements (Phases 1-5) - SHIPPED 2026-02-13</summary>

### Phase 1: Order Details Modal
**Goal**: Users can view complete order information without leaving the Orders page
**Plans**: 1 plan

Plans:
- [x] 01-01: Build order detail modal with line items and payment breakdown

### Phase 2: Lead Matching Enhancement
**Goal**: Users can manually match unmatched orders to leads with smart suggestions
**Plans**: 1 plan

Plans:
- [x] 02-01: Add manual match UI with smart suggestions for unmatched orders

### Phase 3: Sync Automation
**Goal**: Orders sync automatically without manual intervention
**Plans**: 1 plan

Plans:
- [x] 03-01: Implement browser-based sync scheduler with SyncContext

### Phase 4: Revenue Charts
**Goal**: Users can visualize revenue trends over time
**Plans**: 1 plan

Plans:
- [x] 04-01: Build revenue chart with time granularity toggle

### Phase 5: Shrike Consolidation
**Goal**: Shrike Media Website consolidates two clients while preserving per-site identity
**Plans**: 2 plans

Plans:
- [x] 05-01: Add website_label to database and consolidate clients
- [x] 05-02: Update visit tracking and UI to support website_label

</details>

## 🚧 v1.2 Lead Management (In Progress)

**Milestone Goal:** Expand lead capture with manual entry and dedicated cold-calling client.

### Phase 6: Database + Cold Calling Client
**Goal**: Cold Calling client exists as leads-only view and lead schema supports new qualification fields
**Depends on**: Phase 5 (v1.1 complete)
**Requirements**: CLIENT-01, CLIENT-02
**Success Criteria** (what must be TRUE):
  1. User sees "Cold Calling" in client sidebar as an active client
  2. When Cold Calling is selected, only Leads tab is visible (no Visits, Orders, Pipeline, Analytics tabs)
  3. Leads table has has_website (boolean) and social_media_presence (1-5 integer) columns
**Plans**: 1 plan

Plans:
- [ ] 06-01-PLAN.md -- Cold Calling client + lead schema extension + client-type tab filtering

### Phase 7: Manual Lead Entry UI
**Goal**: Users can manually add leads from any client's leads page
**Depends on**: Phase 6 (schema extended, Cold Calling client exists)
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04
**Success Criteria** (what must be TRUE):
  1. User sees "Add Lead" button on all clients' leads pages
  2. Clicking Add Lead opens form that captures: first name, last name, email, phone, preferred contact, SMS consent, has_website, social_media_presence
  3. All form fields are optional (no required validation)
  4. After submitting, new lead appears in leads list within 5 seconds
**Plans**: 1 plan

Plans:
- [ ] 07-01-PLAN.md -- Add Lead dialog, form, submit handler, and button on leads page

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Order Details | v1.1 | 1/1 | Complete | 2026-01 |
| 2. Lead Matching | v1.1 | 1/1 | Complete | 2026-01 |
| 3. Sync Automation | v1.1 | 1/1 | Complete | 2026-02 |
| 4. Revenue Charts | v1.1 | 1/1 | Complete | 2026-02 |
| 5. Shrike Consolidation | v1.1 | 2/2 | Complete | 2026-02-13 |
| 6. Database + Cold Calling | v1.2 | 0/1 | Planned | - |
| 7. Manual Lead Entry UI | v1.2 | 0/1 | Planned | - |

---
*Last updated: 2026-02-14 after Phase 7 planning*
