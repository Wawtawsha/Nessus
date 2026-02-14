-- =============================================================================
-- Migration: Cold Calling Client + Lead Qualification Fields
-- =============================================================================
-- Purpose: Add qualification fields to leads table (has_website,
--          social_media_presence), create client_type column for client
--          classification, and insert Cold Calling as a leads-only client.
--
-- Tables affected: leads, clients
--
-- Changes:
--   1. leads: Add has_website (boolean, nullable) and social_media_presence
--      (integer 1-5, nullable) for cold-calling qualification workflow
--   2. clients: Add client_type (text, default 'full') to differentiate
--      full-feature clients from leads-only clients
--   3. Insert Cold Calling client with client_type='leads_only'
--
-- Rollback strategy:
--   1. DELETE FROM clients WHERE slug = 'cold-calling';
--   2. ALTER TABLE clients DROP COLUMN client_type;
--   3. ALTER TABLE leads DROP COLUMN social_media_presence;
--   4. ALTER TABLE leads DROP COLUMN has_website;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Add qualification fields to leads table
-- ---------------------------------------------------------------------------
-- has_website: Boolean indicator for web presence (null = not assessed yet)
ALTER TABLE leads
ADD COLUMN has_website BOOLEAN DEFAULT NULL;

-- social_media_presence: 1-5 scale for social media engagement level
-- (null = not assessed yet, 1 = minimal, 5 = very active)
ALTER TABLE leads
ADD COLUMN social_media_presence INTEGER DEFAULT NULL
  CHECK (social_media_presence IS NULL OR (social_media_presence >= 1 AND social_media_presence <= 5));

-- ---------------------------------------------------------------------------
-- Step 2: Add client_type column to clients table
-- ---------------------------------------------------------------------------
-- client_type: Classifies client display behavior in UI
--   - 'full' (default): Shows all tabs (Leads, Orders, Pipeline, Analytics, Visits)
--   - 'leads_only': Shows only Leads tab (for cold-calling workflow)
ALTER TABLE clients
ADD COLUMN client_type TEXT NOT NULL DEFAULT 'full';

-- ---------------------------------------------------------------------------
-- Step 3: Insert Cold Calling client
-- ---------------------------------------------------------------------------
-- This client is used for manual lead entry without orders/visits tracking
INSERT INTO clients (id, name, slug, is_active, client_type, created_at)
VALUES (
  gen_random_uuid(),
  'Cold Calling',
  'cold-calling',
  true,
  'leads_only',
  NOW()
);

COMMIT;
