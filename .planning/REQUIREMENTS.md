# Requirements: Nessus CRM

**Defined:** 2026-02-14
**Core Value:** Connect marketing leads to actual revenue

## v1.2 Requirements

Requirements for Lead Management milestone. Each maps to roadmap phases.

### Cold Calling Client

- [x] **CLIENT-01**: "Cold Calling" client appears in sidebar as an active client
- [x] **CLIENT-02**: When Cold Calling is selected, only the Leads tab is shown (visits, orders, pipeline, analytics are hidden)

### Manual Lead Entry

- [ ] **LEAD-01**: "Add Lead" button is visible on all clients' leads pages
- [ ] **LEAD-02**: Add Lead form captures: first name, last name, email, phone, preferred contact, SMS consent, has_website (boolean), social_media_presence (1-5 scale)
- [ ] **LEAD-03**: All form fields are optional (no validation requirements — admin tool)
- [ ] **LEAD-04**: Submitted leads appear in the leads list immediately

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
| Bulk lead import (CSV) | Manual entry sufficient for v1.2, revisit if volume grows |
| Lead scoring/ranking | Premature — not enough data to score meaningfully yet |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLIENT-01 | Phase 6 | Complete |
| CLIENT-02 | Phase 6 | Complete |
| LEAD-01 | Phase 7 | Pending |
| LEAD-02 | Phase 7 | Pending |
| LEAD-03 | Phase 7 | Pending |
| LEAD-04 | Phase 7 | Pending |

**Coverage:**
- v1.2 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after Phase 6 execution*
