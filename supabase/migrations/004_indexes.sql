-- ============================================================
-- 004_indexes.sql
-- AI-Driven Sales Agent — Performance Indexes
-- ============================================================
-- Optimizes query performance for the most common access patterns:
--   - Dashboard loading (orders by shop_id)
--   - n8n sender deduplication (orders by sender_id + shop_id)
--   - Order filtering by status
--   - Bot settings lookup by shop
-- ============================================================


-- ====================================
-- INDEXES: orders
-- ====================================

-- Fast lookup of all orders for a specific shop (dashboard main view)
CREATE INDEX IF NOT EXISTS idx_orders_shop_id
    ON public.orders(shop_id);

-- Fast lookup by sender_id within a shop (deduplication in n8n)
CREATE INDEX IF NOT EXISTS idx_orders_shop_sender
    ON public.orders(shop_id, sender_id);

-- Filter orders by status within a shop (dashboard filtering)
CREATE INDEX IF NOT EXISTS idx_orders_shop_status
    ON public.orders(shop_id, order_status);

-- Sort orders by creation date (dashboard timeline view)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON public.orders(created_at DESC);


-- ====================================
-- INDEXES: bot_settings
-- ====================================

-- Fast lookup of bot settings for a specific shop
CREATE INDEX IF NOT EXISTS idx_bot_settings_shop_id
    ON public.bot_settings(shop_id);

-- Find only active bot configurations
CREATE INDEX IF NOT EXISTS idx_bot_settings_active
    ON public.bot_settings(shop_id)
    WHERE is_active = true;


-- ====================================
-- INDEXES: clients_shops
-- ====================================

-- The primary key on `id` already serves as the main index.
-- Add an index on created_at for admin reporting queries.
CREATE INDEX IF NOT EXISTS idx_clients_shops_created_at
    ON public.clients_shops(created_at DESC);
