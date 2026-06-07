-- ============================================================
-- 014_views_security_invoker.sql
-- Add security_invoker = true to all public views
-- ============================================================
-- Background: Postgres views bypass RLS by default (the view is
-- executed as the view owner, who typically has bypassrls). On
-- Supabase, this means the v_* analytics views would currently
-- return rows from ALL shops if hit by an authenticated user,
-- not just the calling user's shop.
--
-- Setting security_invoker = true on a view causes it to be
-- executed with the privileges and RLS policies of the calling
-- user, the same as a base table query.
--
-- This requires Postgres 15+ (Supabase runs PG 15+).
-- ============================================================


-- ====================================
-- v_avg_latency_per_stage
-- ====================================
-- Backed by: workflow_logs
-- RLS already gates workflow_logs to the caller's shop via the
-- `shop_view_own_workflow_logs` policy. Enabling security_invoker
-- makes the view honor that policy directly.
ALTER VIEW public.v_avg_latency_per_stage SET (security_invoker = true);


-- ====================================
-- v_dlq_summary
-- ====================================
-- Backed by: failed_messages
-- RLS policy `shop_view_own_failed_messages` filters by shop_id.
ALTER VIEW public.v_dlq_summary SET (security_invoker = true);


-- ====================================
-- v_orders_per_hour
-- ====================================
-- Backed by: orders
-- RLS policy `orders_select_own` filters by shop_id.
-- Note: this view aggregates ALL shops' rows in its GROUP BY
-- because there is no shop_id filter in the view definition. With
-- security_invoker, it will be called as the authenticated user,
-- so the underlying orders SELECT will only return their own shop.
-- The aggregate result will then be limited to that shop's data.
ALTER VIEW public.v_orders_per_hour SET (security_invoker = true);


-- ====================================
-- v_shop_daily_stats
-- ====================================
-- Backed by: orders
-- Same reasoning as v_orders_per_hour. shop_id is included in the
-- GROUP BY, so with security_invoker the aggregate is restricted
-- to the caller's own shop.
ALTER VIEW public.v_shop_daily_stats SET (security_invoker = true);


-- ====================================
-- v_success_rate
-- ====================================
-- Backed by: workflow_logs
-- RLS policy `shop_view_own_workflow_logs` applies.
ALTER VIEW public.v_success_rate SET (security_invoker = true);


-- ====================================
-- v_top_products
-- ====================================
-- Backed by: orders
-- RLS policy `orders_select_own` applies. shop_id is in GROUP BY
-- so results are naturally scoped per shop.
ALTER VIEW public.v_top_products SET (security_invoker = true);


-- ============================================================
-- VERIFICATION
-- ============================================================
-- Run after migration to confirm:
--
-- SELECT c.relname AS view_name,
--        c.reloptions
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'v'
-- ORDER BY c.relname;
--
-- Expected: reloptions for each view should contain
-- {security_invoker=true}.
-- ============================================================
