-- ============================================================
-- 007_metrics_views.sql
-- Production: Analytics views for dashboard & alerts
-- ============================================================

-- =========================
-- VIEW: v_orders_per_hour
-- =========================
CREATE OR REPLACE VIEW public.v_orders_per_hour AS
SELECT
    date_trunc('hour', created_at) AS hour,
    shop_id,
    count(*) AS order_count,
    sum(quantity) AS total_units
FROM public.orders
WHERE created_at > now() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- =========================
-- VIEW: v_success_rate (per hour)
-- =========================
CREATE OR REPLACE VIEW public.v_success_rate AS
SELECT
    date_trunc('hour', created_at) AS hour,
    count(*) FILTER (WHERE status = 'success')   AS success_count,
    count(*) FILTER (WHERE status = 'error')     AS error_count,
    count(*) FILTER (WHERE status = 'warning')   AS warning_count,
    count(*) AS total_count,
    CASE WHEN count(*) = 0 THEN 100
         ELSE round((count(*) FILTER (WHERE status = 'success'))::numeric
                    / count(*)::numeric * 100, 2)
    END AS success_pct
FROM public.workflow_logs
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;

-- =========================
-- VIEW: v_avg_latency_per_stage
-- =========================
CREATE OR REPLACE VIEW public.v_avg_latency_per_stage AS
SELECT
    stage,
    count(*) AS samples,
    round(avg(latency_ms)::numeric, 1)  AS avg_ms,
    round((percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms))::numeric, 1) AS p50_ms,
    round((percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::numeric, 1) AS p95_ms,
    round((percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms))::numeric, 1) AS p99_ms
FROM public.workflow_logs
WHERE created_at > now() - INTERVAL '24 hours'
  AND latency_ms IS NOT NULL
GROUP BY stage
ORDER BY stage;

-- =========================
-- VIEW: v_dlq_summary
-- =========================
CREATE OR REPLACE VIEW public.v_dlq_summary AS
SELECT
    status,
    count(*) AS message_count,
    min(created_at) AS oldest,
    max(created_at) AS newest
FROM public.failed_messages
GROUP BY status;

-- =========================
-- VIEW: v_top_products
-- =========================
CREATE OR REPLACE VIEW public.v_top_products AS
SELECT
    shop_id,
    product_requested,
    count(*)         AS order_count,
    sum(quantity)    AS total_units,
    max(created_at)  AS last_ordered_at
FROM public.orders
WHERE created_at > now() - INTERVAL '30 days'
  AND product_requested IS NOT NULL
GROUP BY shop_id, product_requested
ORDER BY order_count DESC;

-- =========================
-- VIEW: v_shop_daily_stats
-- =========================
CREATE OR REPLACE VIEW public.v_shop_daily_stats AS
SELECT
    shop_id,
    date_trunc('day', created_at) AS day,
    count(*)          AS orders_count,
    sum(quantity)     AS total_units,
    count(DISTINCT sender_id) AS unique_customers,
    count(*) FILTER (WHERE order_status = 'confirmed') AS confirmed_count,
    count(*) FILTER (WHERE order_status = 'shipped')   AS shipped_count
FROM public.orders
WHERE created_at > now() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 2 DESC, 1;

-- Grant access to authenticated users
GRANT SELECT ON public.v_orders_per_hour     TO authenticated;
GRANT SELECT ON public.v_success_rate        TO authenticated;
GRANT SELECT ON public.v_avg_latency_per_stage TO authenticated;
GRANT SELECT ON public.v_dlq_summary         TO authenticated;
GRANT SELECT ON public.v_top_products        TO authenticated;
GRANT SELECT ON public.v_shop_daily_stats    TO authenticated;

GRANT SELECT ON public.v_orders_per_hour     TO service_role;
GRANT SELECT ON public.v_success_rate        TO service_role;
GRANT SELECT ON public.v_avg_latency_per_stage TO service_role;
GRANT SELECT ON public.v_dlq_summary         TO service_role;
GRANT SELECT ON public.v_top_products        TO service_role;
GRANT SELECT ON public.v_shop_daily_stats    TO service_role;
