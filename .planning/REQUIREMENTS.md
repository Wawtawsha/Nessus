# Requirements: Nessus CRM

**Defined:** 2026-01-20
**Core Value:** Connect marketing leads to actual revenue

## v1.1 Requirements

Requirements for Toast Enhancements milestone. Each maps to roadmap phases.

### Sync Automation

- [x] **SYNC-01**: Orders sync automatically on interval without manual trigger
- [x] **SYNC-02**: Sync status indicator shows last sync time and in-progress state
- [x] **SYNC-03**: Sync backs off gracefully when API rate limited
- [x] **SYNC-04**: Manual sync button remains available as fallback

### Order Details

- [x] **ORD-01**: User can click order row to open detail modal
- [x] **ORD-02**: Detail modal shows all line items with nested modifiers
- [x] **ORD-03**: Detail modal shows payment breakdown (method, card type, tip)

### Lead Matching

- [x] **MATCH-01**: Unmatched orders show "Match to Lead" button
- [x] **MATCH-02**: Matching UI shows smart suggestions based on name/phone similarity
- [x] **MATCH-03**: User can confirm match and save to update order

### Revenue Charts

- [x] **CHART-01**: Analytics shows time-series revenue chart (line or bar)
- [x] **CHART-02**: User can toggle granularity (daily/weekly/monthly)
- [x] **CHART-03**: User can select custom date range

### Shrike Website Consolidation

- [ ] **SHRIKE-01**: "Shrike Website" client exists in sidebar and both old clients ("2016 Night at Press Club", "Rosemont Vineyard") are deactivated
- [ ] **SHRIKE-02**: Visit data from both old clients is consolidated under "Shrike Website" with per-site identity preserved via website_label column
- [ ] **SHRIKE-03**: Visits panel shows each webpage's full metrics (visits, unique IPs, sessions, locations, referrers, pages, time series) in its own distinct card
- [ ] **SHRIKE-04**: All per-site metrics viewable on one screen without clicking between clients

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Notifications
- **NOTIF-01**: Alert when new orders sync
- **NOTIF-02**: Alert when leads match automatically

### Email/SMS
- **COMM-01**: Send email to leads
- **COMM-02**: Send SMS to leads with consent

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Toast webhooks | Requires partnership, polling sufficient |
| Real-time order updates | Polling handles this adequately |
| Bulk lead matching | One-by-one matching is clearer for v1.1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORD-01 | Phase 1 | Complete |
| ORD-02 | Phase 1 | Complete |
| ORD-03 | Phase 1 | Complete |
| MATCH-01 | Phase 2 | Complete |
| MATCH-02 | Phase 2 | Complete |
| MATCH-03 | Phase 2 | Complete |
| SYNC-01 | Phase 3 | Complete |
| SYNC-02 | Phase 3 | Complete |
| SYNC-03 | Phase 3 | Complete |
| SYNC-04 | Phase 3 | Complete |
| CHART-01 | Phase 4 | Complete |
| CHART-02 | Phase 4 | Complete |
| CHART-03 | Phase 4 | Complete |
| SHRIKE-01 | Phase 5 | Planned |
| SHRIKE-02 | Phase 5 | Planned |
| SHRIKE-03 | Phase 5 | Planned |
| SHRIKE-04 | Phase 5 | Planned |

**Coverage:**
- v1.1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-02-13 after Phase 5 planning*
