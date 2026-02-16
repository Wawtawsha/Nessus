-- =============================================================================
-- RPC: get_script_outcome_stats
-- =============================================================================
-- Purpose: Aggregate script outcome statistics for a given client.
--          Returns success_count, fail_count, total_count, and win_rate for
--          each script, including scripts with zero outcomes (via LEFT JOIN).
--
-- Parameters:
--   p_client_id UUID - Client to aggregate stats for
--
-- Returns TABLE:
--   script_id UUID - Script identifier
--   success_count BIGINT - Count of outcomes where outcome='success'
--   fail_count BIGINT - Count of outcomes where outcome='fail'
--   total_count BIGINT - Total count of outcomes for this script
--   win_rate NUMERIC - (success_count / total_count) * 100, rounded to 1 decimal
--
-- Key behavior:
--   - Uses LEFT JOIN so scripts with zero outcomes appear with 0 counts
--   - Uses COUNT(o.id) for total_count (not COUNT(*)) to correctly return 0
--     when no outcomes exist (COUNT(*) would return 1 due to LEFT JOIN)
--   - Only returns active scripts (is_active = true)
--   - Win rate is 0 when total_count is 0 (division by zero guard)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_script_outcome_stats(
  p_client_id UUID
)
RETURNS TABLE (
  script_id UUID,
  success_count BIGINT,
  fail_count BIGINT,
  total_count BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS script_id,
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
  WHERE s.client_id = p_client_id
    AND s.is_active = true
  GROUP BY s.id
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_script_outcome_stats(UUID) IS
'Aggregates script outcome statistics (success/fail counts, total, win rate) per script for a given client.
Uses LEFT JOIN to include scripts with zero outcomes (returns 0 counts).
Only returns active scripts (is_active = true).
Win rate is calculated as (success_count / total_count) * 100, rounded to 1 decimal place.';
