# Nessus CRM

## What This Is

A multi-tenant CRM for managing leads with Toast POS integration. Restaurants can track leads, sync orders from Toast, manually add and edit leads, and see which customers convert to paying guests. Includes a dedicated Cold Calling client for leads-only workflows. Built with Next.js 14, Supabase, and Tailwind.

## Core Value

Connect marketing leads to actual revenue — show which leads became paying customers and how much they spent.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Toast API client with OAuth2 authentication — v1.0
- ✓ Manual order sync from Toast — v1.0
- ✓ Order storage with line items and payments — v1.0
- ✓ Automatic lead matching by email/phone — v1.0
- ✓ Orders page with filters and CSV export — v1.0
- ✓ Revenue overview in Analytics (totals, payment breakdown, top items) — v1.0
- ✓ Lead detail page shows linked orders — v1.0
- ✓ Automated sync runs on schedule without manual trigger — v1.1
- ✓ Order detail modal shows line items with modifiers and payment info — v1.1
- ✓ Unmatched orders show smart lead suggestions for manual matching — v1.1
- ✓ Revenue chart shows trends over time with granularity toggle — v1.1
- ✓ Shrike Media Website consolidation with per-site visit metrics — v1.1
- ✓ Cold Calling client with leads-only sidebar view — v1.2
- ✓ Manual "Add Lead" form with extended qualification fields — v1.2
- ✓ All form fields optional (admin tool philosophy) — v1.2
- ✓ Inline edit mode on lead detail page with change event logging — v1.2

### Active

<!-- Current scope. Building toward these. -->

- [ ] Session journey visualization — show event sequences within a session (v1.3)
- [ ] Geographic heatmap — visualize visitor locations using existing ip/country/city data (v1.3)
- [ ] Referrer analysis — which external sources drive the most engaged visitors (v1.3)
- [ ] Scroll depth tracking — capture scroll milestones (25/50/75/100%) in Shrike (v1.3)
- [ ] Time on page metrics — calculate from page view timestamps within sessions (v1.3)
- [ ] Call scripts CRUD on Cold Calling page (v1.4)
- [ ] Script-lead outcome tracking with success/fail per call (v1.4)
- [ ] User-defined lead niche taxonomy with persistent options (v1.4)
- [ ] Script performance analytics by niche and overall (v1.4)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time webhooks from Toast — requires Toast partnership, overkill for current scale
- Email/SMS integration — separate milestone
- Pipeline automation — separate milestone
- Bulk lead import (CSV) — manual entry sufficient, revisit if volume grows
- Lead scoring/ranking — premature, not enough data yet

## Context

- Toast API uses OAuth2 client credentials, tokens valid for ~24 hours
- Current sync fetches orders since last_sync_at, defaults to 30 days back
- Line items stored in toast_order_items, payments in toast_payments
- Lead matching normalizes email (lowercase) and phone (digits only)
- Multi-tenant: each client has their own Toast credentials and data
- Shrike Media Website consolidated from two clients with website_label for per-site identity
- Visit tracking via Supabase Edge Function (track-visitor) with website_label support
- Cold Calling client uses client_type='leads_only' for tab filtering
- Manual leads tagged with utm_source='manual-entry' for attribution
- Lead detail supports inline editing with lead_event audit logging
- Cold Calling scripts: each script always linked to a lead outcome (no standalone counters)
- Niche taxonomy: user-managed options that persist until manually removed
- Script counters are aggregated from script_lead_outcomes, not independent values

## Constraints

- **API Rate Limits**: Toast may throttle aggressive polling — handled with exponential backoff
- **Supabase**: Using client-side Supabase with RLS, no server-side cron built-in
- **No Backend**: Next.js API routes only, no persistent server process

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polling over webhooks | Simpler, no Toast partnership needed | v1.1 — Working well |
| Client-side scheduling | No server to run cron, browser-based | v1.1 — 60s interval, SyncContext |
| RPC for chart aggregation | Better perf than client-side | v1.1 — get_revenue_by_period |
| Manual shadcn/ui setup | More control than interactive CLI | v1.1 — 4 components created |
| website_label for multi-site | Preserve per-site identity in consolidated client | v1.1 — nullable TEXT column |
| Deactivate old clients, not delete | Enables rollback if consolidation has issues | v1.1 — is_active=false |
| client_type column for tab filtering | Simpler than separate routes for leads-only clients | v1.2 — getNavItems() function |
| Native HTML dialog for forms | No external dependency, modern browser API | v1.2 — Add Lead form |
| Inline edit vs separate page | Faster workflow, matches admin tool philosophy | v1.2 — isEditing toggle |

## Milestones

| Version | Name | Status | Date |
|---------|------|--------|------|
| v1.0 | Foundation | Complete | 2026-01 |
| v1.1 | Toast Enhancements | Complete | 2026-02-13 |
| v1.2 | Lead Management | Complete | 2026-02-15 |
| v1.3 | Analytics Deep Dive | Active | 2026-02-15 |
| v1.4 | Cold Calling Scripts | Active | 2026-02-15 |

## Current Milestone: v1.3 Analytics Deep Dive (parallel)

**Goal:** Surface deep visitor insights — session journeys, geographic distribution, referrer quality, and scroll engagement — building on the existing ShrikeAnalytics dashboard.

**Target features:**
- Session journey visualization (event timeline per session)
- Geographic heatmap from existing visit data (country/city)
- Referrer analysis with engagement quality scoring
- Scroll depth tracking (new Shrike events + CRM display)
- Time on page calculation from session timestamps

## Current Milestone: v1.4 Cold Calling Scripts

**Goal:** Equip cold callers with managed call scripts, track per-lead outcomes (success/fail), and surface analytics on which scripts perform best overall and within business niches.

**Target features:**
- Scripts CRUD (create, edit, delete call scripts on Cold Calling page)
- Script-lead outcome tracking (assign script to lead, mark success/fail per call)
- Aggregated script performance counters (derived from per-lead outcomes)
- User-defined lead niche taxonomy (combo selector: pick existing or create new)
- Script analytics by niche and overall performance ranking

---
*Last updated: 2026-02-15 after v1.4 milestone start*
