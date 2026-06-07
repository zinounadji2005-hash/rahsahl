-- ============================================================
-- 018_unique_bot_settings_shop_id.sql
-- Add UNIQUE constraint on bot_settings.shop_id to enable
-- ON CONFLICT upserts from the dashboard.
-- ============================================================
-- Without this, the onboarding flow's `upsert(..., {onConflict:'shop_id'})`
-- fails with "no unique or exclusion constraint matching the ON CONFLICT
-- specification" (Postgres 42P10).
--
-- The constraint also enforces the 1:1 invariant the schema implies:
-- every shop has at most one bot_settings row.


-- ====================================
-- 1. Check for duplicates first (run manually before applying)
-- ====================================
-- SELECT shop_id, COUNT(*) FROM public.bot_settings
-- GROUP BY shop_id HAVING COUNT(*) > 1;
-- Expected: 0 rows. If duplicates exist, merge them first.


-- ====================================
-- 2. Add the unique constraint
-- ====================================
ALTER TABLE public.bot_settings
  ADD CONSTRAINT bot_settings_shop_id_key UNIQUE (shop_id);


-- ====================================
-- 3. Helpful index (constraint creates one, but explicit for clarity)
-- ====================================
CREATE INDEX IF NOT EXISTS idx_bot_settings_shop_id ON public.bot_settings(shop_id);


-- ============================================================
-- VERIFICATION
-- ============================================================
-- \d bot_settings
-- Should show:
--   "bot_settings_shop_id_key" UNIQUE CONSTRAINT, btree (shop_id)
