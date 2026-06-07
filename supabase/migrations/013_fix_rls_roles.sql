-- ============================================================
-- 013_fix_rls_roles.sql
-- Tighten RLS policies: TO public → TO authenticated
-- ============================================================
-- Background: Several policies on clients_shops, bot_settings, and
-- orders were scoped to TO public, which includes the anon role.
-- This means anonymous (not-signed-in) users could attempt inserts
-- and updates. The USING/WITH CHECK auth.uid() predicates already
-- prevented cross-tenant writes, but allowing anon to hit the table
-- at all is a leak surface and shows up in security scans.
--
-- This migration drops the old policies and recreates them scoped
-- strictly to the authenticated role.
-- ============================================================


-- ====================================
-- clients_shops
-- ====================================

-- Drop and recreate clients_shops_select_own
DROP POLICY IF EXISTS "clients_shops_select_own" ON public.clients_shops;
CREATE POLICY "clients_shops_select_own"
    ON public.clients_shops
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Drop and recreate clients_shops_insert_own
DROP POLICY IF EXISTS "clients_shops_insert_own" ON public.clients_shops;
CREATE POLICY "clients_shops_insert_own"
    ON public.clients_shops
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Drop and recreate clients_shops_update_own
DROP POLICY IF EXISTS "clients_shops_update_own" ON public.clients_shops;
CREATE POLICY "clients_shops_update_own"
    ON public.clients_shops
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);


-- ====================================
-- bot_settings
-- ====================================

-- Drop and recreate bot_settings_select_own
DROP POLICY IF EXISTS "bot_settings_select_own" ON public.bot_settings;
CREATE POLICY "bot_settings_select_own"
    ON public.bot_settings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = shop_id);

-- Drop and recreate bot_settings_insert_own
DROP POLICY IF EXISTS "bot_settings_insert_own" ON public.bot_settings;
CREATE POLICY "bot_settings_insert_own"
    ON public.bot_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = shop_id);

-- Drop and recreate bot_settings_update_own
DROP POLICY IF EXISTS "bot_settings_update_own" ON public.bot_settings;
CREATE POLICY "bot_settings_update_own"
    ON public.bot_settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = shop_id)
    WITH CHECK (auth.uid() = shop_id);

-- Drop and recreate bot_settings_delete_own
DROP POLICY IF EXISTS "bot_settings_delete_own" ON public.bot_settings;
CREATE POLICY "bot_settings_delete_own"
    ON public.bot_settings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = shop_id);


-- ====================================
-- orders
-- ====================================

-- Drop and recreate orders_select_own
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own"
    ON public.orders
    FOR SELECT
    TO authenticated
    USING (auth.uid() = shop_id);

-- Drop and recreate orders_insert_own
-- NOTE: Inserts from n8n use the service_role key (bypasses RLS).
-- This policy is for authenticated dashboard users if needed.
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own"
    ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = shop_id);

-- Drop and recreate orders_update_own
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
CREATE POLICY "orders_update_own"
    ON public.orders
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = shop_id)
    WITH CHECK (auth.uid() = shop_id);


-- ============================================================
-- VERIFICATION
-- ============================================================
-- Run after migration to confirm:
--
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('clients_shops', 'bot_settings', 'orders')
-- ORDER BY tablename, policyname;
--
-- Expected: roles column should be {authenticated} for all
-- policies on these three tables.
-- ============================================================
