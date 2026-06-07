-- ============================================================
-- 010_grants_for_dashboard.sql
-- P1.5+: Grant table access to anon/authenticated roles
-- ============================================================
-- Without these, RLS policies can't be evaluated because
-- the role has no privilege to use the table at all (403).
-- ============================================================

-- clients_shops
GRANT SELECT, UPDATE ON public.clients_shops TO authenticated;
GRANT INSERT ON public.clients_shops TO authenticated;

-- bot_settings
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_settings TO authenticated;

-- orders
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;

-- products
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- conversations
GRANT SELECT ON public.conversations TO authenticated;
GRANT INSERT ON public.conversations TO service_role;
GRANT SELECT ON public.conversations TO service_role;

-- workflow_logs (read-only for dashboard)
GRANT SELECT ON public.workflow_logs TO authenticated;

-- failed_messages (read-only for dashboard)
GRANT SELECT ON public.failed_messages TO authenticated;

-- signup_events (read-only for dashboard)
GRANT SELECT ON public.signup_events TO authenticated;

-- api_key_audit (read-only for dashboard)
GRANT SELECT ON public.api_key_audit TO authenticated;
