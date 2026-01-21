# Requirements: Nessus CRM

**Defined:** 2026-01-20
**Core Value:** Connect marketing leads to actual revenue

## v1.1 Requirements

Requirements for Toast Enhancements milestone. Each maps to roadmap phases.

### Sync Automation

- [ ] **SYNC-01**: Orders sync automatically on interval without manual trigger
- [ ] **SYNC-02**: Sync status indicator shows last sync time and in-progress state
- [ ] **SYNC-03**: Sync backs off gracefully when API rate limited
- [ ] **SYNC-04**: Manual sync button remains available as fallback

### Order Details

- [ ] **ORD-01**: User can click order row to open detail modal
- [ ] **ORD-02**: Detail modal shows all line items with nested modifiers
- [ ] **ORD-03**: Detail modal shows payment breakdown (method, card type, tip)

### Lead Matching

- [ ] **MATCH-01**: Unmatched orders show "Match to Lead" button
- [ ] **MATCH-02**: Matching UI shows smart suggestions based on name/phone similarity
- [ ] **MATCH-03**: User can confirm match and save to update order

### Revenue Charts

- [ ] **CHART-01**: Analytics shows time-series revenue chart (line or bar)
- [ ] **CHART-02**: User can toggle granularity (daily/weekly/monthly)
- [ ] **CHART-03**: User can select custom date range

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
| SYNC-01 | — | Pending |
| SYNC-02 | — | Pending |
| SYNC-03 | — | Pending |
| SYNC-04 | — | Pending |
| ORD-01 | — | Pending |
| ORD-02 | — | Pending |
| ORD-03 | — | Pending |
| MATCH-01 | — | Pending |
| MATCH-02 | — | Pending |
| MATCH-03 | — | Pending |
| CHART-01 | — | Pending |
| CHART-02 | — | Pending |
| CHART-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 (roadmap pending)

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-20 after initial definition*
