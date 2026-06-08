-- ============================================================
-- FULL_MIGRATION.sql
-- AI-Driven Sales Agent — Complete Database Setup
-- ============================================================
-- Run this SINGLE file to execute ALL migrations at once.
-- Execute via Supabase SQL Editor or psql CLI.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: CREATE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients_shops (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_name     TEXT NOT NULL,
    owner_name    TEXT NOT NULL,
    phone_number  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_settings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id          UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    prompt_context   TEXT NOT NULL DEFAULT '',
    target_dialect   TEXT NOT NULL DEFAULT 'Algerian Darija',
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id            UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    sender_id          TEXT NOT NULL,
    customer_name      TEXT,
    phone              TEXT,
    location_city      TEXT,
    product_requested  TEXT,
    quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    order_status       TEXT NOT NULL DEFAULT 'pending'
                       CHECK (order_status IN ('pending', 'confirmed', 'shipped')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_bot_settings_updated_at
    BEFORE UPDATE ON public.bot_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- STEP 2: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.clients_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;

-- clients_shops policies
CREATE POLICY "clients_shops_select_own" ON public.clients_shops
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "clients_shops_update_own" ON public.clients_shops
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "clients_shops_insert_own" ON public.clients_shops
    FOR INSERT WITH CHECK (auth.uid() = id);

-- bot_settings policies
CREATE POLICY "bot_settings_select_own" ON public.bot_settings
    FOR SELECT USING (auth.uid() = shop_id);

CREATE POLICY "bot_settings_insert_own" ON public.bot_settings
    FOR INSERT WITH CHECK (auth.uid() = shop_id);

CREATE POLICY "bot_settings_update_own" ON public.bot_settings
    FOR UPDATE USING (auth.uid() = shop_id) WITH CHECK (auth.uid() = shop_id);

CREATE POLICY "bot_settings_delete_own" ON public.bot_settings
    FOR DELETE USING (auth.uid() = shop_id);

-- orders policies
CREATE POLICY "orders_select_own" ON public.orders
    FOR SELECT USING (auth.uid() = shop_id);

CREATE POLICY "orders_insert_own" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = shop_id);

CREATE POLICY "orders_update_own" ON public.orders
    FOR UPDATE USING (auth.uid() = shop_id) WITH CHECK (auth.uid() = shop_id);


-- ============================================================
-- STEP 3: ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients_shops;


-- ============================================================
-- STEP 4: CREATE PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_sender ON public.orders(shop_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON public.orders(shop_id, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_settings_shop_id ON public.bot_settings(shop_id);
CREATE INDEX IF NOT EXISTS idx_bot_settings_active ON public.bot_settings(shop_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_clients_shops_created_at ON public.clients_shops(created_at DESC);

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies
-- SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public';

-- Check realtime publication
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Check indexes
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- ============================================================
-- ADDENDUM: contact_messages (inserted after original migration)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_messages_anon_insert" ON public.contact_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "contact_messages_admin_select" ON public.contact_messages
    FOR SELECT USING (auth.role() IS NOT NULL AND auth.role() IN ('admin', 'authenticated'));

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC);
