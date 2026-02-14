# Plan 05-01 Summary: Database Migration

**Status:** Complete
**Duration:** ~10 min
**Completed:** 2026-02-13

## What Was Done

Created and applied a transactional SQL migration that consolidates "2016 Night at Press Club" and "Rosemont Vineyard" into a single "Shrike Media Website" client.

### Changes

| File | Action |
|------|--------|
| `crm-dashboard/supabase/migrations/05_shrike_consolidation.sql` | Created - full migration script |

### Database Changes Applied

1. Added `website_label TEXT` column to visits table (nullable)
2. Created "Shrike Media Website" client (slug: shrike-media-website, is_active: true)
3. Migrated ALL data across 5 tables: visits, leads, toast_orders, toast_order_items, toast_payments
4. Set website_label = 'press-club' for Press Club visits, 'rosemont' for Rosemont visits
5. Created indexes: idx_visits_website_label, idx_visits_client_website
6. Deactivated old clients (is_active = false)
7. Count verification passed for all tables

### Key Decisions

- website_label intentionally nullable (external tracking script not yet updated)
- Client IDs looked up dynamically by name (no hardcoded UUIDs)
- Old clients deactivated, not deleted (enables rollback)

## Verification

- Migration applied successfully in Supabase SQL Editor
- User confirmed counts match
- Human checkpoint: PASSED
