-- 012_clients_shops_is_active.sql
-- Add is_active column to clients_shops for verify-hmac
ALTER TABLE public.clients_shops
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
