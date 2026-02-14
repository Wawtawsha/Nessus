# Nessus CRM

## What This Is

A multi-tenant CRM for managing leads with Toast POS integration. Restaurants can track leads, sync orders from Toast, and see which customers convert to paying guests. Built with Next.js 14, Supabase, and Tailwind.

## Core Value

Connect marketing leads to actual revenue — show which leads became paying customers and how much they spent.

## Current Milestone: v1.2 Lead Management

**Goal:** Expand lead capture beyond website forms with manual entry and a dedicated cold-calling client.

**Target features:**
- Cold Calling client (lead-source bucket, leads-only dashboard view)
- Manual "Add Lead" button on all clients' leads pages
- New lead fields: has_website (boolean), social_media_presence (1-5 scale)

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

### Active

<!-- Current scope. Building toward these. -->

- [ ] Cold Calling client exists in sidebar as lead-source bucket
- [ ] Cold Calling shows leads-only view (no visits/orders/analytics)
- [ ] Manual "Add Lead" button on all clients' leads pages
- [ ] Add Lead form captures extended fields (has_website, social_media_presence)
- [ ] No required fields on Add Lead form (admin tool)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time webhooks from Toast — requires Toast partnership, overkill for current scale
- Email/SMS integration — separate milestone
- Pipeline automation — separate milestone

## Context

- Toast API uses OAuth2 client credentials, tokens valid for ~24 hours
- Current sync fetches orders since last_sync_at, defaults to 30 days back
- Line items stored in toast_order_items, payments in toast_payments
- Lead matching normalizes email (lowercase) and phone (digits only)
- Multi-tenant: each client has their own Toast credentials and data
- Shrike Media Website consolidated from two clients with website_label for per-site identity
- Visit tracking via Supabase Edge Function (track-visitor) with website_label support

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

## Milestones

| Version | Name | Status | Date |
|---------|------|--------|------|
| v1.0 | Foundation | Complete | 2026-01 |
| v1.1 | Toast Enhancements | Complete | 2026-02-13 |
| v1.2 | Lead Management | In Progress | 2026-02-14 |

---
*Last updated: 2026-02-14 after milestone v1.2 start*
