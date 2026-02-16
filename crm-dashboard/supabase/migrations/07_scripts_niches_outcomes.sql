-- =============================================================================
-- Migration: Cold Calling Scripts + Niches + Outcomes
-- =============================================================================
-- Purpose: Create foundational schema for v1.4 Cold Calling Scripts feature.
--          Adds niches taxonomy (global), scripts library (client-scoped),
--          script_lead_outcomes junction table, and niche_id on leads.
--
-- Tables created: niches, scripts, script_lead_outcomes
-- Tables affected: leads
--
-- Changes:
--   1. niches: Global taxonomy table with unique lowercase-normalized names
--   2. scripts: Client-scoped call scripts with soft delete (is_active)
--   3. script_lead_outcomes: Junction table tracking script usage on leads
--   4. leads: Add niche_id (nullable, FK to niches with ON DELETE SET NULL)
--
-- Rollback strategy:
--   1. ALTER TABLE leads DROP COLUMN niche_id;
--   2. DROP TABLE script_lead_outcomes;
--   3. DROP TABLE scripts;
--   4. DROP TABLE niches;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Create niches table (global taxonomy)
-- ---------------------------------------------------------------------------
-- Niches are shared across all clients (e.g., "restaurant", "retail", "law").
-- Names are normalized to lowercase and unique to prevent duplicates.
-- Niches are immutable (create or delete, not rename).
CREATE TABLE niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints: Ensure name is not empty, lowercase, and max 100 chars
  CONSTRAINT niche_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT niche_name_lowercase CHECK (name = lower(name)),
  CONSTRAINT niche_name_length CHECK (char_length(name) <= 100)
);

-- Index on name for fast lookups and uniqueness enforcement
CREATE INDEX idx_niches_name ON niches(name);

-- Enable RLS
ALTER TABLE niches ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Niches are global, all authenticated users can read/create/delete
CREATE POLICY niches_select ON niches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY niches_insert ON niches
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY niches_delete ON niches
  FOR DELETE
  TO authenticated
  USING (true);

-- No UPDATE policy: niches are immutable (create or delete, not rename)

-- ---------------------------------------------------------------------------
-- Step 2: Create scripts table (client-scoped)
-- ---------------------------------------------------------------------------
-- Scripts belong to a specific client and can be soft-deleted (is_active).
-- RLS policies scope to user's accessible clients via user_clients join.
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraint: Title must not be empty
  CONSTRAINT scripts_title_not_empty CHECK (char_length(trim(title)) > 0)
);

-- Index on client_id for fast client-scoped queries
CREATE INDEX idx_scripts_client_id ON scripts(client_id);

-- Enable RLS
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Scope to user's clients via user_clients join
CREATE POLICY scripts_select ON scripts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_clients uc
      WHERE uc.client_id = scripts.client_id
        AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY scripts_insert ON scripts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_clients uc
      WHERE uc.client_id = scripts.client_id
        AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY scripts_update ON scripts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_clients uc
      WHERE uc.client_id = scripts.client_id
        AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY scripts_delete ON scripts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_clients uc
      WHERE uc.client_id = scripts.client_id
        AND uc.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Step 3: Create script_lead_outcomes table
-- ---------------------------------------------------------------------------
-- Junction table tracking which scripts were used on which leads, with outcome.
-- UNIQUE(script_id, lead_id) allows upsert pattern for updating outcomes.
-- RLS policies scope through scripts -> user_clients chain.
CREATE TABLE script_lead_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraint: outcome must be 'success' or 'fail'
  CONSTRAINT outcome_valid CHECK (outcome IN ('success', 'fail')),

  -- Constraint: Each lead can have at most one outcome per script
  CONSTRAINT unique_script_lead UNIQUE (script_id, lead_id)
);

-- Indexes for fast lookups by script_id and lead_id
CREATE INDEX idx_slo_script_id ON script_lead_outcomes(script_id);
CREATE INDEX idx_slo_lead_id ON script_lead_outcomes(lead_id);

-- Enable RLS
ALTER TABLE script_lead_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Scope through scripts -> user_clients chain
CREATE POLICY slo_select ON script_lead_outcomes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scripts s
      JOIN user_clients uc ON uc.client_id = s.client_id
      WHERE s.id = script_lead_outcomes.script_id
        AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY slo_insert ON script_lead_outcomes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scripts s
      JOIN user_clients uc ON uc.client_id = s.client_id
      WHERE s.id = script_lead_outcomes.script_id
        AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY slo_update ON script_lead_outcomes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scripts s
      JOIN user_clients uc ON uc.client_id = s.client_id
      WHERE s.id = script_lead_outcomes.script_id
        AND uc.user_id = auth.uid()
    )
  );

CREATE POLICY slo_delete ON script_lead_outcomes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scripts s
      JOIN user_clients uc ON uc.client_id = s.client_id
      WHERE s.id = script_lead_outcomes.script_id
        AND uc.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Step 4: Add niche_id to leads table
-- ---------------------------------------------------------------------------
-- Links leads to niches for categorization in cold-calling workflow.
-- ON DELETE SET NULL: Deleting a niche doesn't delete leads, just unlinks them.
ALTER TABLE leads
ADD COLUMN niche_id UUID REFERENCES niches(id) ON DELETE SET NULL;

-- Index for fast niche-scoped queries
CREATE INDEX idx_leads_niche_id ON leads(niche_id);

COMMIT;
