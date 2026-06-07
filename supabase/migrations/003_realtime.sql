-- ============================================================
-- 003_realtime.sql
-- AI-Driven Sales Agent — Realtime Pub/Sub Configuration
-- ============================================================
-- Enables Supabase Realtime streaming for specific tables.
-- This allows the Tailwind CSS dashboard to receive live updates
-- when new orders arrive or shop profiles are modified.
-- ============================================================


-- ====================================
-- ENABLE REALTIME FOR TARGET TABLES
-- ====================================
-- Add tables to the `supabase_realtime` publication group.
-- This enables PostgreSQL logical replication for these tables,
-- allowing Supabase Realtime to broadcast changes to subscribed clients.

-- First, drop the existing publication and recreate it with our tables
-- (Supabase creates a default `supabase_realtime` publication)

-- Remove tables from publication if they already exist (idempotent)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients_shops;


-- ====================================
-- REALTIME CONFIGURATION NOTES
-- ====================================
-- 
-- The dashboard will subscribe to these channels:
--
-- 1. orders (INSERT/UPDATE):
--    - New order arrives from AI agent → dashboard updates instantly
--    - Order status changes → dashboard reflects immediately
--
-- 2. clients_shops (UPDATE):
--    - Shop profile updates → dashboard refreshes profile data
--
-- Client-side subscription example (Supabase JS SDK):
--
--   const channel = supabase
--     .channel('orders-realtime')
--     .on('postgres_changes', {
--       event: '*',
--       schema: 'public',
--       table: 'orders',
--       filter: `shop_id=eq.${userId}`
--     }, (payload) => {
--       console.log('Order change:', payload);
--     })
--     .subscribe();
--
-- NOTE: Realtime respects RLS policies. Authenticated users will
-- only receive events for rows they have SELECT access to.
