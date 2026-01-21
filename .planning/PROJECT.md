# Nessus CRM

## What This Is

A multi-tenant CRM for managing leads with Toast POS integration. Restaurants can track leads, sync orders from Toast, and see which customers convert to paying guests. Built with Next.js 14, Supabase, and Tailwind.

## Core Value

Connect marketing leads to actual revenue — show which leads became paying customers and how much they spent.

## Current Milestone: v1.1 Toast Enhancements

**Goal:** Make the Toast integration more useful with automated syncing, better order visibility, and smarter lead matching.

**Target features:**
- Automated order sync (aggressive polling within API limits)
- Order detail view (line items, payments, modifiers)
- Smart manual lead matching (suggest likely matches for unmatched orders)
- Revenue over time chart (daily/weekly/monthly toggle)

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

### Active

<!-- Current scope. Building toward these. -->

- [ ] Automated sync runs on schedule without manual trigger
- [ ] Order detail modal shows line items with modifiers and payment info
- [ ] Unmatched orders show smart lead suggestions for manual matching
- [ ] Revenue chart shows trends over time with granularity toggle

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

## Constraints

- **API Rate Limits**: Toast may throttle aggressive polling — need to handle gracefully
- **Supabase**: Using client-side Supabase with RLS, no server-side cron built-in
- **No Backend**: Next.js API routes only, no persistent server process

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polling over webhooks | Simpler, no Toast partnership needed | — Pending |
| Client-side scheduling | No server to run cron, browser-based | — Pending |

---
*Last updated: 2026-01-20 after milestone v1.1 start*
