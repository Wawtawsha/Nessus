-- =============================================================================
-- Migration: Script Analytics RPCs
-- =============================================================================
-- Purpose: Create three RPC functions for script analytics with date filtering.
--
-- Functions:
--   1. get_script_outcome_stats - Aggregates per-script success/fail stats
--   2. get_niche_performance_stats - Aggregates per-niche stats
--   3. get_script_niche_matrix - Cross-tabulation of script x niche
--
-- All three:
--   - Accept optional date range parameters (p_start_date, p_end_date)
--   - Use LEFT JOIN to preserve zero-outcome entities
--   - Use COUNT(o.id) for accurate total_count
--   - Include division-by-zero guard for win_rate calculation
--   - Use SECURITY DEFINER with client_id scoping for RLS bypass
-- =============================================================================

-- =============================================================================
-- Function 1: get_script_outcome_stats (upgraded from Phase 16)
-- =============================================================================
-- Drop old single-parameter version to avoid overload ambiguity.
-- The old signature get_script_outcome_stats(UUID) would conflict with the
-- new get_script_outcome_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) when called
-- with only p_client_id (relying on DEFAULT NULL for date params).
-- =============================================================================

DROP FUNCTION IF EXISTS get_script_outcome_stats(UUID);

-- =============================================================================
-- RPC: get_script_outcome_stats
-- =============================================================================
-- Purpose: Aggregate script outcome statistics for a given client with optional
--          date range filtering. Returns script metadata plus stats.
--
-- Parameters:
--   p_client_id UUID - Client to aggregate stats for
--   p_start_date TIMESTAMPTZ DEFAULT NULL - Start of date range (inclusive)
--   p_end_date TIMESTAMPTZ DEFAULT NULL - End of date range (inclusive)
--
-- Returns TABLE:
--   script_id UUID - Script identifier
--   script_title TEXT - Script title
--   is_active BOOLEAN - Whether script is currently active
--   success_count BIGINT - Count of outcomes where outcome='success'
--   fail_count BIGINT - Count of outcomes where outcome='fail'
--   total_count BIGINT - Total count of outcomes for this script
--   win_rate NUMERIC - (success_count / total_count) * 100, rounded to 1 decimal
--
-- Key behavior:
--   - Uses LEFT JOIN so scripts with zero outcomes appear with 0 counts
--   - Date filter applied in LEFT JOIN ON clause (NOT WHERE) to preserve zeros
--   - Uses COUNT(o.id) for total_count (not COUNT(*)) to correctly return 0
--     when no outcomes exist (COUNT(*) would return 1 due to LEFT JOIN)
--   - Shows ALL scripts including inactive (analytics needs historical view)
--   - Win rate is 0 when total_count is 0 (division by zero guard)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_script_outcome_stats(
  p_client_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  script_id UUID,
  script_title TEXT,
  is_active BOOLEAN,
  success_count BIGINT,
  fail_count BIGINT,
  total_count BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS script_id,
    s.title AS script_title,
    s.is_active,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'success'), 0)::BIGINT AS success_count,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'fail'), 0)::BIGINT AS fail_count,
    COUNT(o.id)::BIGINT AS total_count,
    CASE
      WHEN COUNT(o.id) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE o.outcome = 'success')::NUMERIC / COUNT(o.id)::NUMERIC) * 100, 1)
      ELSE
        0
    END AS win_rate
  FROM scripts s
  LEFT JOIN script_lead_outcomes o ON o.script_id = s.id
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
  WHERE s.client_id = p_client_id
  GROUP BY s.id, s.title, s.is_active
  ORDER BY total_count DESC, win_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_script_outcome_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
'Aggregates script outcome statistics (success/fail counts, total, win rate) per script for a given client.
Uses LEFT JOIN to include scripts with zero outcomes (returns 0 counts).
Shows ALL scripts including inactive ones (analytics needs historical view).
Supports optional date range filtering via p_start_date and p_end_date.
Win rate is calculated as (success_count / total_count) * 100, rounded to 1 decimal place.';

-- =============================================================================
-- Function 2: get_niche_performance_stats
-- =============================================================================
-- Purpose: Aggregate outcome statistics per niche for a given client with
--          optional date range filtering.
--
-- Parameters:
--   p_client_id UUID - Client to aggregate stats for
--   p_start_date TIMESTAMPTZ DEFAULT NULL - Start of date range (inclusive)
--   p_end_date TIMESTAMPTZ DEFAULT NULL - End of date range (inclusive)
--
-- Returns TABLE:
--   niche_id UUID - Niche identifier
--   niche_name TEXT - Niche name
--   success_count BIGINT - Count of successful outcomes
--   fail_count BIGINT - Count of failed outcomes
--   total_count BIGINT - Total count of outcomes
--   win_rate NUMERIC - (success_count / total_count) * 100, rounded to 1 decimal
--
-- Key behavior:
--   - Uses LEFT JOIN chain: niches -> leads -> script_lead_outcomes
--   - Date filter applied in outcomes LEFT JOIN ON clause
--   - Only includes niches used by the client's leads (via WHERE EXISTS)
--   - Uses COUNT(o.id) for accurate total_count with LEFT JOIN
--   - Win rate is 0 when total_count is 0 (division by zero guard)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_niche_performance_stats(
  p_client_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  niche_id UUID,
  niche_name TEXT,
  success_count BIGINT,
  fail_count BIGINT,
  total_count BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS niche_id,
    n.name AS niche_name,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'success'), 0)::BIGINT AS success_count,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'fail'), 0)::BIGINT AS fail_count,
    COUNT(o.id)::BIGINT AS total_count,
    CASE
      WHEN COUNT(o.id) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE o.outcome = 'success')::NUMERIC / COUNT(o.id)::NUMERIC) * 100, 1)
      ELSE
        0
    END AS win_rate
  FROM niches n
  LEFT JOIN leads l ON l.niche_id = n.id
  LEFT JOIN script_lead_outcomes o ON o.lead_id = l.id
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
  WHERE EXISTS (
    SELECT 1
    FROM leads
    WHERE niche_id = n.id
      AND client_id = p_client_id
  )
  GROUP BY n.id, n.name
  ORDER BY total_count DESC, win_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_niche_performance_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
'Aggregates outcome statistics per niche for a given client.
Uses LEFT JOIN to include niches with zero outcomes (returns 0 counts).
Only includes niches that have leads for the specified client.
Supports optional date range filtering via p_start_date and p_end_date.
Win rate is calculated as (success_count / total_count) * 100, rounded to 1 decimal place.';

-- =============================================================================
-- Function 3: get_script_niche_matrix
-- =============================================================================
-- Purpose: Cross-tabulation of scripts and niches with outcome statistics.
--          Shows which scripts perform best in which niches.
--
-- Parameters:
--   p_client_id UUID - Client to aggregate stats for
--   p_start_date TIMESTAMPTZ DEFAULT NULL - Start of date range (inclusive)
--   p_end_date TIMESTAMPTZ DEFAULT NULL - End of date range (inclusive)
--
-- Returns TABLE:
--   script_id UUID - Script identifier
--   script_title TEXT - Script title
--   niche_id UUID - Niche identifier
--   niche_name TEXT - Niche name
--   success_count BIGINT - Count of successful outcomes
--   fail_count BIGINT - Count of failed outcomes
--   total_count BIGINT - Total count of outcomes
--   win_rate NUMERIC - (success_count / total_count) * 100, rounded to 1 decimal
--
-- Key behavior:
--   - Uses CROSS JOIN to create all script x niche combinations
--   - LEFT JOINs leads and outcomes to get stats for each combination
--   - Date filter applied in outcomes LEFT JOIN ON clause
--   - HAVING filters to only show combinations where client has leads in that niche
--   - Uses COUNT(o.id) for accurate total_count with LEFT JOIN
--   - Win rate is 0 when total_count is 0 (division by zero guard)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_script_niche_matrix(
  p_client_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  script_id UUID,
  script_title TEXT,
  is_active BOOLEAN,
  niche_id UUID,
  niche_name TEXT,
  success_count BIGINT,
  fail_count BIGINT,
  total_count BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS script_id,
    s.title AS script_title,
    s.is_active,
    n.id AS niche_id,
    n.name AS niche_name,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'success'), 0)::BIGINT AS success_count,
    COALESCE(COUNT(*) FILTER (WHERE o.outcome = 'fail'), 0)::BIGINT AS fail_count,
    COUNT(o.id)::BIGINT AS total_count,
    CASE
      WHEN COUNT(o.id) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE o.outcome = 'success')::NUMERIC / COUNT(o.id)::NUMERIC) * 100, 1)
      ELSE
        0
    END AS win_rate
  FROM scripts s
  CROSS JOIN niches n
  LEFT JOIN leads l ON l.niche_id = n.id
    AND l.client_id = p_client_id
  LEFT JOIN script_lead_outcomes o ON o.script_id = s.id
    AND o.lead_id = l.id
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
  WHERE s.client_id = p_client_id
  GROUP BY s.id, s.title, s.is_active, n.id, n.name
  HAVING COUNT(l.id) > 0
  ORDER BY s.title, n.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_script_niche_matrix(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
'Cross-tabulation of scripts and niches with outcome statistics.
Shows performance of each script in each niche for a given client.
Includes is_active flag for inactive script visual distinction.
Uses CROSS JOIN with LEFT JOINs to preserve zero-outcome combinations.
Only returns script-niche pairs where the client has leads in that niche.
Supports optional date range filtering via p_start_date and p_end_date.
Win rate is calculated as (success_count / total_count) * 100, rounded to 1 decimal place.';
