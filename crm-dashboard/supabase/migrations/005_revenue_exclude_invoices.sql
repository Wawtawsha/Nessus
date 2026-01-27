-- Add include_invoices parameter to revenue aggregation RPC

CREATE OR REPLACE FUNCTION get_revenue_by_period(
  p_granularity TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_client_id UUID DEFAULT NULL,
  p_include_invoices BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  period TEXT,
  revenue NUMERIC,
  order_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc(p_granularity, to_date(business_date::text, 'YYYYMMDD'))::date::text as period,
    COALESCE(SUM(total_amount), 0)::NUMERIC as revenue,
    COUNT(*)::BIGINT as order_count
  FROM toast_orders
  WHERE to_date(business_date::text, 'YYYYMMDD') >= p_start_date
    AND to_date(business_date::text, 'YYYYMMDD') <= p_end_date
    AND (p_client_id IS NULL OR client_id = p_client_id)
    AND voided = false
    AND (p_include_invoices = true OR source IS DISTINCT FROM 'Invoice')
  GROUP BY date_trunc(p_granularity, to_date(business_date::text, 'YYYYMMDD'))
  ORDER BY period ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_revenue_by_period(TEXT, DATE, DATE, UUID, BOOLEAN) IS
'Aggregates revenue from toast_orders by time period (day/week/month).
Excludes voided orders. Pass NULL for p_client_id to get all clients.
Pass true for p_include_invoices to include Invoice source orders (excluded by default).';
