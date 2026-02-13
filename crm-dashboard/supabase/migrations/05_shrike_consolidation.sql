-- =============================================================================
-- Migration: Shrike Media Website Consolidation
-- =============================================================================
-- Purpose: Consolidate "2016 Night at Press Club" and "Rosemont Vineyard"
--          into a single "Shrike Media Website" client with per-page identity.
--
-- These two clients are NOT separate businesses -- they are pages on the same
-- website (Shrike Media's website) that were incorrectly set up as separate
-- clients. This migration unifies ALL their data under one client.
--
-- Tables affected: visits, leads, toast_orders, toast_order_items, toast_payments
-- (lead_events follows automatically through lead_id foreign key)
--
-- Rollback strategy:
--   1. Re-activate old clients: UPDATE clients SET is_active = true
--      WHERE name IN ('2016 Night at Press Club', 'Rosemont Vineyard');
--   2. Move visits back by website_label:
--      UPDATE visits SET client_id = (SELECT id FROM clients WHERE name = '2016 Night at Press Club')
--      WHERE website_label = 'press-club';
--      UPDATE visits SET client_id = (SELECT id FROM clients WHERE name = 'Rosemont Vineyard')
--      WHERE website_label = 'rosemont';
--   3. Move leads back (identify by checking which old client they came from
--      via toast_orders or other context).
--   4. Move toast_orders, toast_order_items, toast_payments back similarly.
--   5. Deactivate new client and drop website_label column if needed.
--
-- IMPORTANT: website_label is intentionally nullable (no NOT NULL constraint).
-- The visit tracking mechanism is external to this codebase and will continue
-- to create visits without a website_label until it is updated separately.
-- Adding NOT NULL would break new visit ingestion.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Add website_label column to visits table
-- ---------------------------------------------------------------------------
-- This column preserves per-page identity after consolidation.
-- Nullable TEXT -- see note above about why NOT NULL is NOT used here.
ALTER TABLE visits
ADD COLUMN website_label TEXT;

-- ---------------------------------------------------------------------------
-- Step 2: Create the new consolidated client
-- ---------------------------------------------------------------------------
INSERT INTO clients (id, name, slug, is_active, created_at)
VALUES (
  gen_random_uuid(),
  'Shrike Media Website',
  'shrike-media-website',
  true,
  NOW()
);

-- ---------------------------------------------------------------------------
-- Step 3: Capture pre-migration counts for verification
-- Step 4: Migrate ALL data across ALL tables
-- Step 5: Verify counts match post-migration
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_press_club_id UUID;
  v_rosemont_id UUID;
  v_new_client_id UUID;

  -- Pre-migration counts
  v_visits_before BIGINT;
  v_leads_before BIGINT;
  v_orders_before BIGINT;
  v_items_before BIGINT;
  v_payments_before BIGINT;

  -- Post-migration counts
  v_visits_after BIGINT;
  v_leads_after BIGINT;
  v_orders_after BIGINT;
  v_items_after BIGINT;
  v_payments_after BIGINT;
BEGIN
  -- Look up old client IDs by name (never hardcoded)
  SELECT id INTO v_press_club_id
  FROM clients WHERE name = '2016 Night at Press Club';

  SELECT id INTO v_rosemont_id
  FROM clients WHERE name = 'Rosemont Vineyard';

  SELECT id INTO v_new_client_id
  FROM clients WHERE slug = 'shrike-media-website';

  -- Bail out if any client lookup failed
  IF v_press_club_id IS NULL THEN
    RAISE EXCEPTION 'Client "2016 Night at Press Club" not found';
  END IF;
  IF v_rosemont_id IS NULL THEN
    RAISE EXCEPTION 'Client "Rosemont Vineyard" not found';
  END IF;
  IF v_new_client_id IS NULL THEN
    RAISE EXCEPTION 'Client "Shrike Media Website" not found (INSERT may have failed)';
  END IF;

  -- =========================================================================
  -- Capture pre-migration counts (combined total of both old clients)
  -- =========================================================================
  SELECT COUNT(*) INTO v_visits_before
  FROM visits WHERE client_id IN (v_press_club_id, v_rosemont_id);

  SELECT COUNT(*) INTO v_leads_before
  FROM leads WHERE client_id IN (v_press_club_id, v_rosemont_id);

  SELECT COUNT(*) INTO v_orders_before
  FROM toast_orders WHERE client_id IN (v_press_club_id, v_rosemont_id);

  SELECT COUNT(*) INTO v_items_before
  FROM toast_order_items WHERE client_id IN (v_press_club_id, v_rosemont_id);

  SELECT COUNT(*) INTO v_payments_before
  FROM toast_payments WHERE client_id IN (v_press_club_id, v_rosemont_id);

  RAISE NOTICE 'Pre-migration counts -- visits: %, leads: %, orders: %, items: %, payments: %',
    v_visits_before, v_leads_before, v_orders_before, v_items_before, v_payments_before;

  -- =========================================================================
  -- Migrate visits: set website_label based on old client, then reassign
  -- =========================================================================
  UPDATE visits
  SET
    website_label = CASE
      WHEN client_id = v_press_club_id THEN 'press-club'
      WHEN client_id = v_rosemont_id THEN 'rosemont'
    END,
    client_id = v_new_client_id
  WHERE client_id IN (v_press_club_id, v_rosemont_id);

  -- =========================================================================
  -- Migrate leads: reassign to new client
  -- =========================================================================
  UPDATE leads
  SET client_id = v_new_client_id
  WHERE client_id IN (v_press_club_id, v_rosemont_id);

  -- =========================================================================
  -- Migrate toast_orders: reassign to new client
  -- =========================================================================
  UPDATE toast_orders
  SET client_id = v_new_client_id
  WHERE client_id IN (v_press_club_id, v_rosemont_id);

  -- =========================================================================
  -- Migrate toast_order_items: reassign to new client
  -- =========================================================================
  UPDATE toast_order_items
  SET client_id = v_new_client_id
  WHERE client_id IN (v_press_club_id, v_rosemont_id);

  -- =========================================================================
  -- Migrate toast_payments: reassign to new client
  -- =========================================================================
  UPDATE toast_payments
  SET client_id = v_new_client_id
  WHERE client_id IN (v_press_club_id, v_rosemont_id);

  -- =========================================================================
  -- Verify post-migration counts match pre-migration counts
  -- =========================================================================
  SELECT COUNT(*) INTO v_visits_after
  FROM visits WHERE client_id = v_new_client_id;

  SELECT COUNT(*) INTO v_leads_after
  FROM leads WHERE client_id = v_new_client_id;

  SELECT COUNT(*) INTO v_orders_after
  FROM toast_orders WHERE client_id = v_new_client_id;

  SELECT COUNT(*) INTO v_items_after
  FROM toast_order_items WHERE client_id = v_new_client_id;

  SELECT COUNT(*) INTO v_payments_after
  FROM toast_payments WHERE client_id = v_new_client_id;

  RAISE NOTICE 'Post-migration counts -- visits: %, leads: %, orders: %, items: %, payments: %',
    v_visits_after, v_leads_after, v_orders_after, v_items_after, v_payments_after;

  -- Verify each table
  IF v_visits_before != v_visits_after THEN
    RAISE EXCEPTION 'VISITS count mismatch: before=% after=%', v_visits_before, v_visits_after;
  END IF;

  IF v_leads_before != v_leads_after THEN
    RAISE EXCEPTION 'LEADS count mismatch: before=% after=%', v_leads_before, v_leads_after;
  END IF;

  IF v_orders_before != v_orders_after THEN
    RAISE EXCEPTION 'TOAST_ORDERS count mismatch: before=% after=%', v_orders_before, v_orders_after;
  END IF;

  IF v_items_before != v_items_after THEN
    RAISE EXCEPTION 'TOAST_ORDER_ITEMS count mismatch: before=% after=%', v_items_before, v_items_after;
  END IF;

  IF v_payments_before != v_payments_after THEN
    RAISE EXCEPTION 'TOAST_PAYMENTS count mismatch: before=% after=%', v_payments_before, v_payments_after;
  END IF;

  RAISE NOTICE 'All counts verified successfully.';

  -- =========================================================================
  -- Deactivate old clients (do NOT delete -- allows rollback)
  -- =========================================================================
  UPDATE clients
  SET is_active = false
  WHERE id IN (v_press_club_id, v_rosemont_id);

  RAISE NOTICE 'Old clients deactivated. Migration complete.';
END $$;

-- ---------------------------------------------------------------------------
-- Step 6: Create indexes for query performance
-- ---------------------------------------------------------------------------
-- Single-column index for filtering by website_label alone
CREATE INDEX idx_visits_website_label ON visits(website_label);

-- Composite index for the common query pattern: client + website
CREATE INDEX idx_visits_client_website ON visits(client_id, website_label);

COMMIT;
