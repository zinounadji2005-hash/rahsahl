-- ============================================================
-- 002_rls_policies.sql
-- AI-Driven Sales Agent — Row Level Security Policies
-- ============================================================
-- Enforces strict tenant isolation:
--   - Shop owners can ONLY read/write their own data
--   - n8n backend uses service_role_key (bypasses RLS)
--   - Dashboard users authenticate via Supabase Auth
-- ============================================================


-- ====================================
-- ENABLE RLS ON ALL TABLES
-- ====================================

ALTER TABLE public.clients_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;


-- ====================================
-- POLICIES: clients_shops
-- ====================================
-- The `id` column IS the auth user's UUID, so we match auth.uid() = id

-- Allow shop owners to read their own profile
CREATE POLICY "clients_shops_select_own"
    ON public.clients_shops
    FOR SELECT
    USING (auth.uid() = id);

-- Allow shop owners to update their own profile
CREATE POLICY "clients_shops_update_own"
    ON public.clients_shops
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow new users to insert their own profile during onboarding
CREATE POLICY "clients_shops_insert_own"
    ON public.clients_shops
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Prevent shop owners from deleting their profile via API
-- (Account deletion should be handled through admin/service_role)


-- ====================================
-- POLICIES: bot_settings
-- ====================================
-- Match auth.uid() = shop_id for all operations

-- Allow shop owners to read their bot settings
CREATE POLICY "bot_settings_select_own"
    ON public.bot_settings
    FOR SELECT
    USING (auth.uid() = shop_id);

-- Allow shop owners to insert new bot settings
CREATE POLICY "bot_settings_insert_own"
    ON public.bot_settings
    FOR INSERT
    WITH CHECK (auth.uid() = shop_id);

-- Allow shop owners to update their bot settings
CREATE POLICY "bot_settings_update_own"
    ON public.bot_settings
    FOR UPDATE
    USING (auth.uid() = shop_id)
    WITH CHECK (auth.uid() = shop_id);

-- Allow shop owners to delete their bot settings
CREATE POLICY "bot_settings_delete_own"
    ON public.bot_settings
    FOR DELETE
    USING (auth.uid() = shop_id);


-- ====================================
-- POLICIES: orders
-- ====================================
-- Match auth.uid() = shop_id
-- NOTE: INSERT from n8n uses service_role_key (bypasses RLS).
--       The INSERT policy below is for direct dashboard inserts if needed.

-- Allow shop owners to view their own orders
CREATE POLICY "orders_select_own"
    ON public.orders
    FOR SELECT
    USING (auth.uid() = shop_id);

-- Allow order insertion (for service_role or authenticated shop owner)
CREATE POLICY "orders_insert_own"
    ON public.orders
    FOR INSERT
    WITH CHECK (auth.uid() = shop_id);

-- Allow shop owners to update their orders (e.g., change status)
CREATE POLICY "orders_update_own"
    ON public.orders
    FOR UPDATE
    USING (auth.uid() = shop_id)
    WITH CHECK (auth.uid() = shop_id);

-- Orders should not be deletable from the frontend
-- (Soft-delete or archival should be handled via status changes)
