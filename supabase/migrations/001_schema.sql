-- ============================================================
-- 001_schema.sql
-- AI-Driven Sales Agent — Database Schema
-- ============================================================
-- This migration creates the core tables for the SaaS platform:
--   1. clients_shops  — SaaS tenant accounts (linked to auth.users)
--   2. bot_settings   — AI agent configuration per shop
--   3. orders         — Extracted leads/conversions from social channels
-- ============================================================

-- =========================
-- TABLE: clients_shops
-- =========================
-- Represents each SaaS tenant (shop owner).
-- The `id` column references Supabase Auth users directly,
-- ensuring a 1:1 relationship between an auth user and a shop.

CREATE TABLE IF NOT EXISTS public.clients_shops (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_name     TEXT NOT NULL,
    owner_name    TEXT NOT NULL,
    phone_number  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.clients_shops IS 'SaaS tenant accounts — each row represents one shop/business owner';
COMMENT ON COLUMN public.clients_shops.id IS 'References auth.users(id) — one auth user = one shop';
COMMENT ON COLUMN public.clients_shops.shop_name IS 'Business/shop display name';
COMMENT ON COLUMN public.clients_shops.owner_name IS 'Full name of the shop owner';
COMMENT ON COLUMN public.clients_shops.phone_number IS 'Primary contact phone number';


-- =========================
-- TABLE: bot_settings
-- =========================
-- Stores the AI agent context and configuration for each shop.
-- Each shop can have one active bot configuration that includes
-- the product catalog, pricing rules, FAQ, and dialect preferences.

CREATE TABLE IF NOT EXISTS public.bot_settings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id          UUID NOT NULL REFERENCES public.clients_shops(id) ON DELETE CASCADE,
    prompt_context   TEXT NOT NULL DEFAULT '',
    target_dialect   TEXT NOT NULL DEFAULT 'Algerian Darija',
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.bot_settings IS 'AI agent configuration per shop — catalog, rules, dialect';
COMMENT ON COLUMN public.bot_settings.shop_id IS 'FK to clients_shops.id — which shop this config belongs to';
COMMENT ON COLUMN public.bot_settings.prompt_context IS 'Full context injected into LLM: catalog, pricing, FAQ, rules';
COMMENT ON COLUMN public.bot_settings.target_dialect IS 'Target language/dialect for AI responses';
COMMENT ON COLUMN public.bot_settings.is_active IS 'Whether this bot configuration is currently active';


-- =========================
-- TABLE: orders
-- =========================
-- Stores extracted leads and conversions from social channel conversations.
-- Each order is linked to a shop and contains the parsed customer data
-- extracted by the AI sales agent from the conversation.

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

COMMENT ON TABLE  public.orders IS 'Extracted leads/conversions from social channel AI conversations';
COMMENT ON COLUMN public.orders.shop_id IS 'FK to clients_shops.id — which shop received this order';
COMMENT ON COLUMN public.orders.sender_id IS 'Unique social profile ID of the customer (IG/WA)';
COMMENT ON COLUMN public.orders.customer_name IS 'Customer name extracted by AI (nullable until captured)';
COMMENT ON COLUMN public.orders.phone IS 'Customer phone extracted by AI (nullable until captured)';
COMMENT ON COLUMN public.orders.location_city IS 'Delivery city extracted by AI (nullable until captured)';
COMMENT ON COLUMN public.orders.product_requested IS 'Product name/description requested by customer';
COMMENT ON COLUMN public.orders.quantity IS 'Number of units requested (minimum 1)';
COMMENT ON COLUMN public.orders.order_status IS 'Current status: pending → confirmed → shipped';


-- =========================
-- AUTO-UPDATE TRIGGER
-- =========================
-- Automatically update `updated_at` timestamp on row modification.

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to bot_settings
CREATE TRIGGER set_bot_settings_updated_at
    BEFORE UPDATE ON public.bot_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Apply trigger to orders
CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
