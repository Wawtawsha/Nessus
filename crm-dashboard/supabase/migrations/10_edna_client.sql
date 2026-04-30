-- =============================================================================
-- Migration: EDNA Client + User Accounts
-- =============================================================================
-- Purpose: Create the EDNA client with per-page visibility settings,
--          and restricted user profiles for Andy Leonard and Kent Bradshaw.
--
-- Tables affected: clients, user_profiles
--
-- Auth users must be created SEPARATELY via Supabase dashboard or admin API
-- before running the user_profiles inserts. See setup-edna-users.js for
-- the automated approach.
--
-- EDNA page visibility: Leads, Orders, Analytics, Visits (no Pipeline)
--
-- Rollback strategy:
--   1. DELETE FROM user_profiles WHERE id IN (
--        SELECT id FROM auth.users WHERE email IN (
--          'andy.leonard@dilmsuite.com', 'kent.bradshaw.001@gmail.com'
--        )
--      );
--   2. DELETE FROM clients WHERE slug = 'edna';
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Insert EDNA client with page visibility settings
-- ---------------------------------------------------------------------------
-- enabled_pages controls which sidebar nav items appear for this client.
-- Orders is included but won't have data connected yet (API connector TBD).
-- Pipeline is excluded per EDNA requirements.
INSERT INTO clients (id, name, slug, is_active, client_type, settings, created_at)
VALUES (
  gen_random_uuid(),
  'EDNA',
  'edna',
  true,
  'full',
  '{"enabled_pages": ["/leads", "/orders", "/analytics", "/visits"]}',
  NOW()
);

-- ---------------------------------------------------------------------------
-- Step 2: Verify EDNA client was created
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_edna_id UUID;
BEGIN
  SELECT id INTO v_edna_id FROM clients WHERE slug = 'edna';
  IF v_edna_id IS NULL THEN
    RAISE EXCEPTION 'EDNA client was not created successfully';
  END IF;
  RAISE NOTICE 'EDNA client created with ID: %', v_edna_id;
END $$;

COMMIT;
